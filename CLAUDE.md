# PM Tools — notes for Claude

Static React + TypeScript + Vite site for product prioritization (Impact vs Effort, RICE, MoSCoW, Weighted Scoring), deployed to GitHub Pages at `patrickpoulin.github.io/pmtools`. Public-facing. No backend: all state is in the browser. See `README.md` for setup, deploy, and the "Adding a method" steps.

## Commands

- `npm run dev` → http://localhost:5173/pmtools/ (the `/pmtools/` base path is required)
- `npm test` (Vitest: scoring/IO/URL logic in `src/methods/scoring.test.ts`, user story hints, saving and PDF text in `src/stories/story.test.ts`, source guards in `src/effects.test.ts`), `npx tsc --noEmit`, `npm run build`
- Node 18 is installed locally, so stay on Vite 5 and avoid deps that need Node 20+. CI uses Node 20.

## Architecture

- **One shared backlog** (`src/core/store.ts`, zustand persisted to `localStorage` key `pmtools-backlog`). Every method scores the same items; scores live in `item.scores[methodId][fieldKey]` as numbers (even categorical ones like MoSCoW).
- **Methods are plugins**: `src/methods/<id>/{scoring.ts, Chart.tsx, index.ts}` exporting a `MethodDef`, registered in `src/methods/registry.ts`. The method page, score table, Compare, CSV and PDF are generic over `MethodDef`. Optional `MethodDef` hooks (`guide`, `summary`, `wideChart`, `chartHint`, `showResultInTable`, `chartUsesItemNumbers`) customize the shared page; method-specific side panels are chosen by id in `src/pages/MethodPage.tsx`.
- **User stories** (`/stories`) are not a scoring method and not tied to the backlog: they are for writing net-new stories. `src/stories/story.ts` holds the model, INVEST hints and Markdown export, `src/stories/store.ts` a separate zustand store persisted to `localStorage` key `pmtools-stories`, and `src/pages/StoriesPage.tsx` the editor. "Add to backlog" copies a story into the backlog as a new item. An example story is added once for every user (`seeded` flag, so deleting it sticks; the left nav offers "+ Add the example story" via `restoreExample()` when it is missing); the how-to guide is its own entry in the page's left nav (`?guide`). Story PDFs come from `src/pdf/exportStories.ts`, which runs all user text through `pdfText()` for WinAnsi; page size, palette and footer are shared with the method PDFs in `src/pdf/common.ts`. Story size limits live in `LIMITS` (`story.ts`); the editor's `maxLength`s use the same values so loading never trims what a user typed. Stories are not in backlog JSON, CSV or share links. The first version stored them on items (`item.story`); `storiesFromBacklogItems()` moves those over once. Loading goes through `loadStories()`, which is unit-tested; change it with care, since it decides whether saved stories, old item stories or the example appear. Stories are new-first, the example sits at the end, and deleting a story returns to the first one at the top of the page.
- **Fields may be dynamic** (Weighted Scoring builds them from user criteria). Always read fields with `fieldsFor(method, backlog)`, never `method.fields` directly.
- **Clean URLs on GitHub Pages** (no rewrites available): `BrowserRouter` with basename `/pmtools`, and the `static-routes` plugin in `vite.config.ts` writes a copy of `index.html` for every path in `src/routes.ts` (with its own title, description and canonical link), plus `404.html` and `sitemap.xml`. **A new page needs an entry in `PAGES`** or a refresh on it shows GitHub's 404.
- The router opts in to the React Router v7 future flags (`main.tsx`), so a move to v7 should mostly be a package bump.
- Share links are `import/#d=<lz-string>`. The data stays after `#` so it never reaches the server. Old hash links (`#/method/rice`, `#/import?d=…`) are redirected in `main.tsx` via `legacyHashTarget()`.

## Non-obvious rules

- **Charts render twice**: on screen (CSS-variable palette) and in the PDF via `renderToStaticMarkup` + `svg2pdf.js` (hex palette). Put colors and fonts in `style={{ ... }}` using palette values. `exportPdf.ts` converts inline styles to SVG attributes because svg2pdf ignores `style`. Palette fonts for print must be lowercase `helvetica`.
- **PDF text is WinAnsi only** (jsPDF built-in fonts). Characters like `→ ≤ ≈ Σ` render as garbage. Keep them out of chart SVG text, method `formula`/`reference`/`summary` strings, and anything printed. `safe()` in `exportPdf.ts` handles a few, not all; `pdfText()` in `src/pdf/common.ts` is the thorough version, used for user story text.
- **Backward compatibility of saved data**: users have old backlogs in `localStorage`, JSON files and share links. When adding settings or a method:
  - add defaults in `emptyBacklog()` and sample data in `src/core/sample.ts`;
  - validate untrusted input in `normalizeBacklog()` (`src/core/io.ts`), including the new id in `METHOD_IDS`;
  - `fillSampleScores()` (`store.ts`) backfills missing settings and sample-item scores on load and on `replaceBacklog`; never overwrite values the user set.
  - Code reading new settings should tolerate them being missing (e.g. `criteriaOf()`).
- **CSV**: fixed columns are in `CSV_SCORE_COLUMNS`; Weighted Scoring adds `weighted.<criterion name>` columns matched case-insensitively. MoSCoW categories are written as names.
- **Colors**: follow the dataviz palette in `src/styles.css` (`--series-1..8` categorical in fixed order, `--ord-*` ordinal for MoSCoW). Color follows the entity, not its position: Weighted Scoring criteria store a fixed `color` slot. Never add a hue outside the palette.
- **Existing tests must keep passing unchanged** when adding features. Add tests for new scoring logic.
- **Search Console**: `index.html` carries the `google-site-verification` meta tag for the `https://patrickpoulin.github.io/pmtools/` property; it is copied to every route page. Never remove it (Google re-checks). The sitemap is generated from `PAGES` in `src/routes.ts`.
- **Privacy promise**: the UI says data never leaves the browser and there is no tracking. Don't add analytics, cookies or third-party requests without updating that copy (and a consent banner for cookie-based tools); prefer cookieless analytics if asked.
- **Licensing**: AGPL-3.0-only with attribution terms in `NOTICE`. Never remove or weaken the author credit in the site footer (`App.tsx`) or the PDF footer (`drawFooter()` in `src/pdf/common.ts`, shared by every PDF).
- **`useEffect` bodies always use braces** (`useEffect(() => { … }, deps)`). An arrow that implicitly returns a value is treated by React as a cleanup function; newer browsers return a Promise from `window.scrollTo`, which crashed every navigation and blanked the app. No `async` effects either. `src/effects.test.ts` enforces both.
- **Headings use title case** (page titles, card and section headings, menu group names, the numbered user story steps, PDF section titles, method `summary.title`). Buttons, field labels, hints and body copy stay in sentence case.
- Don't use `window.alert/confirm/prompt` (destructive actions use an inline two-step confirm).

## Browser testing (Claude in Chrome)

- The test tab shares `localStorage` with the user's own tab. Before changing data, snapshot `localStorage['pmtools-backlog']` (e.g. into `sessionStorage`), and restore it before closing the tab.
- To check PDFs without saving files to the user's Downloads, override `URL.createObjectURL` to capture the blob and no-op `HTMLAnchorElement.prototype.click`/`dispatchEvent`, then show the blob in a full-screen iframe. Restore the prototypes afterwards.

## Copy and style

- UI copy is plain, direct and friendly; explain *why* in method guides. Public audience: no internal jargon.
- Match the surrounding code: small components, comments only where intent isn't obvious.
