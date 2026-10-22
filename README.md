# PM Tools — Prioritization Toolkit

Free, private product prioritization tools that run entirely in the browser.
Live at **https://patrickpoulin.github.io/pmtools/**.

- **Impact vs Effort**: a drag-and-drop 2×2 matrix (Quick Wins, Major Projects, Fill-ins, Money Pits) with adjustable dividers.
- **RICE**: (Reach × Impact × Confidence) ÷ Effort, ranked as a bar chart.
- **MoSCoW**: a drag-and-drop Must / Should / Could / Won't board checked against the release's capacity (DSDM guidelines: Must ≤ ~60%, Must + Should ≈ 80%), with suggested cuts when the plan doesn't fit.
- **Weighted Scoring**: your own criteria (benefit or cost) with relative weights; a ranked bar per item split by criterion so you can see what drives each score.
- **Compare**: shows each item's rank under every method and flags where the methods disagree.
- **PDF export** for each method, with a vector chart, a scores table, decision notes and a method reference.
- **One shared backlog** that saves automatically to `localStorage`, with JSON save/open, CSV import/export, and share links that carry the backlog in the URL.

There is no server and no account. Nothing leaves the user's browser.

## Development

```bash
npm install
npm run dev      # http://localhost:5173/pmtools/
npm test         # scoring + import/export unit tests
npm run build    # type-check + production build into dist/
```

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/` to GitHub Pages.
One-time setup: in the repo go to **Settings → Pages → Source** and choose **GitHub Actions**.

## Adding a method

1. Create `src/methods/<id>/` containing:
   - `scoring.ts`: the `FieldDef[]` inputs and pure scoring functions, plus tests. Inputs can also be a function of the backlog when users define them (see `weighted/`); read them with `fieldsFor()`.
   - `Chart.tsx`: an SVG chart that takes `ChartProps`. Use `style={{ fill: p.x }}` with palette colors so the same component renders on screen (CSS variables) and in the PDF (hex).
   - `index.ts`: exports a `MethodDef`
2. Add the id to `MethodId` in `src/core/types.ts`, and to `METHOD_IDS` and `CSV_SCORE_COLUMNS` in `src/core/io.ts`.
3. Register it in `src/methods/registry.ts`. Navigation, the scores table, Compare and PDF export pick it up automatically.

## Structure

```
src/
├─ core/       types, zustand store (persisted), sample data, JSON/CSV/share-link I/O
├─ methods/    registry + one folder per method (fields, scoring, chart, copy)
├─ pdf/        jsPDF + svg2pdf + autotable report builder (lazy-loaded)
├─ components/ score table, interactive chart wrapper, backlog actions, theme toggle
└─ pages/      Home, Backlog, Method, Compare, Import (share links)
```

## License

Copyright (C) 2026 Patrick Poulin. Licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only), with additional terms in [NOTICE](NOTICE).

In short: you can use, study, modify and share this code. If you distribute it, or run a modified version that people use over a network, you must:

- make your full source code available under the same license;
- keep the visible author credit (“Based on PM Tools by Patrick Poulin” with a link to this repository) in the site footer and in exported PDFs;
- mark your version as modified, not the original.

See [NOTICE](NOTICE) for the exact terms.

