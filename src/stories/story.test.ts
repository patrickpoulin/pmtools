import { describe, expect, it } from 'vitest'
import {
  MAX_CRITERIA, article, cleanPart, exampleStory, criterionText, emptyStory, hasStory, investStatus, normalizeStory, readyCount, restatesWant,
  storyHints, storyMarkdown, storySentence, type UserStory,
} from './story'
import { loadStories, normalizeStoryDocs, storiesFromBacklogItems, useStories, withExample } from './store'
import { pdfText } from '../pdf/exportStories'

const good = (): UserStory => ({
  role: 'finance approver',
  want: 'to see invoices waiting for my approval',
  benefit: 'suppliers get paid on time',
  criteria: [{ given: 'two invoices are pending', when: 'I open my queue', then: 'I see both, oldest first' }],
  points: 3,
  invest: {},
  notes: '',
})

const hintsFor = (patch: Partial<UserStory>) => storyHints({ ...good(), ...patch }).map((h) => h.invest)

describe('story text', () => {
  it('strips template words people type out of habit', () => {
    expect(cleanPart('role', 'As an admin')).toBe('admin')
    expect(cleanPart('want', 'I want to export.')).toBe('to export')
    expect(cleanPart('benefit', 'so that I save time.')).toBe('I save time')
  })
  it('builds the sentence with the right article', () => {
    expect(storySentence({ role: 'admin', want: 'to export', benefit: 'I can audit' })).toBe(
      'As an admin, I want to export, so that I can audit.',
    )
    expect(['user', 'unit lead', 'urban planner', 'operator'].map(article)).toEqual(['a', 'a', 'an', 'an'])
    expect(storySentence({ role: 'As a buyer', want: '', benefit: '' })).toBe('As a buyer, I want …, so that ….')
  })
  it('writes Given/When/Then, skipping empty parts', () => {
    expect(criterionText({ given: 'a cart', when: 'I pay', then: 'I get a receipt.' })).toBe(
      'Given a cart, when I pay, then I get a receipt.',
    )
    expect(criterionText({ given: '', when: '', then: 'it saves' })).toBe('Then it saves.')
    expect(criterionText({ given: ' ', when: '', then: '' })).toBe('')
  })
  it('exports Markdown with criteria as a checklist', () => {
    const md = storyMarkdown('Approvals', { ...good(), notes: 'Phase 1 only' })
    expect(md).toContain('### Approvals')
    expect(md).toContain('- [ ] Given two invoices are pending, when I open my queue, then I see both, oldest first.')
    expect(md).toContain('**Estimate:** 3 points')
    expect(md).toContain('Phase 1 only')
  })
  it('treats an untouched story as empty', () => {
    expect(hasStory(emptyStory())).toBe(false)
    expect(hasStory(null)).toBe(false)
    expect(hasStory(good())).toBe(true)
  })
})

describe('storyHints', () => {
  it('has no warnings for a well-formed story', () => {
    expect(storyHints(good())).toEqual([])
  })
  it('flags generic roles, missing parts and restated benefits as value problems', () => {
    expect(hintsFor({ role: 'user' })).toEqual(['valuable'])
    expect(hintsFor({ benefit: '' })).toEqual(['valuable'])
    expect(hintsFor({ want: 'to export reports', benefit: 'I can export reports' })).toEqual(['valuable'])
  })
  it('flags UI words, compound wants, untestable criteria and big estimates', () => {
    expect(hintsFor({ want: 'a dropdown to pick a month' })).toEqual(['negotiable'])
    expect(hintsFor({ want: 'to approve and reject invoices' })).toEqual(['small'])
    expect(hintsFor({ criteria: [{ given: '', when: 'I search', then: 'results load fast' }] })).toEqual(['testable'])
    expect(hintsFor({ criteria: [{ given: 'x', when: 'y', then: '' }] })).toEqual(['testable'])
    expect(hintsFor({ points: 13 })).toEqual(['small'])
    expect(hintsFor({ points: null })).toEqual(['estimable'])
  })
  it('compares words, not substrings, when checking for a restated want', () => {
    expect(restatesWant('to export', 'I can share the export with my auditor')).toBe(false)
    expect(restatesWant('to export', '')).toBe(false)
  })
})

describe('investStatus', () => {
  it('needs a tick for ok, and a warning overrides the tick', () => {
    const s = { ...good(), role: 'user', invest: { valuable: true, testable: true } }
    const status = investStatus(s)
    expect(status.valuable).toBe('warn')
    expect(status.testable).toBe('ok')
    expect(status.small).toBe('todo')
    expect(readyCount(s)).toBe(1)
  })
})

describe('saved stories', () => {
  it('normalizes untrusted input', () => {
    const s = normalizeStory({ role: 5, want: 'x'.repeat(900), criteria: [{ given: 1, then: 'ok' }], points: -2, invest: { small: 'yes', valuable: true, bogus: true } })!
    expect(s.role).toBe('')
    expect(s.want).toHaveLength(500)
    expect(s.criteria).toEqual([{ given: '', when: '', then: 'ok' }])
    expect(s.points).toBeNull()
    expect(s.invest).toEqual({ valuable: true })
    expect(normalizeStory(undefined)).toBeNull()
    expect(normalizeStory('nope')).toBeNull()
  })
  it('keeps saved stories, giving duplicate or missing ids new ones', () => {
    const docs = normalizeStoryDocs([{ ...good(), id: 'a', title: 'One' }, { ...good(), id: 'a', title: 'Two' }, 'junk', { ...good() }])
    expect(docs.map((d) => d.title)).toEqual(['One', 'Two', 'Untitled story'])
    expect(new Set(docs.map((d) => d.id)).size).toBe(3)
    expect(docs[0].id).toBe('a')
    expect(normalizeStoryDocs('nope')).toEqual([])
  })
  it('brings over stories written on backlog items, but not the sample examples', () => {
    const moved = storiesFromBacklogItems([
      { id: 'sample-2', title: 'Onboarding checklist', story: good() },
      { id: 'x1', title: 'Approvals', story: good() },
      { id: 'x2', title: 'Cleared', story: null },
      { id: 'x3', title: 'Empty', story: emptyStory() },
      { id: 'x4', title: 'No story' },
    ])
    expect(moved.map((m) => m.title)).toEqual(['Approvals'])
    expect(moved[0].role).toBe('finance approver')
    expect(storiesFromBacklogItems(undefined)).toEqual([])
  })
  it('has an example that passes every check', () => {
    const ex = exampleStory()
    expect(storyHints(ex)).toEqual([])
    expect(readyCount(ex)).toBe(6)
  })
})

describe('example and PDF text', () => {
  it('adds the example after the user’s own stories', () => {
    const list = withExample([{ ...good(), id: 'mine', title: 'Mine' }])
    expect(list.map((s) => s.id)).toEqual(['mine', 'example'])
    expect(list[1].title).toMatch(/^Example/)
  })
  it('keeps PDF text inside WinAnsi', () => {
    expect(pdfText('As a café owner → “fast” ✓')).toBe('As a café owner -> “fast” v')
    expect(pdfText('Łódź 東京 🚀 ok')).toBe('Lódz ??  ok')
  })
})

describe('restoreExample', () => {
  it('brings back a deleted example once, at the end of the list', () => {
    const { addStory, removeStory, restoreExample } = useStories.getState()
    removeStory('example')
    addStory({ title: 'Mine' })
    restoreExample()
    restoreExample()
    const titles = useStories.getState().stories.map((s) => s.title)
    expect(titles.filter((t) => t.startsWith('Example')).length).toBe(1)
    expect(titles[titles.length - 1]).toMatch(/^Example/)
  })
})

describe('loadStories', () => {
  const mine = { ...good(), id: 'mine', title: 'Mine' }
  const ids = (r: ReturnType<typeof loadStories>) => r.stories.map((s) => s.id)

  it('starts a first-time visitor with just the example', () => {
    expect(ids(loadStories(undefined, () => []))).toEqual(['example'])
  })
  it('moves stories from the old backlog version on a first visit, then adds the example', () => {
    expect(ids(loadStories(undefined, () => [mine]))).toEqual(['mine', 'example'])
  })
  it('adds the example once to stories saved before it existed', () => {
    const r = loadStories({ stories: [mine] }, () => [])
    expect(ids(r)).toEqual(['mine', 'example'])
    expect(r.seeded).toBe(true)
  })
  it('keeps a deleted example deleted', () => {
    expect(ids(loadStories({ stories: [mine], seeded: true }, () => []))).toEqual(['mine'])
    expect(ids(loadStories({ stories: [], seeded: true }, () => []))).toEqual([])
  })
  it('does not read old backlog stories once stories have been saved', () => {
    expect(ids(loadStories({ stories: [], seeded: true }, () => [mine]))).toEqual([])
  })
  it('cleans saved data', () => {
    const r = loadStories({ stories: [{ ...mine, points: 'big' }, 7], seeded: true }, () => [])
    expect(r.stories).toHaveLength(1)
    expect(r.stories[0].points).toBeNull()
  })
})

describe('story edge cases', () => {
  it('leaves empty sections out of the Markdown', () => {
    const md = storyMarkdown('Bare', { ...emptyStory(), role: 'admin' })
    expect(md).toBe('### Bare\n\nAs an admin, I want …, so that ….')
  })
  it('flags too many acceptance criteria as too big', () => {
    const criteria = Array.from({ length: MAX_CRITERIA + 1 }, (_, i) => ({ given: `case ${i}`, when: 'I save', then: 'it is saved' }))
    expect(hintsFor({ criteria })).toEqual(['small'])
  })
  it('caps imported estimates and ignores criteria lists past 20', () => {
    const s = normalizeStory({ points: 500, criteria: Array.from({ length: 30 }, () => ({ then: 'x' })) })!
    expect(s.points).toBe(100)
    expect(s.criteria).toHaveLength(20)
  })
})
