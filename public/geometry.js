import {MODULES, occupant} from './model.js';

export const WALL_UNITS = {width:6,height:8};
export const CHAMBER = {
  bounds:{x:336,y:61,width:608,height:608},
  ceiling:[[340,65],[940,65],[815,155],[465,155]],
  back:[[465,155],[815,155],[815,515],[465,515]],
  floor:[[465,515],[815,515],[940,635],[340,635]],
  sill:[[340,635],[940,635],[940,665],[340,665]]
};
export const WALLS = {
  // Retain the original editor's camera and full 6 × 8 installation planes.
  // Every row, including the upper and lower rows, is an installation row.
  perspective: {
    left:[[340,65],[465,155],[465,515],[340,635]],
    right:[[815,155],[940,65],[940,635],[815,515]]
  },
  // Equal scales in both axes: 60 drawing points per physical unit, giving
  // 2:1 single-row modules and square two-row modules before perspective.
  front: {left:[[220,85],[580,85],[580,565],[220,565]], right:[[740,85],[1100,85],[1100,565],[740,565]]}
};
export function wallPoint(corners,u,v) {
  const [a,b,c,d]=corners;
  return [0,1].map(i=>a[i]*(1-u)*(1-v)+b[i]*u*(1-v)+c[i]*u*v+d[i]*(1-u)*v);
}
export function viewPanels(view) {
  return view==='combined'
    ? [{mode:'perspective',map:([x,y])=>[x*.68+210,y*.68]}, {mode:'front',map:([x,y])=>[x*.4+384,y*.4+475]}]
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
