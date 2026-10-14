import {MODULES, occupant} from './model.js';
import {referencePoint,REFERENCE_HEIGHT} from './illustration-style.js';

export const WALL_UNITS = {width:6,height:8};
export const CHAMBER = {
  bounds:{x:336,y:61,width:608,height:REFERENCE_HEIGHT},
  ceiling:[[152.95,118.97],[300.59,118.97],[273.45,101.24],[180.09,101.24]].map(p=>referencePoint(...p)),
  back:[[180.09,101.24],[273.45,101.24],[273.45,200.01],[180.09,200.01]].map(p=>referencePoint(...p)),
  floor:[[180.09,200.02],[273.45,200.02],[300.59,235.7],[152.95,235.7]].map(p=>referencePoint(...p)),
  sill:[[149.39,235.7],[304.15,235.7],[304.15,238.91],[149.39,238.91]].map(p=>referencePoint(...p))
};
export const WALLS = {
  // The reference camera and full-height installation planes are independent
  // of the front rim's screen position. Every row spans the actual wall face.
  perspective: {
    left:[[152.95,118.97],[180.09,101.24],[180.09,200.02],[152.95,235.7]].map(p=>referencePoint(...p)),
    right:[[273.45,101.24],[300.59,118.97],[300.59,235.7],[273.45,200.02]].map(p=>referencePoint(...p))
  },
  // Equal scales in both axes: 60 drawing points per physical unit, giving
  // 2:1 single-row modules and square two-row modules before perspective.
  front: {left:[[220,85],[580,85],[580,565],[220,565]], right:[[740,85],[1100,85],[1100,565],[740,565]]}
};
export function wallPoint(corners,u,v) {
  const [a,b,c,d]=corners;
  return [0,1].map(i=>a[i]*(1-u)*(1-v)+b[i]*u*(1-v)+c[i]*u*v+d[i]*(1-u)*v);
}
// Project a point in the chamber volume without changing the reference camera.
// x: left→right, depth: rear→front, height: floor→ceiling (each 0–1).
export function chamberPoint(x,depth,height) {
  const floor=wallPoint(CHAMBER.floor,x,depth);
  const roof=wallPoint([CHAMBER.ceiling[3],CHAMBER.ceiling[2],CHAMBER.ceiling[1],CHAMBER.ceiling[0]],x,depth);
  return floor.map((v,i)=>v*(1-height)+roof[i]*height);
}
const frontRise=CHAMBER.ceiling[0][1]-CHAMBER.ceiling[3][1];
const floorRise=CHAMBER.floor[3][1]-CHAMBER.floor[0][1];
const verticalSpan=((CHAMBER.floor[3][1]-CHAMBER.ceiling[0][1])+(CHAMBER.floor[0][1]-CHAMBER.ceiling[3][1]))/2;
// The center of the supplied projection gives the observer's elevation relative
// to chamber depth. Higher parts at the same depth are nearer this observer.
export const CAMERA_RISE=(frontRise+floorRise)/2/WALL_UNITS.width/(verticalSpan/WALL_UNITS.height);
export const viewDepth=(depth,height)=>depth*WALL_UNITS.width+height*WALL_UNITS.height*CAMERA_RISE;
export function moduleDepth(wall,col,row,height=1) {
  const u=(col*2+1)/WALL_UNITS.width;
  return viewDepth(wall==='left'?1-u:u,1-(row+height/2)/WALL_UNITS.height);
}
export function floorDepth(y) {
  return Math.max(0,Math.min(1,(y-CHAMBER.floor[0][1])/(CHAMBER.floor[3][1]-CHAMBER.floor[0][1])));
}
export function viewPanels(view) {
  return view==='combined'
    ? [{mode:'perspective',scale:.68,map:([x,y])=>[x*.68+210,y*.68]}, {mode:'front',scale:.4,map:([x,y])=>[x*.4+384,y*.4+420]}]
    : [{mode:view,scale:1,map:p=>p}];
}
export function wallRegions(state, cells=false) {
  const regions=[];
  for(const panel of viewPanels(state.view)) for(const wall of ['left','right']) {
    for(let col=0;col<3;col++) for(let row=0;row<8;row++) {
      const m=occupant(state.walls[wall],col,row);
      if(!cells&&m&&m.row!==row) continue;
      const h=!cells&&m?MODULES[m.type].h:1;
      const corners=WALLS[panel.mode][wall];
      const points=[[col*2,row],[col*2+2,row],[col*2+2,row+h],[col*2,row+h]].map(([x,y])=>panel.map(wallPoint(corners,x/WALL_UNITS.width,y/WALL_UNITS.height)));
      regions.push({wall,col,row,h,points,mode:panel.mode,type:m?.type});
    }
  }
  return regions;
}
export function contains(points,p) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [xi,yi]=points[i], [xj,yj]=points[j];
    if((yi>p.y)!==(yj>p.y)&&p.x<(xj-xi)*(p.y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
