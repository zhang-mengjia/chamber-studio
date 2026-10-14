// Clip a native line/cubic contour to a convex aperture. Fill outlines gain only
// aperture edges; stroke runs keep the original curves, without outlining the
// new cut. SVG, PDF and editable PPT therefore use identical visible geometry.
const EPS=1e-8;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const same=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<EPS;
function split(points,t){
  const levels=[points];
  while(levels.at(-1).length>1){const a=levels.at(-1);levels.push(a.slice(0,-1).map((p,i)=>mix(p,a[i+1],t)));}
  return [levels.map(a=>a[0]),levels.map(a=>a.at(-1)).reverse()];
}
const piece=(points,a,b)=>a===0&&b===1?points:split(split(points,b)[0],a/b)[1];
const at=(points,t)=>split(points,t)[0].at(-1);
function crossings(points,n,c){
  const d=points.map(p=>dot(n,p)-c);
  if(points.length===2){const den=d[0]-d[1],t=den?d[0]/den:-1;return t>EPS&&t<1-EPS?[t]:[];}
  const [p0,p1,p2,p3]=d,a=-p0+3*p1-3*p2+p3,b=3*p0-6*p1+3*p2,e=-3*p0+3*p1;
  const value=t=>((a*t+b)*t+e)*t+p0;
  const knots=[0,1];
  if(Math.abs(a)<EPS){if(Math.abs(b)>EPS)knots.push(-e/(2*b));}
  else{const disc=4*b*b-12*a*e;if(disc>=0)knots.push((-2*b+Math.sqrt(disc))/(6*a),(-2*b-Math.sqrt(disc))/(6*a));}
  const sorted=knots.filter(t=>t>=0&&t<=1).sort((x,y)=>x-y),roots=[];
  for(const t of sorted)if(t>EPS&&t<1-EPS&&Math.abs(value(t))<EPS)roots.push(t);
  for(let i=1;i<sorted.length;i++){
    let l=sorted[i-1],r=sorted[i],fl=value(l),fr=value(r);
    if(fl*fr>=0)continue;
    for(let j=0;j<50;j++){const m=(l+r)/2,fm=value(m);if(fl*fm<=0){r=m;fr=fm;}else{l=m;fl=fm;}}
    const t=(l+r)/2;if(t>EPS&&t<1-EPS)roots.push(t);
  }
  return roots;
}
function segments(ops){
  const result=[];let current,start;
  for(const {op,v}of ops){
    if(op==='M'){current=v;start=v;}
    else if(op==='L'){result.push([current,v]);current=v;}
    else if(op==='C'){const p=[current,v.slice(0,2),v.slice(2,4),v.slice(4,6)];result.push(p);current=p.at(-1);}
    else if(op==='Z'){if(!same(current,start))result.push([current,start]);current=start;}
    else throw Error('Native aperture clipping supports M, L, C and Z paths.');
  }
  return result;
}
const command=p=>p.length===2?{op:'L',v:p[1]}:{op:'C',v:p.slice(1).flat()};
function retain(segment,planes){
  const cuts=[0,1,...planes.flatMap(({n,c})=>crossings(segment,n,c))].sort((a,b)=>a-b);
  const unique=cuts.filter((t,i)=>!i||t-cuts[i-1]>EPS),kept=[];
  for(let i=1;i<unique.length;i++){
    const a=unique[i-1],b=unique[i],middle=at(segment,(a+b)/2);
    if(planes.every(({n,c})=>dot(n,middle)>=c-EPS))kept.push(piece(segment,a,b));
  }
  return kept;
}
export function clipNativePath(ops,polygon){
  const area=polygon.reduce((s,p,i)=>s+p[0]*polygon[(i+1)%polygon.length][1]-p[1]*polygon[(i+1)%polygon.length][0],0);
  const sign=Math.sign(area);
  if(!sign)throw Error('Aperture must have positive area.');
  const planes=polygon.map((p,i)=>{const q=polygon[(i+1)%polygon.length],length=Math.hypot(q[0]-p[0],q[1]-p[1]);const n=[sign*(p[1]-q[1])/length,sign*(q[0]-p[0])/length];return {n,c:dot(n,p)};});
  const source=segments(ops);
  let fill=source;
  // Closing each half-plane intersection preserves the convex aperture's
  // edge ordering while subsequent passes trim the remaining edges.
  for(const plane of planes){
    const kept=fill.flatMap(p=>retain(p,[plane]));
    if(!kept.length){fill=[];break;}
    fill=[];
    for(let i=0;i<kept.length;i++){
      const p=kept[i],next=kept[(i+1)%kept.length];fill.push(p);
      if(!same(p.at(-1),next[0]))fill.push([p.at(-1),next[0]]);
    }
  }
  const fillOps=fill.length?[{op:'M',v:fill[0][0]},...fill.map(command),{op:'Z',v:[]}]:[];
  const strokes=[];
  for(const p of source.flatMap(p=>retain(p,planes))){
    const last=strokes.at(-1);
    if(last&&same(last.at(-1).at(-1),p[0]))last.push(p);else strokes.push([p]);
  }
  return {fillOps,strokeOps:strokes.map(run=>[{op:'M',v:run[0][0]},...run.map(command)])};
}
