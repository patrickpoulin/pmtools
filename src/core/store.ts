import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Backlog, Criterion, Item, MethodId } from './types'
import { MAX_CRITERIA, criteriaOf, nextColor } from '../methods/weighted/scoring'
import { emptyBacklog, sampleBacklog } from './sample'

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 12)

interface State {
  backlog: Backlog
  setMeta: (patch: Partial<Pick<Backlog, 'name' | 'author'>>) => void
  addItem: (item: Partial<Omit<Item, 'id'>>) => string
  updateItem: (id: string, patch: Partial<Omit<Item, 'id' | 'scores'>>) => void
  removeItem: (id: string) => void
  moveItem: (id: string, delta: -1 | 1) => void
  setScore: (id: string, method: MethodId, key: string, value: number) => void
  setNotes: (method: MethodId, notes: string) => void
  setImpactEffortMids: (patch: Partial<Backlog['settings']['impactEffort']>) => void
  setMoscowCapacity: (capacity: number | null) => void
  addCriterion: () => void
  updateCriterion: (id: string, patch: Partial<Omit<Criterion, 'id' | 'color'>>) => void
  removeCriterion: (id: string) => void
  replaceBacklog: (b: Backlog) => void
  loadSample: () => void
  clear: () => void
}

/**
 * A sample backlog saved before a method existed has no scores or settings for it. Fill those in
 * from the current sample so new methods show the sample fully set up; anything the user set is kept.
 */
export function fillSampleScores(b: Backlog): Backlog {
  const fresh = sampleBacklog()
  const sample = new Map(fresh.items.map((i) => [i.id, i.scores]))
  const isSample = b.items.some((i) => sample.has(i.id))
  return {
    ...b,
    settings: {
      ...fresh.settings,
      ...(isSample ? {} : { moscow: { capacity: null } }),
      ...b.settings,
    },
    items: b.items.map((item) => {
      const scores = sample.get(item.id)
      if (!scores) return item
      const missing = Object.entries(scores).filter(([m]) => !item.scores[m as MethodId])
      return missing.length ? { ...item, scores: { ...Object.fromEntries(missing), ...item.scores } } : item
    }),
  }
}

const withCriteria = (b: Backlog, criteria: Criterion[]) => ({
  backlog: { ...b, settings: { ...b.settings, weighted: { criteria } } },
})

const mapItem = (b: Backlog, id: string, fn: (i: Item) => Item): Backlog => ({
  ...b,
  items: b.items.map((i) => (i.id === id ? fn(i) : i)),
})

export const useStore = create<State>()(
  persist(
    (set) => ({
      backlog: sampleBacklog(),
      setMeta: (patch) => set((s) => ({ backlog: { ...s.backlog, ...patch } })),
      addItem: (item) => {
        const id = newId()
        set((s) => ({
          backlog: {
            ...s.backlog,
            items: [
              ...s.backlog.items,
              { title: 'New item', description: '', tags: [], scores: {}, ...item, id },
            ],
          },
        }))
        return id
      },
      updateItem: (id, patch) => set((s) => ({ backlog: mapItem(s.backlog, id, (i) => ({ ...i, ...patch })) })),
      removeItem: (id) =>
        set((s) => ({ backlog: { ...s.backlog, items: s.backlog.items.filter((i) => i.id !== id) } })),
      moveItem: (id, delta) =>
        set((s) => {
          const items = [...s.backlog.items]
          const from = items.findIndex((i) => i.id === id)
          const to = from + delta
          if (from < 0 || to < 0 || to >= items.length) return s
          ;[items[from], items[to]] = [items[to], items[from]]
          return { backlog: { ...s.backlog, items } }
        }),
      setScore: (id, method, key, value) =>
        set((s) => ({
          backlog: mapItem(s.backlog, id, (i) => ({
            ...i,
            scores: { ...i.scores, [method]: { ...i.scores[method], [key]: value } },
          })),
        })),
      setNotes: (method, notes) =>
        set((s) => ({ backlog: { ...s.backlog, notes: { ...s.backlog.notes, [method]: notes } } })),
      setImpactEffortMids: (patch) =>
        set((s) => ({
          backlog: {
            ...s.backlog,
            settings: {
              ...s.backlog.settings,
              impactEffort: { ...s.backlog.settings.impactEffort, ...patch },
            },
          },
        })),
      setMoscowCapacity: (capacity) =>
        set((s) => ({ backlog: { ...s.backlog, settings: { ...s.backlog.settings, moscow: { capacity } } } })),
      addCriterion: () =>
        set((s) => {
          const criteria = criteriaOf(s.backlog)
          if (criteria.length >= MAX_CRITERIA) return s
          const c: Criterion = { id: newId(), name: 'New criterion', weight: 10, kind: 'benefit', color: nextColor(criteria) }
          return withCriteria(s.backlog, [...criteria, c])
        }),
      updateCriterion: (id, patch) =>
        set((s) => withCriteria(s.backlog, criteriaOf(s.backlog).map((c) => (c.id === id ? { ...c, ...patch } : c)))),
      // Items keep their scores for a removed criterion; they are simply no longer read.
      removeCriterion: (id) =>
        set((s) => {
          const criteria = criteriaOf(s.backlog)
          return criteria.length <= 1 ? s : withCriteria(s.backlog, criteria.filter((c) => c.id !== id))
        }),
      replaceBacklog: (backlog) => set({ backlog: fillSampleScores(backlog) }),
      loadSample: () => set({ backlog: sampleBacklog() }),
      clear: () => set({ backlog: emptyBacklog() }),
    }),
    {
      name: 'pmtools-backlog',
      version: 1,
      merge: (persisted, current) => {
        const backlog = (persisted as Partial<State> | undefined)?.backlog
        return backlog ? { ...current, backlog: fillSampleScores(backlog) } : current
      },
    },
  ),
)
