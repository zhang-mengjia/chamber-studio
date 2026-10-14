import {MODULES,defaultState,options,FLAVORS,VOLUMES} from './model.js';
import {ratScene} from './rat-art.js';
import {CHAMBER,WALLS,wallPoint} from './geometry.js';
import {STYLE,REFERENCE,REFERENCE_SCALE,referencePoint,sourceWallPoint} from './illustration-style.js';

const mapped=(ops,fn)=>ops.map(o=>({op:o.op,v:o.v.flatMap((_,i,a)=>i%2?[]:fn(a[i],a[i+1]))}));
const ellipseOps=(x,y,rx,ry)=>{
  const k=.55228475;
  return [{op:'M',v:[x+rx,y]},
    {op:'C',v:[x+rx,y+k*ry,x+k*rx,y+ry,x,y+ry]},
    {op:'C',v:[x-k*rx,y+ry,x-rx,y+k*ry,x-rx,y]},
    {op:'C',v:[x-rx,y-k*ry,x-k*rx,y-ry,x,y-ry]},
    {op:'C',v:[x+k*rx,y-ry,x+rx,y-k*ry,x+rx,y]},{op:'Z',v:[]}];
};
const grille=REFERENCE.speaker.map(p=>({...p,ops:mapped(p.ops,(x,y)=>sourceWallPoint(x,y,'right'))}));
const grillePoints=grille.flatMap(p=>p.ops.flatMap(o=>o.v));
const grilleX=grillePoints.filter((_,i)=>i%2===0),grilleY=grillePoints.filter((_,i)=>i%2===1);
const grilleBox={x:Math.min(...grilleX),y:Math.min(...grilleY),w:Math.max(...grilleX)-Math.min(...grilleX),h:Math.max(...grilleY)-Math.min(...grilleY)};

// Every view and file format consumes these same flat fills and native curves.
export function buildScene(state,_ratPaths,preview=false){
  let scene=[],owner='Box';
  const add=(ops,fill='none',stroke=STYLE.ink,sw=STYLE.line,extra={})=>scene.push({ops,fill,stroke,sw,owner,name:owner+' '+scene.length,...extra});
  const poly=(points,fill,stroke='none',sw=0)=>add([{op:'M',v:points[0]},...points.slice(1).map(v=>({op:'L',v})),{op:'Z',v:[]}],fill,stroke,sw);
  const line=(a,b,stroke=STYLE.ink,sw=STYLE.line)=>add([{op:'M',v:a},{op:'L',v:b}],'none',stroke,sw);
  const text=(str,x,y,size=16)=>scene.push({text:str,x,y,size,fill:STYLE.ink,owner,name:str});
  const reference=(name,fn=referencePoint,scale=REFERENCE_SCALE,modify=p=>p)=>{
    for(const original of REFERENCE[name]){
      const p=modify({...original});
      add(mapped(p.ops,fn),p.fill,p.stroke,p.sw*scale,{opacity:p.opacity});
    }
  };

  function wall(corners,side,devices=null){
    const xy=(u,v)=>wallPoint(corners,u,v),point=(x,y)=>xy(x/6,y/8);
    const rect=(x,y,w,h,fill,stroke=STYLE.ink,sw=STYLE.line)=>poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(p=>point(...p)),fill,stroke,sw);
    const oval=(x,y,rx,ry,fill,stroke=STYLE.ink,sw=STYLE.detail)=>add(mapped(ellipseOps(x,y,rx,ry),point),fill,stroke,sw);
    const straight=Math.abs(corners[0][1]-corners[1][1])<1;
    owner=side+' wall';
    if(straight)poly(corners,STYLE.wall,STYLE.ink,1.5);
    else reference(side);
    if(state.grid){
      owner='Grid';
      for(let c=1;c<3;c++)line(xy(c/3,0),xy(c/3,1),'#A5A39F',.65);
      for(let r=1;r<8;r++)line(xy(0,r/8),xy(1,r/8),'#A5A39F',.65);
    }
    for(const m of state.walls[side]){
      const start=scene.length,def=MODULES[m.type],x=m.col*2,y=m.row;
      const actual=m.state??defaultState(m.type),opt=options(m);
      const ms=actual==='flashing'?(preview&&Date.now()%(1000/opt.hz)>500/opt.hz?'off':'on'):actual;
      owner=side+' '+def.en+' column '+(m.col+1)+' row '+(m.row+1);
      const a=point(x+1,y+.5),b=point(x+1,y+1.5),unit=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(m.type==='house'){
        if(ms==='on'&&state.effects){
          if(straight)oval(x+1,y+.5,.45,.38,STYLE.lamp,'none',0);
          else add(ellipseOps(a[0]+(side==='left'?1:-1)*unit*.32,a[1],unit*.35,unit*.38),STYLE.lamp,'none',0);
          scene.at(-1).opacity=.16;
        }
        if(straight){
          oval(x+1,y+.5,.35,.34,STYLE.metal);
          oval(x+1,y+.5,.27,.27,ms==='on'?STYLE.lamp:STYLE.charcoal);
          oval(x+.98,y+.36,.18,.07,ms==='on'?'#FCF7E5':STYLE.lens,'none',0);
        }else{
          const k=unit*.62/10.87,sign=side==='left'?1:-1;
          reference('house',(sx,sy)=>[a[0]+sign*(sx-174.87)*k,a[1]+(sy-135.83)*k],k,p=>({...p,
            fill:ms==='on'&&p.fill==='#000000'?STYLE.lamp:ms==='on'&&p.fill==='#97CDDE'?'#FCF7E5':p.fill}));
        }
      }else if(m.type==='speaker'){
        // The reference's 61 perforations remain 61 independently editable
        // cubic paths, projected into whichever wall carries the module.
        for(const p of grille)add(mapped(p.ops,(u,v)=>point(x+.38+(u-grilleBox.x)/grilleBox.w*1.24,y+.2+(v-grilleBox.y)/grilleBox.h*1.6)),p.fill,'none',0);
        if(ms==='playing'&&state.effects){
          const pts=Array.from({length:49},(_,i)=>{
            const t=i/48,wave=opt.sound==='clicker'?(i%12<2?.12:-.04):opt.sound==='siren'?.12*Math.sin(t*t*32):opt.sound==='white'?.1*Math.sin(i*73.37)*Math.cos(i*18.7):.1*Math.sin(t*25.13);
            return point(x+.38+t*1.24,y+1.87+wave);
          });
          add(pts.map((v,i)=>({op:i?'L':'M',v})),'none',STYLE.glassEdge,1);
        }
      }else if(m.type==='lever'){
        if(straight||ms==='retracted')rect(x+.59,y+.45,.82,.075,STYLE.charcoal,STYLE.ink,.7);
        if(ms==='extended'){
          if(straight)poly([[x+.62,y+.46],[x+1.38,y+.46],[x+1.56,y+.8],[x+.44,y+.8]].map(p=>point(...p)),STYLE.metal,STYLE.ink,STYLE.detail);
          else{
            const k=unit*.35/7.07,sign=side==='right'?1:-1;
            reference('lever',(sx,sy)=>[a[0]+sign*(sx-285.07)*k,a[1]+(sy-198.57)*k],k);
          }
        }else rect(x+.6,y+.46,.8,.035,STYLE.metal,STYLE.ink,.6);
      }else if(m.type==='water'||m.type==='food'){
        rect(x+.71,y+.2,.65,1.58,'#CCCBC7',STYLE.ink,STYLE.line);
        // A narrow recessed opening and the original cup curves replace the
        // former large dark mounting plate and blue metal highlights.
        const cup=point(x+1.04,y+1.65),k=unit*.32/8;
        reference('waterCup',(sx,sy)=>[cup[0]+(sx-163.39)*k,cup[1]+(sy-196.91)*k],k,p=>{
          if(p.fill!=='#68A7D9')return p;
          // The visible pool expands with volume. Its amount is schematic,
          // rather than an inferred physical depth or cup capacity.
          const size=.6+.08*VOLUMES.indexOf(opt.volume);
          return {...p,fill:m.type==='water'&&ms==='full'?STYLE.water:STYLE.wall,opacity:1,
            ops:mapped(p.ops,(sx,sy)=>[163.4+(sx-163.4)*size,197.32+(sy-197.32)*size])};
        });
        if(m.type==='food'&&ms==='full')for(const [dx,dy]of [[-.07,.02],[.05,.04],[.12,-.015]])add(ellipseOps(cup[0]+unit*dx,cup[1]+unit*dy,unit*.047,unit*.03),FLAVORS[opt.flavor].color,'#8E8174',.6);
      }else if(m.type==='nose'){
        oval(x+1,y+.5,.31,.3,ms==='on'?STYLE.lamp:STYLE.metal,STYLE.ink,STYLE.line);
        oval(x+1,y+.5,.23,.23,STYLE.charcoal,STYLE.ink,.65);
        if(ms==='on')oval(x+.91,y+.41,.045,.04,'#F8EDD0','none',0);
      }else if(m.type==='cue'){
        oval(x+1,y+.5,.25,.25,STYLE.metal,STYLE.ink,STYLE.line);
        oval(x+1,y+.5,.19,.19,ms==='on'?STYLE.lamp:'#888782',STYLE.ink,.65);
        oval(x+.94,y+.42,.045,.035,ms==='on'?'#FCF7E5':'#B7B6B1','none',0);
      }else if(m.type==='camera'){
        rect(x+.53,y+.25,.94,.5,'#A6A59F',STYLE.ink,STYLE.line);
        oval(x+1,y+.5,.22,.2,STYLE.charcoal,STYLE.ink,.8);
        oval(x+1,y+.5,.13,.12,'#4D5B5D','none',0);
        oval(x+.96,y+.45,.04,.035,STYLE.lens,'none',0);
        oval(x+1.32,y+.35,.045,.035,ms==='recording'?'#BC807A':'#73746E','none',0);
      }
      if(devices)devices.push(...scene.splice(start));
    }
    if(state.dimensions){
      owner='Dimensions';const a=xy(0,1.07),b=xy(1,1.07);line(a,b,STYLE.glassEdge,.8);text('6 units',(a[0]+b[0])/2,(a[1]+b[1])/2+22);
      const c=xy(-.09,0),d=xy(-.09,1);line(c,d,STYLE.glassEdge,.8);text('8',(c[0]+d[0])/2-14,(c[1]+d[1])/2);
    }
  }
  function floor(){
    owner='Floor';reference('floor');
    const xy=(u,v)=>wallPoint(CHAMBER.floor,u,v);
    if(state.floor==='bars')for(let i=0;i<18;i++){
      const v=(i+.25)/18,b=v+.021;owner='Metal floor bar '+(i+1);
      poly([xy(0,v),xy(1,v),xy(1,b),xy(0,b)],'#B6B5B0','#66665F',.7);
    }
    else if(state.floor==='acrylic')for(let i=0;i<7;i++)for(let j=0;j<14;j++){
      owner='Acrylic floor hole '+(i*14+j+1);
      add(mapped(ellipseOps((j+.5)/14,(i+.5)/7,.012,.022),xy),'#F3F4F0','#AAAFA9',.55);
    }
  }
  function perspective(){
    owner='Box back';reference('back');
    floor();
    const devices=[];wall(WALLS.perspective.left,'left',devices);wall(WALLS.perspective.right,'right',devices);
    owner='Box glass ceiling';reference('ceiling');
    owner='Box frame';reference('leftTrim');reference('rightTrim');
    scene.push(...devices);
    owner='Box outer frame';reference('frame');
    if(state.rat.visible)scene.push(...ratScene(state.rat));
  }
  function front(){
    wall(WALLS.front.left,'left');wall(WALLS.front.right,'right');owner='Titles';
    text('LEFT WALL',400,48,21);text('RIGHT WALL',920,48,21);
    text('1                 2                 3',400,610);text('1                 2                 3',920,610);
  }
  const project=(s,fn,scale)=>({...s,
    ...(s.text!==undefined?{x:fn(s.x,s.y)[0],y:fn(s.x,s.y)[1],size:s.size*scale}:{ops:mapped(s.ops,fn),sw:s.sw*scale}),
    ...(s.hitOps?{hitOps:mapped(s.hitOps,fn)}:{})});
  if(state.view==='front')front();
  else if(state.view==='perspective')perspective();
  else{
    perspective();const base=scene.map(s=>project(s,(x,y)=>[x*.68+210,y*.68],.68));
    scene=[];front();scene=base.concat(scene.map(s=>project(s,(x,y)=>[x*.52+305,y*.4+475],.65)));
  }
  return scene;
}
