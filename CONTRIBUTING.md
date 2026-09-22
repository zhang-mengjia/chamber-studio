# Contributing

Bug reports, documentation improvements and pull requests are welcome. You can write in English or Chinese.

1. Fork the repository and create a branch for your change.
2. Install Node.js 22 or later; run `npm start` and visit http://127.0.0.1:47831/.
3. Run `npm test` before opening a pull request. No `npm install` or build step is required.
4. Describe the behavior changed, how you checked it and any screenshots that help review it.

## Project map

- `public/model.js`: dimensions, module states and configuration validation.
- `public/geometry.js`: projection and interactive wall regions.
- `public/editor.js`: atomic moves/copies and undo history.
- `public/scene.js`: shared vector drawing for the browser and every export.
- `public/app.js`: canvas interaction and nearby popovers.
- `public/i18n.js`: Chinese/English interface strings; configuration keys stay language-neutral.
- `public/export.js`: editable DrawingML, vector PDF and raster PNG.
- `public/rat-art.js` / `public/assets/rat-paths.json`: original LE artwork and its placement.
- `public/examples/`: small, portable example configurations.

Keep the direct canvas interaction and native editable PPT geometry. When changing geometry, visually compare perspective, front and combined views and export all three formats. If modifying the original rat artwork, clearly state the change and preserve its CC BY attribution.

New UI text needs Chinese and English translations. Keep user-entered names and loaded configuration data intact when switching languages. Test both desktop and narrow screens. Configuration changes must preserve loading of version 1 files or document an explicit migration.

Changes to `main` run tests before deploying `public/` to GitHub Pages. For a fork, enable Pages with GitHub Actions in repository Settings and update project/attribution URLs as appropriate; do not replace the original rat author credit.
