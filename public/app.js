import {t,getLanguage,setLanguage,cellLabel,countLabel,staticTranslator} from './i18n.js';
import {MODULES,POSES,STATES,FLAVORS,SOUNDS,VOLUMES,options,defaultState,initial,occupant,place,validate} from './model.js';
import {buildScene,sceneToSVG} from './scene.js';
import {ratScene} from './rat-art.js';
import {wallRegions,contains} from './geometry.js';
import {insertModule,UndoHistory} from './editor.js';
import {download,pptxBlob,pdfBlob,pngBlob} from './export.js';

const $=id=>document.getElementById(id), KEY='chamber-studio-v1';
let state=initial(),selected=null,scene=[],clipboard=null,drag=null,draft=null,popup=null,toastTimer,scaleStart=null;
const translateStatic=staticTranslator(document);
translateStatic();
const exportSettings={resolution:2,transparent:true},history=new UndoHistory();
function toast(message,error=false){$('toast').textContent=message;$('toast').className='show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').className='',3600);}
try{const saved=localStorage.getItem(KEY);if(saved)state=validate(JSON.parse(saved));else state.name=t(state.name);}catch{toast(t('上次配置无法读取，已载入初始布局'),true);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));$('saved').textContent=t('已保存在本机');}catch{$('saved').textContent=t('自动保存失败，请保存配置');}}
function snapshot(){return {state,selected};}
function commit(next,nextSelected=selected){if(JSON.stringify(next)===JSON.stringify(state)){selected=nextSelected;render();return;}history.record(snapshot());state=next;selected=nextSelected;persist();render();}
function change(fn){const next=structuredClone(state);fn(next);commit(next);}
function chosen(){return selected?.kind==='wall'?occupant(state.walls[selected.wall],selected.col,selected.row):null;}
function normalizeSelection(){if(selected?.kind==='wall'){const m=chosen();if(m)selected={...selected,row:m.row};}if(selected?.kind==='rat'&&!state.rat.visible)selected=null;}
function restore(direction){cancelDrag();const result=history[direction](snapshot());if(!result)return;state=result.state;selected=result.selected;normalizeSelection();persist();render();}
function closePopup(clear=false){popup=null;$('popover').hidden=true;if(clear){selected=null;renderPreview();}}
function openPopup(kind,x,y){popup={kind,x,y};renderPopup();}
function placePopup(){if(!popup)return;const el=$('popover'),gap=14,w=el.offsetWidth,h=el.offsetHeight;let x=popup.x+gap,y=popup.y-22;if(x+w>innerWidth-12)x=popup.x-w-gap;el.style.left=Math.max(10,Math.min(x,innerWidth-w-10))+'px';el.style.top=Math.max(12,Math.min(y,innerHeight-h-12))+'px';}
function polygon(r,cls,extra=''){return `<polygon points="${r.points.map(p=>p.join(',')).join(' ')}" class="${cls}" ${extra}/>`;}
function previewSVG(){const s=draft||state,box=s.view==='perspective'?'205 40 875 670':s.view==='front'?'165 0 990 675':'200 0 900 760';const drawing=buildScene(s,[],true),regions=wallRegions(s);let overlay='<g class="interaction-layer">';
  for(const r of regions){const label=cellLabel(r.wall,r.col,r.row,r.type?MODULES[r.type].name:'空白面板');overlay+=polygon(r,'hit-zone',`data-wall="${r.wall}" data-col="${r.col}" data-row="${r.row}" data-mode="${r.mode}" tabindex="0" role="button" aria-label="${label}"`);}
  // Devices protruding past a cell boundary retain their own click target.
  const counts=new Map();for(const p of drawing){if(!p.ops||! /^(left|right) .* column \d+ row \d+$/.test(p.owner||''))continue;const n=counts.get(p.owner)||0;counts.set(p.owner,n+1);if(n<2||p.opacity<1)continue;overlay+=sceneToSVG([{...p,fill:p.fill==='none'?'none':'transparent',stroke:'transparent',sw:Math.max(p.sw,3)}],true).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');}
  if(selected?.kind==='wall')for(const r of regions)if(r.wall===selected.wall&&r.col===selected.col&&r.row===selected.row)overlay+=polygon(r,'selection-outline');
  if(selected?.kind==='rat'&&s.rat.visible){const pts=drawing.filter(p=>p.owner==='Rat').flatMap(p=>p.ops.flatMap(o=>o.v));const xs=pts.filter((_,i)=>i%2===0),ys=pts.filter((_,i)=>i%2);if(xs.length)overlay+=`<rect class="rat-outline" x="${Math.min(...xs)-8}" y="${Math.min(...ys)-8}" width="${Math.max(...xs)-Math.min(...xs)+16}" height="${Math.max(...ys)-Math.min(...ys)+16}" rx="8"/>`;}
  if(drag?.active&&drag.target){const cells=wallRegions(state,true).filter(r=>r.mode===drag.target.mode&&r.wall===drag.target.wall&&r.col===drag.target.col&&r.row>=drag.target.row&&r.row<drag.target.row+MODULES[drag.module.type].h);for(const r of cells)overlay+=polygon(r,'drop-outline'+(drag.valid?'':' invalid'));}
  overlay+='</g>';
  // Keep rat above wall hit areas; editor-only outlines never enter export scenes.
  const ratTop=sceneToSVG(drawing.filter(p=>p.owner==='Rat'),true).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
  return sceneToSVG(drawing.filter(p=>p.owner!=='Rat'),true).replace('viewBox="0 0 1280 760"',`viewBox="${box}"`).replace('</svg>',overlay+ratTop+'</svg>');
}
function renderPreview(){const focus=document.activeElement?.matches?.('#canvas [data-wall]')?{...document.activeElement.dataset}:null;scene=buildScene(state,[]);$('canvas').innerHTML=previewSVG();if(focus)$('canvas').querySelector(`[data-wall="${focus.wall}"][data-col="${focus.col}"][data-row="${focus.row}"][data-mode="${focus.mode}"]`)?.focus({preventScroll:true});$('canvasNote').textContent=state.view==='front'?t('点击任一面板或模块 · 拖动模块调整位置'):t('点击面板、设备、大鼠或地板 · 拖动调整位置');}
function render(){normalizeSelection();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));$('name').value=state.name;$('undo').disabled=!history.past.length;$('redo').disabled=!history.future.length;for(const [id,key]of [['gridToggle','grid'],['dimensions','dimensions'],['effects','effects']])$(id).checked=state[key];$('totalCount').textContent=countLabel(state.walls.left.length+state.walls.right.length);renderPreview();if(popup)renderPopup();}
function button(text,fn,cls=''){const b=document.createElement('button');b.textContent=t(text);b.className=cls;b.onclick=fn;return b;}
function hint(text){const p=document.createElement('p');p.className='hint';p.textContent=text;return p;}
function label(text){const p=document.createElement('h3');p.className='section-label';p.textContent=text;return p;}
function selectField(parent,title,id,values,value,fn){const l=document.createElement('label');l.className='field';l.textContent=title;const select=document.createElement('select');select.id=id;for(const [v,txt]of Object.entries(values)){const o=document.createElement('option');o.value=v;o.textContent=t(txt);select.append(o);}select.value=String(value);select.onchange=()=>fn(select.value);l.append(select);parent.append(l);}
function moduleProperty(key,value){change(n=>{const m=occupant(n.walls[selected.wall],selected.col,selected.row);if(m)m[key]=value;});}
function renderPopup(){if(!popup)return;const body=$('popoverBody');body.replaceChildren();$('popover').hidden=false;let title='',eyebrow='';
  if(popup.kind==='module'){
    if(selected?.kind!=='wall'){closePopup();return;}const m=chosen();title=m?MODULES[m.type].name:t('安装模块');eyebrow=cellLabel(selected.wall,selected.col,selected.row);
    if(m){const statuses=document.createElement('div');statuses.className='switch';statuses.id='moduleState';for(const [value,txt]of Object.entries(STATES[m.type])){const b=button(txt,()=>moduleProperty('state',value),value===(m.state??defaultState(m.type))?'active':'');b.dataset.state=value;statuses.append(b);}body.append(statuses);const opt=options(m);if(m.type==='food')selectField(body,t('颗粒口味'),'option-flavor',Object.fromEntries(Object.entries(FLAVORS).map(([k,v])=>[k,v.name])),opt.flavor,v=>moduleProperty('flavor',v));if(m.type==='water')selectField(body,t('水量（μL）'),'option-volume',Object.fromEntries(VOLUMES.map(v=>[v,v+' μL'])),opt.volume,v=>moduleProperty('volume',Number(v)));if(m.type==='speaker')selectField(body,t('声波类型'),'option-sound',SOUNDS,opt.sound,v=>moduleProperty('sound',v));if(m.type==='house'&&m.state==='flashing'){const l=document.createElement('label');l.className='field';l.textContent=t('闪烁频率（Hz）');const input=document.createElement('input');Object.assign(input,{id:'option-hz',type:'number',min:'.2',max:'5',step:'.1',value:String(opt.hz)});input.onchange=()=>{const hz=Number(input.value);if(!Number.isFinite(hz)||hz<.2||hz>5){toast(t('频率范围为 0.2–5 Hz'),true);input.value=opt.hz;return;}moduleProperty('hz',hz);};l.append(input);body.append(l);}body.append(label(t('替换模块')));}
    const modules=document.createElement('div');modules.className='modules';for(const [key,d]of Object.entries(MODULES)){const b=button('',()=>{try{if(m?.type===key)return;commit(place(state,selected.wall,selected.col,selected.row,key));}catch(e){toast(t(e.message),true);}},m?.type===key?'active':'');b.innerHTML=`<span><i style="background:${d.color}"></i>${t(d.name)}</span><small>2 × ${d.h}</small>`;b.dataset.module=key;modules.append(b);}body.append(modules);
    const actions=document.createElement('div');actions.className='popup-actions';if(m){actions.append(button(t('复制'),copyModule),button(t('剪切'),cutModule),button(t('删除'),removeSelected,'danger'));}else{const b=button(t('粘贴模块'),pasteModule);b.disabled=!clipboard;actions.append(b);}body.append(actions,hint(m?t('拖动模块移动位置；方向键微调安装格。'):t('直接选择模块安装。2 × 2 模块需连续两行空位。')));
  }else if(popup.kind==='rat'){
    title=t('大鼠素材');eyebrow=t('海报风黑白 LE 大鼠 · 拖动位置');const poses=document.createElement('div');poses.className='poses';for(const [pose,name]of Object.entries(POSES)){const b=button('',()=>{const n=structuredClone(state);n.rat.pose=pose;n.rat.visible=true;commit(n,{kind:'rat'});},state.rat.pose===pose?'active':'');b.dataset.pose=pose;b.innerHTML=sceneToSVG(ratScene({pose,x:245,y:250,scale:1,facing:'right'}),true).replace('viewBox="0 0 1280 760"','viewBox="25 70 440 265"')+`<span>${t(name)}</span>`;poses.append(b);}body.append(poses);selectField(body,t('朝向'),'facing',{right:t('向右'),left:t('向左')},state.rat.facing,v=>change(n=>n.rat.facing=v));const row=document.createElement('div');row.className='row';row.innerHTML=t('<label for="scale">大小</label><output id="scaleValue">')+Math.round(state.rat.scale*100)+'%</output>';const slider=document.createElement('input');Object.assign(slider,{id:'scale',type:'range',min:'45',max:'170',value:String(Math.round(state.rat.scale*100))});slider.oninput=()=>{if(!scaleStart)scaleStart=structuredClone(state);draft=structuredClone(state);draft.rat.scale=Number(slider.value)/100;$('scaleValue').textContent=slider.value+'%';renderPreview();};slider.onchange=()=>{if(!scaleStart)return;const next=draft;draft=null;scaleStart=null;commit(next);};body.append(row,slider);const actions=document.createElement('div');actions.className='popup-actions';actions.append(button(state.rat.visible?t('隐藏大鼠'):t('显示大鼠'),()=>{const next=structuredClone(state);next.rat.visible=!next.rat.visible;commit(next,next.rat.visible?{kind:'rat'}:null);}),button(t('回到中央'),()=>{const n=structuredClone(state);n.rat.x=650;n.rat.y=535;n.rat.scale=1;n.rat.visible=true;commit(n,{kind:'rat'});}));body.append(actions,hint(t('方向键移动 1 步，Shift + 方向键移动 10 步。')));
  }else if(popup.kind==='floor'){
    title=t('地板');eyebrow=t('箱体底部');const list=document.createElement('div');list.className='floor-options';for(const [value,txt]of [['bars',t('金属横杠')],['acrylic',t('多孔透明亚克力')]]){const b=button('',()=>change(n=>n.floor=value),state.floor===value?'active':'');b.dataset.floor=value;b.innerHTML=`<span class="floor-icon ${value}"></span>${t(txt)}`;list.append(b);}body.append(list);
  }else if(popup.kind==='export'){
    title=t('导出当前视图');eyebrow=t('矢量图 · 原生可编辑 PPT');selectField(body,t('PNG 分辨率'),'resolution',{1:'1280 × 760',2:'2560 × 1520',3:'3840 × 2280'},exportSettings.resolution,v=>exportSettings.resolution=Number(v));const l=document.createElement('label');l.className='check';l.innerHTML=t('<input id="transparent" type="checkbox">PNG 透明背景');l.querySelector('input').checked=exportSettings.transparent;l.querySelector('input').onchange=e=>exportSettings.transparent=e.target.checked;body.append(l);const actions=document.createElement('div');actions.className='export-buttons';for(const [type,name]of [['pptx',t('保存 PPT')],['pdf','PDF'],['png','PNG']]){const b=button(name,()=>exportFile(type),type==='pptx'?'primary':'');b.dataset.export=type;actions.append(b);}body.append(actions,hint(t('PPT 零件与大鼠各部分可独立编辑。闪烁导出为点亮灯体，图中不添加部件文字。')));
  }else if(popup.kind==='examples'){
    title=t('选择示例布局');eyebrow='Chamber Studio';
    for(const [file,name]of [['dual-water','双水槽'],['operant','操作性条件反射'],['empty','空白箱体']]){
      body.append(button(t(name),async()=>{try{const response=await fetch('./examples/'+file+'.chamber.json');if(!response.ok)throw Error(String(response.status));const next=validate(await response.json());next.name=t(name);closePopup();commit(next,null);}catch(e){toast(t('示例载入失败：')+t(e.message),true);}},'example-button'));
    }
    body.append(hint(t('载入示例将替换当前布局，可以撤销。')));
  }else{
    title=t('常用快捷键');eyebrow=t('选中图中对象后直接操作');const table=document.createElement('table');table.className='keys';for(const [key,desc]of [['Ctrl+Z',t('撤销')],['Ctrl+Y / Ctrl+Shift+Z',t('重做')],['Delete / Backspace',t('删除模块 / 隐藏大鼠')],['Ctrl+C / Ctrl+X',t('复制 / 剪切模块')],['Ctrl+V',t('粘贴到选中位置')],[t('方向键'),t('移动选中对象')],[t('Shift+方向键'),t('大鼠移动 10 步')],['Esc',t('取消拖动 / 取消选择')],['Ctrl+S',t('保存配置文件')]]){const tr=table.insertRow();tr.insertCell().textContent=key;tr.insertCell().textContent=desc;}body.append(table,hint(t('输入框中保留文字编辑快捷键。模块移动和粘贴不会覆盖已有设备。')));
  }
  $('popoverTitle').textContent=t(title);$('popoverEyebrow').textContent=eyebrow;placePopup();
}
function copyModule(){const m=chosen();if(!m)return;clipboard=structuredClone(m);toast(t('已复制')+t(MODULES[m.type].name)+t('，点击目标位置后 Ctrl+V'));}
function cutModule(){if(!chosen())return;copyModule();removeSelected();}
function pasteModule(){if(!clipboard||selected?.kind!=='wall')return;try{commit(insertModule(state,selected,clipboard));toast(t('已粘贴模块'));}catch(e){toast(t(e.message),true);}}
function removeSelected(){if(selected?.kind==='wall'&&chosen()){commit(place(state,selected.wall,selected.col,selected.row,'blank'));}else if(selected?.kind==='rat'){const n=structuredClone(state);n.rat.visible=false;commit(n,null);closePopup();}}
function point(e){const svg=$('canvas').querySelector('svg');return new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());}
function moduleSelection(element){const zone=element.closest('[data-wall]');if(zone)return {kind:'wall',wall:zone.dataset.wall,col:Number(zone.dataset.col),row:Number(zone.dataset.row),mode:zone.dataset.mode};const match=(element.dataset.owner||'').match(/^(left|right) .* column (\d+) row (\d+)$/);return match?{kind:'wall',wall:match[1],col:Number(match[2])-1,row:Number(match[3])-1}:null;}
function ratClamped(r){r.x=Math.max(200,Math.min(1050,r.x));r.y=Math.max(250,Math.min(660,r.y));return r;}
function cancelDrag(){if(!drag&&!draft)return;drag=null;draft=null;scaleStart=null;$('canvas').classList.remove('dragging');$('dragBadge').hidden=true;render();}
$('canvas').addEventListener('pointerdown',e=>{
  if(e.button!==0)return;const hit=moduleSelection(e.target),owner=e.target.dataset.owner||'';
  if(hit){const m=occupant(state.walls[hit.wall],hit.col,hit.row);selected={kind:'wall',wall:hit.wall,col:hit.col,row:m?.row??hit.row};drag={kind:'module',module:m?structuredClone(m):null,source:{...selected},start:point(e),screen:{x:e.clientX,y:e.clientY},id:e.pointerId,mode:hit.mode,grabRow:(wallRegions(state,true).find(r=>r.wall===hit.wall&&r.col===hit.col&&contains(r.points,point(e)))?.row??selected.row)-selected.row};}
  else if(owner==='Rat'){selected={kind:'rat'};drag={kind:'rat',start:point(e),screen:{x:e.clientX,y:e.clientY},id:e.pointerId,x:state.rat.x,y:state.rat.y,f:state.view==='combined'?1/.68:1};}
  else if(/^(Floor|Metal floor|Acrylic floor)/.test(owner)){selected={kind:'floor'};closePopup();openPopup('floor',e.clientX,e.clientY);renderPreview();return;}
  else{closePopup(true);return;}
  closePopup();$('canvas').focus({preventScroll:true});$('canvas').setPointerCapture(e.pointerId);renderPreview();e.preventDefault();
});
$('canvas').addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;if(!drag.active&&Math.hypot(e.clientX-drag.screen.x,e.clientY-drag.screen.y)<5)return;if(drag.kind==='module'&&!drag.module)return;
  drag.active=true;$('canvas').classList.add('dragging');const p=point(e);
  if(drag.kind==='rat'){draft=structuredClone(state);draft.rat=ratClamped({...state.rat,x:drag.x+(p.x-drag.start.x)*drag.f,y:drag.y+(p.y-drag.start.y)*drag.f});}
  else{drag.target=wallRegions(state,true).find(r=>contains(r.points,p));if(drag.target)drag.target={...drag.target,row:drag.target.row-drag.grabRow};drag.valid=false;if(drag.target){try{insertModule(state,drag.target,drag.module,drag.source);drag.valid=true;}catch{}}const badge=$('dragBadge');badge.hidden=false;badge.className=drag.valid?'':'invalid';badge.textContent=t(MODULES[drag.module.type].name)+' · '+(drag.valid?t('松开以放置'):t('此处无法放置'));badge.style.left=Math.min(innerWidth-180,e.clientX+16)+'px';badge.style.top=Math.max(12,e.clientY-35)+'px';}
  renderPreview();
});
$('canvas').addEventListener('pointerup',e=>{
  if(!drag||e.pointerId!==drag.id)return;const ended=drag,next=draft;drag=null;draft=null;$('canvas').classList.remove('dragging');$('dragBadge').hidden=true;if($('canvas').hasPointerCapture(e.pointerId))$('canvas').releasePointerCapture(e.pointerId);
  if(ended.active){if(ended.kind==='rat')commit(next);else if(ended.valid){const t=ended.target;try{commit(insertModule(state,t,ended.module,ended.source),{kind:'wall',wall:t.wall,col:t.col,row:t.row});}catch(error){renderPreview();toast(t(error.message),true);}}else{renderPreview();toast(t('无法放置：需要足够的连续空位，已保留原位置'),true);}}
  else{renderPreview();openPopup(ended.kind==='rat'?'rat':'module',e.clientX,e.clientY);}
});
$('canvas').addEventListener('pointercancel',cancelDrag);
$('canvas').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-wall]')){e.preventDefault();selected=moduleSelection(e.target);const r=e.target.getBoundingClientRect();openPopup('module',r.right,r.top);renderPreview();}});
document.addEventListener('pointerdown',e=>{if(popup&&!e.composedPath().includes($('popover'))&&!e.composedPath().includes($('canvas'))&&!e.target.closest('#ratTool,#floorTool,#exportMenu,#shortcutHelp,#examples'))closePopup();});
$('closePopover').onclick=()=>{closePopup();$('canvas').focus({preventScroll:true});};
for(const [id,kind]of [['ratTool','rat'],['floorTool','floor'],['exportMenu','export'],['shortcutHelp','help'],['examples','examples']])$(id).onclick=()=>{if(kind==='rat'){selected=state.rat.visible?{kind:'rat'}:null;renderPreview();}if(kind==='floor'){selected={kind:'floor'};renderPreview();}const r=$(id).getBoundingClientRect();openPopup(kind,r.left,r.bottom+25);};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{closePopup();change(n=>n.view=b.dataset.view);});
$('undo').onclick=()=>restore('undo');$('redo').onclick=()=>restore('redo');$('reset').onclick=()=>{closePopup();const next=initial();next.name=t(next.name);commit(next,null);toast(t('已恢复初始布局，可撤销'));};$('name').onchange=()=>change(n=>n.name=$('name').value.trim()||t('未命名方案'));
for(const [id,key]of [['gridToggle','grid'],['dimensions','dimensions'],['effects','effects']])$(id).onchange=()=>change(n=>n[key]=$(id).checked);
function saveConfig(){download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),state.name+'.chamber.json');}
$('saveConfig').onclick=saveConfig;$('loadConfig').onclick=()=>$('file').click();$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;try{if(f.size>1024*1024)throw Error(t('配置文件过大'));closePopup();commit(validate(JSON.parse(await f.text())),null);toast(t('配置已载入'));}catch(e){toast(t('载入失败：')+t(e.message),true);}finally{$('file').value='';}};
async function exportFile(type){const buttons=[...document.querySelectorAll('[data-export]')];buttons.forEach(b=>b.disabled=true);toast(t('正在生成 ')+type.toUpperCase()+'…');try{const blob=type==='pptx'?await pptxBlob(scene):type==='pdf'?await pdfBlob(scene):await pngBlob(scene,exportSettings.resolution,exportSettings.transparent);download(blob,(state.name||'chamber').replace(/[<>:"/\\|?*]/g,'_')+'.'+type);toast(type.toUpperCase()+t(' 已生成'));}catch(e){toast(t('导出失败：')+t(e.message),true);console.error(e);}finally{buttons.forEach(b=>b.disabled=false);}}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();if(drag||draft)cancelDrag();else closePopup(true);$('canvas').focus({preventScroll:true});return;}
  if(e.isComposing||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  const key=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;if(drag){e.preventDefault();return;}
  if(mod&&key==='z'){e.preventDefault();restore(e.shiftKey?'redo':'undo');return;}if(mod&&key==='y'){e.preventDefault();restore('redo');return;}if(mod&&key==='s'){e.preventDefault();saveConfig();return;}
  if(mod&&['c','x','v'].includes(key)){if(selected?.kind==='wall'){e.preventDefault();({c:copyModule,x:cutModule,v:pasteModule})[key]();}return;}
  if(['Delete','Backspace'].includes(e.key)&&selected){e.preventDefault();removeSelected();return;}
  const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta||!selected||mod||e.altKey)return;e.preventDefault();closePopup();
  if(selected.kind==='rat'){const step=e.shiftKey?10:1;change(n=>{n.rat=ratClamped({...n.rat,x:n.rat.x+delta[0]*step,y:n.rat.y+delta[1]*step});});}
  else if(selected.kind==='wall'){const m=chosen(),target={...selected,col:selected.col+delta[0],row:selected.row+delta[1]};if(m){try{commit(insertModule(state,target,m,selected),target);}catch(e){toast(t(e.message),true);}}else{selected={...target,col:Math.max(0,Math.min(2,target.col)),row:Math.max(0,Math.min(7,target.row))};normalizeSelection();renderPreview();}}
});
window.addEventListener('resize',()=>{if(popup)placePopup();});window.addEventListener('blur',()=>{if(drag)cancelDrag();});
window.chamber={getState:()=>structuredClone(state),getScene:()=>structuredClone(scene),setState:s=>{closePopup();commit(validate(s),null);},getSelection:()=>structuredClone(selected),exportPptx:pptxBlob,exportPdf:pdfBlob,exportPng:pngBlob};
$('language').value=getLanguage();
$('language').onchange=()=>{cancelDrag();setLanguage($('language').value);translateStatic();persist();render();};
render();
let flashPhase='';
setInterval(()=>{if(document.hidden||drag||draft)return;const phase=[...state.walls.left,...state.walls.right].filter(m=>m.type==='house'&&m.state==='flashing').map(m=>Date.now()%(1000/options(m).hz)>500/options(m).hz?'0':'1').join('');if(phase!==flashPhase){flashPhase=phase;renderPreview();}},60);
