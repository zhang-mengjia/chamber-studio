import fs from 'node:fs/promises';
import {manifest, CONFIG_SCHEMA} from '../public/agent-contract.js';

await fs.mkdir(new URL('../public/api/', import.meta.url), {recursive:true});
for (const [filename, value] of [['manifest.json', manifest()], ['config.schema.json', CONFIG_SCHEMA]]) {
  await fs.writeFile(new URL('../public/api/' + filename, import.meta.url), JSON.stringify(value, null, 2) + '\n');
}
console.log('Updated public/api/manifest.json and config.schema.json');
