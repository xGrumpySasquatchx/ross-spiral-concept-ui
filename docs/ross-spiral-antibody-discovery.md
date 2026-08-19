# Antibody Discovery — 3D Attrition Spiral (Ross Spiral GUI)

A research navigation tool that maps an antibody discovery workflow onto the **Ross Spiral Curriculum** organizational method (spiral.ross.org): a helix where concepts recurse with increasing complexity, navigated along three simultaneous axes — vertical progression, radial domain threads, and lateral cross-domain integrations. Built for a specific program: an anti-transferrin receptor (hTfR1) antibody targeting blood-brain-barrier transcytosis, carrying CyP40 (Q08752) or HTRA1 (Q92743) payloads, across the Dotmatics platform stack (Luma, BioGlyph, Geneious Biologics, Geneious Prime, BoltzGen).

Companion file: `ross-spiral-antibody-discovery.html` — a single-file, dependency-free React app (loads React/Babel from CDN) that runs by opening it directly in a browser. `src/App.jsx` in the same export is the React component source, ready to drop into a Vite project in Cursor.

---

## Core concept: attrition-as-geometry

The Ross Spiral's "widening" visual metaphor is repurposed here as an **attrition funnel**. Each of the five program phases is drawn as a concentric coil on a 3D helix:

| Phase | Coil radius | Meaning |
|---|---|---|
| Part 1 — mAb Discovery | 230 (outermost/widest) | ~10,000+ starting candidates |
| Part 2 — Format Design | 185 | Leads narrowed to 10–50 |
| Part 3 — Expression & Characterization | 140 | Narrowed to 1–5 clinical candidates |
| Part 4 — Protein Engineering | 100 | Iterative refinement of the lead |
| Part 5 — VHH / BoltzGen | 65 (innermost/narrowest) | AI-designed nanobody variants |

Radius shrinking inward literally represents the shrinking candidate pool — the widest coil holds the most molecules, the innermost coil the fewest.

## Ross-Spiral-derived interaction model

- **Vertical axis (progression)** — the five phases stacked as concentric coils along the helix's long axis.
- **Radial axis (domain threads)** — colored dashed lines running through the whole spiral connecting nodes that share a discipline: Sequence, Cross-reactivity, Developability, Humanization, Luma, Cross-linking.
- **Lateral axis (integrations)** — loop-back arcs marking re-entry events (e.g., failed titer → re-boost; failed CHO expression → re-transfect), the "loops within loops" that make linear pipeline diagrams inadequate for this kind of R&D work.
- **Left vertical lane navigator** — modeled directly on the Ross Spiral's own linear sidebar: collapsible phase sections, each listing its steps with domain-color dots and small indicator dots for loop-backs (red) and database links (blue).

## Data model

Each workflow step is a node object:

```js
{
  id: "n1", ph: 0, t: .05,           // phase index (0-4), position along coil (0-1)
  label: "Reagent prep",
  sub: "Soluble TfR proteins",
  dom: "molbio",                     // domain: molbio | protein | bioinf | assay | decision | engineer | xlink
  gate: ">95% purity",                // attrition/QC gate, or null
  tools: ["Luma"],                    // connected Dotmatics tools
  up: ["P02786","Q62351"],            // UniProt accessions to fetch live
  re: ["R-HSA-917977"],               // Reactome stable IDs to fetch live
  loop: null,                         // loop-back description, or null
  detail: "...",                      // full descriptive text
  assay: "Analytical SEC, protein QC" // primary assay/method
}
```

38 core workflow nodes (`n1`–`n38`) span the five phases, plus 9 dedicated cross-linking/PTM nodes (`x1`–`x9`) that run alongside the main workflow at both a descriptive and an atomic (Angstrom-scale) level of detail — covering XL-MS methodology, reagent chemistry, epitope mapping by cross-linking, PTM characterization (glycosylation, oxidation, deamidation), disulfide bond mapping, glycan profiling, and ADC conjugation site analysis.

Threads (`THREADS`) are named sets of node IDs; phases (`PHASES`) carry a label, description, and hex color; domains (`DCOL`) map to marker colors.

## Rendering approach

Built as **pure SVG in React** — no Three.js, no WebGL. A hand-rolled spherical orbit camera (`project()` function: rotate by `theta`/`phi`, perspective-divide by `fov`) projects each node's 3D helix coordinate (`helixXYZ()`) to 2D screen space every render. This was a deliberate choice after repeated Three.js builds failed in the artifact sandbox due to modern JS syntax parsing limits — the SVG approach has zero external dependencies and renders reliably anywhere React runs.

Interaction:
- **Drag** — orbit (adjusts `theta`/`phi`)
- **Scroll** — zoom (`zoom` state, clamped 0.3–4×)
- **Shift-drag** — pan (`panXY`)
- **Click a node** — every node carries an invisible 32px-diameter hit-target circle as its first SVG child, so small nodes are reliably clickable regardless of visual radius or zoom level; `stopPropagation` keeps the background click-to-deselect handler from firing on the same click.
- **Click empty space** — deselects the current node.
- Nodes are depth-sorted (painter's algorithm) and dimmed when a phase or thread filter is active and they don't match.

## Right panel

- **Search bar** — live queries against the UniProt REST API and the Reactome ContentService search endpoint, rendered as clickable result cards.
- **Filter pills** — Phases, Threads (color-coded, toggle on/off).
- **Registration Access** — direct links out to Luma, UniProt (P02786), GenBank, the Reactome Pathway Browser, IMGT/V-QUEST, and RCSB PDB.
- **Node detail panel**, four tabs:
  - *Detail* — full descriptive text
  - *Assay* — primary method, attrition gate (if any), loop-back note (if any)
  - *Databases* — live-fetched UniProt/Reactome records for that node's linked IDs
  - *Tools* — connected Dotmatics tools, and which threads the node belongs to (clickable to activate that thread filter)

## Importing into Cursor

The export includes both a ready-to-run standalone HTML file and the raw component source:

```
ross-spiral-antibody-discovery.html   ← open directly in a browser, no build step
src/App.jsx                            ← same component, as an ES module for a Vite/React project
```

To wire `App.jsx` into a fresh Vite project in Cursor:

```bash
npm create vite@latest ross-spiral -- --template react
cd ross-spiral
npm install
# replace the generated src/App.jsx with the one from this export
npm run dev
```

No extra npm packages are required — the component only uses React's built-in hooks (`useState`, `useRef`, `useEffect`, `useCallback`) and the browser's native `fetch`.

## Known limitations / things to revisit

- The UniProt and Reactome fetches are client-side calls to public REST APIs — they will fail silently (empty result) if the sandbox/browser has no network access, or if either service changes its endpoint shape.
- `up`/`re` ID arrays are only populated on a subset of nodes; most are empty and will show "No database IDs linked to this step."
- The helix geometry (`SP_RADII`, `helixXYZ`) is hand-tuned for this five-phase, ~38-node dataset; adding phases or drastically changing node counts per phase will need the radius/spacing constants revisited.
- This was built as a Claude-generated React artifact rather than in a dedicated repo, so there's no test suite — worth adding basic rendering/interaction tests if this becomes a longer-lived internal tool.

## Origin

Extended from an internal conversation about using the Ross Spiral Curriculum's navigational structure (linear timeline, domain threads, integrations, bifurcations) as a UI metaphor for R&D workflows with loops-within-loops, applied to a specific anti-hTfR1 bispecific antibody discovery program.
