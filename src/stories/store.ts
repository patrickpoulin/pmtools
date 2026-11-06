import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newId } from '../core/store'
import { emptyStory, hasStory, normalizeStory, type StoryDoc } from './story'

interface StoriesState {
  stories: StoryDoc[]
  addStory: (story?: Partial<Omit<StoryDoc, 'id'>>) => string
  updateStory: (id: string, patch: Partial<Omit<StoryDoc, 'id'>>) => void
  removeStory: (id: string) => void
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

export const useStories = create<StoriesState>()(
  persist(
    (set) => ({
      stories: [],
      addStory: (story) => {
        const id = newId()
        set((s) => ({ stories: [{ ...emptyStory(), title: 'Untitled story', ...story, id }, ...s.stories] }))
        return id
      },
      updateStory: (id, patch) =>
        set((s) => ({ stories: s.stories.map((st) => (st.id === id ? { ...st, ...patch } : st)) })),
      removeStory: (id) => set((s) => ({ stories: s.stories.filter((st) => st.id !== id) })),
    }),
    {
      name: 'pmtools-stories',
      version: 1,
      merge: (persisted, current) => {
        const stories = (persisted as Partial<StoriesState> | undefined)?.stories
        return { ...current, stories: stories ? normalizeStoryDocs(stories) : legacyStories() }
      },
    },
  ),
)
