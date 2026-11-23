import { describe, expect, it } from 'vitest'
import { AI_PROMPT, draftStory, isDuplicate, parseAiReply } from './aiParse'
import { LIMITS } from '../stories/story'
import { ITEM_LIMITS } from './io'

describe('parseAiReply', () => {
  it('reads a fenced JSON block with text around it', () => {
    const reply = 'Here you go:\n```json\n[{"title":" Export CSV ","description":"For finance.","isStory":true,"source":"Export invoices"}]\n```\nAnything else?'
    expect(parseAiReply(reply)).toEqual([{ title: 'Export CSV', description: 'For finance.', isStory: true, source: 'Export invoices' }])
  })
  it('reads a bare array or an object with items', () => {
    expect(parseAiReply('[{"title":"A"}]')).toEqual([{ title: 'A', description: '', isStory: false, source: '' }])
    expect(parseAiReply('{"items":[{"title":"B","isStory":"yes"}]}')[0]).toMatchObject({ title: 'B', isStory: true })
  })
  it('joins source lines and drops items without a title', () => {
    const items = parseAiReply('[{"title":"A","source":["line 1","line 2"]},{"title":"  "},null,{"description":"x"}]')
    expect(items).toHaveLength(1)
    expect(items[0].source).toBe('line 1\nline 2')
  })
  it('fits titles, descriptions and the item count to the backlog limits', () => {
    const long = Array.from({ length: ITEM_LIMITS.items + 5 }, () => ({ title: 'x'.repeat(300), description: 'y'.repeat(3000) }))
    const items = parseAiReply(JSON.stringify(long))
    expect(items).toHaveLength(ITEM_LIMITS.items)
    expect(items[0].title).toHaveLength(ITEM_LIMITS.title)
    expect(items[0].description).toHaveLength(ITEM_LIMITS.description)
  })
  it('explains what is wrong', () => {
    expect(() => parseAiReply('  ')).toThrow(/Paste/)
    expect(() => parseAiReply('Sorry, I cannot help')).toThrow(/No JSON/)
    expect(() => parseAiReply('[{"title":"A"')).toThrow(/No JSON|incomplete/)
    expect(() => parseAiReply('[{"title":"A",}]')).toThrow(/incomplete/)
    expect(() => parseAiReply('{"title":"A"}')).toThrow(/list/)
    expect(() => parseAiReply('[{"description":"x"}]')).toThrow(/title/)
  })
})

describe('isDuplicate', () => {
  it('matches titles ignoring case and spacing', () => {
    expect(isDuplicate('export  CSV ', [{ title: 'Export CSV' }])).toBe(true)
    expect(isDuplicate('Export PDF', [{ title: 'Export CSV' }])).toBe(false)
  })
})

describe('AI_PROMPT', () => {
  it('asks for the fields the parser reads, and no scores', () => {
    for (const f of ['"title"', '"description"', '"isStory"', '"source"']) expect(AI_PROMPT).toContain(f)
    expect(AI_PROMPT).toMatch(/Do not add scores/)
  })
})

describe('story parts', () => {
  const reply = JSON.stringify([
    {
      title: 'Export CSV', description: 'Finance needs it.', isStory: true, source: 'Finance exports CSV. Approved only.',
      story: {
        role: 'As a finance approver', want: 'I want to export invoices.', benefit: 'so that I can reconcile',
        criteria: [{ given: 'unapproved invoices', when: 'I export', then: 'they are left out' }, { given: ' ', when: '', then: '' }, 'junk'],
      },
    },
    { title: 'Upgrade database', isStory: false, story: { role: '', want: '', benefit: '', criteria: [] } },
  ])

  it('reads the story parts without template words, and drops empty criteria and empty stories', () => {
    const [a, b] = parseAiReply(reply)
    expect(a.story).toEqual({
      role: 'finance approver', want: 'to export invoices', benefit: 'I can reconcile',
      criteria: [{ given: 'unapproved invoices', when: 'I export', then: 'they are left out' }],
    })
    expect(b.story).toBeUndefined()
  })

  it('drafts a story with the parts, and keeps the description and source in the notes', () => {
    const [a] = parseAiReply(reply)
    const draft = draftStory(a)
    expect(draft).toMatchObject({ title: 'Export CSV', role: 'finance approver', want: 'to export invoices', benefit: 'I can reconcile' })
    expect(draft.criteria).toHaveLength(1)
    expect(draft.notes).toBe('Finance needs it.\n\nSource:\nFinance exports CSV. Approved only.')
    expect(draft.points).toBeUndefined()
  })

  it('drafts a story from the title and notes alone when the AI gave no parts', () => {
    const draft = draftStory({ title: 'Export CSV', description: '', source: '' })
    expect(draft).toEqual({ title: 'Export CSV', notes: '' })
  })

  it('fits criteria to the story limits', () => {
    const many = Array.from({ length: LIMITS.criteria + 3 }, () => ({ given: 'g'.repeat(3000), when: 'w', then: 't' }))
    const [a] = parseAiReply(JSON.stringify([{ title: 'A', isStory: true, story: { criteria: many } }]))
    expect(a.story?.criteria).toHaveLength(LIMITS.criteria)
    expect(a.story?.criteria[0].given).toHaveLength(LIMITS.text)
  })

  it('asks for story parts but not points', () => {
    for (const f of ['"role"', '"want"', '"benefit"', '"criteria"']) expect(AI_PROMPT).toContain(f)
    expect(AI_PROMPT).toMatch(/story points/)
  })
})
