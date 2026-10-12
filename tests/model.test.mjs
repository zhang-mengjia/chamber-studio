import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,place,validate,occupant,STATES,defaultState,MODULES} from '../public/model.js';
import {buildScene,sceneBounds,sceneToSVG} from '../public/scene.js';
import {insertModule,UndoHistory} from '../public/editor.js';
import {CHAMBER,WALLS,wallRegions,contains} from '../public/geometry.js';
import {ratDrawing} from '../public/rat-art.js';
test('two-row modules reject overflow and collision without changing the original',()=>{let s=initial();const before=JSON.stringify(s);assert.throws(()=>place(s,'left',1,7,'food'),/超出/);assert.throws(()=>place(s,'left',0,4,'speaker'),/占用/);assert.equal(JSON.stringify(s),before);});
test('clicking lower half replaces or removes the entire module',()=>{let s=initial();s=place(s,'left',0,6,'nose');assert.equal(occupant(s.walls.left,0,5).type,'nose');assert.equal(occupant(s.walls.left,0,6),undefined);s=place(s,'left',0,5,'blank');assert.equal(occupant(s.walls.left,0,5),undefined);});
test('all eight module types fit expected units and preserve states and options in configuration',()=>{let s=initial();s.walls={left:[],right:[]};let row=0;for(const type of Object.keys(MODULES)){const side=row>=8?'right':'left';const r=row>=8?row-8:row;s=place(s,side,0,r,type);row+=MODULES[type].h;}s.walls.left[0].flavor='strawberry';s.walls.left[1].volume=160;s.floor='acrylic';const next=validate(JSON.parse(JSON.stringify(s)));assert.equal(next.floor,'acrylic');assert.equal(next.walls.left[0].flavor,'strawberry');assert.equal(next.walls.left[1].volume,160);assert.equal(next.walls.right.at(-1).type,'camera');});
test('invalid configurations reject overlaps, unknown types, states and amounts',()=>{let s=initial();s.walls.left.push({col:0,row:6,type:'camera'});assert.throws(()=>validate(s),/重叠/);s=initial();s.walls.left[0].state='exploded';assert.throws(()=>validate(s),/状态/);s=initial();s.walls.left[1].volume=25;assert.throws(()=>validate(s),/参数/);});
test('every module state, view and floor generates finite vector geometry',()=>{for(const type of Object.keys(MODULES))for(const status of Object.keys(STATES[type]))for(const view of ['front','perspective','combined'])for(const floor of ['bars','acrylic']){let s=initial();s.walls={left:[{type,col:0,row:1,state:status}],right:[]};s.view=view;s.floor=floor;for(const item of buildScene(s,[])){if(item.ops)assert.ok(item.ops.every(o=>o.v.every(Number.isFinite)));}}});
test('static flashing export retains a lit face without adding labels',()=>{const s=initial();s.walls.left[0].state='flashing';s.walls.left[0].hz=2;const scene=buildScene(s,[]);assert.ok(scene.every(x=>x.text===undefined));assert.ok(scene.some(x=>x.fill==='#fff7c4'));});
test('moving and copying preserves options, rejects collisions atomically, and permits overlapping self moves',()=>{
 const s=initial();const m=s.walls.left.find(m=>m.type==='water');Object.assign(m,{state:'full',volume:160});const original=JSON.stringify(s);
 const moved=insertModule(s,{wall:'right',col:0,row:3},m,{wall:'left',col:0,row:5});assert.equal(occupant(moved.walls.right,0,4).volume,160);assert.equal(occupant(moved.walls.left,0,5),undefined);
 const shifted=insertModule(s,{wall:'left',col:0,row:6},m,{wall:'left',col:0,row:5});assert.equal(occupant(shifted.walls.left,0,7).state,'full');
 assert.throws(()=>insertModule(s,{wall:'right',col:1,row:0},m),/占用/);assert.throws(()=>insertModule(s,{wall:'right',col:0,row:7},m),/边界/);assert.equal(JSON.stringify(s),original);
});
test('undo and redo retain independent snapshots and discard redo after a new edit',()=>{
 const h=new UndoHistory(2),a={state:initial(),selected:null},b=structuredClone(a);b.state.floor='acrylic';h.record(a);a.state.name='later mutation';assert.equal(h.undo(b).state.name,'双水槽实验箱');assert.equal(h.redo(a).state.floor,'acrylic');h.undo(b);h.record(a);assert.equal(h.redo(b),null);h.record(a);h.record(a);assert.equal(h.past.length,2);
});
test('hit regions cover all 48 cells in both views, with two-row modules selected as one',()=>{
 for(const view of ['perspective','front','combined']){const s=initial();s.view=view;const panels=view==='combined'?2:1;const cells=wallRegions(s,true);assert.equal(cells.length,48*panels);for(const r of cells){const p={x:r.points.reduce((s,p)=>s+p[0],0)/4,y:r.points.reduce((s,p)=>s+p[1],0)/4};assert.ok(contains(r.points,p));}assert.equal(wallRegions(s).filter(r=>r.wall==='left'&&r.col===0&&r.row===5)[0].h,2);}
});
test('original LE rat retains every source curve and old pose settings migrate without losing modules',()=>{const parts=ratDrawing();assert.equal(parts.length,117);assert.ok(parts.every(p=>p.ops.every(o=>o.v.every(Number.isFinite))));for(const pose of ['stand','walk','rear','nose','press','eat']){const s=initial();s.rat.pose=pose;s.walls.left[1].volume=160;const next=validate(s);assert.equal(next.rat.pose,'stand');assert.equal(next.walls.left[1].volume,160);}});
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
test('perspective chamber has straight square outer edges and a tight export viewport',()=>{
 for(const floor of ['bars','acrylic'])for(const visible of [false,true]){
  const s=initial();s.floor=floor;s.rat.visible=visible;
  const scene=buildScene(s,[]),box=sceneBounds(scene);
  assert.deepEqual(box,CHAMBER.bounds);assert.equal(box.width,box.height);
  for(const side of ['left','right']){const corners=WALLS.perspective[side],edge=side==='left'?[corners[0],corners[3]]:[corners[1],corners[2]];assert.equal(edge[0][0],edge[1][0]);}
  assert.match(sceneToSVG(scene,true),/width="608" height="608" viewBox="336 61 608 608"/);
  assert.match(sceneToSVG(scene,false),/<rect x="336" y="61" width="608" height="608" fill="white"\/>/);
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
