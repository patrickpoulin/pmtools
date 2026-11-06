import { describe, expect, it } from 'vitest'
import {
  article, cleanPart, criterionText, emptyStory, hasStory, investStatus, normalizeStory, readyCount, restatesWant,
  storyHints, storyMarkdown, storySentence, type UserStory,
} from './story'
import { normalizeBacklog } from '../core/io'
import { sampleBacklog } from '../core/sample'
import { fillSampleScores } from '../core/store'

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
    expect(normalizeStory(undefined)).toBeUndefined()
    expect(normalizeStory('nope')).toBeNull()
  })
  it('round-trips through a backlog file, keeping cleared stories cleared', () => {
    const b = sampleBacklog()
    b.items[0].story = null
    const back = normalizeBacklog(JSON.parse(JSON.stringify(b)))
    expect(back.items[1].story).toEqual(b.items[1].story)
    expect(back.items[0].story).toBeNull()
    expect('story' in back.items[2]).toBe(false)
  })
  it('backfills sample stories for backlogs saved before stories, but not over a cleared one', () => {
    const b = sampleBacklog()
    for (const it of b.items) delete it.story
    b.items[3].story = null
    const filled = fillSampleScores(b)
    expect(filled.items[1].story?.role).toBe('new workspace admin')
    expect(filled.items[3].story).toBeNull()
  })
})
