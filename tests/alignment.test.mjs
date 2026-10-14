import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,validate,place,MODULES,STATES} from '../public/model.js';
import {CHAMBER,WALLS,WALL_UNITS,wallPoint,wallRegions} from '../public/geometry.js';
import {buildScene,sceneBounds,sceneToSVG} from '../public/scene.js';
import {APERTURES,REFERENCE} from '../public/illustration-style.js';
import {clipNativePath} from '../public/path-clipping.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const points=ops=>{
 const result=[];let current,start;
 for(const {op,v}of ops){
  if(op==='M'){current=v;start=v;result.push(v);}
  else if(op==='L'){current=v;result.push(v);}
  else if(op==='Z'){current=start;result.push(start);}
  else if(op==='C'){
   const a=current,b=v.slice(0,2),c=v.slice(2,4),d=v.slice(4);
   for(let i=1;i<=40;i++){const t=i/40,u=1-t;result.push([0,1].map(k=>u**3*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t**3*d[k]));}
   current=d;
  }
 }
 return result;
};
const inPolygon=(polygon,p)=>{
 const signs=polygon.map((a,i)=>{const b=polygon[(i+1)%polygon.length];return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);});
 return signs.every(v=>v>=-1e-7)||signs.every(v=>v<=1e-7);
};

test('all eight installation rows span the original wall planes from ceiling to floor without a reserved strip',()=>{
 assert.deepEqual(WALLS.perspective.left,[[340,65],[465,155],[465,515],[340,635]]);
 assert.deepEqual(WALLS.perspective.right,[[815,155],[940,65],[940,635],[815,515]]);
 for(const side of ['left','right']){
  const wall=WALLS.perspective[side],roof=side==='left'?[CHAMBER.ceiling[0],CHAMBER.ceiling[3]]:[CHAMBER.ceiling[2],CHAMBER.ceiling[1]];
  for(let i=0;i<2;i++)assert.deepEqual(wallPoint(wall,i,0),roof[i]);
  const feet=side==='left'?[CHAMBER.floor[3],CHAMBER.floor[0]]:[CHAMBER.floor[1],CHAMBER.floor[2]];
  for(let i=0;i<2;i++)assert.deepEqual(wallPoint(wall,i,1),feet[i]);
  const s=initial();s.walls={left:[],right:[]};
  const cells=wallRegions(s,true).filter(r=>r.wall===side);
  assert.equal(cells.length,24);
  for(let col=0;col<3;col++)for(let row=0;row<8;row++){
   const cell=cells.find(c=>c.col===col&&c.row===row);
   const expected=[[col/3,row/8],[(col+1)/3,row/8],[(col+1)/3,(row+1)/8],[col/3,(row+1)/8]].map(([u,v])=>wallPoint(wall,u,v));
   assert.deepEqual(cell.points,expected);
  }
 }
});

test('single-row modules are 2:1 and two-row modules are square in both front diagrams',()=>{
 assert.deepEqual(WALL_UNITS,{width:6,height:8});
 for(const view of ['front','combined']){
  const s=initial();s.view=view;s.walls={left:[],right:[]};
  for(const cell of wallRegions(s,true).filter(r=>r.mode==='front')){
   const [a,b,,d]=cell.points,w=Math.hypot(b[0]-a[0],b[1]-a[1]),h=Math.hypot(d[0]-a[0],d[1]-a[1]);
   near(w/h,2);near(w/(2*h),1);
  }
 }
});

test('every row is installable and all device types render at every legal anchor',()=>{
 let filled=initial();filled.walls={left:[],right:[]};filled.effects=false;filled.rat.visible=false;
 for(const side of ['left','right'])for(let col=0;col<3;col++)for(let row=0;row<8;row++)filled=place(filled,side,col,row,'house');
 const valid=validate(filled),scene=buildScene(valid,[]);
 for(const side of ['left','right']){
  assert.equal(valid.walls[side].length,24);
  for(const m of valid.walls[side])assert.ok(scene.some(p=>p.owner===`${side} House light column ${m.col+1} row ${m.row+1}`));
 }
 for(const side of ['left','right'])for(let col=0;col<3;col++)for(const type of Object.keys(MODULES))for(let row=0;row<=8-MODULES[type].h;row++)for(const state of Object.keys(STATES[type])){
  const s=initial();s.rat.visible=false;s.effects=false;s.walls={left:[],right:[]};s.walls[side]=[{type,state,col,row}];
  const devices=buildScene(validate(s),[]).filter(p=>p.owner.startsWith(side+' ')&&p.owner.includes(' column '));
  assert.ok(devices.length>0);assert.ok(devices.every(p=>p.ops.every(o=>o.v.every(Number.isFinite))));
  const bounds=sceneBounds(devices);assert.ok(bounds.y>CHAMBER.bounds.y&&bounds.y+bounds.height<CHAMBER.floor[3][1]);
  assert.ok(bounds.x>CHAMBER.bounds.x&&bounds.x+bounds.width<CHAMBER.bounds.x+CHAMBER.bounds.width,`${side} ${type} at ${col},${row} extends outside the chamber`);
 }
});

test('roof and inner frame stay behind all installation rows while the outer rim stays in front',()=>{
 const s=initial();s.rat.visible=false;const scene=buildScene(s,[]);
 const floor=scene.findIndex(p=>p.owner==='Floor'),ceiling=scene.findIndex(p=>p.owner==='Box glass ceiling');
 assert.ok(ceiling<floor);
 for(const owner of ['left wall','right wall','Box frame'])assert.ok(scene.findLastIndex(p=>p.owner===owner)>floor);
 const outer=scene.findIndex(p=>p.owner==='Box outer frame');
 const frameEnd=scene.findLastIndex(p=>p.owner==='Box frame');
 assert.ok(scene.filter(p=>p.owner.includes(' column ')).every(p=>scene.indexOf(p)>frameEnd&&scene.indexOf(p)<outer));
});

test('lamps in consecutive installation rows have a visible gap instead of covering one another',()=>{
 for(const side of ['left','right'])for(let col=0;col<3;col++){
  const s=initial();s.rat.visible=false;s.effects=false;s.walls={left:[],right:[]};
  s.walls[side]=Array.from({length:8},(_,row)=>({type:'house',state:'on',col,row}));
  const scene=buildScene(s,[]),boxes=s.walls[side].map(m=>sceneBounds(scene.filter(p=>p.owner===`${side} House light column ${col+1} row ${m.row+1}`)));
  for(let row=1;row<8;row++)assert.ok(boxes[row].y-(boxes[row-1].y+boxes[row-1].height)>1,`${side} column ${col}: lamps ${row} and ${row+1} overlap`);
 }
});

test('protruding devices render far to near regardless of the order they were installed',()=>{
 for(const side of ['left','right']){
  const s=initial();s.effects=false;s.rat.visible=false;s.walls={left:[],right:[]};
  s.walls[side]=[{type:'house',state:'on',col:0,row:2},{type:'house',state:'on',col:2,row:2}];
  const original=JSON.stringify(s),scene=buildScene(s,[]);
  assert.equal(JSON.stringify(s),original,'Drawing changed the saved configuration');
  const owners=[...new Set(scene.filter(p=>p.owner.includes('House light column')).map(p=>p.owner))];
  assert.match(owners[0],new RegExp(`column ${side==='left'?3:1} row 3$`));
  const reversed=structuredClone(s);reversed.walls[side].reverse();
  assert.equal(sceneToSVG(scene),sceneToSVG(buildScene(reversed,[])));
 }
});

test('native lever plates protrude toward the chamber interior on both walls',()=>{
 for(const side of ['left','right'])for(let col=0;col<3;col++)for(const row of [0,7]){
  const s=initial();s.rat.visible=false;s.walls={left:[],right:[]};s.walls[side]=[{type:'lever',state:'extended',col,row}];
  const plate=buildScene(s,[]).filter(p=>p.owner===`${side} Lever column ${col+1} row ${row+1}`);
  const root=wallPoint(WALLS.perspective[side],(col*2+1)/6,(row+.46)/8);
  for(const p of plate.flatMap(p=>points(p.ops)))assert.ok(side==='left'?p[0]>=root[0]-1e-8:p[0]<=root[0]+1e-8);
 }
});

test('native clipping splits a cubic exactly without stroking the new aperture edge',()=>{
 const curve=[{op:'M',v:[-2,0]},{op:'C',v:[-2,2,2,2,2,0]},{op:'Z',v:[]}];
 const aperture=[[0,-3],[3,-3],[3,3],[0,3]];
 for(const polygon of [aperture,aperture.toReversed()]){
  const clipped=clipNativePath(curve,polygon),c=clipped.fillOps.find(o=>o.op==='C');
  c.v.forEach((v,i)=>near(v,[1,1.5,2,1,2,0][i]));
  assert.ok(clipped.fillOps.some(o=>o.op==='Z'));
  assert.ok(points(clipped.fillOps).every(p=>inPolygon(aperture,p)));
  const strokes=clipped.strokeOps.flatMap(points);
  assert.ok(strokes.every(p=>inPolygon(aperture,p)));
  assert.ok(!strokes.some(p=>Math.abs(p[0])<1e-7&&p[1]>.01&&p[1]<1.49),'A false vertical edge was added to the cup');
 }
 const inside=[[.1,.1],[.4,.1],[.4,.4],[.1,.4]],clipped=clipNativePath(curve,inside);
 assert.ok(clipped.fillOps.length>0);assert.equal(clipped.strokeOps.length,0);
 assert.ok(points(clipped.fillOps).every(p=>inPolygon(inside,p)));
});

test('clipping retains separate visible runs when a cubic crosses the aperture three times',()=>{
 const ops=[{op:'M',v:[-1,0]},{op:'C',v:[3,1,-3,2,1,3]}];
 const clipped=clipNativePath(ops,[[0,-1],[5,-1],[5,4],[0,4]]);
 assert.equal(clipped.strokeOps.length,2);
 assert.ok(clipped.strokeOps.every(run=>run.some(o=>o.op==='C')));
 assert.ok(clipped.strokeOps.flatMap(points).every(p=>p[0]>=-1e-7));
});

test('the source cup and liquid stay inside the reference recess as editable curves',()=>{
 for(const p of REFERENCE.waterCup){
  const clipped=clipNativePath(p.ops,APERTURES.waterCup);
  assert.ok(points(clipped.fillOps).every(p=>inPolygon(APERTURES.waterCup,p)));
  assert.ok(clipped.strokeOps.flatMap(points).every(p=>inPolygon(APERTURES.waterCup,p)));
  assert.ok(clipped.fillOps.some(o=>o.op==='C'));
 }
 for(const view of ['perspective','front','combined'])for(const side of ['left','right'])for(let col=0;col<3;col++)for(const row of [0,6]){
  const s=initial();s.view=view;s.rat.visible=false;s.walls={left:[],right:[]};s.walls[side]=[{type:'water',state:'full',volume:160,col,row}];
  const device=buildScene(s,[]).filter(p=>p.owner.startsWith(side+' Water well column'));
  assert.ok(device.some(p=>p.ops.some(o=>o.op==='C')));
  assert.ok(device.every(p=>!p.image&&p.ops.every(o=>o.v.every(Number.isFinite))));
 }
});

test('front-wall grilles remove the side-view compression and pools remain in their openings',()=>{
 const s=initial();s.view='front';s.walls={left:[{type:'speaker',state:'silent',col:1,row:0}],right:[{type:'water',state:'full',volume:160,col:1,row:4}]};
 const scene=buildScene(s,[]),grille=scene.filter(p=>p.owner.startsWith('left Speaker column'));
 const box=sceneBounds(grille);assert.equal(grille.length,61);assert.ok(box.width/box.height>.8&&box.width/box.height<1.2);
 const well=scene.filter(p=>p.owner.startsWith('right Water well column'));
 assert.ok(points(well.at(-1).ops).every(p=>inPolygon(points(well[0].ops),p)));
});
