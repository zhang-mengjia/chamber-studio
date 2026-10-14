import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,place,validate,occupant,STATES,defaultState,MODULES,POSES,LEGACY_POSES} from '../public/model.js';
import {buildScene,sceneBounds,sceneToSVG} from '../public/scene.js';
import {insertModule,dragTarget,UndoHistory} from '../public/editor.js';
import {CHAMBER,WALLS,wallRegions,contains} from '../public/geometry.js';
import {ratScene} from '../public/rat-art.js';
import assets from '../public/assets/rats/poses.json' with {type:'json'};
import {STYLE,REFERENCE} from '../public/illustration-style.js';
test('reference grille curves stay editable and water quantities produce different visible pools',()=>{
 const s=initial();s.rat.visible=false;s.effects=false;s.walls={left:[{col:1,row:2,type:'speaker',state:'silent'}],right:[{col:1,row:4,type:'water',state:'full',volume:10}]};
 const grille=buildScene(s,[]).filter(p=>p.owner.includes('Speaker column'));
 assert.equal(grille.length,REFERENCE.speaker.length);assert.equal(grille.length,61);
 assert.ok(grille.every(p=>p.ops.some(o=>o.op==='C')&&!p.image));
 const pool=volume=>{s.walls.right[0].volume=volume;return sceneBounds(buildScene(s,[]).filter(p=>p.owner.includes('Water well column')&&p.fill===STYLE.water));};
 const small=pool(10),large=pool(160);assert.ok(large.width>small.width&&large.height>small.height);
 s.walls.right[0].state='empty';assert.equal(buildScene(s,[]).filter(p=>p.owner.includes('Water well column')&&p.fill===STYLE.water).length,0);
});
test('two-row modules reject overflow and collision without changing the original',()=>{let s=initial();const before=JSON.stringify(s);assert.throws(()=>place(s,'left',1,7,'food'),/超出/);assert.throws(()=>place(s,'left',0,4,'speaker'),/占用/);assert.equal(JSON.stringify(s),before);});
test('clicking lower half replaces or removes the entire module',()=>{let s=initial();s=place(s,'left',0,6,'nose');assert.equal(occupant(s.walls.left,0,5).type,'nose');assert.equal(occupant(s.walls.left,0,6),undefined);s=place(s,'left',0,5,'blank');assert.equal(occupant(s.walls.left,0,5),undefined);});
test('all eight module types fit expected units and preserve states and options in configuration',()=>{let s=initial();s.walls={left:[],right:[]};let row=0;for(const type of Object.keys(MODULES)){const side=row>=8?'right':'left';const r=row>=8?row-8:row;s=place(s,side,0,r,type);row+=MODULES[type].h;}s.walls.left[0].flavor='strawberry';s.walls.left[1].volume=160;s.floor='acrylic';const next=validate(JSON.parse(JSON.stringify(s)));assert.equal(next.floor,'acrylic');assert.equal(next.walls.left[0].flavor,'strawberry');assert.equal(next.walls.left[1].volume,160);assert.equal(next.walls.right.at(-1).type,'camera');});
test('invalid configurations reject overlaps, unknown types, states and amounts',()=>{let s=initial();s.walls.left.push({col:0,row:6,type:'camera'});assert.throws(()=>validate(s),/重叠/);s=initial();s.walls.left[0].state='exploded';assert.throws(()=>validate(s),/状态/);s=initial();s.walls.left[1].volume=25;assert.throws(()=>validate(s),/参数/);});
test('every module state, view and floor generates finite vector geometry',()=>{for(const type of Object.keys(MODULES))for(const status of Object.keys(STATES[type]))for(const view of ['front','perspective','combined'])for(const floor of ['plain','bars','acrylic']){let s=initial();s.walls={left:[{type,col:0,row:1,state:status}],right:[]};s.view=view;s.floor=floor;for(const item of buildScene(s,[])){if(item.ops)assert.ok(item.ops.every(o=>o.v.every(Number.isFinite)));}}});
test('static flashing export retains a lit face without adding labels',()=>{const s=initial();s.walls.left[0].state='flashing';s.walls.left[0].hz=2;const scene=buildScene(s,[]);assert.ok(scene.every(x=>x.text===undefined));assert.ok(scene.some(x=>x.fill===STYLE.lamp));});
test('moving and copying preserves options, rejects collisions atomically, and permits overlapping self moves',()=>{
 const s=initial();const m=s.walls.left.find(m=>m.type==='water');Object.assign(m,{state:'full',volume:160});const original=JSON.stringify(s);
 const moved=insertModule(s,{wall:'right',col:0,row:3},m,{wall:'left',col:0,row:5});assert.equal(occupant(moved.walls.right,0,4).volume,160);assert.equal(occupant(moved.walls.left,0,5),undefined);
 const shifted=insertModule(s,{wall:'left',col:0,row:6},m,{wall:'left',col:0,row:5});assert.equal(occupant(shifted.walls.left,0,7).state,'full');
 assert.throws(()=>insertModule(s,{wall:'right',col:1,row:0},m),/占用/);assert.throws(()=>insertModule(s,{wall:'right',col:0,row:7},m),/边界/);assert.equal(JSON.stringify(s),original);
});
test('dragging either half of a two-row module reaches both wall edges and still protects occupied destinations',()=>{
 const s=initial();s.walls={left:[{type:'water',state:'full',volume:160,col:2,row:6}],right:[]};
 const module=s.walls.left[0],source={wall:'left',col:2,row:6},original=JSON.stringify(s);
 const top=dragTarget({wall:'right',col:0,row:0},module,1);
 const moved=insertModule(s,top,module,source);
 assert.equal(occupant(moved.walls.right,0,0).volume,160);assert.equal(occupant(moved.walls.right,0,1).row,0);
 const bottom=dragTarget({wall:'right',col:0,row:7},module,0);
 const lowered=insertModule(moved,bottom,moved.walls.right[0],top);
 assert.equal(occupant(lowered.walls.right,0,7).row,6);
 assert.equal(dragTarget({wall:'right',col:0,row:4},module,1).row,3);
 assert.equal(dragTarget(null,module,1),null);
 s.walls.right=[{type:'cue',state:'off',col:0,row:0}];
 assert.throws(()=>insertModule(s,top,module,source),/占用/);
 s.walls.right=[];assert.equal(JSON.stringify(s),original);
});
test('undo and redo retain independent snapshots and discard redo after a new edit',()=>{
 const h=new UndoHistory(2),a={state:initial(),selected:null},b=structuredClone(a);b.state.floor='acrylic';h.record(a);a.state.name='later mutation';assert.equal(h.undo(b).state.name,'双水槽实验箱');assert.equal(h.redo(a).state.floor,'acrylic');h.undo(b);h.record(a);assert.equal(h.redo(b),null);h.record(a);h.record(a);assert.equal(h.past.length,2);
});
test('hit regions cover all 48 cells in both views, with two-row modules selected as one',()=>{
 for(const view of ['perspective','front','combined']){const s=initial();s.view=view;const panels=view==='combined'?2:1;const cells=wallRegions(s,true);assert.equal(cells.length,48*panels);for(const r of cells){const p={x:r.points.reduce((s,p)=>s+p[0],0)/4,y:r.points.reduce((s,p)=>s+p[1],0)/4};assert.ok(contains(r.points,p));}assert.equal(wallRegions(s).filter(r=>r.wall==='left'&&r.col===0&&r.row===5)[0].h,2);}
});
test('all five rat poses survive configuration round-trips and legacy poses migrate without losing modules',()=>{
 assert.equal(Object.keys(POSES).length,5);assert.deepEqual(Object.keys(assets),Object.keys(POSES));
 for(const pose of [...Object.keys(POSES),...LEGACY_POSES]){
  const s=initial();s.rat.pose=pose;s.walls.left[1].volume=160;
  const next=validate(JSON.parse(JSON.stringify(s)));
  assert.equal(next.rat.pose,LEGACY_POSES.includes(pose)?'stand':pose);
  assert.equal(next.walls.left[1].volume,160);
 }
 const invalid=initial();invalid.rat.pose='missing';assert.throws(()=>validate(invalid),/素材/);
});
test('all rat poses render native curves, share floor anchors and mirror in every exported rat view',()=>{
 for(const pose of Object.keys(POSES))for(const scale of [.45,1,1.7]){
  const r={...initial().rat,pose,scale},a=ratScene(r),b=ratScene({...r,facing:'left'}),asset=assets[pose];
  assert.equal(a.length,asset.paths.length);assert.ok(a.length>10);assert.ok(a.every(p=>!p.image));
  const point=a[0].ops[0].v,source=asset.paths[0].ops[0].v;
  assert.ok(Math.abs(point[1]-(r.y+35*scale)-(source[1]-asset.feetY)*.265*scale)<1e-9);
  const boxA=sceneBounds(a),boxB=sceneBounds(b);
  assert.equal(boxA.width,boxB.width);assert.equal(boxA.height,boxB.height);
  assert.ok(Math.abs(boxA.x+boxB.x+boxA.width-2*r.x)<1e-8);
  for(let part=0;part<a.length;part++)for(let i=0;i<a[part].ops.length;i++)for(let j=0;j<a[part].ops[i].v.length;j+=2){
   assert.ok(Math.abs(a[part].ops[i].v[j]+b[part].ops[i].v[j]-2*r.x)<1e-9);
   assert.equal(a[part].ops[i].v[j+1],b[part].ops[i].v[j+1]);
  }
  for(const view of ['perspective','combined']){
   const rat=buildScene({...initial(),view,rat:r},[]).filter(p=>p.owner==='Rat');
   assert.equal(rat.length,a.length);assert.equal(rat.filter(p=>p.hitOps).length,1);
   assert.ok(rat.every(p=>p.ops.every(o=>o.v.every(Number.isFinite))));
   assert.doesNotMatch(sceneToSVG(rat,true),/<image\b|href=/);
  }
 }
 assert.equal(buildScene({...initial(),view:'front'},[]).filter(p=>p.owner==='Rat').length,0);
 assert.equal(buildScene({...initial(),rat:{...initial().rat,visible:false}},[]).filter(p=>p.owner==='Rat').length,0);
});
test('static exports contain no editor hit areas or selection outlines',()=>{const s=initial();for(const view of ['perspective','front','combined']){s.view=view;assert.ok(buildScene(s,[]).every(p=>p.fill!=='transparent'&&!p.owner?.includes('selection')));}});
test('wall devices stay in front of the inner frame and behind the outer frame and rat',()=>{
 for(const view of ['perspective','combined'])for(const type of Object.keys(MODULES))for(const status of Object.keys(STATES[type]))for(const preview of [false,true]){
  const s=initial();s.view=view;s.walls={left:[{type,col:1,row:0,state:status}],right:[{type,col:1,row:0,state:status}]};
  const scene=buildScene(s,[],preview),outer=scene.findIndex(p=>p.owner==='Box outer frame');
  const inner=scene.slice(0,outer),frameEnd=inner.findLastIndex(p=>p.owner==='Box frame');
  const devices=inner.flatMap((p,i)=>/^(left|right) .* column \d+ row \d+$/.test(p.owner)?[i]:[]);
  assert.ok(frameEnd>=0&&devices.length>0);
  assert.ok(devices.every(i=>i>frameEnd),`${view}: ${type} ${status} was covered by the inner frame`);
  for(const side of ['left','right']){
   const indices=inner.flatMap((p,i)=>p.owner.startsWith(side+' ')&&/ column \d+ row \d+$/.test(p.owner)?[i]:[]);
   assert.equal(indices.at(-1)-indices[0]+1,indices.length,'Each editable device must remain one contiguous group');
  }
  assert.ok(scene.findIndex(p=>p.owner==='Rat')>outer);
  if(view==='perspective')assert.deepEqual(sceneBounds(scene),CHAMBER.bounds);
 }
});
test('reference perspective retains its camera proportions and tight export viewport',()=>{
 for(const floor of ['plain','bars','acrylic'])for(const visible of [false,true]){
  const s=initial();s.floor=floor;s.rat.visible=visible;
  const scene=buildScene(s,[]),box=sceneBounds(scene);
  assert.deepEqual(box,CHAMBER.bounds);assert.ok(Math.abs(box.width/box.height-155.26/138.17)<1e-9);
  for(const side of ['left','right']){const corners=WALLS.perspective[side],edge=side==='left'?[corners[0],corners[3]]:[corners[1],corners[2]];assert.equal(edge[0][0],edge[1][0]);}
  assert.ok(sceneToSVG(scene,true).includes(`width="608" height="${box.height}" viewBox="336 61 608 ${box.height}"`));
  assert.ok(sceneToSVG(scene,false).includes(`<rect x="336" y="61" width="608" height="${box.height}" fill="white"/>`));
 }
});
test('tight bounds include painted stroke widths and actual Bezier extrema, ignoring invisible paths',()=>{
 const curve={ops:[{op:'M',v:[10,10]},{op:'C',v:[10,110,110,110,110,10]}],fill:'none',stroke:'#000000',sw:4};
 const invisible={ops:[{op:'M',v:[-500,-500]},{op:'L',v:[500,500]}],fill:'none',stroke:'none'};
 assert.deepEqual(sceneBounds([curve,invisible]),{x:8,y:8,width:104,height:79});
 const quadratic={...curve,ops:[{op:'M',v:[0,0]},{op:'Q',v:[50,100,100,0]}]};
 assert.deepEqual(sceneBounds([quadratic]),{x:-2,y:-2,width:104,height:54});
});
test('export bounds preserve external dimensions and rats in every view instead of clipping them',()=>{
 const s=initial();s.dimensions=true;const box=sceneBounds(buildScene(s,[]));assert.ok(box.height>CHAMBER.bounds.height);
 s.dimensions=false;s.rat.x=1050;const outside=sceneBounds(buildScene(s,[]));assert.ok(outside.x+outside.width>CHAMBER.bounds.x+CHAMBER.bounds.width);
 for(const view of ['front','combined']){s.view=view;const fitted=sceneBounds(buildScene(s,[]));assert.ok(fitted.width>0&&fitted.height>0);assert.notEqual(fitted.width,1280);assert.notEqual(fitted.height,760);}
});
test('legacy label settings cannot restore device text in any view or state',()=>{
 for(const view of ['perspective','front','combined'])for(const type of Object.keys(MODULES))for(const status of Object.keys(STATES[type])){
  const s=initial();s.labels=true;s.view=view;s.walls={left:[{type,col:0,row:1,state:status,volume:160,hz:2,flavor:'strawberry',sound:'siren'}],right:[]};
  const migrated=validate(s);assert.equal(migrated.labels,false);assert.equal(migrated.walls.left[0].volume,160);assert.equal(migrated.walls.left[0].hz,2);
  for(const state of [s,migrated])for(const preview of [false,true])assert.ok(buildScene(state,[],preview).filter(p=>p.text!==undefined).every(p=>['Titles','Dimensions'].includes(p.owner)));
 }
});
