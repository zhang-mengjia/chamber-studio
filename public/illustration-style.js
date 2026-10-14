import reference from './assets/reference-parts.json' with {type:'json'};

// One palette and the original SVG curves drive the editor and every export.
export const STYLE = Object.freeze({...reference.palette, line:1.25, detail:.75,
  lamp:'#F2E6B8', lens:'#97CDDE', grille:'#666666', skinShade:'#C7B2AE'});
export const REFERENCE = reference.parts;
export const APERTURES = reference.clips;
export const SOURCE_WALLS = {
  left:[[152.95,118.97],[180.09,101.24],[180.09,202.45],[152.95,235.7]],
  right:[[273.45,101.24],[300.59,118.97],[300.59,235.7],[273.45,202.45]]
};
// Source-path line weights use this scale. Chamber placement and its camera
// are defined by the editor's original full-height planes in geometry.js.
export const REFERENCE_SCALE = 608 / 155.26;
export function sourceWallPoint(x,y,side){
  const [a,b,c,d]=SOURCE_WALLS[side],u=(x-a[0])/(b[0]-a[0]);
  const top=a[1]*(1-u)+b[1]*u,bottom=d[1]*(1-u)+c[1]*u;
  return [u,(y-top)/(bottom-top)];
}
