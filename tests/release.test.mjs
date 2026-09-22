import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {initial,validate} from '../public/model.js';
import {english,setLanguage,t,cellLabel,countLabel} from '../public/i18n.js';

test('both interface languages leave configurations intact and translate dynamic labels',()=>{
  const state=initial(),before=JSON.stringify(state);
  setLanguage('en');assert.equal(t('房灯'),'House light');assert.match(cellLabel('left',1,2,'房灯'),/Left wall · Column 2 · Row 3 House light/);assert.match(countLabel(5),/5 modules/);
  setLanguage('zh');assert.equal(t('房灯'),'房灯');assert.match(cellLabel('right',0,1),/右墙/);assert.equal(JSON.stringify(state),before);
});
test('all literal translated interface strings have English entries',async()=>{
  const app=await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const keys=[...app.matchAll(/\bt\('([^'\n]*)'\)/g)].map(m=>m[1]);
  for(const key of keys)if(/[\u4e00-\u9fff]/.test(key))assert.ok(Object.hasOwn(english,key),`Missing translation: ${key}`);
});
test('shipped examples validate and round-trip without loss',async()=>{
  for(const file of ['dual-water','operant','empty']){
    const raw=JSON.parse(await fs.readFile(new URL(`../public/examples/${file}.chamber.json`,import.meta.url),'utf8'));
    assert.deepEqual(validate(raw),raw);
  }
});
