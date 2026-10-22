/**
 * Every real URL on the site, with its page title and description. The build writes a copy of
 * index.html for each path (so GitHub Pages serves it directly) plus the sitemap, and the app uses
 * the same titles at runtime. Plain data only: vite.config.ts imports this file.
 */
export const SITE_URL = 'https://patrickpoulin.github.io/pmtools/'

export interface PageMeta {
  /** Relative to the site root, with a trailing slash ('' is the home page). */
  path: string
  title: string
  description: string
  /** False keeps the page out of search results and the sitemap. */
  index?: boolean
}

export const PAGES: PageMeta[] = [
  {
    path: '',
    title: 'PM Tools — Free Product Prioritization Toolkit',
    description:
      'Free, private product prioritization tools: Impact vs Effort, RICE, MoSCoW and Weighted Scoring, with charts and PDF export. Runs entirely in your browser.',
  },
  {
    path: 'backlog/',
    title: 'Your Backlog — PM Tools',
    description: 'Add your product backlog once and score it with every prioritization method. Import from CSV or open a shared link.',
  },
  {
    path: 'method/impact-effort/',
    title: 'Impact vs Effort Matrix — PM Tools',
    description:
      'Plot ideas on a drag-and-drop Impact vs Effort 2×2 matrix to find quick wins and avoid money pits. Free, with PDF export.',
  },
  {
    path: 'method/rice/',
    title: 'RICE Score Calculator — PM Tools',
    description:
      'Score features with RICE (Reach × Impact × Confidence ÷ Effort) and rank them on a chart. Free, private, with PDF export.',
  },
  {
    path: 'method/moscow/',
    title: 'MoSCoW Prioritization — PM Tools',
    description:
      'Sort work into Must, Should, Could and Won’t have, and check the plan against your team’s capacity. Free, with PDF export.',
  },
  {
    path: 'method/weighted/',
    title: 'Weighted Scoring Model — PM Tools',
    description:
      'Rank features against your own weighted criteria and see what drives each score. Free weighted scoring tool with PDF export.',
  },
  {
    path: 'compare/',
    title: 'Compare Prioritization Methods — PM Tools',
    description: 'See how each item ranks under every prioritization method and spot where they disagree.',
  },
  {
    path: 'import/',
    title: 'Open a Shared Backlog — PM Tools',
    description: 'Open a product backlog shared with you.',
    index: false,
  },
]

/** The page for an app pathname like "/method/rice" (no base), falling back to the home page. */
export function pageFor(pathname: string): PageMeta {
  const key = pathname.replace(/^\/+/, '').replace(/\/*$/, '/')
  return PAGES.find((p) => p.path === key) ?? PAGES[0]
}

/**
 * Old links used hash routing (#/method/rice, #/import?d=…). Returns the clean path, relative to the
 * site root, to send them to, or null if the hash isn't an old route. Share data stays in the hash
 * (#d=…) so it is never sent to the server.
 */
export function legacyHashTarget(hash: string): string | null {
  const m = hash.match(/^#\/([^?]*)(?:\?(.*))?$/)
  if (!m) return null
  const [, path, query = ''] = m
  // Read d= raw: share data uses "+", which URLSearchParams would turn into a space.
  const d = query.match(/(?:^|&)d=([^&]*)/)?.[1]
  return path === 'import' && d ? `import/#d=${d}` : path
}
