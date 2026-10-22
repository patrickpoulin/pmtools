import type { Backlog } from '../../core/types'
import type { MethodDef, RankedRow } from '../types'
import { scoresFor } from '../types'
import { ImpactEffortChart } from './Chart'
import { IE_FIELDS, QUADRANTS, quadrantOf } from './scoring'

const ref = { id: 'impact-effort' as const, fields: IE_FIELDS }

/** Ranked by quadrant (Quick Wins first), then highest impact, then lowest effort. */
export function rankImpactEffort(backlog: Backlog): RankedRow[] {
  const mids = backlog.settings.impactEffort
  return backlog.items
    .map((item) => {
      const v = scoresFor(item, ref)
      const q = quadrantOf(v.impact, v.effort, mids)
      return { item, values: v, q, result: QUADRANTS[q].name }
    })
    .sort(
      (a, b) =>
        QUADRANTS[a.q].order - QUADRANTS[b.q].order ||
        b.values.impact - a.values.impact ||
        a.values.effort - b.values.effort,
    )
    .map(({ q: _q, ...row }) => row)
}

export const impactEffort: MethodDef = {
  id: 'impact-effort',
  name: 'Impact vs Effort',
  tagline: 'Plot ideas on a 2×2 matrix to spot quick wins and avoid money pits.',
  bestFor: 'Great for initial discussions.',
  formula: 'Quadrant = Impact (high / low) × Effort (high / low)',
  fields: IE_FIELDS,
  resultLabel: 'Quadrant',
  chartUsesItemNumbers: true,
  chartHint: 'Drag a dot to re-score it, or select it with Tab and use the arrow keys (Shift for bigger steps).',
  guide: {
    heading: 'Quadrant',
    rows: Object.values(QUADRANTS).map(({ name, position, advice }) => ({ name, position, advice })),
  },
  about: {
    summary:
      'The Impact vs Effort matrix (also called a value/complexity or action priority matrix) is a quick visual triage. Rate each item on two 1–10 scales and see which quadrant it falls in.',
    whenToUse: [
      'Early triage of a long or messy backlog.',
      'Workshops: drag the dots together and talk through the disagreements.',
      'You need a decision quickly and do not have data for detailed estimates.',
    ],
    pitfalls: [
      'Scores are relative. Calibrate against one or two reference items first.',
      'Effort is usually underestimated, so include risk and unknowns.',
      'A Quick Win that does not support your strategy is still a distraction.',
    ],
  },
  reference: [
    ...Object.values(QUADRANTS).map((q) => `${q.name} (${q.position.toLowerCase()}): ${q.advice}`),
    'Impact and Effort are rated 1–10. Values on a divider count as "high".',
  ],
  rank: rankImpactEffort,
  Chart: ImpactEffortChart,
  describe: (item, backlog) => {
    const v = scoresFor(item, ref)
    const q = quadrantOf(v.impact, v.effort, backlog.settings.impactEffort)
    return [`Impact: ${v.impact} / 10`, `Effort: ${v.effort} / 10`, QUADRANTS[q].name]
  },
}
