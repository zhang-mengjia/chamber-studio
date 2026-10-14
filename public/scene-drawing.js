import {MODULES,defaultState,options,FLAVORS,VOLUMES} from './model.js';
import {ratScene} from './rat-art.js';
import {CHAMBER,WALLS,WALL_UNITS,wallPoint,chamberPoint,moduleDepth,floorDepth,viewDepth,viewPanels} from './geometry.js';
import {STYLE,REFERENCE,APERTURES,REFERENCE_SCALE,referencePoint,sourceWallPoint} from './illustration-style.js';
import {clipNativePath} from './path-clipping.js';

const mapped=(ops,fn)=>ops.map(o=>({op:o.op,v:o.v.flatMap((_,i,a)=>i%2?[]:fn(a[i],a[i+1]))}));
const ellipseOps=(x,y,rx,ry)=>{
  const k=.55228475;
  return [{op:'M',v:[x+rx,y]},
    {op:'C',v:[x+rx,y+k*ry,x+k*rx,y+ry,x,y+ry]},
    {op:'C',v:[x-k*rx,y+ry,x-rx,y+k*ry,x-rx,y]},
    {op:'C',v:[x-rx,y-k*ry,x-k*rx,y-ry,x,y-ry]},
    {op:'C',v:[x+k*rx,y-ry,x+rx,y-k*ry,x+rx,y]},{op:'Z',v:[]}];
};
const grilleFront=REFERENCE.speaker.map(p=>({...p,ops:mapped(p.ops,(sx,sy)=>sourceWallPoint(sx,sy,'right'))}));
const frontPoints=grilleFront.flatMap(p=>p.ops.flatMap(o=>o.v));
const frontX=frontPoints.filter((_,i)=>i%2===0),frontY=frontPoints.filter((_,i)=>i%2===1);
const frontBox={x:Math.min(...frontX),y:Math.min(...frontY),w:Math.max(...frontX)-Math.min(...frontX),h:Math.max(...frontY)-Math.min(...frontY)};
const portPoints=REFERENCE.waterMount.flatMap(p=>p.ops.flatMap(o=>o.v.flatMap((_,i,a)=>i%2?[]:[sourceWallPoint(a[i],a[i+1],'left')])));
const portBox={x:Math.min(...portPoints.map(p=>p[0])),y:Math.min(...portPoints.map(p=>p[1]))};
portBox.w=Math.max(...portPoints.map(p=>p[0]))-portBox.x;portBox.h=Math.max(...portPoints.map(p=>p[1]))-portBox.y;

// Every view and file format consumes these same flat fills and native curves.
export function buildScene(state,_ratPaths,preview=false){
  let scene=[],owner='Box';
  const add=(ops,fill='none',stroke=STYLE.ink,sw=STYLE.line,extra={})=>scene.push({ops,fill,stroke,sw,owner,name:owner+' '+scene.length,...extra});
  const poly=(points,fill,stroke='none',sw=0,extra={})=>add([{op:'M',v:points[0]},...points.slice(1).map(v=>({op:'L',v})),{op:'Z',v:[]}],fill,stroke,sw,extra);
  const line=(a,b,stroke=STYLE.ink,sw=STYLE.line)=>add([{op:'M',v:a},{op:'L',v:b}],'none',stroke,sw);
  const text=(str,x,y,size=16)=>scene.push({text:str,x,y,size,fill:STYLE.ink,owner,name:str});
  const reference=(name,fn=referencePoint,scale=REFERENCE_SCALE,modify=p=>p)=>{
    for(const original of REFERENCE[name]){
      const p=modify({...original});
      add(mapped(p.ops,fn),p.fill,p.stroke,p.sw*scale,{opacity:p.opacity});
    }
  };

  function wall(corners,side,devices=null){
    const straight=devices===null;
    const xy=(u,v)=>wallPoint(corners,u,v),point=(x,y)=>xy(x/WALL_UNITS.width,y/WALL_UNITS.height);
    const rect=(x,y,w,h,fill,stroke=STYLE.ink,sw=STYLE.line)=>poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(p=>point(...p)),fill,stroke,sw);
    const oval=(x,y,rx,ry,fill,stroke=STYLE.ink,sw=STYLE.detail)=>add(mapped(ellipseOps(x,y,rx,ry),point),fill,stroke,sw);
    owner=side+' wall';
    if(straight)poly(corners,STYLE.wall,STYLE.ink,STYLE.line);
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
        const lamp=point(x+1,y+.5);
        if(ms==='on'&&state.effects){
          if(straight)oval(x+1,y+.5,.45,.38,STYLE.lamp,'none',0);
          else add(ellipseOps(lamp[0]+(side==='left'?1:-1)*unit*.32,lamp[1],unit*.35,unit*.38),STYLE.lamp,'none',0);
          scene.at(-1).opacity=.16;
        }
        if(straight){
          oval(x+1,y+.5,.35,.34,STYLE.metal);
          oval(x+1,y+.5,.27,.27,ms==='on'?STYLE.lamp:STYLE.charcoal);
          oval(x+.98,y+.36,.18,.07,ms==='on'?'#FCF7E5':STYLE.lens,'none',0);
        }else{
          // Fit the source lamp inside one row while preserving its silhouette
          // with a uniform scale. The body protrudes toward the box interior.
          const k=unit*.74/10.89,sign=side==='left'?1:-1;
          reference('house',(sx,sy)=>[lamp[0]+sign*(sx-174.87)*k,lamp[1]+(sy-135.83)*k],k,p=>({...p,
            fill:ms==='on'&&p.fill==='#000000'?STYLE.lamp:ms==='on'&&p.fill==='#97CDDE'?'#FCF7E5':p.fill}));
        }
      }else if(m.type==='speaker'){
        // The reference's 61 perforations remain 61 independently editable
        // cubic paths, projected into whichever wall carries the module.
        // Recover the wall-face coordinates, then project that plane at the
        // destination cell. A fixed screen-space ellipse tilts incorrectly at
        // the upper rows and on the opposite wall.
        for(const p of grilleFront)add(mapped(p.ops,(u,v)=>point(x+.08+(u-frontBox.x)/frontBox.w*1.84,y+.1+(v-frontBox.y)/frontBox.h*1.8)),p.fill,'none',0);
        if(ms==='playing'&&state.effects){
          const pts=Array.from({length:49},(_,i)=>{
            const t=i/48,wave=opt.sound==='clicker'?(i%12<2?.12:-.04):opt.sound==='siren'?.12*Math.sin(t*t*32):opt.sound==='white'?.1*Math.sin(i*73.37)*Math.cos(i*18.7):.1*Math.sin(t*25.13);
            return point(x+.38+t*1.24,y+1.87+wave);
          });
          add(pts.map((v,i)=>({op:i?'L':'M',v})),'none',STYLE.glassEdge,1);
        }
      }else if(m.type==='lever'){
        rect(x+.34,y+.43,1.32,.12,STYLE.charcoal,STYLE.ink,.65);
        Object.assign(scene.at(-1),{role:'lever-slot',name:owner+' mounting slot'});
        if(ms==='extended'){
          if(straight){
            // A wall-normal front diagram sees the plate's edge, not a top face.
            rect(x+.4,y+.47,1.2,.06,STYLE.metal,STYLE.ink,STYLE.detail);
            Object.assign(scene.at(-1),{role:'lever-edge',name:owner+' front edge'});
          }
          else{
            // The plate is a horizontal solid attached along the wall's depth
            // axis. All corners use the existing chamber projection, rather
            // than mirroring an already-projected source silhouette.
            const height=1-(y+.47)/WALL_UNITS.height,thickness=.06/WALL_UNITS.height;
            const face=(s,inset,lower=0)=>{
              const u=(x+s)/WALL_UNITS.width;
              return chamberPoint(side==='left'?inset/WALL_UNITS.width:1-inset/WALL_UNITS.width,side==='left'?1-u:u,height-lower);
            };
            const near=side==='left'?.4:1.6,far=side==='left'?1.6:.4;
            const backNear=face(near,0),backFar=face(far,0),tipNear=face(near,.25),tipFar=face(far,.25);
            poly([tipFar,tipNear,face(near,.25,thickness),face(far,.25,thickness)],'#858480',STYLE.ink,STYLE.detail,{role:'lever-tip',name:owner+' free edge'});
            poly([backNear,tipNear,face(near,.25,thickness),face(near,0,thickness)],'#777670',STYLE.ink,STYLE.detail,{role:'lever-near',name:owner+' near edge'});
            poly([backNear,backFar,tipFar,tipNear],STYLE.metal,STYLE.ink,STYLE.detail,{role:'lever-top',name:owner+' top surface'});
          }
        }else{
          rect(x+.45,y+.47,1.1,.045,STYLE.metal,STYLE.ink,.6);
          Object.assign(scene.at(-1),{role:'lever-retracted',name:owner+' retracted edge'});
        }
      }else if(m.type==='water'||m.type==='food'){
        const size=.6+.08*VOLUMES.indexOf(opt.volume);
        if(straight){
          const cy=y+def.h-.4;
          rect(x+.35,y+.1,1.3,def.h-.24,STYLE.wall);
          oval(x+1,cy+.13,.52,.12,STYLE.floor);
          oval(x+1,cy,.52,.16,STYLE.wall);
          if(m.type==='water'&&ms==='full')oval(x+1,cy-.015,.44*size,.1*size,STYLE.water,STYLE.ink,.65);
          if(m.type==='food'&&ms==='full')for(const [dx,dy]of [[-.24,0],[0,-.025],[.24,.015]])oval(x+1+dx,cy+dy,.055,.04,FLAVORS[opt.flavor].color,'#8E8174',.55);
        }else{
          // The mount, recessed cup, liquid and food share one template frame.
          // Retain the original SVG aperture as native clipped curves, so the
          // cup remains inside the wall in PPT/PDF as well as the browser.
          const portPoint=(sx,sy)=>{
            const [u,v]=sourceWallPoint(sx,sy,'left'),local=.51+(u-portBox.x)/portBox.w*1.38;
            return point(x+(side==='left'?local:2-local),y+.1+(v-portBox.y)/portBox.h*(def.h-.24));
          };
          reference('waterMount',portPoint);
          const aperture=p=>{
            const clipped=clipNativePath(p.ops,APERTURES.waterCup);
            if(clipped.fillOps.length)add(mapped(clipped.fillOps,portPoint),p.fill,'none',0,{opacity:p.opacity});
            if(p.stroke!=='none'&&p.sw)for(const ops of clipped.strokeOps)add(mapped(ops,portPoint),'none',p.stroke,p.sw*REFERENCE_SCALE,{opacity:p.opacity});
          };
          for(const original of REFERENCE.waterCup){
            let p={...original};
            if(p.fill==='#68A7D9'){
              p={...p,fill:m.type==='water'&&ms==='full'?STYLE.water:STYLE.wall,
                ops:mapped(p.ops,(sx,sy)=>[163.4+(sx-163.4)*size,197.32+(sy-197.32)*size])};
            }
            aperture(p);
          }
          if(m.type==='food'&&ms==='full')for(const [dx,dy]of [[.8,.2],[1.8,-.15],[2.8,.35]])aperture({ops:ellipseOps(164.2+dx,197.3+dy,.5,.35),fill:FLAVORS[opt.flavor].color,stroke:'#8E8174',sw:.15,opacity:1});
        }
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
      if(devices)devices.push({depth:moduleDepth(side,m.col,m.row,def.h),key:side+' '+m.col+' '+m.row,paths:scene.splice(start)});
    }
    if(state.dimensions){
      owner='Dimensions';const a=xy(0,1.07),b=xy(1,1.07);line(a,b,STYLE.glassEdge,.8);text(WALL_UNITS.width+' units',(a[0]+b[0])/2,(a[1]+b[1])/2+22);
      const c=xy(-.09,0),d=xy(-.09,1);line(c,d,STYLE.glassEdge,.8);text(String(WALL_UNITS.height),(c[0]+d[0])/2-14,(c[1]+d[1])/2);
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
    const devices=[];wall(WALLS.perspective.left,'left',devices);wall(WALLS.perspective.right,'right',devices);
    floor();
    if(state.rat.visible)devices.push({depth:viewDepth(floorDepth(state.rat.y+35*state.rat.scale),0),key:'Rat',paths:ratScene(state.rat)});
    // Both walls and the animal share one order along the observer's sight line.
    // Glass remains translucent, so occupied upper cells remain visible through it.
    devices.sort((a,b)=>a.depth-b.depth||a.key.localeCompare(b.key));
    for(const device of devices)scene.push(...device.paths);
    owner='Box glass ceiling';reference('ceiling');
    owner='Box frame';reference('leftTrim');reference('rightTrim');
    owner='Box outer frame';reference('frame');
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
    const [upper,lower]=viewPanels('combined');
    perspective();const base=scene.map(s=>project(s,(x,y)=>upper.map([x,y]),upper.scale));
    scene=[];front();scene=base.concat(scene.map(s=>project(s,(x,y)=>lower.map([x,y]),lower.scale)));
  }
  return scene;
}
