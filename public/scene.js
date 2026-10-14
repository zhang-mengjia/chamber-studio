export {buildScene} from './scene-drawing.js';

export const W=1280,H=760;
const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function toD(ops){return ops.map(o=>o.op+(o.v||[]).map(v=>+v.toFixed(3)).join(' ')).join(' ');}
// Include painted strokes and curve extrema, without adding export padding.
export function sceneBounds(scene){
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  const include=(x,y,pad=0)=>{left=Math.min(left,x-pad);top=Math.min(top,y-pad);right=Math.max(right,x+pad);bottom=Math.max(bottom,y+pad);};
  const extrema=(p0,p1,p2,p3)=>{
    const a=-p0+3*p1-3*p2+p3,b=2*(p0-2*p1+p2),c=p1-p0;
    if(Math.abs(a)<1e-12)return Math.abs(b)<1e-12?[]:[-c/b];
    const d=b*b-4*a*c;
    return d<0?[]:[(-b+Math.sqrt(d))/(2*a),(-b-Math.sqrt(d))/(2*a)];
  };
  const cubic=(p0,p1,p2,p3,t)=>{const u=1-t;return u*u*u*p0+3*u*u*t*p1+3*u*t*t*p2+t*t*t*p3;};
  for(const s of scene){
    if(s.opacity===0)continue;
    if(s.image){include(s.x,s.y);include(s.x+s.width,s.y+s.height);continue;}
    if(s.text!==undefined){
      if(!s.fill||s.fill==='none'||!s.text)continue;
      let width=s.text.length*s.size*.61,ascent=s.size*.8,descent=s.size*.2;
      if(typeof document!=='undefined'){
        const ctx=document.createElement('canvas').getContext('2d');ctx.font=`${s.size}px Arial`;
        const metrics=ctx.measureText(s.text);width=metrics.width;ascent=metrics.actualBoundingBoxAscent;descent=metrics.actualBoundingBoxDescent;
      }
      const x=s.x-(s.align==='start'?0:s.align==='end'?width:width/2);
      include(x,s.y-ascent);include(x+width,s.y+descent);continue;
    }
    const stroked=s.stroke&&s.stroke!=='none'&&(s.sw||0)>0;
    if((!s.fill||s.fill==='none')&&!stroked)continue;
    const pad=stroked?s.sw/2:0;
    let current=[0,0],start=current;
    for(const {op,v} of s.ops){
      if(op==='M'){current=v;start=v;include(...v,pad);}
      else if(op==='L'){include(...v,pad);current=v;}
      else if(op==='Z'){include(...start,pad);current=start;}
      else if(op==='C'||op==='Q'){
        const end=v.slice(-2),p1=v.slice(0,2);
        const controls=op==='C'?[p1,v.slice(2,4)]:[
          current.map((p,i)=>p+2*(p1[i]-p)/3),end.map((p,i)=>p+2*(p1[i]-p)/3)
        ];
        include(...end,pad);
        const ts=[...extrema(current[0],controls[0][0],controls[1][0],end[0]),...extrema(current[1],controls[0][1],controls[1][1],end[1])];
        for(const t of ts)if(t>0&&t<1)include(...[0,1].map(i=>cubic(current[i],controls[0][i],controls[1][i],end[i],t)),pad);
        current=end;
      }
    }
  }
  const clean=n=>Math.round(n*1e9)/1e9;
  return Number.isFinite(left)?{x:clean(left),y:clean(top),width:Math.max(1,clean(right-left)),height:Math.max(1,clean(bottom-top))}:{x:0,y:0,width:1,height:1};
}
function imageSVG(s){
  const c=s.crop,viewX=s.flip?s.sourceWidth-c.x-c.width:c.x;
  const transform=s.flip?` transform="translate(${s.sourceWidth} 0) scale(-1 1)"`:'';
  return `<svg data-owner="${esc(s.owner||'')}" x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" viewBox="${viewX} ${c.y} ${c.width} ${c.height}" overflow="hidden" pointer-events="none"><image href="${esc(s.image)}" width="${s.sourceWidth}" height="${s.sourceHeight}"${transform}/></svg>`;
}
export function sceneToSVG(scene,transparent=false,viewport=sceneBounds(scene)){const {x,y,width,height}=viewport;return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">${transparent?'':`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white"/>`}${scene.map(s=>s.image?imageSVG(s):s.text!==undefined?`<text x="${s.x}" y="${s.y}" font-family="Arial, sans-serif" font-size="${s.size}" fill="${s.fill}" text-anchor="${s.align||'middle'}">${esc(s.text)}</text>`:`<path data-owner="${esc(s.owner||'')}" d="${toD(s.ops)}" opacity="${s.opacity??1}" fill="${s.fill||'none'}" stroke="${s.stroke||'none'}" stroke-width="${s.sw||0}" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}</svg>`;}
