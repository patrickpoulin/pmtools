import Papa from 'papaparse'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { Backlog, Criterion, Item, MethodId, MethodScores } from './types'
import { emptyBacklog } from './sample'
import { newId } from './store'
import { categoryName, parseCategory } from '../methods/moscow/scoring'
import { SCALE_MAX, SCALE_MIN, criteriaOf, defaultCriteria, normalizeCriteria } from '../methods/weighted/scoring'

const METHOD_IDS: MethodId[] = ['impact-effort', 'rice', 'moscow', 'weighted']

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

const positive = (n: number | undefined) => (n !== undefined && n > 0 ? n : null)

/** Coerce untrusted JSON (file upload, share link) into a valid Backlog. */
export function normalizeBacklog(raw: unknown): Backlog {
  if (!raw || typeof raw !== 'object') throw new Error('Not a backlog file.')
  const r = raw as Record<string, any>
  if (!Array.isArray(r.items)) throw new Error('Backlog has no "items" list.')
  const base = emptyBacklog()
  const items: Item[] = r.items.slice(0, 500).map((it: any) => {
    const scores: Item['scores'] = {}
    for (const m of METHOD_IDS) {
      const src = it?.scores?.[m]
      if (src && typeof src === 'object') {
        const clean: MethodScores = {}
        for (const [k, v] of Object.entries(src)) {
          const n = num(v)
          if (n !== undefined) clean[k] = n
        }
        scores[m] = clean
      }
    }
    return {
      id: str(it?.id) || newId(),
      title: str(it?.title, 'Untitled').slice(0, 200),
      description: str(it?.description).slice(0, 2000),
      tags: Array.isArray(it?.tags) ? it.tags.filter((t: unknown) => typeof t === 'string').slice(0, 20) : [],
      scores,
    }
  })
  const ie = r.settings?.impactEffort ?? {}
  const notes: Backlog['notes'] = {}
  for (const m of METHOD_IDS) if (typeof r.notes?.[m] === 'string') notes[m] = r.notes[m]
  return {
    name: str(r.name, base.name).slice(0, 200),
    author: str(r.author).slice(0, 200),
    items,
    notes,
    settings: {
      impactEffort: {
        effortMid: num(ie.effortMid) ?? base.settings.impactEffort.effortMid,
        impactMid: num(ie.impactMid) ?? base.settings.impactEffort.impactMid,
      },
      moscow: { capacity: positive(num(r.settings?.moscow?.capacity)) },
      weighted: { criteria: normalizeCriteria(r.settings?.weighted?.criteria) },
    },
  }
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'backlog'
}

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const backlogToJson = (b: Backlog) => JSON.stringify(b, null, 2)

/** CSV columns. Scores are flattened as `<method>.<field>`, e.g. `rice.reach`. */
const CSV_SCORE_COLUMNS: [MethodId, string][] = [
  ['impact-effort', 'impact'],
  ['impact-effort', 'effort'],
  ['rice', 'reach'],
  ['rice', 'impact'],
  ['rice', 'confidence'],
  ['rice', 'effort'],
  ['moscow', 'category'],
  ['moscow', 'effort'],
]

/** MoSCoW categories are written as names ("Must have") so the CSV reads naturally in a spreadsheet. */
const toCsvValue = (m: MethodId, k: string, v: number) => (m === 'moscow' && k === 'category' ? categoryName(v) : v)
const fromCsvValue = (m: MethodId, k: string, raw: string | undefined) =>
  m === 'moscow' && k === 'category' ? parseCategory(raw ?? '') : num(raw)

interface CsvColumn {
  header: string
  method: MethodId
  key: string
  write: (v: number) => string | number
  read: (raw: string | undefined) => number | undefined
}

/** The fixed method columns, plus one `weighted.<criterion name>` column per Weighted Scoring criterion. */
function csvColumns(criteria: Criterion[]): CsvColumn[] {
  return [
    ...CSV_SCORE_COLUMNS.map(([m, k]) => ({
      header: `${m}.${k}`,
      method: m,
      key: k,
      write: (v: number) => toCsvValue(m, k, v),
      read: (raw: string | undefined) => fromCsvValue(m, k, raw),
    })),
    ...criteria.map((c) => ({
      header: `weighted.${c.name}`,
      method: 'weighted' as const,
      key: c.id,
      write: (v: number) => v,
      read: (raw: string | undefined) => {
        const n = num(raw)
        return n === undefined ? undefined : Math.min(SCALE_MAX, Math.max(SCALE_MIN, n))
      },
    })),
  ]
}

export function backlogToCsv(b: Backlog): string {
  const columns = csvColumns(criteriaOf(b))
  return Papa.unparse(
    b.items.map((i) => {
      const row: Record<string, string | number> = {
        title: i.title,
        description: i.description,
        tags: i.tags.join('; '),
      }
      for (const col of columns) {
        const v = i.scores[col.method]?.[col.key]
        row[col.header] = v === undefined ? '' : col.write(v)
      }
      return row
    }),
    { columns: ['title', 'description', 'tags', ...columns.map((c) => c.header)] },
  )
}

/**
 * Parse CSV into items. Only `title` is required; any score columns present are used.
 * Weighted Scoring columns are matched to `criteria` by name, ignoring case.
 */
export function csvToItems(csv: string, criteria: Criterion[] = defaultCriteria()): Item[] {
  const { data } = Papa.parse<Record<string, string>>(csv.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  if (!data.length || !('title' in data[0])) throw new Error('CSV needs a header row with a "title" column.')
  const columns = csvColumns(criteria)
  return data
    .filter((r) => r.title?.trim())
    .map((r) => {
      const scores: Item['scores'] = {}
      for (const col of columns) {
        const n = col.read(r[col.header.trim().toLowerCase()])
        if (n !== undefined) scores[col.method] = { ...scores[col.method], [col.key]: n }
      }
      return {
        id: newId(),
        title: r.title.trim(),
        description: (r.description ?? '').trim(),
        tags: (r.tags ?? '').split(/[;,]/).map((t) => t.trim()).filter(Boolean),
        scores,
      }
    })
}

export const encodeShare = (b: Backlog) => compressToEncodedURIComponent(JSON.stringify(b))

export function decodeShare(data: string): Backlog {
  const json = decompressFromEncodedURIComponent(data)
  if (!json) throw new Error('This share link is incomplete or corrupted.')
  return normalizeBacklog(JSON.parse(json))
}

/** The data goes after "#", which browsers never send to the server, so shared backlogs stay private. */
export function shareUrl(b: Backlog) {
  return `${window.location.origin}${import.meta.env.BASE_URL}import/#d=${encodeShare(b)}`
}
