import {MODULES, STATES, validate, occupant, defaultState} from './model.js';
import {insertModule} from './editor.js';
import {API_VERSION, TOOLS, manifest} from './agent-contract.js';
import {buildScene, sceneToSVG} from './scene.js';
import {download, pptxBlob, pdfBlob, pngBlob} from './export.js';

class AgentError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new AgentError(code, message); };

// Validate only the JSON Schema keywords used by our contract, without dependencies.
// Model validation additionally checks occupied cells and type-specific states.
export function checkArguments(schema, value, path = 'arguments') {
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(candidate => {
      try { checkArguments(candidate, value, path); return true; } catch { return false; }
    });
    if (matches.length !== 1) fail('INVALID_ARGUMENT', `${path} does not match exactly one supported operation or module schema.`);
    return;
  }
  if (Object.hasOwn(schema, 'const') && value !== schema.const) fail('INVALID_ARGUMENT', `${path} must equal ${JSON.stringify(schema.const)}.`);
  if (schema.enum && !schema.enum.includes(value)) fail('INVALID_ARGUMENT', `${path} must be one of ${schema.enum.join(', ')}.`);
  if (schema.type === 'object') {
    if (!value || Array.isArray(value) || typeof value !== 'object') fail('INVALID_ARGUMENT', `${path} must be an object.`);
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail('INVALID_ARGUMENT', `${path}.${key} is required.`);
    if (Object.keys(value).length < (schema.minProperties || 0)) fail('INVALID_ARGUMENT', `${path} must not be empty.`);
    for (const [key, child] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties, key)) fail('INVALID_ARGUMENT', `${path}.${key} is not supported.`);
      checkArguments(schema.properties[key], child, `${path}.${key}`);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) fail('INVALID_ARGUMENT', `${path} must be an array.`);
    if (value.length < (schema.minItems || 0) || value.length > (schema.maxItems ?? Infinity)) fail('INVALID_ARGUMENT', `${path} has an invalid number of items.`);
    value.forEach((item, i) => checkArguments(schema.items, item, `${path}[${i}]`));
  } else if (schema.type === 'number' || schema.type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value))) fail('INVALID_ARGUMENT', `${path} must be a finite ${schema.type}.`);
    if (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) fail('INVALID_ARGUMENT', `${path} is outside the supported range.`);
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length < (schema.minLength || 0) || value.length > (schema.maxLength ?? Infinity)) fail('INVALID_ARGUMENT', `${path} must be a string of supported length.`);
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') fail('INVALID_ARGUMENT', `${path} must be a boolean.`);
}

function normalized(config) {
  try { return validate(config); } catch (error) { fail('INVALID_CONFIG', error.message); }
}
function moduleAt(state, position) {
  const module = occupant(state.walls[position.wall], position.col, position.row);
  if (!module) fail('NOT_FOUND', `No module at ${position.wall} column ${position.col} row ${position.row}.`);
  return module;
}
function insert(state, position, module, source) {
  if (position.row + MODULES[module.type].h > 8) fail('INVALID_ARGUMENT', 'Module extends beyond the bottom of the wall.');
  try { return insertModule(state, position, module, source); }
  catch (error) { fail('OCCUPIED', error.message); }
}

export function applyOperations(current, operations) {
  checkArguments(TOOLS.find(t => t.name === 'chamber_apply_operations').inputSchema, {operations});
  let next = normalized(current);
  for (const op of operations) {
    if (op.action === 'add') {
      const {action, wall, ...module} = op;
      next = insert(next, op, {state:defaultState(module.type), ...module});
    } else if (op.action === 'update') {
      const module = moduleAt(next, op);
      const allowed = {food:['flavor'], water:['volume'], house:['hz'], speaker:['sound']}[module.type] || [];
      for (const key of Object.keys(op.properties)) if (key !== 'state' && !allowed.includes(key)) fail('INVALID_ARGUMENT', `${key} is not an option for ${module.type}.`);
      if (op.properties.state !== undefined && !Object.hasOwn(STATES[module.type], op.properties.state)) fail('INVALID_ARGUMENT', `Invalid state for ${module.type}.`);
      Object.assign(module, op.properties);
    } else if (op.action === 'remove') {
      const module = moduleAt(next, op);
      next.walls[op.wall] = next.walls[op.wall].filter(item => item !== module);
    } else if (op.action === 'move') {
      const module = moduleAt(next, op.from);
      next = insert(next, op.to, module, op.from);
    } else if (op.action === 'settings') {
      const {rat, ...rest} = op.settings;
      Object.assign(next, rest);
      if (rat) Object.assign(next.rat, rat);
    }
    next = normalized(next);
  }
  return next;
}

export async function exportArtifact(state, {format, scale = 2, transparent = true, download:save = false}) {
  const scene = format === 'json' ? null : buildScene(state, []);
  let blob;
  if (format === 'json') blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  else if (format === 'svg') blob = new Blob([sceneToSVG(scene,transparent)], {type:'image/svg+xml'});
  else if (format === 'png') blob = await pngBlob(scene,scale,transparent);
  else if (format === 'pdf') blob = await pdfBlob(scene);
  else blob = await pptxBlob(scene);
  const filename = (state.name || 'chamber').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_') + (format === 'json' ? '.chamber.json' : '.' + format);
  const result = {filename, mimeType:blob.type, size:blob.size, format,
    attribution:{author:'zhang-mengjia', license:'CC BY 4.0', url:'https://zhang-mengjia.github.io/chamber-studio/assets/ATTRIBUTION.md', appliesTo:'LE rat artwork when included'}};
  if (save) { download(blob,filename); return {...result, downloaded:true}; }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i=0; i<bytes.length; i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768));
  return {...result, encoding:'base64', data:btoa(binary)};
}

export function createAgentAPI({getState, setState, undo, redo, fetchExample = async name => {
  const response = await fetch(new URL(`./examples/${name}.chamber.json`, import.meta.url));
  if (!response.ok) throw new Error(`Example returned HTTP ${response.status}.`);
  return response.json();
}, makeArtifact = exportArtifact}) {
  let queue = Promise.resolve();
  const read = () => structuredClone(getState());
  const handlers = {
    chamber_get_capabilities:() => manifest(),
    chamber_get_state:read,
    chamber_load_config:({config}) => { const next = normalized(config); setState(next); return read(); },
    chamber_apply_operations:({operations}) => { const next = applyOperations(read(),operations); setState(next); return read(); },
    chamber_load_example:async ({name}) => {
      let config;
      try { config = await fetchExample(name); } catch (error) { fail('EXAMPLE_FAILED',error.message); }
      const next = normalized(config); setState(next); return read();
    },
    chamber_undo:() => ({changed:!!undo(), state:read()}),
    chamber_redo:() => ({changed:!!redo(), state:read()}),
    chamber_export:async args => {
      try { return await makeArtifact(read(),args); } catch (error) { fail('EXPORT_FAILED',error.message); }
    }
  };
  return Object.freeze({
    apiVersion:API_VERSION, getState:read, getCapabilities:() => structuredClone(manifest()), listTools:() => structuredClone(TOOLS),
    callTool(name, args = {}) {
      let input;
      try { input = structuredClone(args); }
      catch { return Promise.resolve({ok:false, apiVersion:API_VERSION, error:{code:'INVALID_ARGUMENT', message:'Arguments must be JSON-compatible data.'}}); }
      // All calls run in arrival order, including async example loads and exports.
      const pending = queue.then(async () => {
        try {
          const tool = TOOLS.find(tool => tool.name === name);
          if (!tool) fail('UNKNOWN_TOOL', `Unknown tool: ${String(name)}`);
          checkArguments(tool.inputSchema,input);
          const result = await handlers[name](input);
          return {ok:true, apiVersion:API_VERSION, result:structuredClone(result)};
        } catch (error) {
          return {ok:false, apiVersion:API_VERSION, error:{code:error.code || 'INTERNAL_ERROR', message:error.message}};
        }
      });
      queue = pending.then(() => undefined);
      return pending;
    }
  });
}

// Optional draft browser integration; the ordinary JavaScript API always works.
export async function registerWebMCP(api, context) {
  if (typeof context?.registerTool !== 'function') return {available:false, registered:[]};
  const registered = [], errors = [];
  for (const tool of api.listTools()) {
    try {
      await context.registerTool({...tool, execute:args => api.callTool(tool.name,args)});
      registered.push(tool.name);
    } catch (error) { errors.push({name:tool.name, message:error.message}); }
  }
  return {available:true, registered, errors};
}
