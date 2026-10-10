---
name: chamber-studio
description: Create or edit behavioral chamber figures on the public Chamber Studio website through its browser tools, then export editable PowerPoint, vector PDF/SVG, PNG or a reusable configuration. Use for Chamber Studio layout and figure requests.
---

# Chamber Studio

Open https://zhang-mengjia.github.io/chamber-studio/ to create or edit a chamber figure. For a new figure, use a fresh browser context when available. To edit the user's current layout, use their authorized existing page or import their `.chamber.json`.

Read [the public API guide](https://zhang-mengjia.github.io/chamber-studio/api/README.md) for operation fields, errors and file retrieval; [the manifest](https://zhang-mengjia.github.io/chamber-studio/api/manifest.json) provides full tool schemas and the module catalog. Keep `/chamber-studio/` in public URLs.

## Access the tools

Choose the method supported by your browser tools:

- If native WebMCP tools are available, use the registered `chamber_` tools.
- With page JavaScript execution, wait for `window.chamberStudio?.apiVersion`, then call `await window.chamberStudio.callTool(name, arguments)`. Playwright `page.evaluate()` can retrieve its JSON result.
- With browser controls only, open https://zhang-mengjia.github.io/chamber-studio/ai.html, select a tool, enter JSON in **Arguments JSON**, click **Execute**, and read **Result JSON**. The embedded editor shows the current figure.

HTTP GET can read documentation and schemas. Tool execution needs a browser page; do not invent an HTTP POST endpoint or an MCP server URL. If the environment has only HTTP fetching, explain this limitation and produce a schema-valid `.chamber.json` that the user can load.

## Make the figure

Read `chamber_get_capabilities` and `chamber_get_state` before editing. For a new layout, use `chamber_load_example` with `name:"empty"`, `"operant"` or `"dual-water"` as appropriate. Preserve existing modules when the user requests a partial edit.

Use `chamber_apply_operations` for additions, updates, moves, removals and settings. A batch is one undo step and fails without changing the chamber if any operation is invalid. Check `ok` in every response; use its error code and message to correct the request.

Positions are **zero-based**: `wall` is `left` or `right`, `col` is 0–2, `row` is 0–7, starting at the top left. Food, water and speaker require two consecutive rows, so their anchor cannot be row 7. Adding never overwrites existing modules; replace with remove + add in one batch. Rat x is 200–1050, y is 250–660, scale is 0.45–1.7. Current rat pose is `stand`; view is `perspective`, `front` or `combined`.

After editing, read the resulting state and inspect the figure in the editor. Use `chamber_undo` or `chamber_redo` when needed. These operations and normal UI edits share history and browser-local autosave.

## Deliver files

Call `chamber_export` with the requested `format`: `json`, `svg`, `png`, `pdf` or `pptx`. Prefer PPTX when native editable shapes are required. PNG supports `scale` 1, 2 or 3 and `transparent`; SVG also supports `transparent`.

The default response contains base64 `data`, `filename`, `mimeType`, `size` and `attribution`. Decode the file and verify it before delivery. For a browser download, pass `download:true` and await or verify the saved file through available browser tools. The console's export default uses this mode.

Preserve the returned LE rat credit when sharing figures containing the artwork: zhang-mengjia, CC BY 4.0, source https://zhang-mengjia.github.io/chamber-studio/assets/ATTRIBUTION.md. Figure settings are schematic; the app does not operate behavioral hardware.
