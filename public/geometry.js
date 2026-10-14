import {MODULES, occupant} from './model.js';
import {referencePoint,REFERENCE_HEIGHT} from './illustration-style.js';

export const CHAMBER = {
  bounds:{x:336,y:61,width:608,height:REFERENCE_HEIGHT},
  ceiling:[[152.95,118.97],[300.59,118.97],[273.45,101.24],[180.09,101.24]].map(p=>referencePoint(...p)),
  back:[[180.09,101.24],[273.45,101.24],[273.45,200.01],[180.09,200.01]].map(p=>referencePoint(...p)),
  floor:[[180.09,200.02],[273.45,200.02],[300.59,235.7],[152.95,235.7]].map(p=>referencePoint(...p)),
  sill:[[149.39,235.7],[304.15,235.7],[304.15,238.91],[149.39,238.91]].map(p=>referencePoint(...p))
};
export const WALLS = {
  // Installation coordinates belong to the whole side-wall plane. Its upper
  // edge follows the ceiling into depth; the front horizontal rim is not the
  // top of the rear cells. Feet meet the visible floor, not hidden extensions.
  perspective: {
    left:[[152.95,118.97],[180.09,101.24],[180.09,200.02],[152.95,235.7]].map(p=>referencePoint(...p)),
    right:[[273.45,101.24],[300.59,118.97],[300.59,235.7],[273.45,200.02]].map(p=>referencePoint(...p))
  },
  // The front diagram shows the 6 × 8 mounting face, cropped below the roof
  // clearance; it does not include the surrounding chamber shell.
  front: {left:[[230,85],[570,85],[570,565],[230,565]], right:[[750,85],[1090,85],[1090,565],[750,565]]}
};
export function wallPoint(corners,u,v) {
  const [a,b,c,d]=corners;
  return [0,1].map(i=>a[i]*(1-u)*(1-v)+b[i]*u*(1-v)+c[i]*u*v+d[i]*(1-u)*v);
}
// Keep a real, uniform height clearance on the wall plane. This matches the
// roof reveal (17.73 / 98.78 ≈ 18%), rounded up for the rim and device outlines,
// without flattening the depth axis or adding a screen-space row-zero offset.
export const INSTALLATION_TOP = .2;
export const installationPoint = (corners,u,v) => wallPoint(corners,u,INSTALLATION_TOP+(1-INSTALLATION_TOP)*v);
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
      const at=panel.mode==='perspective'?installationPoint:wallPoint;
      const points=[[col*2,row],[col*2+2,row],[col*2+2,row+h],[col*2,row+h]].map(([x,y])=>panel.map(at(corners,x/6,y/8)));
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
