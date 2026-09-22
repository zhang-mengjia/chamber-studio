import {MODULES,occupant} from './model.js';

// Insertions and moves are atomic: occupied destinations are never overwritten.
export function insertModule(state,destination,module,source=null) {
  const next=structuredClone(state), {wall,col,row}=destination;
  if(!['left','right'].includes(wall)||!Number.isInteger(col)||col<0||col>2||!Number.isInteger(row)||row<0||!MODULES[module.type]||row+MODULES[module.type].h>8) throw Error('模块超出墙面边界');
  if(source) {
    const original=occupant(next.walls[source.wall],source.col,source.row);
    if(!original) throw Error('原模块已不存在');
    next.walls[source.wall]=next.walls[source.wall].filter(m=>m!==original);
  }
  for(let r=row;r<row+MODULES[module.type].h;r++) if(occupant(next.walls[wall],col,r)) throw Error('此位置已被占用，请选择连续的空白面板');
  next.walls[wall].push({...structuredClone(module),col,row});
  return next;
}

export class UndoHistory {
  constructor(limit=60){this.past=[];this.future=[];this.limit=limit;}
  record(snapshot){this.past.push(structuredClone(snapshot));if(this.past.length>this.limit)this.past.shift();this.future=[];}
  undo(current){if(!this.past.length)return null;this.future.push(structuredClone(current));return this.past.pop();}
  redo(current){if(!this.future.length)return null;this.past.push(structuredClone(current));return this.future.pop();}
}
