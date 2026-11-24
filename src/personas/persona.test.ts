import { describe, expect, it } from 'vitest'
import {
  PERSONA_LIMITS, emptyIcp, emptyPersona, examplePersonaMap, hasPersonaMap, movePersona, nextColor,
  normalizePersonaMap, personaMapMarkdown,
} from './persona'
import { loadPersonaMap } from './store'

let n = 0
const newId = () => `id-${++n}`

describe('normalizePersonaMap', () => {
  it('keeps a valid map as it is', () => {
    const map = examplePersonaMap()
    expect(normalizePersonaMap(JSON.parse(JSON.stringify(map)), newId)).toEqual(map)
  })

  it('cleans untrusted data instead of failing', () => {
    const out = normalizePersonaMap(
      {
        icp: { name: 42, industry: 'SaaS', extra: 'x' },
        personas: [
          null,
          { id: 'a', name: 'Ana', buyingRole: 'king', color: 99, goals: ['x'] },
          { id: 'a', name: 'Dup', color: 2 },
          'nope',
        ],
      },
      newId,
    )
    expect(out.icp).toEqual({ ...emptyIcp(), industry: 'SaaS' })
    expect(out.personas).toHaveLength(2)
    expect(out.personas[0]).toMatchObject({ id: 'a', name: 'Ana', buyingRole: '', color: 1, goals: '' })
    // A repeated id gets a new one, so editing one column never changes another.
    expect(out.personas[1].id).not.toBe('a')
    expect(out.personas[1].color).toBe(2)
  })

  it('applies the size limits', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: 'x'.repeat(500) }))
    const out = normalizePersonaMap({ personas: many }, newId)
    expect(out.personas).toHaveLength(PERSONA_LIMITS.personas)
    expect(out.personas[0].name).toHaveLength(PERSONA_LIMITS.name)
  })

  it('returns an empty map for junk', () => {
    expect(normalizePersonaMap('junk', newId)).toEqual({ icp: emptyIcp(), personas: [] })
  })
})

describe('loadPersonaMap', () => {
  it('starts a first visit with the example', () => {
    expect(loadPersonaMap(undefined)).toEqual(examplePersonaMap())
  })

  it('keeps a map the user cleared, rather than bringing the example back', () => {
    expect(loadPersonaMap({ icp: emptyIcp(), personas: [] })).toEqual({ icp: emptyIcp(), personas: [] })
  })
})

describe('persona colors and order', () => {
  it('gives a new persona the first free palette slot', () => {
    expect(nextColor([])).toBe(1)
    expect(nextColor([{ color: 1 }, { color: 3 }])).toBe(2)
    expect(emptyPersona('x', [{ color: 1 }, { color: 2 }]).color).toBe(3)
  })

  it('moves a column left or right and ignores moves off the edge', () => {
    expect(movePersona(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(movePersona(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    const list = ['a', 'b']
    expect(movePersona(list, 0, -1)).toBe(list)
    expect(movePersona(list, -1, 1)).toBe(list)
  })
})

describe('personaMapMarkdown', () => {
  it('writes the ICP as a list and the personas as a table', () => {
    const md = personaMapMarkdown(examplePersonaMap())
    expect(md).toContain('## Ideal Customer Profile: Growing B2B SaaS companies')
    expect(md).toContain('- **Industry or type:** B2B software')
    expect(md).toContain('| | Olivia, Head of Operations | Sam, Workspace Admin | Felix, Finance Approver |')
    expect(md).toContain('| **Buying role** | Decision maker | Champion | Blocker |')
  })

  it('keeps pipes and line breaks from breaking the table', () => {
    const map = { icp: emptyIcp(), personas: [{ ...emptyPersona('a', []), name: 'A | B', goals: 'one\ntwo' }] }
    const md = personaMapMarkdown(map)
    expect(md).toContain('| | A \\| B |')
    expect(md).toContain('| **Goals** | one<br>two |')
    expect(md).toContain('Not written yet.')
  })
})

describe('hasPersonaMap', () => {
  it('is false for an empty map or blank personas', () => {
    expect(hasPersonaMap({ icp: emptyIcp(), personas: [] })).toBe(false)
    expect(hasPersonaMap({ icp: emptyIcp(), personas: [emptyPersona('a', [])] })).toBe(false)
    expect(hasPersonaMap({ icp: { ...emptyIcp(), region: 'EU' }, personas: [] })).toBe(true)
  })
})
