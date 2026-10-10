import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {initial, validate, occupant} from '../public/model.js';
import {UndoHistory} from '../public/editor.js';
import {API_VERSION, TOOLS, CONFIG_SCHEMA, manifest} from '../public/agent-contract.js';
import {createAgentAPI, checkArguments, registerWebMCP} from '../public/agent.js';

function setup(extra = {}) {
  let state = initial(), commits = 0;
  const history = new UndoHistory();
  const api = createAgentAPI({
    getState:() => state,
    setState:next => {
      if (JSON.stringify(next) === JSON.stringify(state)) return;
      history.record({state}); state = next; commits++;
    },
    undo:() => { const next=history.undo({state}); if(!next) return false; state=next.state; return true; },
    redo:() => { const next=history.redo({state}); if(!next) return false; state=next.state; return true; },
    fetchExample:async name => JSON.parse(await fs.readFile(new URL(`../public/examples/${name}.chamber.json`,import.meta.url),'utf8')),
    ...extra
  });
  return {api, history, commits:() => commits};
}
const add = (wall,col,row,type,extra={}) => ({action:'add',wall,col,row,type,...extra});

test('published discovery matches the runtime contract and all shipped configurations match the schema', async () => {
  for (const [file, expected] of [['manifest.json',manifest()],['config.schema.json',CONFIG_SCHEMA]]) {
    assert.deepEqual(JSON.parse(await fs.readFile(new URL('../public/api/'+file,import.meta.url),'utf8')),expected);
  }
  checkArguments(CONFIG_SCHEMA,initial());
  for (const name of ['empty','operant','dual-water']) {
    checkArguments(CONFIG_SCHEMA,JSON.parse(await fs.readFile(new URL(`../public/examples/${name}.chamber.json`,import.meta.url),'utf8')));
  }
});

test('tool reads return independent data and cannot alter the live schemas or configuration', async () => {
  const {api,commits} = setup();
  assert.equal(api.apiVersion,API_VERSION);
  const state = await api.callTool('chamber_get_state'); state.result.rat.x = 201;
  const capabilities = await api.callTool('chamber_get_capabilities'); capabilities.result.tools[0].name = 'changed';
  const tools=api.listTools(); tools[0].inputSchema.properties.foo={type:'string'};
  assert.equal(api.getState().rat.x,650);
  assert.equal(api.listTools()[0].name,'chamber_get_capabilities');
  assert.equal((await api.callTool('chamber_get_capabilities',{foo:'bad'})).error.code,'INVALID_ARGUMENT');
  assert.equal(commits(),0);
});

test('a batch is one undo step and a later collision rolls back the entire batch and history', async () => {
  const {api,history,commits} = setup();
  const before=api.getState();
  const failed=await api.callTool('chamber_apply_operations',{operations:[
    add('right',0,3,'lever'),add('left',0,5,'water')
  ]});
  assert.equal(failed.error.code,'OCCUPIED');
  assert.deepEqual(api.getState(),before); assert.equal(commits(),0); assert.equal(history.past.length,0);
  const success=await api.callTool('chamber_apply_operations',{operations:[
    add('right',0,3,'lever',{state:'retracted'}),
    {action:'settings',settings:{view:'combined',floor:'acrylic',rat:{visible:false}}}
  ]});
  assert.equal(success.ok,true); assert.equal(commits(),1); assert.equal(history.past.length,1);
  const undone=await api.callTool('chamber_undo'); assert.equal(undone.result.changed,true); assert.deepEqual(undone.result.state,before);
  const redone=await api.callTool('chamber_redo'); assert.equal(redone.result.changed,true); assert.equal(redone.result.state.view,'combined');
});

test('update and self/cross-wall moves preserve module options when addressing the lower row', async () => {
  const {api}=setup();
  const updated=await api.callTool('chamber_apply_operations',{operations:[
    {action:'update',wall:'left',col:0,row:6,properties:{state:'full',volume:160}},
    {action:'move',from:{wall:'left',col:0,row:6},to:{wall:'left',col:0,row:6}},
    {action:'move',from:{wall:'left',col:0,row:7},to:{wall:'right',col:0,row:4}}
  ]});
  assert.equal(updated.ok,true);
  assert.equal(occupant(api.getState().walls.right,0,5).volume,160);
  assert.equal(occupant(api.getState().walls.right,0,4).state,'full');
  assert.equal(occupant(api.getState().walls.left,0,6),undefined);
  const replaced=await api.callTool('chamber_apply_operations',{operations:[
    {action:'remove',wall:'right',col:0,row:5},add('right',0,4,'nose',{state:'on'})
  ]});
  assert.equal(replaced.result.walls.right.find(m=>m.col===0).type,'nose');
});

test('invalid coordinates, module options, unknown fields and missing modules leave state untouched', async () => {
  const {api}=setup(); const before=api.getState();
  const invalid=[
    add('left',0,7,'speaker'),add('roof',0,2,'nose'),add('left',1.5,2,'nose'),add('left',0,2,'water',{volume:25}),
    {action:'update',wall:'left',col:0,row:5,properties:{flavor:'grain'}},
    {action:'update',wall:'left',col:0,row:5,properties:{state:'flashing'}},
    {action:'settings',settings:{effects:'false'}}, {action:'settings',settings:{rat:{x:1051}}},
    {action:'settings',settings:{view:'typo'}}, {action:'settings',settings:{rat:{visible:null}}},
    {action:'settings',settings:{name:'a'.repeat(81)}}, {action:'delete',wall:'left',col:0,row:0},
    {action:'add',wall:'left',col:0,row:1,type:'camera',typo:true}
  ];
  for (const op of invalid) {
    const result=await api.callTool('chamber_apply_operations',{operations:[op]});
    assert.equal(result.ok,false,JSON.stringify(op)); assert.equal(result.error.code,'INVALID_ARGUMENT'); assert.deepEqual(api.getState(),before);
  }
  assert.equal((await api.callTool('chamber_apply_operations',{operations:[{action:'remove',wall:'right',col:2,row:7}]})).error.code,'NOT_FOUND');
  for (const args of [{}, {operations:[]}, {operations:[invalid[0]],unexpected:1}, null]) {
    assert.equal((await api.callTool('chamber_apply_operations',args)).error.code,'INVALID_ARGUMENT');
  }
  assert.equal((await api.callTool('does_not_exist')).error.code,'UNKNOWN_TOOL');
});

test('loading a configuration rejects overlaps and wrong shapes and migrates legacy poses/labels', async () => {
  const {api}=setup(), original=api.getState();
  const overlapping=initial(); overlapping.walls.left.push({type:'nose',col:0,row:6});
  assert.equal((await api.callTool('chamber_load_config',{config:overlapping})).error.code,'INVALID_CONFIG');
  const invalid=initial(); invalid.rat.visible='false';
  assert.equal((await api.callTool('chamber_load_config',{config:invalid})).error.code,'INVALID_ARGUMENT');
  assert.deepEqual(api.getState(),original);
  const legacy=initial(); legacy.rat.pose='walk'; legacy.labels=true;
  const migrated=await api.callTool('chamber_load_config',{config:legacy});
  assert.equal(migrated.result.rat.pose,'stand'); assert.equal(migrated.result.labels,false);
  assert.deepEqual(validate(migrated.result),migrated.result);
});

test('calls are ordered across asynchronous loads, arguments are captured on arrival, and failures do not poison the queue', async () => {
  let release;
  const {api}=setup({fetchExample:() => new Promise(resolve=>release=resolve)});
  const load=api.callTool('chamber_load_example',{name:'empty'});
  const args={operations:[add('left',0,3,'water',{state:'full',volume:40})]};
  const edit=api.callTool('chamber_apply_operations',args); args.operations[0].volume=25;
  await Promise.resolve(); const empty=initial(); empty.walls={left:[],right:[]}; release(empty);
  assert.equal((await load).ok,true); assert.equal((await edit).ok,true);
  assert.equal(api.getState().walls.left[0].volume,40);
  await api.callTool('chamber_load_example',{name:'invalid'});
  assert.equal((await api.callTool('chamber_get_state')).ok,true);
  const broken=setup({fetchExample:async()=>{throw Error('offline');}});
  assert.equal((await broken.api.callTool('chamber_load_example',{name:'empty'})).error.code,'EXAMPLE_FAILED');
});

test('JSON and SVG exports return real files with attribution and leave state/history unchanged', async () => {
  const {api,commits}=setup(); const original=api.getState();
  const json=await api.callTool('chamber_export',{format:'json'});
  assert.equal(json.ok,true); assert.equal(json.result.mimeType,'application/json');
  assert.deepEqual(JSON.parse(Buffer.from(json.result.data,'base64')),original);
  const svg=await api.callTool('chamber_export',{format:'svg',transparent:true});
  assert.equal(svg.result.size,Buffer.from(svg.result.data,'base64').length);
  assert.match(Buffer.from(svg.result.data,'base64').toString(),/^<svg /);
  assert.doesNotMatch(Buffer.from(svg.result.data,'base64').toString(),/interaction-layer|selection-outline/);
  assert.equal(svg.result.attribution.license,'CC BY 4.0'); assert.deepEqual(api.getState(),original); assert.equal(commits(),0);
  const invalid=await api.callTool('chamber_export',{format:'png',scale:0}); assert.equal(invalid.error.code,'INVALID_ARGUMENT');
  const failure=setup({makeArtifact:async()=>{throw Error('template unavailable');}});
  assert.equal((await failure.api.callTool('chamber_export',{format:'pptx'})).error.code,'EXPORT_FAILED');
});

test('WebMCP registers callable schemas, tolerates absent/failed providers and does not affect the browser API', async () => {
  const {api}=setup(), received=[];
  const registration=await registerWebMCP(api,{registerTool:async tool=>received.push(tool)});
  assert.deepEqual(registration.registered,TOOLS.map(tool=>tool.name));
  assert.equal((await received.find(t=>t.name==='chamber_get_state').execute({})).ok,true);
  assert.deepEqual(await registerWebMCP(api,undefined),{available:false,registered:[]});
  const failed=await registerWebMCP(api,{registerTool:()=>{throw Error('unsupported');}});
  assert.equal(failed.errors.length,TOOLS.length); assert.equal(failed.registered.length,0);
  assert.equal((await api.callTool('chamber_get_state')).ok,true);
});
