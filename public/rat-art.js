import originalPaths from './assets/rat-paths.json' with {type:'json'};

// Preserve the original LE rat's 117 native curves, colors and proportions.
// Only translation, uniform scaling and a horizontal reflection are applied.
export function ratDrawing(){return originalPaths.map(p=>({...p,sw:p.strokeWidth}));}
export function ratScene(r){
  const scale=.32*r.scale,flip=r.facing==='left'?-1:1;
  return originalPaths.map(p=>({name:p.name,owner:'Rat',fill:p.fill,stroke:p.stroke,sw:p.strokeWidth*scale,
    ops:p.ops.map(o=>({op:o.op,v:o.v.flatMap((_,i,a)=>i%2?[]:[r.x+(1171-a[i]-585)*scale*flip,r.y+(a[i+1]-485)*scale])}))}));
}
