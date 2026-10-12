import assets from './assets/rats/poses.json' with {type:'json'};

// Original PNGs stay intact. Each pose uses its visible bounds and a common
// floor anchor, so changing pose does not change the rat's position or size.
export function ratScene(r){
  const pose=Object.hasOwn(assets,r.pose)?r.pose:'stand',asset=assets[pose];
  const scale=.265*r.scale,{crop}=asset,flip=r.facing==='left';
  const width=crop.width*scale,height=crop.height*scale;
  const x=r.x-width/2,y=r.y+35*r.scale-(asset.feetY-crop.y)*scale;
  const points=asset.outline.map(([px,py])=>[
    x+(flip?crop.width-(px-crop.x):px-crop.x)*scale,
    y+(py-crop.y)*scale
  ]);
  return [{name:`LE rat ${pose}`,owner:'Rat',image:asset.file,
    sourceWidth:asset.sourceWidth,sourceHeight:asset.sourceHeight,crop,
    x,y,width,height,flip,
    hitOps:[{op:'M',v:points[0]},...points.slice(1).map(v=>({op:'L',v})),{op:'Z',v:[]}]
  }];
}
