import assets from './assets/rats/poses.json' with {type:'json'};
import {CHAMBER,wallPoint} from './geometry.js';

const FOOT_OFFSET=35;
export const ratFloorAnchor=r=>[r.x,r.y+FOOT_OFFSET*r.scale];
export function centerRat(r){
  const [x,y]=wallPoint(CHAMBER.floor,.5,.5);
  return {...r,x,y:y-FOOT_OFFSET*r.scale,visible:true};
}

// Five poses are redrawn as independently editable cubic paths in the muted
// reference palette. The original floor anchors keep saved positions stable.
export function ratScene(r){
  const pose=Object.hasOwn(assets,r.pose)?r.pose:'stand',asset=assets[pose];
  const scale=.265*r.scale,{crop}=asset,flip=r.facing==='left';
  const [anchorX,anchorY]=ratFloorAnchor(r);
  const point=(px,py)=>[anchorX+(flip?-1:1)*(px-crop.x-crop.width/2)*scale,anchorY+(py-asset.feetY)*scale];
  const map=ops=>ops.map(o=>({op:o.op,v:o.v.flatMap((_,i,a)=>i%2?[]:point(a[i],a[i+1]))}));
  return asset.paths.map((p,i)=>({...p,name:`LE rat ${pose} ${p.name}`,owner:'Rat',sw:p.sw*scale,
    ops:map(p.ops),...(i===0?{hitOps:map(asset.hitOps)}:{})}));
}
