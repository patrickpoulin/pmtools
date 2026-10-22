import type { FieldDef } from '../../core/types'

export const IE_FIELDS: FieldDef[] = [
  {
    key: 'impact',
    label: 'Impact',
    help: 'Value to users and the business, 1 (negligible) to 10 (transformational).',
    kind: 'number',
    min: 1,
    max: 10,
    step: 0.5,
    defaultValue: 5,
  },
  {
    key: 'effort',
    label: 'Effort',
    help: 'Cost to deliver (time, people, complexity, risk), 1 (trivial) to 10 (huge).',
    kind: 'number',
    min: 1,
    max: 10,
    step: 0.5,
    defaultValue: 5,
  },
]

export type Quadrant = 'quick-win' | 'major-project' | 'fill-in' | 'money-pit'

export const QUADRANTS: Record<Quadrant, { name: string; position: string; advice: string; order: number }> = {
  'quick-win': {
    name: 'Quick Wins',
    position: 'High impact, low effort',
    advice: 'Usually prioritize these first.',
    order: 0,
  },
  'major-project': {
    name: 'Major Projects',
    position: 'High impact, high effort',
    advice: 'Plan these deliberately. Look for a smaller version that delivers most of the value.',
    order: 1,
  },
  'fill-in': {
    name: 'Fill-ins',
    position: 'Low impact, low effort',
    advice: 'Fit these in when capacity allows, or bundle them with related work.',
    order: 2,
  },
  'money-pit': {
    name: 'Money Pits',
    position: 'Low impact, high effort',
    advice: 'Poor returns. Usually defer or drop these.',
    order: 3,
  },
}

/** Values on a midpoint count as "high". */
export function quadrantOf(impact: number, effort: number, mids: { impactMid: number; effortMid: number }): Quadrant {
  const highImpact = impact >= mids.impactMid
  const highEffort = effort >= mids.effortMid
  if (highImpact) return highEffort ? 'major-project' : 'quick-win'
  return highEffort ? 'money-pit' : 'fill-in'
}
