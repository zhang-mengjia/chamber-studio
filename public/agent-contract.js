import {MODULES, STATES, FLAVORS, SOUNDS, VOLUMES, defaultState} from './model.js';

export const API_VERSION = '1.0.0';
export const FORMATS = ['json', 'svg', 'png', 'pdf', 'pptx'];
export const EXAMPLES = ['dual-water', 'operant', 'empty'];
const object = (properties, required = [], extra = {}) => ({type:'object', properties, required, additionalProperties:false, ...extra});
const choice = values => ({type:'string', enum:values});
const number = (minimum, maximum, type = 'number') => ({type, minimum, maximum});
const boolean = {type:'boolean'};
const location = {wall:choice(['left','right']), col:number(0,2,'integer'), row:number(0,7,'integer')};
const position = object(location, ['wall','col','row']);
const options = {
  food:{flavor:choice(Object.keys(FLAVORS))}, water:{volume:{type:'integer', enum:VOLUMES}},
  house:{hz:number(.2,5)}, speaker:{sound:choice(Object.keys(SOUNDS))}
};
const allOptions = Object.assign({}, ...Object.values(options));
const moduleProperties = type => ({state:choice(Object.keys(STATES[type])), ...options[type]});
const ratProperties = {
  pose:choice(['stand','walk','rear','nose','press','eat']), facing:choice(['left','right']),
  visible:boolean, scale:number(.45,1.7), x:number(200,1050), y:number(250,660)
};
const settings = {
  name:{type:'string', minLength:1, maxLength:80}, floor:choice(['bars','acrylic']),
  view:choice(['perspective','front','combined']), grid:boolean, dimensions:boolean, effects:boolean,
  rat:object(ratProperties, [], {minProperties:1})
};
const modules = {
  type:'array', maxItems:24, items:{oneOf:Object.keys(MODULES).map(type => object({
    col:location.col, row:number(0,8-MODULES[type].h,'integer'), type:{const:type},
    state:choice(Object.keys(STATES[type])), ...allOptions
  }, ['col','row','type']))}
};
export const CONFIG_SCHEMA = {
  $schema:'https://json-schema.org/draft/2020-12/schema',
  title:'Chamber Studio version 1 configuration',
  description:'Zero-based cells: columns 0–2, rows 0–7. Two-row modules occupy their anchor and the row below. Overlaps are rejected at runtime. Legacy rat poses normalize to stand; labels normalize to false.',
  ...object({
    version:{const:1}, ...settings, labels:boolean,
    walls:object({left:modules, right:modules}, ['left','right']),
    rat:object(ratProperties, ['pose','facing','scale','x','y'])
  }, ['version','walls','rat'])
};
const operations = [
  ...Object.keys(MODULES).map(type => object({
    action:{const:'add'}, ...location, type:{const:type}, ...moduleProperties(type)
  }, ['action','wall','col','row','type'])),
  object({action:{const:'update'}, ...location, properties:object({
    state:choice([...new Set(Object.values(STATES).flatMap(Object.keys))]), ...allOptions
  }, [], {minProperties:1})}, ['action','wall','col','row','properties']),
  object({action:{const:'move'}, from:position, to:position}, ['action','from','to']),
  object({action:{const:'remove'}, ...location}, ['action','wall','col','row']),
  object({action:{const:'settings'}, settings:object(settings, [], {minProperties:1})}, ['action','settings'])
];
const tool = (name, description, inputSchema, readOnlyHint = false) => ({
  name, description, inputSchema, annotations:{readOnlyHint}
});
export const TOOLS = [
  tool('chamber_get_capabilities', 'Read API version, module types, geometry limits, export formats and tool schemas.', object({}), true),
  tool('chamber_get_state', 'Read an independent copy of the current chamber configuration.', object({}), true),
  tool('chamber_load_config', 'Replace the current chamber with a validated configuration. The change can be undone.', object({config:CONFIG_SCHEMA}, ['config'])),
  tool('chamber_apply_operations', 'Apply an ordered batch as one undo step. Add never overwrites a module; a failed operation leaves the entire chamber unchanged. Coordinates are zero-based. Update/remove/move may address either occupied row. Update accepts only options relevant to that module type.', object({
    operations:{type:'array', minItems:1, maxItems:100, items:{oneOf:operations}}
  }, ['operations'])),
  tool('chamber_load_example', 'Replace the layout with a bundled example. The change can be undone.', object({name:choice(EXAMPLES)}, ['name'])),
  tool('chamber_undo', 'Undo one layout change and return the restored configuration.', object({})),
  tool('chamber_redo', 'Redo one layout change and return the restored configuration.', object({})),
  tool('chamber_export', 'Export a snapshot of the current chamber. Returns a base64 file by default; download=true triggers a browser download and returns metadata. JSON retains configuration, SVG/PDF are vector, PPTX has editable native shapes. PNG scale is 1, 2 or 3. Includes rat artwork attribution.', object({
    format:choice(FORMATS), scale:{type:'integer', enum:[1,2,3], default:2},
    transparent:{...boolean, default:true}, download:{...boolean, default:false}
  }, ['format']))
];

export function manifest() {
  return {
    name:'Chamber Studio', apiVersion:API_VERSION,
    website:'https://zhang-mengjia.github.io/chamber-studio/',
    transport:{
      browser:{global:'window.chamberStudio', call:'await window.chamberStudio.callTool(name, arguments)', ready:'window.chamberStudio?.apiVersion'},
      webmcp:{optional:true, registration:'document.modelContext.registerTool; navigator.modelContext compatibility fallback'},
      http:{mode:'static-discovery-only', note:'GET the discovery files. Tool execution requires an open browser page; there is no remote HTTP POST or hosted MCP endpoint.'}
    },
    resources:{documentation:'../ai.html', guide:'./README.md', skill:'../skills/chamber-studio/SKILL.md', schema:'./config.schema.json', discovery:'../llms.txt'},
    coordinates:{walls:['left','right'], columns:3, rows:8, origin:'top-left', indexing:'zero-based'},
    modules:Object.fromEntries(Object.entries(MODULES).map(([type,m]) => [type, {
      name:m.en, width:2, height:m.h, states:Object.keys(STATES[type]), defaultState:defaultState(type), options:options[type] || {}
    }])),
    examples:EXAMPLES, formats:FORMATS, tools:TOOLS
  };
}
