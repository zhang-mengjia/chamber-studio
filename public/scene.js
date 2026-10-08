import {MODULES,defaultState,options,FLAVORS,VOLUMES} from './model.js';
import {ratScene} from './rat-art.js';
import {WALLS,wallPoint} from './geometry.js';

export const W=1280,H=760;
const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function toD(ops){return ops.map(o=>o.op+(o.v||[]).map(v=>+v.toFixed(3)).join(' ')).join(' ');}
export function sceneToSVG(scene,transparent=false){return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${transparent?'':`<rect width="${W}" height="${H}" fill="white"/>`}${scene.map(s=>s.text!==undefined?`<text x="${s.x}" y="${s.y}" font-family="Arial, sans-serif" font-size="${s.size}" fill="${s.fill}" text-anchor="${s.align||'middle'}">${esc(s.text)}</text>`:`<path data-owner="${esc(s.owner||'')}" d="${toD(s.ops)}" opacity="${s.opacity??1}" fill="${s.fill||'none'}" stroke="${s.stroke||'none'}" stroke-width="${s.sw||0}" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}</svg>`;}
function mapped(ops,fn){return ops.map(o=>({op:o.op,v:(o.v||[]).flatMap((_,i,a)=>i%2?[]:fn(a[i],a[i+1]))}));}
function blend(a,b,t){return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');}

// Shading and reflections use native paths shared by SVG, PDF and editable PPT.
export function buildScene(state,ratPaths,preview=false){
  let scene=[],owner='Box';
  const add=(ops,fill,stroke='#404c5b',sw=1)=>scene.push({ops,fill,stroke,sw,owner,name:owner+' '+scene.length});
  const poly=(pts,fill,stroke='none',sw=0)=>add([{op:'M',v:pts[0]},...pts.slice(1).map(v=>({op:'L',v})),{op:'Z',v:[]}],fill,stroke,sw);
  const text=(str,x,y,size=18,fill='#4b6278')=>scene.push({text:str,x,y,size,fill,owner,name:str});
  const line=(a,b,stroke='#8ca7bf',sw=1)=>add([{op:'M',v:a},{op:'L',v:b}],'none',stroke,sw);
  const ellipse=(x,y,rx,ry,fill,stroke='#404c5b',sw=1)=>poly(Array.from({length:48},(_,i)=>[x+rx*Math.cos(i*Math.PI/24),y+ry*Math.sin(i*Math.PI/24)]),fill,stroke,sw);
  function surface(corners,from,to,steps=16,horizontal=false){
    const xy=(u,v)=>wallPoint(corners,u,v);
    for(let i=0;i<steps;i++){
      const a=i/steps,b=(i+1)/steps;
      const pts=horizontal?[[a,0],[b,0],[b,1],[a,1]]:[[0,a],[1,a],[1,b],[0,b]];
      const fill=blend(from,to,(i+.5)/steps);
      // Matching strokes close antialiasing gaps between adjacent vector bands.
      poly(pts.map(([u,v])=>xy(u,v)),fill,fill,.6);
    }
  }
  function glass(corners,from,to,ceiling=false){
    surface(corners,from,to,28);
    const xy=(u,v)=>wallPoint(corners,u,v);
    const shine=pts=>{poly(pts.map(([u,v])=>xy(u,v)),'#ffffff');scene.at(-1).opacity=.36;};
    if(ceiling){
      shine([[.16,0],[.29,0],[.12,1],[.01,1]]);
      shine([[.39,0],[.42,0],[.27,1],[.23,1]]);
      shine([[.83,0],[.89,0],[.99,.78],[.99,.98]]);
    }else{
      shine([[.26,.01],[.39,.01],[.01,.51],[.01,.34]]);
      shine([[.95,.01],[.99,.01],[.99,.1],[.28,.99],[.14,.99]]);
      shine([[.99,.66],[.99,.74],[.81,.99],[.74,.99]]);
    }
    poly(corners,'none','#537b9a',1.5);
    for(const v of [.015,.985])line(xy(.012,v),xy(.988,v),'#f5fbff',2);
    for(const u of [.016,.984])line(xy(u,.018),xy(u,.982),'#f1faff',1.5);
  }

  function wall(corners,side){
    const xy=(u,v)=>wallPoint(corners,u,v);
    const points=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([u,v])=>xy(u/6,v/8));
    const rect=(x,y,w,h,fill,stroke='#566a7d',sw=1)=>poly(points(x,y,w,h),fill,stroke,sw);
    const shadedRect=(x,y,w,h,from,to,stroke='#9aafc2',sw=.8)=>{
      const pts=points(x,y,w,h);surface(pts,from,to,6,true);poly(pts,'none',stroke,sw);
    };
    const oval=(x,y,rx,ry,fill,stroke='#35414e',sw=.8)=>poly(Array.from({length:48},(_,i)=>xy((x+rx*Math.cos(i*Math.PI/24))/6,(y+ry*Math.sin(i*Math.PI/24))/8)),fill,stroke,sw);

    owner=side+' wall';surface(corners,'#e8f1fa','#cbdbe9',16,true);poly(corners,'none','#4d657c',1.8);
    for(let c=0;c<3;c++)for(let r=0;r<8;r++){
      if(state.walls[side].some(m=>m.col===c&&r>=m.row&&r<m.row+MODULES[m.type].h))continue;
      owner=side+' blank '+c+' '+r;
      shadedRect(c*2+.055,r+.025,1.89,.95,side==='left'?'#eaf2f9':'#d5e2ee',side==='left'?'#d5e2ee':'#eaf2f9');
      line(xy((c*2+.08)/6,(r+.045)/8),xy((c*2+1.92)/6,(r+.045)/8),'#f7fbff',.75);
    }
    // Device faces remain opaque; this reflection sits behind their bodies.
    owner=side+' wall reflection';
    const sheen=side==='left'?[[.025,.08],[.97,.23],[.97,.3],[.025,.38]]:[[.03,.16],[.98,.04],[.98,.19],[.03,.38]];
    poly(sheen.map(([u,v])=>xy(u,v)),'#ffffff');scene.at(-1).opacity=.3;
    owner=side+' aluminum rails';
    for(let c=0;c<=3;c++){
      const x=c*2;shadedRect(x-.035,0,.07,8,'#afc5d9','#e7f1fb','#6b89a4',.8);
      line(xy(x/6,0),xy(x/6,1),'#f4fbff',1);
    }
    if(state.grid){owner='Grid';for(let r=1;r<8;r++)line(xy(0,r/8),xy(1,r/8),'#7798b7',.7);}

    for(const m of state.walls[side]){
      const def=MODULES[m.type],x=m.col*2,y=m.row,h=def.h,actual=m.state??defaultState(m.type),opt=options(m);
      const ms=actual==='flashing'?(preview&&Date.now()%(1000/opt.hz)>500/opt.hz?'off':'on'):actual;
      owner=side+' '+def.en+' column '+(m.col+1)+' row '+(m.row+1);
      // The editor skips these first two backing shapes when adding targets for
      // parts that protrude beyond a module's installation cell.
      rect(x+.055,y+.025,1.89,h-.05,'#8fa5b8','#3c4c5d',1.5);
      rect(x+.2,y+.15,1.6,h-.3,'#303c49','#202b37',1.15);
      rect(x+.23,y+.18,1.54,.035,'#5c7084','none',0);
      rect(x+.23,y+h-.2,1.54,.035,'#8299ae','none',0);
      for(const sx of [x+.13,x+1.87])for(const sy of [y+.1,y+h-.1])oval(sx,sy,.035,.025,'#d9e8f4','#4b647b',.65);

      if(m.type==='house'){
        const straight=Math.abs(corners[0][1]-corners[1][1])<1;
        const a=xy((x+1)/6,(y+.43)/8),edge=xy((x+1)/6,(y+1.43)/8);
        const unit=Math.hypot(edge[0]-a[0],edge[1]-a[1]);
        const depth=straight?[0,0]:[(side==='left'?1:-1)*unit*.46,unit*.10];
        const ring=(radius,z=0)=>Array.from({length:64},(_,i)=>{
          const t=i*Math.PI/32,p=xy((x+1+radius*Math.cos(t))/6,(y+.43+radius*Math.sin(t))/8);
          return [p[0]+depth[0]*z,p[1]+depth[1]*z];
        });
        if(ms==='on'&&state.effects)for(const [radius,opacity]of [[.65,.07],[.52,.10],[.4,.13]]){
          poly(ring(radius,1),'#ffe89c');scene.at(-1).opacity=opacity;
        }
        poly(ring(.37),'#667b8b','#354655',1.1);
        poly(ring(.32),'#d9e6ee','#8b9eac',.85);
        const back=ring(.25),front=ring(.25,1);
        if(!straight){
          const pts=[...back,...front].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
          const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
          const lower=[],upper=[];
          for(const p of pts){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
          for(const p of [...pts].reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
          poly([...lower.slice(0,-1),...upper.slice(0,-1)],ms==='on'?'#ffe58a':'#bdcdd8','#708897',1);
          line(back[48],front[48],ms==='on'?'#fff9dc':'#edf4f8',1.6);
        }
        poly(front,ms==='on'?'#fff7c4':'#d9e4eb',ms==='on'?'#cfaa4e':'#8b9fac',1);
        poly(ring(.19,1),ms==='on'?'#fffbdc':'#edf3f6');
      }
      if(m.type==='cue'){
        oval(x+1,y+.5,.3,.3,'#152532','#788e9f',1);
        oval(x+1,y+.5,.23,.23,ms==='on'?'#ffda56':'#697481','#bea15a',.8);
        oval(x+.94,y+.43,.07,.06,ms==='on'?'#fff6bf':'#8e9daa','none',0);
      }
      if(m.type==='speaker'){
        oval(x+1,y+.87,.62,.65,'#18222d','#6e8397',1.25);
        oval(x+1,y+.87,.48,.5,'#4f6073','#101b26',1.1);
        oval(x+1,y+.87,.28,.3,'#172330','#34485c',1);
        if(ms==='playing'&&state.effects){
          const pts=Array.from({length:65},(_,i)=>{
            const t=i/64;
            const wave=opt.sound==='clicker'?(i%16<2?.18:-.08):opt.sound==='siren'?.15*Math.sin(t*t*40):opt.sound==='white'?.16*Math.sin(i*73.37)*Math.cos(i*18.7):.14*Math.sin(t*25.13);
            return xy((x+.42+t*1.16)/6,(y+1.58+wave)/8);
          });
          add(pts.map((v,i)=>({op:i?'L':'M',v})),'none','#43d8ed',1.8);
        }
      }
      if(m.type==='camera'){
        rect(x+.52,y+.25,.94,.48,'#1e2c3b','#879db2',1);
        oval(x+1,y+.49,.29,.25,'#8aadc6','#304e69',1);
        oval(x+1,y+.49,.21,.18,'#12334f');
        oval(x+.94,y+.43,.07,.05,'#90e0f3','none',0);
        oval(x+1.34,y+.34,.055,.04,ms==='recording'?'#ff7a88':'#5d748a','none',0);
      }
      if(m.type==='nose'){
        oval(x+1,y+.5,.32,.34,ms==='on'?'#ffe18a':'#c9dbe9','#718da5',1);
        oval(x+1,y+.5,.24,.26,'#14212e');
        oval(x+.94,y+.44,.06,.04,ms==='on'?'#ffdf68':'#5f8b9f','none',0);
      }
      if(m.type==='lever'){
        rect(x+.5,y+.46,1,.12,'#152431','#0e1d2b',.8);
        if(ms==='extended'){
          poly([[x+.48,y+.51],[x+1.52,y+.51],[x+1.6,y+.85],[x+.4,y+.85]].map(([u,v])=>xy(u/6,v/8)),'#ceddea','#42586d',1.25);
          rect(x+.4,y+.83,1.2,.075,'#819aad','#4d647a',.8);
          line(xy((x+.49)/6,(y+.55)/8),xy((x+1.5)/6,(y+.55)/8),'#f3faff',1);
        }else rect(x+.53,y+.47,.94,.065,'#8ba4b8');
      }
      if(m.type==='water'||m.type==='food'){
        rect(x+.33,y+.31,1.34,1.25,'#14212e','#0a1724',.9);
        poly([[x+.34,y+1.56],[x+.55,y+1.3],[x+1.45,y+1.3],[x+1.66,y+1.56]].map(([u,v])=>xy(u/6,v/8)),'#a9c2d5','#607e98',1);
        if(m.type==='water'&&ms==='full'){
          const level=.08+VOLUMES.indexOf(opt.volume)*.045;
          rect(x+.35,y+1.53-level,1.3,level,'#359feb','none',0);
          poly([[x+.35,y+1.53-level],[x+.55,y+1.3-level],[x+1.45,y+1.3-level],[x+1.65,y+1.53-level]].map(([u,v])=>xy(u/6,v/8)),'#71d6ff','#3091cf',.7);
          line(xy((x+.48)/6,(y+1.49-level)/8),xy((x+1.48)/6,(y+1.49-level)/8),'#d2f5ff',1.1);
        }
        rect(x+.32,y+1.57,1.36,.1,'#e3f0fa','#718ca3',.7);
        if(m.type==='water'){
          rect(x+.94,y+.48,.12,.48,'#dcebf5','#8da9bf',.6);
          oval(x+1,y+.98,.065,.06,'#7babc3');
        }else if(ms==='full'){
          const col=FLAVORS[opt.flavor].color;
          for(const [dx,dy]of [[.76,1.46],[1.1,1.48],[1.33,1.41]]){
            oval(x+dx,y+dy,.11,.075,col,'#8d6a40',.7);
            oval(x+dx-.025,y+dy-.02,.035,.02,'#fff2c5','none',0);
          }
        }
      }
      // Device settings live in the popover and config, never on the figure.
    }
    owner=side+' wall fasteners';
    for(const u of [.11,5.89])for(const v of [.65,3.75,7.52]){
      oval(u,v,.045,.065,'#7e98af','#3a5269',.8);
      oval(u-.008,v-.012,.018,.025,'#d9e9f6','none',0);
    }
    if(state.dimensions){
      owner='Dimensions';const a=xy(0,1.07),b=xy(1,1.07);line(a,b);text('6 units',(a[0]+b[0])/2,(a[1]+b[1])/2+22,16);
      const c=xy(-.09,0),d=xy(-.09,1);line(c,d);text('8',(c[0]+d[0])/2-14,(c[1]+d[1])/2,16);
    }
  }

  function floor(){
    owner='Floor';const corners=[[435,505],[860,505],[990,635],[290,635]],xy=(u,v)=>wallPoint(corners,u,v);
    surface(corners,state.floor==='bars'?'#485e71':'#cde9fa',state.floor==='bars'?'#6b8295':'#e7f7ff',20);
    poly(corners,'none','#526e85',1.8);
    if(state.floor==='bars'){
      for(let i=0;i<18;i++){
        const v=(i+.2)/18,b=v+.032;owner='Metal floor bar '+(i+1);
        surface([xy(0,v),xy(1,v),xy(1,b),xy(0,b)],'#eef7ff','#94afc3',4);
        line(xy(0,v),xy(1,v),'#f6fbff',1.25);line(xy(0,b),xy(1,b),'#334e64',1.3);
      }
    }else{
      owner='Acrylic floor reflection';poly([xy(.12,.03),xy(.23,.03),xy(.76,.97),xy(.57,.97)],'#ffffff');scene.at(-1).opacity=.42;
      for(let i=0;i<7;i++)for(let j=0;j<14;j++){
        owner='Acrylic floor hole '+(i*14+j+1);const u=(j+.5)/14,v=(i+.5)/7;
        poly(Array.from({length:24},(_,k)=>xy(u+.016*Math.cos(k*Math.PI/12),v+.028*Math.sin(k*Math.PI/12))),'#aacce1','#6f9cb9',.65);
      }
      owner='Acrylic floor edge';line(xy(.015,.025),xy(.985,.025),'#f5fcff',2);line(xy(.015,.97),xy(.985,.97),'#82b3d2',2);
    }
  }
  function perspective(){
    owner='Box glass ceiling';glass([[280,85],[1000,85],[855,170],[440,170]],'#bdddf9','#d4edff',true);
    owner='Box glass back';glass([[440,170],[855,170],[860,505],[435,505]],'#c5e2fc','#e3f4ff');
    floor();wall(WALLS.perspective.left,'left');wall(WALLS.perspective.right,'right');
    owner='Box frame';
    for(const [a,b]of [[[280,85],[1000,85]],[[280,85],[440,170]],[[855,170],[1000,85]],[[440,170],[855,170]],[[440,170],[435,505]],[[855,170],[860,505]],[[280,85],[290,635]],[[1000,85],[990,635]]]){
      line(a,b,'#557b9f',5.5);line(a,b,'#d6ecff',2.8);line([a[0]-1,a[1]-1],[b[0]-1,b[1]-1],'#f7fcff',1);
    }
    const sill=[[290,635],[990,635],[990,664],[290,664]];
    surface(sill,'#b9d0e4','#92acc4',12);poly(sill,'none','#4b6883',1.6);line([292,637],[988,637],'#f2faff',2.2);
    for(const [x,y]of [[285,93],[995,93],[440,171],[855,171]]){
      poly([[x-7,y-7],[x+7,y-7],[x+7,y+7],[x-7,y+7]],'#9ebbd4','#476785',1.2);
      ellipse(x,y,3.1,3.1,'#5a768f','#334f69',.9);ellipse(x-.6,y-.8,1.15,1.1,'#d9edfb','none',0);
    }
    for(const x of [305,975])ellipse(x,650,4.7,4.7,'#718da6','#3b536b',1.1);
    if(state.rat.visible)scene.push(...ratScene(state.rat));
  }
  function front(){
    wall(WALLS.front.left,'left');wall(WALLS.front.right,'right');owner='Titles';
    text('LEFT WALL',400,48,23);text('RIGHT WALL',920,48,23);
    text('1                 2                 3',400,610,16);text('1                 2                 3',920,610,16);
  }
  if(state.view==='front')front();
  else if(state.view==='perspective')perspective();
  else{
    perspective();scene=scene.map(s=>s.text!==undefined?{...s,x:s.x*.68+210,y:s.y*.68,size:s.size*.68}:{...s,ops:mapped(s.ops,(x,y)=>[x*.68+210,y*.68]),sw:s.sw*.68});
    const base=scene;scene=[];front();scene=scene.map(s=>s.text!==undefined?{...s,x:s.x*.52+305,y:s.y*.4+475,size:s.size*.65}:{...s,ops:mapped(s.ops,(x,y)=>[x*.52+305,y*.4+475]),sw:s.sw*.65});scene=[...base,...scene];
  }
  return scene;
}
