import {MODULES, occupant} from './model.js';
import {referencePoint,SOURCE_WALLS} from './illustration-style.js';

export const CHAMBER = {
  bounds:{x:336,y:61,width:608,height:608},
  ceiling:[[152.95,118.97],[300.59,118.97],[273.45,101.24],[180.09,101.24]].map(p=>referencePoint(...p)),
  back:[[180.09,101.24],[273.45,101.24],[273.45,200.01],[180.09,200.01]].map(p=>referencePoint(...p)),
  floor:[[180.09,200.02],[273.45,200.02],[300.59,235.7],[152.95,235.7]].map(p=>referencePoint(...p)),
  sill:[[149.39,235.7],[304.15,235.7],[304.15,238.91],[149.39,238.91]].map(p=>referencePoint(...p))
};
export const WALLS = {
  perspective: Object.fromEntries(Object.entries(SOURCE_WALLS).map(([side,points])=>[side,points.map(p=>referencePoint(...p))])),
  front: {left:[[230,85],[570,85],[570,565],[230,565]], right:[[750,85],[1090,85],[1090,565],[750,565]]}
};
export function wallPoint(corners,u,v) {
  const [a,b,c,d]=corners;
  return [0,1].map(i=>a[i]*(1-u)*(1-v)+b[i]*u*(1-v)+c[i]*u*v+d[i]*(1-u)*v);
}
export function viewPanels(view) {
  return view==='combined'
    ? [{mode:'perspective',map:([x,y])=>[x*.68+210,y*.68]}, {mode:'front',map:([x,y])=>[x*.52+305,y*.4+475]}]
    : [{mode:view,map:p=>p}];
}
export function wallRegions(state, cells=false) {
  const regions=[];
  for(const panel of viewPanels(state.view)) for(const wall of ['left','right']) {
    for(let col=0;col<3;col++) for(let row=0;row<8;row++) {
      const m=occupant(state.walls[wall],col,row);
      if(!cells&&m&&m.row!==row) continue;
      const h=!cells&&m?MODULES[m.type].h:1;
      const corners=WALLS[panel.mode][wall];
      const points=[[col*2,row],[col*2+2,row],[col*2+2,row+h],[col*2,row+h]].map(([x,y])=>panel.map(wallPoint(corners,x/6,y/8)));
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
