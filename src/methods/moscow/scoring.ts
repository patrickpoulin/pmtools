import type { Backlog, FieldDef } from '../../core/types'
import type { RankedRow } from '../types'
import { scoresFor } from '../types'

/** Category values are stored as numbers like every other score; higher = more important. */
export const MUST = 4
export const SHOULD = 3
export const COULD = 2
export const WONT = 1
export const UNSORTED = 0

export interface Category {
  value: number
  name: string
  advice: string
}

/** In priority order. Unsorted is not a MoSCoW category; it marks items nobody has placed yet. */
export const CATEGORIES: Category[] = [
  { value: MUST, name: 'Must have', advice: 'Non-negotiable for this release. Without it, the release fails or is not viable.' },
  { value: SHOULD, name: 'Should have', advice: 'Important but not vital. Leaving it out hurts, but there is a workaround.' },
  { value: COULD, name: 'Could have', advice: 'Nice to have. The first thing to drop if time or budget runs short.' },
  { value: WONT, name: "Won't have (this time)", advice: 'Explicitly out of scope for now. Recording it sets expectations and avoids scope creep.' },
]

export const UNSORTED_NAME = 'Unsorted'

export const categoryName = (v: number) => CATEGORIES.find((c) => c.value === v)?.name ?? UNSORTED_NAME

/** DSDM rule of thumb: Must-haves should be no more than ~60% of the effort available. */
export const MUST_SHARE_LIMIT = 0.6
/** Must + Should at about 80%, leaving Could-haves as the contingency. */
export const MUST_SHOULD_LIMIT = 0.8

export const MOSCOW_FIELDS: FieldDef[] = [
  {
    key: 'category',
    label: 'Category',
    help: 'Must, Should, Could, or Won’t have this time.',
    kind: 'select',
    options: [
      { value: UNSORTED, label: '— Unsorted' },
      ...CATEGORIES.map((c) => ({ value: c.value, label: c.name })),
    ],
    defaultValue: UNSORTED,
    format: (v) => categoryName(v),
  },
  {
    key: 'effort',
    label: 'Effort',
    help: 'Estimated effort in any consistent unit (days, points). Used to check that Must-haves leave room for contingency.',
    kind: 'number',
    min: 0,
    step: 0.5,
    defaultValue: 1,
  },
]

const ref = { id: 'moscow' as const, fields: MOSCOW_FIELDS }

/** Must first, down to Won't, then Unsorted; backlog order within a category. */
export function rankMoscow(backlog: Backlog): RankedRow[] {
  return backlog.items
    .map((item, i) => ({ item, i, values: scoresFor(item, ref) }))
    .sort((a, b) => sortKey(b.values.category) - sortKey(a.values.category) || a.i - b.i)
    .map(({ item, values }) => ({ item, values, result: categoryName(values.category) }))
}

// Unsorted sorts below Won't.
const sortKey = (v: number) => (v === UNSORTED ? -1 : v)

export interface EffortBalance {
  byCategory: Map<number, { count: number; effort: number }>
  /** Must + Should + Could: the work planned for this release. Won't and Unsorted are excluded. */
  planned: number
  must: number
  mustShould: number
  capacity: number | null
  /** Shares are of capacity when it is set, otherwise of the planned effort. */
  mustShare: number
  mustShouldShare: number
  plannedShare: number
}

export function effortBalance(backlog: Backlog): EffortBalance {
  const byCategory = new Map<number, { count: number; effort: number }>()
  for (const v of [...CATEGORIES.map((c) => c.value), UNSORTED]) byCategory.set(v, { count: 0, effort: 0 })
  for (const item of backlog.items) {
    const s = scoresFor(item, ref)
    const slot = byCategory.get(s.category) ?? byCategory.get(UNSORTED)!
    slot.count++
    slot.effort += Math.max(0, s.effort)
  }
  const e = (v: number) => byCategory.get(v)!.effort
  const must = e(MUST)
  const mustShould = must + e(SHOULD)
  const planned = mustShould + e(COULD)
  const capacity = backlog.settings.moscow?.capacity ?? null
  const basis = capacity ?? planned
  const share = (n: number) => (basis > 0 ? n / basis : 0)
  return {
    byCategory,
    planned,
    must,
    mustShould,
    capacity,
    mustShare: share(must),
    mustShouldShare: share(mustShould),
    plannedShare: share(planned),
  }
}

export interface ScopeCheck {
  tone: 'ok' | 'warn' | 'info'
  text: string
}

const effortRows = (backlog: Backlog) =>
  backlog.items.map((item) => {
    const s = scoresFor(item, ref)
    return { title: item.title, category: s.category, effort: s.effort }
  })

export const fmtEffort = (n: number) => String(+n.toFixed(2))
const pct = (n: number) => `${Math.round(n * 100)}%`
const list = (items: { title: string; effort: number }[]) =>
  items.map((i) => `${i.title} (${fmtEffort(i.effort)})`).join(', ')

/**
 * Items to move to Won't to cut `excess` effort: Coulds before Shoulds (never Musts). Within a
 * group, take the smallest single item that closes the gap, else the largest and keep going.
 */
export function suggestCuts(backlog: Backlog, excess: number) {
  const cuts: { title: string; effort: number }[] = []
  let remaining = excess
  for (const cat of [COULD, SHOULD]) {
    const pool = effortRows(backlog)
      .filter((i) => i.category === cat && i.effort > 0)
    while (remaining > 1e-9 && pool.length) {
      pool.sort((a, b) => a.effort - b.effort)
      const fits = pool.find((i) => i.effort >= remaining - 1e-9)
      const pick = fits ?? pool[pool.length - 1]
      pool.splice(pool.indexOf(pick), 1)
      cuts.push({ title: pick.title, effort: pick.effort })
      remaining -= pick.effort
    }
  }
  return { cuts, stillOver: Math.max(0, remaining) }
}

/** Plain-language checks against the DSDM guidelines, shown on the page and printed in the PDF. */
export function scopeChecks(backlog: Backlog): ScopeCheck[] {
  const b = effortBalance(backlog)
  const checks: ScopeCheck[] = []
  const mustLimit = pct(MUST_SHARE_LIMIT)
  const msLimit = pct(MUST_SHOULD_LIMIT)

  if (b.planned === 0) return [{ tone: 'info', text: 'Put items in Must, Should or Could to check the scope.' }]

  if (b.capacity === null) {
    checks.push(
      b.mustShare > MUST_SHARE_LIMIT
        ? { tone: 'warn', text: `Must-haves are ${pct(b.mustShare)} of the planned effort. The guideline is ${mustLimit} or less, to leave room for contingency.` }
        : { tone: 'ok', text: `Must-haves are ${pct(b.mustShare)} of the planned effort, within the ${mustLimit} guideline.` },
      { tone: 'info', text: 'Set the capacity available for this release to check whether the plan actually fits.' },
    )
    return checks
  }

  const cap = b.capacity
  if (b.planned > cap + 1e-9) {
    const over = b.planned - cap
    const { cuts, stillOver } = suggestCuts(backlog, over)
    let text = `Planned work is ${fmtEffort(b.planned)} against a capacity of ${fmtEffort(cap)}: over by ${fmtEffort(over)}.`
    if (cuts.length) text += ` To fit, consider moving to Won't: ${list(cuts)}.`
    if (stillOver > 0) text += ` Must-haves alone exceed capacity by ${fmtEffort(stillOver)}, so reduce their scope or add capacity.`
    checks.push({ tone: 'warn', text })
  } else {
    checks.push({ tone: 'ok', text: `Planned work (${fmtEffort(b.planned)}) fits within the capacity of ${fmtEffort(cap)}.` })
  }

  checks.push(
    b.mustShare > MUST_SHARE_LIMIT + 1e-9
      ? { tone: 'warn', text: `Must-haves use ${pct(b.mustShare)} of capacity. The guideline is ${mustLimit} or less. Can any Must become a Should, or be cut down to a smaller first version?` }
      : { tone: 'ok', text: `Must-haves use ${pct(b.mustShare)} of capacity (guideline ${mustLimit} or less).` },
  )
  checks.push(
    b.mustShouldShare > MUST_SHOULD_LIMIT + 1e-9
      ? { tone: 'warn', text: `Must + Should use ${pct(b.mustShouldShare)} of capacity. The guideline is about ${msLimit}, so little is left for contingency if estimates slip.` }
      : { tone: 'ok', text: `Must + Should use ${pct(b.mustShouldShare)} of capacity (guideline about ${msLimit}). The rest is contingency.` },
  )

  const spare = cap - b.planned
  if (spare > 1e-9) {
    const pullable = effortRows(backlog)
      .filter((i) => i.category === WONT && i.effort <= spare + 1e-9)
    checks.push({
      tone: 'info',
      text: pullable.length
        ? `${fmtEffort(spare)} spare. Won't items that would fit: ${list(pullable)}.`
        : `${fmtEffort(spare)} spare. No Won't item is small enough to pull in, so keep it as buffer.`,
    })
  }
  return checks
}

/** Accepts a number or a name like "Must", "should have", "won't", "wont". */
export function parseCategory(raw: string): number | undefined {
  const t = raw.trim().toLowerCase()
  if (!t) return undefined
  const n = Number(t)
  if (Number.isFinite(n)) return CATEGORIES.some((c) => c.value === n) || n === UNSORTED ? n : undefined
  if (t.startsWith('must')) return MUST
  if (t.startsWith('should')) return SHOULD
  if (t.startsWith('could')) return COULD
  if (t.startsWith('won') || t.startsWith('will not')) return WONT
  if (t.startsWith('unsorted')) return UNSORTED
  return undefined
}
