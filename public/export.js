import {toD,sceneBounds,sceneToSVG} from './scene.js';
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const emu=n=>Math.round(n*9525);
const hex=c=>(c||'#000000').replace('#','').toUpperCase();
const solid=(c,opacity=1)=>!c||c==='none'?'<a:noFill/>':`<a:solidFill><a:srgbClr val="${hex(c)}">${opacity<1?`<a:alpha val="${Math.round(opacity*100000)}"/>`:''}</a:srgbClr></a:solidFill>`;
export function download(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const imageCache=new Map();
async function imageBytes(source){
  if(!imageCache.has(source))imageCache.set(source,(async()=>{
    const response=await fetch(source);
    if(!response.ok)throw Error('无法读取大鼠图片');
    return new Uint8Array(await response.arrayBuffer());
  })().catch(error=>{imageCache.delete(source);throw error;}));
  return imageCache.get(source);
}
function dataURL(bytes){
  let binary='';
  for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return 'data:image/png;base64,'+btoa(binary);
}
// Embed any pictures in custom scenes so SVG/PNG also work away from the site.
export async function svgBlob(scene,transparent=true){
  const embedded=await Promise.all(scene.map(async s=>s.image?{...s,image:dataURL(await imageBytes(s.image))}:s));
  return new Blob([sceneToSVG(embedded,transparent)],{type:'image/svg+xml'});
}
function bounds(s){if(s.image)return [s.x,s.y,s.width,s.height];if(s.text!==undefined){const w=Math.max(20,s.text.length*s.size*.61+12);return [s.x-w/2,s.y-s.size,w,s.size*1.5];}const points=s.ops.flatMap(o=>o.v||[]),xs=points.filter((_,i)=>i%2===0),ys=points.filter((_,i)=>i%2===1),l=Math.min(...xs),t=Math.min(...ys);return [l,t,Math.max(.01,Math.max(...xs)-l),Math.max(.01,Math.max(...ys)-t)];}
export async function pptxBlob(scene){const box=sceneBounds(scene);const raw=await fetch('./assets/template.pptx');if(!raw.ok)throw Error('无法读取 PPT 模板');const z=await JSZip.loadAsync(await raw.arrayBuffer());let id=2;
const media=new Map();
for(const s of scene)if(s.image&&!media.has(s.image)){
  const index=media.size+1,entry={rid:`ratImage${index}`,file:`rat-${index}.png`};
  media.set(s.image,entry);z.file('ppt/media/'+entry.file,await imageBytes(s.image));
}
if(media.size){
  const relPath='ppt/slides/_rels/slide1.xml.rels',rels=await z.file(relPath).async('string');
  const imageRels=[...media.values()].map(m=>`<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${m.file}"/>`).join('');
  z.file(relPath,rels.replace('</Relationships>',imageRels+'</Relationships>'));
  const types=await z.file('[Content_Types].xml').async('string');
  if(!/<Default\b[^>]*Extension="png"/.test(types))z.file('[Content_Types].xml',types.replace('</Types>','<Default Extension="png" ContentType="image/png"/></Types>'));
}
function shape(s){const [l,t,w,h]=bounds(s);
if(s.image){
  const c=s.crop,percent=(n,total)=>Math.round(n/total*100000);
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id++}" name="${xml(s.name||s.owner)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${media.get(s.image).rid}"/><a:srcRect l="${percent(c.x,s.sourceWidth)}" t="${percent(c.y,s.sourceHeight)}" r="${percent(s.sourceWidth-c.x-c.width,s.sourceWidth)}" b="${percent(s.sourceHeight-c.y-c.height,s.sourceHeight)}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm${s.flip?' flipH="1"':''}><a:off x="${emu(l)}" y="${emu(t)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}
const nv=`<p:nvSpPr><p:cNvPr id="${id++}" name="${xml(s.name||s.owner)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`;const xf=`<a:xfrm><a:off x="${emu(l)}" y="${emu(t)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>`;
if(s.text!==undefined)return `<p:sp>${nv}<p:spPr>${xf}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="none" lIns="0" rIns="0" tIns="0" bIns="0" anchor="t"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="${Math.round(s.size*75)}">${solid(s.fill)}<a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/></a:rPr><a:t>${xml(s.text)}</a:t></a:r><a:endParaRPr/></a:p></p:txBody></p:sp>`;
const point=(v,i=0)=>`<a:pt x="${emu(v[i]-l)}" y="${emu(v[i+1]-t)}"/>`;const commands=s.ops.map(o=>o.op==='M'?`<a:moveTo>${point(o.v)}</a:moveTo>`:o.op==='L'?`<a:lnTo>${point(o.v)}</a:lnTo>`:o.op==='C'?`<a:cubicBezTo>${point(o.v)}${point(o.v,2)}${point(o.v,4)}</a:cubicBezTo>`:o.op==='Q'?`<a:quadBezTo>${point(o.v)}${point(o.v,2)}</a:quadBezTo>`:'<a:close/>').join('');return `<p:sp>${nv}<p:spPr>${xf}<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${emu(w)}" h="${emu(h)}" fill="${s.fill==='none'?'none':'norm'}">${commands}</a:path></a:pathLst></a:custGeom>${solid(s.fill,s.opacity??1)}<a:ln w="${emu(s.sw||0)}" cap="rnd">${solid(s.stroke,s.opacity??1)}<a:round/></a:ln></p:spPr></p:sp>`;}
const groups=[];for(const s of scene){if(groups.at(-1)?.owner===s.owner)groups.at(-1).items.push(s);else groups.push({owner:s.owner,items:[s]});}let content='';for(const group of groups){const b=group.items.map(bounds);const l=Math.min(...b.map(x=>x[0])),t=Math.min(...b.map(x=>x[1])),r=Math.max(...b.map(x=>x[0]+x[2])),bot=Math.max(...b.map(x=>x[1]+x[3]));const gid=id++;content+=`<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${gid}" name="${xml(group.owner)}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${emu(l-box.x)}" y="${emu(t-box.y)}"/><a:ext cx="${emu(r-l)}" cy="${emu(bot-t)}"/><a:chOff x="${emu(l)}" y="${emu(t)}"/><a:chExt cx="${emu(r-l)}" cy="${emu(bot-t)}"/></a:xfrm></p:grpSpPr>${group.items.map(shape).join('')}</p:grpSp>`;}
z.file('ppt/slides/slide1.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Modular chamber"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${content}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
const presentation=await z.file('ppt/presentation.xml').async('string');
z.file('ppt/presentation.xml',presentation.replace(/<p:sldSz\b[^>]*\/>/,`<p:sldSz cx="${emu(box.width)}" cy="${emu(box.height)}" type="custom"/>`));
return z.generateAsync({type:'blob',compression:'DEFLATE',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});}
export async function pdfBlob(scene){
  const box=sceneBounds(scene);
  const {PDFDocument,StandardFonts,rgb,pushGraphicsState,popGraphicsState,rectangle,clip,endPath,concatTransformationMatrix}=PDFLib;
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),page=doc.addPage([box.width,box.height]);
  const color=c=>{if(!c||c==='none')return undefined;const h=hex(c);return rgb(parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255);};
  const embedded=new Map();
  for(const s of scene){
    if(s.image){
      if(!embedded.has(s.image))embedded.set(s.image,await doc.embedPng(await imageBytes(s.image)));
      const c=s.crop,k=s.width/c.width,x=s.x-box.x,y=box.height+box.y-s.y-s.height;
      page.pushOperators(pushGraphicsState(),rectangle(x,y,s.width,s.height),clip(),endPath());
      if(s.flip)page.pushOperators(concatTransformationMatrix(-1,0,0,1,2*x+s.width,0));
      page.drawImage(embedded.get(s.image),{x:x-c.x*k,y:y-(s.sourceHeight-c.y-c.height)*k,width:s.sourceWidth*k,height:s.sourceHeight*k});
      page.pushOperators(popGraphicsState());
    }else if(s.text!==undefined){
      const width=font.widthOfTextAtSize(s.text,s.size);page.drawText(s.text,{x:s.x-box.x-width/2,y:box.height+box.y-s.y,size:s.size,font,color:color(s.fill)});
    }else page.drawSvgPath(toD(s.ops),{x:-box.x,y:box.height+box.y,scale:1,color:color(s.fill),borderColor:color(s.stroke),borderWidth:s.stroke==='none'?0:s.sw,opacity:s.opacity??1,borderOpacity:s.opacity??1});
  }
  doc.setTitle('Modular chamber configuration');doc.setCreator('Chamber Studio');return new Blob([await doc.save()],{type:'application/pdf'});
}
export async function pngBlob(scene,scale=2,transparent=true){const box=sceneBounds(scene),svg=await svgBlob(scene,transparent);const url=URL.createObjectURL(svg);try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=Math.ceil(box.width*scale);canvas.height=Math.ceil(box.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return await new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(Error('PNG 生成失败')),'image/png'));}finally{URL.revokeObjectURL(url);}}
export async function copyPng(scene,scale=2,transparent=true){
  if(!globalThis.ClipboardItem||!navigator.clipboard?.write)throw Error('当前浏览器无法复制图片，请使用 PNG 导出');
  // Start the write in the click gesture, even while PNG rendering is pending.
  const image=pngBlob(scene,scale,transparent);
  image.catch(()=>{});
  await navigator.clipboard.write([new ClipboardItem({'image/png':image})]);
}
