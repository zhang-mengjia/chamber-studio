# Chamber Studio Agent API v1

Base URL: https://zhang-mengjia.github.io/chamber-studio/

Chamber Studio exposes eight tools for reading, editing and exporting the chamber in an open browser. All configuration changes pass through the editor's rendering, autosave and undo history. The API does not require a key or account.

## Choose an access method

- **Browser JavaScript:** open the editor, wait for `window.chamberStudio?.apiVersion`, then call `await window.chamberStudio.callTool(name, arguments)`. This works with Playwright and other browser tools that permit page JavaScript execution.
- **Browser controls:** open [the agent console](../ai.html), select a tool, fill **Arguments JSON**, click **Execute**, and read **Result JSON**. It controls the editor embedded on that page. Export defaults to a browser download.
- **WebMCP:** a browser with a `registerTool` provider discovers the same tools automatically on the editor page. Registration prefers `document.modelContext` and supports older `navigator.modelContext` providers. This is an optional integration with the evolving [WebMCP draft](https://webmachinelearning.github.io/webmcp/), checked against the 9 October 2026 draft. It is not a hosted MCP server. Inspect `await window.chamberStudioWebMCP` for registration results.
- **HTTP reads:** GET [manifest.json](manifest.json), [config.schema.json](config.schema.json), [the skill](../skills/chamber-studio/SKILL.md) and [llms.txt](../llms.txt). These are static discovery resources. HTTP requests cannot execute tools, modify an editor's state or generate exports; no POST endpoint exists on GitHub Pages.

The same relative paths work on localhost. Keep `/chamber-studio/` in online URLs: this is a GitHub project site. Configuration and language preferences stay in this browser's local storage. Each browser context has its own storage; online and localhost storage are separate. An agent in a new context cannot read another browser's unsaved work. Import its `.chamber.json` if needed.

## Tool list

| Name | Arguments | Result |
| --- | --- | --- |
| `chamber_get_capabilities` | `{}` | API version, catalog, coordinate limits, formats, full tool schemas |
| `chamber_get_state` | `{}` | Current configuration, copied independently |
| `chamber_load_config` | `{config: ...}` | Validated and normalized replacement configuration |
| `chamber_apply_operations` | `{operations: [...]}` | Updated configuration; one undo step |
| `chamber_load_example` | `{name: "empty"}` | Replacement example: `empty`, `operant`, `dual-water` |
| `chamber_undo` | `{}` | `{changed, state}` |
| `chamber_redo` | `{}` | `{changed, state}` |
| `chamber_export` | `{format: "png"}` | File data or browser download metadata |

`apiVersion`, `getState()`, `getCapabilities()` and `listTools()` are also directly available on `window.chamberStudio`. Use `callTool()` for operations. Existing `window.chamber` methods remain available for older integrations.

## Geometry and editing

Each wall has three module columns, numbered **0, 1, 2**, and eight rows, numbered **0 through 7**, starting at the top left. A column is two drawing units wide. Food, water and speaker modules occupy two rows and can start only in rows 0–6. Nose poke, lever, house light, cue light and camera occupy one row. Two-row modules cannot overlap any other module.

`chamber_apply_operations` accepts 1–100 operations in order:

```json
{
  "operations": [
    {"action":"add","wall":"left","col":0,"row":5,"type":"water","state":"full","volume":40},
    {"action":"add","wall":"right","col":1,"row":0,"type":"house","state":"flashing","hz":2},
    {"action":"settings","settings":{"name":"AI chamber","view":"combined","floor":"acrylic","rat":{"visible":true,"facing":"left"}}}
  ]
}
```

This example assumes an empty chamber. Read the current state or load `empty` first. Adding to an occupied cell returns `OCCUPIED`; to replace a module, remove it and add the new one in the same batch.

| Operation | Required fields | Notes |
| --- | --- | --- |
| `add` | `action`, `wall`, `col`, `row`, `type` | Optional `state` and type-specific parameters |
| `update` | `action`, `wall`, `col`, `row`, `properties` | Change state or relevant parameters; changing `type` requires remove + add |
| `move` | `action`, `from:{wall,col,row}`, `to:{wall,col,row}` | Retain state and options; destination row is the new anchor |
| `remove` | `action`, `wall`, `col`, `row` | Require an existing module |
| `settings` | `action`, `settings` | Patch `name`, `view`, `floor`, `rat`, `grid`, `dimensions`, `effects` |

Update, move source and remove can address either occupied row of a two-row module. Every batch applies atomically: a failed operation leaves state, autosave and undo history unchanged. API calls run in arrival order, including asynchronous example loads and exports. A successful change uses one undo step. Read tools and exports do not add undo steps.

Module keys: `food`, `water`, `nose`, `lever`, `house`, `cue`, `speaker`, `camera`. Use the catalog for states/defaults. Food `flavor`: `grain`, `sucrose`, `chocolate`, `banana`, `strawberry`; water `volume`: 10, 20, 40, 80, 160 μL; speaker `sound`: `clicker`, `siren`, `white`, `pure`; house `hz`: 0.2–5. Update rejects options for another module type. Rat bounds: x 200–1050, y 250–660, scale 0.45–1.7, facing `left`/`right`; current pose is `stand`. Version 1 configurations with legacy rat poses normalize to `stand`. Device labels remain hidden, including when importing legacy `labels:true`.

## Responses and errors

```json
{"ok":true,"apiVersion":"1.0.0","result":{"version":1,"name":"..."}}
```

```json
{"ok":false,"apiVersion":"1.0.0","error":{"code":"OCCUPIED","message":"..."}}
```

Check `ok` after every call. `INVALID_ARGUMENT` covers unknown fields, wrong types, out-of-range values and unsupported operations; `INVALID_CONFIG` covers overlapping or malformed chamber configurations; `NOT_FOUND` means a module is absent. `EXAMPLE_FAILED`, `EXPORT_FAILED`, `UNKNOWN_TOOL` and `INTERNAL_ERROR` indicate their corresponding failures. Model-validation messages may be Chinese; use stable error codes in automation. Never treat a failed call as a successful edit.

## Export and retrieve files

Formats: `json`, `svg`, `png`, `pdf`, `pptx`. PNG `scale` is 1, 2 (default), or 3, producing 1280×760, 2560×1520 or 3840×2280. `transparent` defaults to `true` and applies to PNG and SVG. PDF and PPTX retain their normal white page backgrounds. Export captures a snapshot of the current configuration.

By default, `result` contains `filename`, `mimeType`, `size`, `format`, `encoding:"base64"`, `data` and `attribution`. Decode `data` into a local file; it is not a remote URL. Use `{format:"pptx",download:true}` to trigger a browser download, which returns metadata with `downloaded:true` and omits the base64 data. Browser download initiation alone does not confirm that a file has been saved: await the browser's download event when using this mode.

The LE rat artwork is licensed separately under CC BY 4.0, by zhang-mengjia. Preserve the returned attribution when sharing figures containing the rat. PNG is a raster image; SVG/PDF are vector; PPTX retains native editable shapes. Read the editor preview to confirm layout before delivering files.

## Playwright example

With Playwright available in your environment, this creates a chamber and saves an editable PPTX. Use an isolated browser context for new figures; use an existing authorized page for edits to the user's current work.

```js
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('https://zhang-mengjia.github.io/chamber-studio/');
  await page.waitForFunction(() => window.chamberStudio?.apiVersion);
  const call = async (name, args = {}) => {
    const response = await page.evaluate(
      ({name,args}) => window.chamberStudio.callTool(name,args), {name,args});
    if (!response.ok) throw new Error(`${response.error.code}: ${response.error.message}`);
    return response.result;
  };
  await call('chamber_get_capabilities');
  await call('chamber_get_state');
  await call('chamber_load_example',{name:'empty'});
  await call('chamber_apply_operations',{operations:[
    {action:'add',wall:'left',col:0,row:5,type:'water',state:'full',volume:40},
    {action:'settings',settings:{name:'AI chamber',rat:{visible:true}}}
  ]});
  const artifact = await call('chamber_export',{format:'pptx'});
  await writeFile(artifact.filename,Buffer.from(artifact.data,'base64'));
  console.log(artifact.filename,artifact.size,artifact.attribution);
} finally { await browser.close(); }
```

Install the reusable skill by copying the repository's entire `public/skills/chamber-studio/` directory into your agent's skill directory. Its `SKILL.md` has Agent Skills YAML frontmatter. No skill installation is needed to use the public API.
