import type { MethodDef } from '../types'
import { scoresFor } from '../types'
import { MoscowChart } from './Chart'
import { CATEGORIES, MOSCOW_FIELDS, MUST_SHARE_LIMIT, MUST_SHOULD_LIMIT, categoryName, fmtEffort, rankMoscow, scopeChecks } from './scoring'

const ref = { id: 'moscow' as const, fields: MOSCOW_FIELDS }

export const moscow: MethodDef = {
  id: 'moscow',
  name: 'MoSCoW',
  tagline: 'Sort items into Must, Should, Could and Won’t have, and agree on what is in scope.',
  bestFor: 'Great for agreeing scope with stakeholders.',
  formula: 'Must have · Should have · Could have · Won’t have (this time)',
  fields: MOSCOW_FIELDS,
  resultLabel: 'Category',
  wideChart: true,
  chartUsesItemNumbers: true,
  showResultInTable: false,
  chartHint:
    'Drag a card to another column to move it, or select it with Tab and use the left and right arrow keys.',
  about: {
    summary:
      'MoSCoW, from the DSDM agile method, sorts work for a fixed release or timebox into four groups. Rather than ranking items against each other, it makes the team agree on what the release cannot ship without and what it can drop.',
    whenToUse: [
      'You have a fixed deadline or budget and need to agree on scope.',
      'Aligning stakeholders on what is truly essential.',
      'After a scoring method such as RICE, to turn a ranking into a release plan.',
    ],
    pitfalls: [
      'If everything is a Must, nothing is. Test each one by asking: “Would we cancel the release without it?”',
      `Keep Must-haves to about ${Math.round(MUST_SHARE_LIMIT * 100)}% of the capacity and Must + Should to about ${Math.round(MUST_SHOULD_LIMIT * 100)}%. The Could-haves are your contingency.`,
      'Won’t means “not this time”, not “never”. Revisit it next cycle.',
    ],
  },
  guide: {
    heading: 'Category',
    rows: CATEGORIES.map((c) => ({ name: c.name, advice: c.advice })),
  },
  reference: [
    ...CATEGORIES.map((c) => `${c.name}: ${c.advice}`),
    `Guidelines (DSDM): Must-haves no more than about ${Math.round(MUST_SHARE_LIMIT * 100)}% of the effort available, Must + Should about ${Math.round(MUST_SHOULD_LIMIT * 100)}%, and Could-haves the remaining contingency.`,
  ],
  summary: {
    title: 'Scope check',
    lines: (backlog) => {
      const cap = backlog.settings.moscow?.capacity
      return [
        cap ? `Capacity for this release: ${fmtEffort(cap)}` : 'Capacity for this release: not set',
        ...scopeChecks(backlog).map((c) => `${c.tone === 'warn' ? 'WARNING: ' : ''}${c.text}`),
      ]
    },
  },
  rank: rankMoscow,
  Chart: MoscowChart,
  describe: (item) => {
    const v = scoresFor(item, ref)
    return [categoryName(v.category), `Effort: ${v.effort}`]
  },
}
