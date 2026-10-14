# Reference illustration style

The project uses the chamber illustration supplied in `example.pptx` as its
style reference: warm gray walls, a pale rear wall, thin dark outlines, a narrow
front rim, understated glass and flat device colors. The chamber keeps its
608 × 608 drawing bounds. The reference roof and camera replace the previous
blue reflective panels; the roof's two outside corners remain transparent.

`public/assets/reference-parts.json` contains the original chamber SVG paths,
separated into shell, rim, lamp, speaker, lever and cup components. It records
SHA-256 hashes of the original PPTX and its two embedded SVGs. The original PPTX
is unchanged. `public/illustration-style.js` defines the shared palette and
projection, and `public/scene-drawing.js` places these components in all views.
Ports, cue lights, nose pokes, cameras, floor patterns and effects use the same
palette and line weights. Installation cells remain interactive on continuous
wall panels; the grid is optional.

All five Long–Evans rat poses have been redrawn from the owner's supplied pose
artwork into cubic vector paths with muted black, white and pale pink fills.
`public/assets/rats/poses.json` is the drawing source. The standing, walking,
rearing, sniffing and sitting poses retain their original floor anchors and
configuration keys. Each pose has separate editable fur, skin and detail shapes.
The redraw retains the existing pose identities and follows the reference palette;
the reference rat's implanted hardware is not part of these five pose drawings.

The editor, clipboard, PNG, SVG, PDF and PPTX consume the same scene. SVG and PDF
contain vector rat and chamber paths. PPTX uses native DrawingML freeform shapes
grouped by device and rat. PNG and the clipboard rasterize that scene when
exporting. Parameters and pose changes retain autosave and undo/redo behavior.

Load **Examples → Reference layout** for the flat floor, lamp, speaker, cup and
lever arrangement. The new plain floor sits alongside metal bars and perforated
acrylic; importing existing floor and pose settings preserves them.

The [sample PowerPoint](reference-style.pptx) is an export from this layout,
with a [PNG preview](reference-style.png). It contains editable components,
including the rat's internal shapes.
