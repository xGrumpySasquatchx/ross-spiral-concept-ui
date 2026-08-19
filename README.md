# ross-spiral-concept-ui

Interactive 3D attrition spiral for an anti-hTfR1 antibody discovery workflow, organized with the Ross Spiral method (vertical phases, radial domain threads, lateral loop-backs).

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

- Drag to orbit the helix
- Scroll to zoom
- Shift-drag to pan
- Click a node for detail, assay, databases, and tools

## Files

- `src/App.jsx` — spiral UI (SVG helix, sidebar, search, filters)
- `docs/ross-spiral-antibody-discovery.md` — concept notes
- `docs/ross-spiral-antibody-discovery.html` — standalone CDN version (open in a browser, no build)

No extra packages beyond React. UniProt and Reactome lookups need network access.
