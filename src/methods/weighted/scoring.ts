import type { Backlog, Criterion, FieldDef } from '../../core/types'
import type { RankedRow } from '../types'
import { scoresFor } from '../types'

export const SCALE_MIN = 1
export const SCALE_MAX = 5
export const MAX_CRITERIA = 8

export const DEFAULT_CRITERIA: Criterion[] = [
  { id: 'value', name: 'Customer value', weight: 30, kind: 'benefit', color: 0 },
  { id: 'strategy', name: 'Strategic fit', weight: 25, kind: 'benefit', color: 1 },
  { id: 'revenue', name: 'Revenue impact', weight: 20, kind: 'benefit', color: 2 },
  { id: 'effort', name: 'Effort', weight: 15, kind: 'cost', color: 3 },
  { id: 'risk', name: 'Risk', weight: 10, kind: 'cost', color: 4 },
]

export const defaultCriteria = (): Criterion[] => DEFAULT_CRITERIA.map((c) => ({ ...c }))

export const criteriaOf = (backlog: Backlog): Criterion[] => backlog.settings.weighted?.criteria ?? defaultCriteria()

const totalWeight = (criteria: Criterion[]) => criteria.reduce((s, c) => s + Math.max(0, c.weight), 0)

/** Each criterion's share of the total weight, 0–1. */
export function weightShare(c: Criterion, criteria: Criterion[]) {
  const total = totalWeight(criteria)
  return total > 0 ? Math.max(0, c.weight) / total : 0
}

export function criterionFields(backlog: Backlog): FieldDef[] {
  const criteria = criteriaOf(backlog)
  return criteria.map((c) => ({
    key: c.id,
    label: c.name,
    help:
      `Weight ${Math.round(weightShare(c, criteria) * 100)}%. Score ${SCALE_MIN} (low) to ${SCALE_MAX} (high).` +
      (c.kind === 'cost' ? ' Cost criterion: higher means worse, so it counts in reverse.' : ''),
    kind: 'number',
    min: SCALE_MIN,
    max: SCALE_MAX,
    step: 1,
    defaultValue: 3,
  }))
}

/** A cost score counts in reverse on the same scale: 5 → 1, 1 → 5. */
export const effectiveScore = (c: Criterion, raw: number) => (c.kind === 'cost' ? SCALE_MIN + SCALE_MAX - raw : raw)

/** Each criterion's weighted contribution; they sum to the item's score (1–5 when weights are set). */
export function contributions(backlog: Backlog, values: Record<string, number>) {
  const criteria = criteriaOf(backlog)
  return criteria.map((c) => ({
    criterion: c,
    raw: values[c.id],
    value: weightShare(c, criteria) * effectiveScore(c, values[c.id]),
  }))
}

export function weightedScore(backlog: Backlog, values: Record<string, number>) {
  return contributions(backlog, values).reduce((s, x) => s + x.value, 0)
}

export const formatWeighted = (n: number) => n.toFixed(2)

export function rankWeighted(backlog: Backlog): RankedRow[] {
  const ref = { id: 'weighted' as const, fields: criterionFields(backlog) }
  return backlog.items
    .map((item, i) => {
      const values = scoresFor(item, ref)
      const score = weightedScore(backlog, values)
      return { item, i, values, score, result: formatWeighted(score) }
    })
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ i: _i, ...row }) => row)
}

/** Lowest color slot not already taken, so existing criteria keep their colors. */
export function nextColor(criteria: Criterion[]) {
  const used = new Set(criteria.map((c) => c.color))
  for (let i = 0; i < MAX_CRITERIA; i++) if (!used.has(i)) return i
  return 0
}

/** Coerce untrusted criteria (file, share link); falls back to the defaults. */
export function normalizeCriteria(raw: unknown): Criterion[] {
  if (!Array.isArray(raw)) return defaultCriteria()
  const seen = new Set<string>()
  const out: Criterion[] = []
  for (const c of raw.slice(0, MAX_CRITERIA)) {
    if (!c || typeof c !== 'object') continue
    const id = typeof c.id === 'string' && c.id ? c.id : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    const weight = Number(c.weight)
    out.push({
      id,
      name: typeof c.name === 'string' && c.name.trim() ? c.name.slice(0, 60) : 'Criterion',
      weight: Number.isFinite(weight) && weight >= 0 ? weight : 0,
      kind: c.kind === 'cost' ? 'cost' : 'benefit',
      color: Number.isInteger(c.color) && c.color >= 0 && c.color < MAX_CRITERIA ? c.color : nextColor(out),
    })
  }
  return out.length ? out : defaultCriteria()
}
