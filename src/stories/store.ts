import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newId } from '../core/store'
import { emptyStory, exampleStory, hasStory, normalizeStory, type StoryDoc } from './story'

interface StoriesState {
  stories: StoryDoc[]
  /** True once the example story has been added, so deleting it keeps it deleted. */
  seeded: boolean
  addStory: (story?: Partial<Omit<StoryDoc, 'id'>>) => string
  updateStory: (id: string, patch: Partial<Omit<StoryDoc, 'id'>>) => void
  removeStory: (id: string) => void
  /** Puts the example story back at the end of the list if it was deleted. */
  restoreExample: () => void
}

/**
 * The first version kept stories on backlog items (item.story). Bring over any a user wrote there,
 * skipping the sample items' built-in examples, so nothing written before the move is lost.
 */
export function storiesFromBacklogItems(items: unknown): StoryDoc[] {
  if (!Array.isArray(items)) return []
  return items.flatMap((it: any) => {
    const story = normalizeStory(it?.story)
    if (!hasStory(story) || String(it?.id).startsWith('sample-')) return []
    const title = typeof it?.title === 'string' && it.title.trim() ? it.title.slice(0, 200) : 'Untitled story'
    return [{ ...story, id: newId(), title }]
  })
}

function legacyStories(): StoryDoc[] {
  try {
    return storiesFromBacklogItems(JSON.parse(localStorage.getItem('pmtools-backlog') ?? 'null')?.state?.backlog?.items)
  } catch {
    return []
  }
}

/** Saved stories from untrusted or older data, dropping anything that isn't a story. */
export function normalizeStoryDocs(raw: unknown): StoryDoc[] {
  if (!Array.isArray(raw)) return []
  const ids = new Set<string>()
  return raw.slice(0, 500).flatMap((r: any) => {
    const story = normalizeStory(r)
    if (!story) return []
    let id = typeof r.id === 'string' && r.id ? r.id : newId()
    if (ids.has(id)) id = newId()
    ids.add(id)
    return [{ ...story, id, title: typeof r.title === 'string' ? r.title.slice(0, 200) : 'Untitled story' }]
  })
}

/** The example story goes at the end of the list, so a user's own stories stay first. */
export const EXAMPLE_ID = 'example'
export const withExample = (stories: StoryDoc[]): StoryDoc[] => [...stories, { ...exampleStory(), id: EXAMPLE_ID }]

/**
 * The saved stories on load: what was saved (cleaned), or for a first visit any stories from the old
 * backlog-item version. The example is added once per user, so a deleted example stays deleted.
 */
export function loadStories(persisted: unknown, legacy: () => StoryDoc[]): Pick<StoriesState, 'stories' | 'seeded'> {
  const p = persisted as Partial<StoriesState> | undefined
  const stories = p?.stories ? normalizeStoryDocs(p.stories) : legacy()
  return { stories: p?.seeded ? stories : withExample(stories), seeded: true }
}

export const useStories = create<StoriesState>()(
  persist(
    (set) => ({
      stories: withExample([]),
      seeded: true,
      addStory: (story) => {
        const id = newId()
        set((s) => ({ stories: [{ ...emptyStory(), title: 'Untitled story', ...story, id }, ...s.stories] }))
        return id
      },
      updateStory: (id, patch) =>
        set((s) => ({ stories: s.stories.map((st) => (st.id === id ? { ...st, ...patch } : st)) })),
      removeStory: (id) => set((s) => ({ stories: s.stories.filter((st) => st.id !== id) })),
      restoreExample: () =>
        set((s) => (s.stories.some((st) => st.id === EXAMPLE_ID) ? s : { stories: withExample(s.stories) })),
    }),
    {
      name: 'pmtools-stories',
      version: 1,
      merge: (persisted, current) => ({ ...current, ...loadStories(persisted, legacyStories) }),
    },
  ),
)
