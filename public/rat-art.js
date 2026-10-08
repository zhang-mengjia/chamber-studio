import originalPaths from './assets/rat-paths.json' with {type:'json'};

// Keep all 117 source curves and the original pose. The poster adaptation uses
// ivory fur, charcoal outlines and coral skin instead of the source's muted hues.
const posterColors={
  '#E6E2DF':'#fffaf2','#D3CBC5':'#fff7ee','#C1B4A6':'#f4ebdf',
  '#B49F8B':'#ede2d5','#515150':'#53545b','#454444':'#505159',
  '#393736':'#414249','#2F2C2A':'#33343b','#C99187':'#ff9da5',
  '#D3ABA4':'#ffb4b9','#B46A5D':'#c56672','#94908B':'#fffaf2'
};
const color=c=>posterColors[c]??c;
const skinContours=new Set([9,10,11,13,28]);
export function ratDrawing(){return originalPaths.map((p,i)=>({...p,
  fill:color(p.fill),stroke:skinContours.has(i)?'#c56672':color(p.stroke),
  sw:skinContours.has(i)?3.5:p.strokeWidth*(p.fill==='none'?2.2:1)
}));}
export function ratScene(r){
  const scale=.32*r.scale,flip=r.facing==='left'?-1:1;
  const parts=ratDrawing();
  // Put the outline under every colored part. Internal fur and shading curves
  // stay unoutlined; only the outside silhouette retains the charcoal border.
  const silhouette={name:'LE rat silhouette outline',fill:'#383940',stroke:'#383940',sw:7.5,
    ops:parts.filter(p=>p.fill!=='none').flatMap(p=>p.ops)};
  return [silhouette,...parts].map(p=>({name:p.name,owner:'Rat',fill:p.fill,stroke:p.stroke,sw:p.sw*scale,
    ops:p.ops.map(o=>({op:o.op,v:o.v.flatMap((_,i,a)=>i%2?[]:[r.x+(1171-a[i]-585)*scale*flip,r.y+(a[i+1]-485)*scale])}))}));
}
