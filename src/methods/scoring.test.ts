import { describe, expect, it } from 'vitest'
import { riceScore, formatScore } from './rice/scoring'
import { quadrantOf } from './impact-effort/scoring'
import { MUST, WONT, effortBalance, parseCategory, rankMoscow, scopeChecks, suggestCuts } from './moscow/scoring'
import { backlogToCsv, csvToItems, decodeShare, encodeShare, normalizeBacklog } from '../core/io'
import { sampleBacklog } from '../core/sample'
import { fillSampleScores } from '../core/store'
import {
  defaultCriteria, effectiveScore, normalizeCriteria, rankWeighted, weightedScore,
} from './weighted/scoring'

describe('riceScore', () => {
  it('computes (R × I × C) / E with confidence as a percent', () => {
    expect(riceScore({ reach: 1000, impact: 2, confidence: 80, effort: 4 })).toBe(400)
    expect(riceScore({ reach: 300, impact: 0.25, confidence: 50, effort: 0.5 })).toBe(75)
  })
  it('returns 0 for zero or invalid effort instead of Infinity', () => {
    expect(riceScore({ reach: 10, impact: 1, confidence: 100, effort: 0 })).toBe(0)
    expect(riceScore({ reach: 10, impact: 1, confidence: 100, effort: NaN })).toBe(0)
  })
  it('formats by magnitude', () => {
    expect(formatScore(1234.4)).toBe('1,234')
    expect(formatScore(12.345)).toBe('12.3')
    expect(formatScore(1.234)).toBe('1.23')
  })
})

describe('quadrantOf', () => {
  const mids = { impactMid: 5.5, effortMid: 5.5 }
  it('classifies all four quadrants', () => {
    expect(quadrantOf(8, 2, mids)).toBe('quick-win')
    expect(quadrantOf(8, 8, mids)).toBe('major-project')
    expect(quadrantOf(2, 2, mids)).toBe('fill-in')
    expect(quadrantOf(2, 8, mids)).toBe('money-pit')
  })
  it('treats values on the midpoint as high', () => {
    expect(quadrantOf(5.5, 5.5, mids)).toBe('major-project')
  })
})

describe('import / export', () => {
  it('round-trips through a share link', () => {
    const b = sampleBacklog()
    expect(decodeShare(encodeShare(b))).toEqual(b)
  })
  it('round-trips titles and scores through CSV', () => {
    const b = sampleBacklog()
    const items = csvToItems(backlogToCsv(b))
    expect(items.map((i) => i.title)).toEqual(b.items.map((i) => i.title))
    expect(items[0].scores).toEqual(b.items[0].scores)
    expect(items[0].tags).toEqual(b.items[0].tags)
  })
  it('accepts a minimal CSV with only titles', () => {
    expect(csvToItems('Title\nA\nB\n').map((i) => i.title)).toEqual(['A', 'B'])
  })
  it('rejects junk and drops non-numeric scores', () => {
    expect(() => normalizeBacklog({ foo: 1 })).toThrow()
    const b = normalizeBacklog({ items: [{ title: 'x', scores: { rice: { reach: 'abc', effort: '2' } } }] })
    expect(b.items[0].scores.rice).toEqual({ effort: 2 })
  })
})

describe('MoSCoW', () => {
  it('ranks Must → Won’t, then unsorted, keeping backlog order within a category', () => {
    const b = sampleBacklog()
    b.items[9].scores = {}
    const ranked = rankMoscow(b).map((r) => r.result)
    expect(ranked.slice(0, 3)).toEqual(['Must have', 'Must have', 'Must have'])
    expect(ranked[ranked.length - 1]).toBe('Unsorted')
    expect(rankMoscow(b)[0].item.title).toBe('Single sign-on (SAML)')
  })
  it('measures shares against capacity, excluding Won’t from planned work', () => {
    const bal = effortBalance(sampleBacklog())
    // Must 4 + 1.5 + 0.5 = 6; Should 2 + 1 + 0.5 = 3.5; Could 1; capacity 12.
    expect(bal.planned).toBe(10.5)
    expect(bal.capacity).toBe(12)
    expect(bal.mustShare).toBeCloseTo(0.5)
    expect(bal.mustShouldShare).toBeCloseTo(9.5 / 12)
    expect(bal.byCategory.get(WONT)!.count).toBe(3)
  })
  it('falls back to share of planned effort when capacity is not set', () => {
    const b = sampleBacklog()
    b.settings.moscow.capacity = null
    expect(effortBalance(b).mustShare).toBeCloseTo(6 / 10.5)
  })
  it('passes every check for the sample at 12 person-months', () => {
    const checks = scopeChecks(sampleBacklog())
    expect(checks.filter((c) => c.tone === 'warn')).toEqual([])
    expect(checks[checks.length - 1].text).toMatch(/^1\.5 spare\. No Won't item/)
  })
  it('flags the sample at 10 person-months and suggests cutting Dark mode', () => {
    const b = sampleBacklog()
    b.settings.moscow.capacity = 10
    const warns = scopeChecks(b).filter((c) => c.tone === 'warn').map((c) => c.text)
    expect(warns).toHaveLength(2)
    expect(warns[0]).toContain('over by 0.5')
    expect(warns[0]).toContain("Won't: Dark mode (1)")
    expect(warns[1]).toContain('Must + Should use 95%')
  })
  it('cuts Coulds before Shoulds and reports when Musts alone overflow', () => {
    const b = sampleBacklog()
    // After Dark mode (1), 1 is left: Slack (1) closes it exactly, so CSV import (2) is kept.
    expect(suggestCuts(b, 2).cuts.map((c) => c.title)).toEqual(['Dark mode', 'Slack notifications'])
    expect(suggestCuts(b, 5).stillOver).toBeCloseTo(0.5)
  })
  it('parses category names from CSV text', () => {
    expect(['Must', 'should have', "Won't", 'wont', 'COULD', '4', 'maybe'].map(parseCategory)).toEqual([
      MUST, 3, WONT, WONT, 2, MUST, undefined,
    ])
  })
  it('writes categories to CSV as names and reads them back', () => {
    const csv = backlogToCsv(sampleBacklog())
    expect(csv).toContain('Must have')
    expect(csvToItems(csv)[0].scores.moscow).toEqual({ category: MUST, effort: 4 })
  })
})

describe('fillSampleScores', () => {
  it('adds missing method scores to sample items without touching edited ones', () => {
    const old = sampleBacklog()
    old.items.forEach((i) => delete i.scores.moscow)
    old.items[0].scores['impact-effort'] = { impact: 1, effort: 1 }
    old.items.push({ id: 'mine', title: 'Mine', description: '', tags: [], scores: {} })
    const filled = fillSampleScores(old)
    expect(filled.items[0].scores.moscow).toEqual({ category: MUST, effort: 4 })
    expect(filled.items[0].scores['impact-effort']).toEqual({ impact: 1, effort: 1 })
    expect(filled.items[10].scores).toEqual({})
  })
})

describe('Weighted Scoring', () => {
  it('computes the weighted average with cost criteria counted in reverse', () => {
    const b = sampleBacklog()
    // SSO: 0.3×3 + 0.25×5 + 0.2×5 + 0.15×(6−4) + 0.1×(6−3) = 3.75
    expect(weightedScore(b, b.items[0].scores.weighted!)).toBeCloseTo(3.75)
    expect(effectiveScore({ id: 'x', name: 'Risk', weight: 1, kind: 'cost', color: 0 }, 5)).toBe(1)
  })
  it('ranks the sample with Onboarding checklist first, ties kept in backlog order', () => {
    const ranked = rankWeighted(sampleBacklog())
    expect(ranked.map((r) => r.result).slice(0, 2)).toEqual(['4.20', '3.75'])
    expect(ranked[0].item.title).toBe('Onboarding checklist')
    // Dark mode (#3) and Mobile app (#9) both score 2.15.
    expect(ranked.slice(-2).map((r) => r.item.title)).toEqual(['Dark mode', 'Mobile app'])
  })
  it('normalizes relative weights and ignores criteria removed from the list', () => {
    const b = sampleBacklog()
    b.settings.weighted.criteria = [
      { id: 'value', name: 'Customer value', weight: 1, kind: 'benefit', color: 0 },
      { id: 'effort', name: 'Effort', weight: 1, kind: 'cost', color: 3 },
    ]
    // Onboarding: (5 + (6−2)) / 2 = 4.5; its other scores are kept but not read.
    expect(weightedScore(b, b.items[1].scores.weighted!)).toBeCloseTo(4.5)
    expect(b.items[1].scores.weighted!.strategy).toBe(4)
  })
  it('keeps scores when a criterion is renamed, since they are stored by id', () => {
    const b = sampleBacklog()
    const before = rankWeighted(b).map((r) => r.result)
    b.settings.weighted.criteria[0].name = 'User value'
    expect(rankWeighted(b).map((r) => r.result)).toEqual(before)
  })
  it('round-trips criterion scores through CSV, matched by name', () => {
    const b = sampleBacklog()
    const csv = backlogToCsv(b)
    expect(csv.split('\n')[0]).toContain('weighted.Customer value')
    expect(csvToItems(csv, b.settings.weighted.criteria)[0].scores.weighted).toEqual(b.items[0].scores.weighted)
    const clamped = csvToItems('title,weighted.risk\nA,9\n', b.settings.weighted.criteria)
    expect(clamped[0].scores.weighted).toEqual({ risk: 5 })
  })
  it('gives old saves and files the default criteria, and rejects bad ones', () => {
    expect(normalizeBacklog({ items: [] }).settings.weighted.criteria).toEqual(defaultCriteria())
    const c = normalizeCriteria([{ id: 'a', name: 'A', weight: -3, kind: 'bogus', color: 99 }, { id: 'a' }])
    expect(c).toEqual([{ id: 'a', name: 'A', weight: 0, kind: 'benefit', color: 0 }])
    const old = sampleBacklog() as any
    delete old.settings.weighted
    old.items.forEach((i: any) => delete i.scores.weighted)
    const filled = fillSampleScores(old)
    expect(filled.settings.weighted.criteria).toEqual(defaultCriteria())
    expect(rankWeighted(filled)[0].item.title).toBe('Onboarding checklist')
  })
})
