import {MODULES,defaultState,options,FLAVORS,SOUNDS,VOLUMES} from './model.js';
import {ratScene} from './rat-art.js';
import {WALLS,wallPoint} from './geometry.js';
export const W=1280,H=760;
const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function toD(ops){return ops.map(o=>o.op+(o.v||[]).map(v=>+v.toFixed(3)).join(' ')).join(' ');}
export function sceneToSVG(scene,transparent=false){return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${transparent?'':`<rect width="${W}" height="${H}" fill="white"/>`}${scene.map(s=>s.text!==undefined?`<text x="${s.x}" y="${s.y}" font-family="Arial, sans-serif" font-size="${s.size}" fill="${s.fill}" text-anchor="${s.align||'middle'}">${esc(s.text)}</text>`:`<path data-owner="${esc(s.owner||'')}" d="${toD(s.ops)}" opacity="${s.opacity??1}" fill="${s.fill||'none'}" stroke="${s.stroke||'none'}" stroke-width="${s.sw||0}" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}</svg>`;}
function mapped(ops,fn){return ops.map(o=>({op:o.op,v:(o.v||[]).flatMap((_,i,a)=>i%2?[]:fn(a[i],a[i+1]))}));}
export function buildScene(state,ratPaths,preview=false){let scene=[];let owner='Box';const add=(ops,fill,stroke='#454b50',sw=1)=>scene.push({ops,fill,stroke,sw,owner,name:owner+' '+scene.length});
const poly=(pts,fill,stroke,sw)=>add([{op:'M',v:pts[0]},...pts.slice(1).map(v=>({op:'L',v})),{op:'Z',v:[]}],fill,stroke,sw);
const text=(str,x,y,size=18,fill='#4b555e')=>scene.push({text:str,x,y,size,fill,owner,name:str});
const line=(a,b,stroke='#7b858e',sw=1)=>add([{op:'M',v:a},{op:'L',v:b}],'none',stroke,sw);
function wall(corners,side){const xy=(u,v)=>{const [a,b,c,d]=corners;return [a[0]*(1-u)*(1-v)+b[0]*u*(1-v)+c[0]*u*v+d[0]*(1-u)*v,a[1]*(1-u)*(1-v)+b[1]*u*(1-v)+c[1]*u*v+d[1]*(1-u)*v];};const rect=(x,y,w,h,fill,stroke='#555d64',sw=1)=>poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(p=>xy(p[0]/6,p[1]/8)),fill,stroke,sw);const oval=(x,y,rx,ry,fill,stroke='#363d42',sw=.8)=>poly(Array.from({length:48},(_,i)=>xy((x+rx*Math.cos(i*Math.PI/24))/6,(y+ry*Math.sin(i*Math.PI/24))/8)),fill,stroke,sw);
owner=side+' wall';poly(corners,'#aeb3b7','#52595e',1.5);
// Blank filler plates occupy every unused 2 × 1 unit slot.
for(let c=0;c<3;c++)for(let r=0;r<8;r++){if(!state.walls[side].some(m=>m.col===c&&r>=m.row&&r<m.row+MODULES[m.type].h)){owner=side+' blank '+c+' '+r;rect(c*2+.055,r+.025,1.89,.95,'#b5b9bc','#858d94',.65);}}
// Wall rails and seams sit behind the protruding device bodies in every output.
owner=side+' aluminum rails';for(let c=0;c<=3;c++){const x=c*2;rect(x-.045,0,.09,8,'#d8dfe3','#7b8791',.8);rect(x-.008,0,.016,8,'#f3f6f8','none',0);}
if(state.grid){owner='Grid';for(let r=1;r<8;r++)line(xy(0,r/8),xy(1,r/8),'#748ca0',.7);}
for(const m of state.walls[side]){const def=MODULES[m.type],x=m.col*2,y=m.row,h=def.h,actual=m.state??defaultState(m.type),opt=options(m),ms=actual==='flashing'?(preview&&Date.now()%(1000/opt.hz)>500/opt.hz?'off':'on'):actual;owner=side+' '+def.en+' column '+(m.col+1)+' row '+(m.row+1);rect(x+.055,y+.025,1.89,h-.05,'#90979d','#555f68',1);rect(x+.22,y+.16,1.56,h-.32,'#4d565e','#3f484f',.7);
for(const sx of [x+.14,x+1.86])for(const sy of [y+.1,y+h-.1])oval(sx,sy,.035,.025,'#d8dfe4','#76828a',.4);
if(m.type==='house'){
  // The cylinder's axis projects along the wall normal, into the chamber.
  // In a straight-on elevation its end and base are concentric.
  const straight=Math.abs(corners[0][1]-corners[1][1])<1;
  const a=xy((x+1)/6,(y+.43)/8), edge=xy((x+1)/6,(y+1.43)/8);
  const depth=straight?[0,0]:[(side==='left'?1:-1)*Math.hypot(edge[0]-a[0],edge[1]-a[1])*.46,Math.hypot(edge[0]-a[0],edge[1]-a[1])*.10];
  const ring=(radius,z=0)=>Array.from({length:64},(_,i)=>{const t=i*Math.PI/32;const p=xy((x+1+radius*Math.cos(t))/6,(y+.43+radius*Math.sin(t))/8);return [p[0]+depth[0]*z,p[1]+depth[1]*z];});
  if(ms==='on'&&state.effects){for(const [rx,ry,opacity]of [[.92,.59,.07],[.73,.47,.11],[.52,.36,.15]]){oval(x+1,y+.43,rx,ry,'#ffe9ad','none',0);scene.at(-1).opacity=opacity;}}
  poly(ring(.37),'#66727a','#46545e',.9);
  poly(ring(.32),'#dce3e6','#8b989f',.65);
  const back=ring(.25),front=ring(.25,1);
  // Extruded side wall is a convex silhouette of the two circular sections.
  if(!straight){const pts=[...back,...front].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lower=[],upper=[];for(const p of pts){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}for(const p of [...pts].reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}poly([...lower.slice(0,-1),...upper.slice(0,-1)],ms==='on'?'#eee5be':'#c2cdcf','#889496',.65);line(back[48],front[48],ms==='on'?'#fffcec':'#e6ebeb',1.25);}
  poly(front,ms==='on'?'#fff7c4':'#e1e6e4',ms==='on'?'#d0c59b':'#94a2a3',.65);
  poly(ring(.19,1),ms==='on'?'#fffbdf':'#edf0ed','none',0);
}
if(m.type==='cue'){oval(x+1,y+.5,.3,.3,'#3f4548');oval(x+1,y+.5,.23,.23,ms==='on'?'#d9b958':'#666354');oval(x+.94,y+.44,.06,.05,ms==='on'?'#efe0a6':'#83806c','none',0);}
if(m.type==='speaker'){oval(x+1,y+.87,.62,.65,'#292f34');oval(x+1,y+.87,.48,.5,'#69747b');oval(x+1,y+.87,.28,.3,'#343c43');if(ms==='playing'&&state.effects){const pts=Array.from({length:65},(_,i)=>{const t=i/64;let wave=opt.sound==='clicker'?(i%16<2?.18:-.08):opt.sound==='siren'?.15*Math.sin(t*t*40):opt.sound==='white'?.16*Math.sin(i*73.37)*Math.cos(i*18.7):.14*Math.sin(t*25.13);return xy((x+.42+t*1.16)/6,(y+1.58+wave)/8);});add(pts.map((v,i)=>({op:i?'L':'M',v})),'none','#93d0ec',1.1);}}
if(m.type==='camera'){rect(x+.52,y+.25,.94,.48,'#263742');oval(x+1,y+.49,.29,.25,'#87969d');oval(x+1,y+.49,.21,.18,'#12344c');oval(x+.94,y+.43,.06,.045,'#8db2c5','none',0);oval(x+1.34,y+.34,.055,.04,ms==='recording'?'#ef6160':'#57626a','none',0);}
if(m.type==='nose'){oval(x+1,y+.5,.32,.34,ms==='on'?'#dccb7f':'#ced4d8');oval(x+1,y+.5,.24,.26,'#19232b');oval(x+.94,y+.44,.06,.04,ms==='on'?'#eed974':'#528796','none',0);}
if(m.type==='lever'){rect(x+.5,y+.46,1,.12,'#1e292f');if(ms==='extended'){poly([[x+.48,y+.51],[x+1.52,y+.51],[x+1.6,y+.85],[x+.4,y+.85]].map(p=>xy(p[0]/6,p[1]/8)),'#bfc8cd','#36434b',1);rect(x+.4,y+.83,1.2,.075,'#69777f');}else rect(x+.53,y+.47,.94,.065,'#707e87');}
if(m.type==='water'||m.type==='food'){rect(x+.33,y+.31,1.34,1.25,'#202b34');poly([[x+.34,y+1.56],[x+.55,y+1.3],[x+1.45,y+1.3],[x+1.66,y+1.56]].map(p=>xy(p[0]/6,p[1]/8)),'#a3acb2','#7d8e96',.7);if(m.type==='water'&&ms==='full'){const level=.06+VOLUMES.indexOf(opt.volume)*.045;rect(x+.35,y+1.53-level,1.3,level,'#6fbbd7','none',0);poly([[x+.35,y+1.53-level],[x+.55,y+1.3-level],[x+1.45,y+1.3-level],[x+1.65,y+1.53-level]].map(p=>xy(p[0]/6,p[1]/8)),'#a7dfef','#65a8bf',.5);}rect(x+.32,y+1.57,1.36,.1,'#d1d8db');if(m.type==='water'){rect(x+.94,y+.48,.12,.48,'#cad6dd');oval(x+1,y+.98,.065,.06,'#779199');}else if(ms==='full'){const col=FLAVORS[opt.flavor].color;oval(x+.76,y+1.46,.105,.07,col);oval(x+1.1,y+1.48,.11,.07,col);oval(x+1.33,y+1.41,.105,.07,col);}}

let label=def.en;if(m.type==='house'&&actual==='flashing')label='Flashing '+opt.hz+' Hz';if(m.type==='water'&&ms==='full')label=opt.volume+' \u00b5L';if(m.type==='food'&&ms==='full')label=FLAVORS[opt.flavor].en;if(m.type==='speaker'&&ms==='playing')label=SOUNDS[opt.sound];if(m.type==='camera'&&ms==='recording')label='REC';if(state.labels||actual==='flashing'||(m.type==='water'&&ms==='full')){const p=xy((x+1)/6,(y+h-.16)/8);text(label,p[0],p[1],state.view==='perspective'?10:13,'#f8fafc');}}
if(state.dimensions){owner='Dimensions';const a=xy(0,1.07),b=xy(1,1.07);line(a,b);text('6 units',(a[0]+b[0])/2,(a[1]+b[1])/2+22,16);const c=xy(-.09,0),d=xy(-.09,1);line(c,d);text('8',(c[0]+d[0])/2-14,(c[1]+d[1])/2,16);}
}
function rat(){if(state.rat.visible)scene.push(...ratScene(state.rat));}
function floor(){owner='Floor';const xy=(u,v)=>[435-145*v+(425+275*v)*u,505+130*v];poly([[435,505],[860,505],[990,635],[290,635]],state.floor==='bars'?'#677580':'#d9eef3','#73838f',1.4);if(state.floor==='bars'){for(let i=0;i<14;i++){const v=(i+.3)/14;owner='Metal floor bar '+(i+1);poly([xy(0,v),xy(1,v),xy(1,v+.035),xy(0,v+.035)],'#b8c5ce','#536572',.8);line(xy(0,v+.009),xy(1,v+.009),'#eff6fa',1);}}else{for(let i=0;i<7;i++)for(let j=0;j<14;j++){owner='Acrylic floor hole '+(i*14+j+1);const u=(j+.5)/14,v=(i+.5)/7;poly(Array.from({length:24},(_,k)=>xy(u+.016*Math.cos(k*Math.PI/12),v+.028*Math.sin(k*Math.PI/12))),'#afc8d0','#91acb6',.55);}owner='Acrylic floor edge';line(xy(.015,.025),xy(.985,.025),'#f4fbff',2);line(xy(.015,.97),xy(.985,.97),'#8bafbc',2);}}
function perspective(){owner='Box';poly([[280,85],[1000,85],[855,170],[440,170]],'#a8aeb3');poly([[440,170],[855,170],[860,505],[435,505]],'#adb2b6');floor();wall(WALLS.perspective.left,'left');wall(WALLS.perspective.right,'right');owner='Box frame';poly([[290,635],[990,635],[990,664],[290,664]],'#979fa5');rat();}
function front(){wall(WALLS.front.left,'left');wall(WALLS.front.right,'right');owner='Titles';text('LEFT WALL',400,48,23);text('RIGHT WALL',920,48,23);text('1                 2                 3',400,610,16);text('1                 2                 3',920,610,16);}
if(state.view==='front')front();else if(state.view==='perspective')perspective();else{perspective();scene=scene.map(s=>s.text!==undefined?{...s,x:s.x*.68+210,y:s.y*.68,size:s.size*.68}:{...s,ops:mapped(s.ops,(x,y)=>[x*.68+210,y*.68]),sw:s.sw*.68});const base=scene;scene=[];front();scene=scene.map(s=>s.text!==undefined?{...s,x:s.x*.52+305,y:s.y*.4+475,size:s.size*.65}:{...s,ops:mapped(s.ops,(x,y)=>[x*.52+305,y*.4+475]),sw:s.sw*.65});scene=[...base,...scene];}
return scene;
}
