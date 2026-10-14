import assets from './assets/rats/poses.json' with {type:'json'};

// Five poses are redrawn as independently editable cubic paths in the muted
// reference palette. The original floor anchors keep saved positions stable.
export function ratScene(r){
  const pose=Object.hasOwn(assets,r.pose)?r.pose:'stand',asset=assets[pose];
  const scale=.265*r.scale,{crop}=asset,flip=r.facing==='left';
  const point=(px,py)=>[r.x+(flip?-1:1)*(px-crop.x-crop.width/2)*scale,r.y+35*r.scale+(py-asset.feetY)*scale];
  const map=ops=>ops.map(o=>({op:o.op,v:o.v.flatMap((_,i,a)=>i%2?[]:point(a[i],a[i+1]))}));
  return asset.paths.map((p,i)=>({...p,name:`LE rat ${pose} ${p.name}`,owner:'Rat',sw:p.sw*scale,
    ops:map(p.ops),...(i===0?{hitOps:map(asset.hitOps)}:{})}));
}
