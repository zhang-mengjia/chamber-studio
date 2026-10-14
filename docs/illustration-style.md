# Reference illustration style

The project uses the chamber illustration supplied in `example.pptx` as its
style reference: warm gray walls, a pale rear wall, thin dark outlines, a narrow
front rim, understated glass and flat device colors. The chamber preserves the
reference's camera and approximately 1.124:1 width-to-height ratio, with
608 × 541.075 drawing bounds. One scale in both axes preserves the source shell.

`public/assets/reference-parts.json` contains the original chamber SVG paths,
separated into shell, rim, lamp, speaker, lever and cup components. It records
SHA-256 hashes of the original PPTX and its two embedded SVGs. The original PPTX
is unchanged. `public/illustration-style.js` defines the shared palette and source
device coordinates, and `public/scene-drawing.js` places these components in all views.
Ports, cue lights, nose pokes, cameras, floor patterns and effects use the same
palette and line weights. Each complete wall is 6 units wide and 8 units high:
three columns of eight installable rows, without a reserved top strip. Single-row
modules are 2 × 1 (2:1); two-row modules are 2 × 2 (square). Food, water and speaker
modules span two adjacent rows. Both front diagrams use equal scales in both axes;
the perspective view maps these same units to the complete reference side walls.
The shared wall coordinates drive drawing, clicking, dragging and exports.
Combined-view drawing and hit regions also share the same panel transforms.
The original shell curves are reused. Transparent roof glass is drawn before
device contours so top-row parts remain legible through the glass. The narrow
outer rim stays in front; there is no roof-clearance strip in the wall grid.
Protruding devices are ordered from far to near, independently of installation
history; opposite walls use opposite depth directions. Uniform scaling retains
the native lamp and lever silhouettes while fitting each into one row. Both
protrude toward the chamber interior. Dragging either half of a two-row module to
the top or bottom edge snaps the full module to a legal anchor. Occupied positions
are still protected.
Recessed cups, liquid and pellets share their mounting panel's transform;
the original aperture is retained as clipped native curves without artificial
cut-edge outlines in SVG, PDF and PowerPoint.

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
