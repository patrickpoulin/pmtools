import type { MethodDef } from '../types'
import { scoresFor } from '../types'
import { WeightedChart } from './Chart'
import {
  SCALE_MAX, SCALE_MIN, contributions, criteriaOf, criterionFields, formatWeighted, rankWeighted, weightShare,
  weightedScore,
} from './scoring'

export const weighted: MethodDef = {
  id: 'weighted',
  name: 'Weighted Scoring',
  tagline: 'Score items against your own weighted criteria and see what drives each ranking.',
  bestFor: 'Great when several factors matter.',
  formula: 'Score = sum of (weight × score) across criteria, with cost criteria counted in reverse',
  fields: criterionFields,
  resultLabel: 'Weighted score',
  chartHint: 'Each bar is split by criterion, so you can see what drives an item’s score. Hover over a bar for its scores.',
  about: {
    summary:
      'Weighted Scoring ranks items against criteria your team chooses, each with an agreed weight. Every item gets a 1–5 score for each criterion, and the weighted average gives a single comparable number. Because the criteria are your own, it fits decisions that the other methods don’t capture.',
    whenToUse: [
      'Several factors matter and they don’t all matter equally.',
      'Stakeholders disagree, and agreeing the criteria and weights up front makes the trade-offs explicit.',
      'You want a ranking you can explain item by item.',
    ],
    pitfalls: [
      'Agree the weights before scoring, so they aren’t adjusted to favour a particular item.',
      'Keep to 3–6 criteria. With more, each one barely moves the result.',
      'Criteria that overlap (for example “Revenue” and “Customer value”) double-count the same thing.',
    ],
  },
  guide: {
    heading: 'Step',
    rows: [
      { name: '1. Choose criteria', advice: 'Pick the 3–6 factors that matter for this decision, such as customer value, strategic fit or risk.' },
      { name: '2. Set weights', advice: 'Agree how much each criterion matters before scoring. Weights are shown as shares of 100%.' },
      {
        name: '3. Score items',
        advice: `Rate each item ${SCALE_MIN}–${SCALE_MAX} on each criterion. Mark effort and risk as cost criteria: they count in reverse, so a ${SCALE_MAX} counts as a ${SCALE_MIN}.`,
      },
      { name: '4. Read the result', advice: 'The bar segments show which criteria drive each score. Discuss close calls rather than trusting small differences.' },
    ],
  },
  summary: {
    title: 'Criteria and weights',
    lines: (backlog) => {
      const criteria = criteriaOf(backlog)
      return criteria.map(
        (c) => `${c.name}: ${Math.round(weightShare(c, criteria) * 100)}%${c.kind === 'cost' ? ' (cost: counts in reverse)' : ''}`,
      )
    },
  },
  reference: [
    `Each item is scored ${SCALE_MIN} (low) to ${SCALE_MAX} (high) on every criterion.`,
    `Cost criteria count in reverse: a score of s counts as ${SCALE_MIN + SCALE_MAX} - s.`,
    `The weighted score is the weighted average of the criterion scores, from ${SCALE_MIN} to ${SCALE_MAX}.`,
  ],
  rank: rankWeighted,
  Chart: WeightedChart,
  describe: (item, backlog) => {
    const values = scoresFor(item, { id: 'weighted', fields: criterionFields(backlog) })
    const criteria = criteriaOf(backlog)
    return [
      ...contributions(backlog, values).map(
        ({ criterion: c, raw }) =>
          `${c.name}: ${raw} / ${SCALE_MAX} (${Math.round(weightShare(c, criteria) * 100)}%${c.kind === 'cost' ? ', cost' : ''})`,
      ),
      `Score: ${formatWeighted(weightedScore(backlog, values))} / ${SCALE_MAX}`,
    ]
  },
}
