import type { MethodDef } from '../types'
import { scoresFor } from '../types'
import { RiceChart } from './Chart'
import { RICE_FIELDS, formatScore, rankRice, riceScore } from './scoring'

const ref = { id: 'rice' as const, fields: RICE_FIELDS }

const optLabel = (key: string, v: number) =>
  RICE_FIELDS.find((f) => f.key === key)?.options?.find((o) => o.value === v)?.label ?? String(v)

export const rice: MethodDef = {
  id: 'rice',
  name: 'RICE',
  tagline: 'Score each idea on Reach, Impact, Confidence and Effort, then rank the results.',
  bestFor: 'A more detailed ranking.',
  formula: 'RICE = (Reach × Impact × Confidence) ÷ Effort',
  fields: RICE_FIELDS,
  resultLabel: 'RICE score',
  about: {
    summary:
      'RICE, created at Intercom, turns four estimates into one comparable number. Reach and Impact estimate the benefit, Confidence discounts guesses, and Effort is the cost. A higher score means more value per unit of work.',
    whenToUse: [
      'You have many competing ideas and need a defensible, numeric ranking.',
      'You can estimate reach from real data (analytics, customer counts, ticket volume).',
      'You want to make the confidence in each estimate explicit.',
    ],
    pitfalls: [
      'Use the same Reach time period for every item, or the scores are not comparable.',
      'The score informs the decision but does not make it. Strategic bets and dependencies still need judgement.',
      'Low confidence is a prompt to go and research, not just a penalty.',
    ],
  },
  reference: [
    'Reach: people or events affected per time period (keep the period consistent).',
    'Impact: 3 = massive, 2 = high, 1 = medium, 0.5 = low, 0.25 = minimal.',
    'Confidence: 100% = high, 80% = medium, 50% = low.',
    'Effort: total person-months across all disciplines.',
  ],
  rank: rankRice,
  Chart: RiceChart,
  describe: (item) => {
    const v = scoresFor(item, ref)
    return [
      `Reach: ${v.reach.toLocaleString('en-US')}`,
      `Impact: ${optLabel('impact', v.impact)}`,
      `Confidence: ${v.confidence}%`,
      `Effort: ${v.effort} person-months`,
      `Score: ${formatScore(riceScore(v as Parameters<typeof riceScore>[0]))}`,
    ]
  },
}
