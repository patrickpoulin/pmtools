import type { Backlog, FieldDef } from '../../core/types'
import type { RankedRow } from '../types'
import { scoresFor } from '../types'

export const RICE_FIELDS: FieldDef[] = [
  {
    key: 'reach',
    label: 'Reach',
    help: 'How many people or events this affects per time period (e.g. customers per quarter). Use real numbers where you can.',
    kind: 'number',
    min: 0,
    step: 1,
    defaultValue: 100,
  },
  {
    key: 'impact',
    label: 'Impact',
    help: 'How much it moves the goal for each person reached.',
    kind: 'select',
    options: [
      { value: 3, label: '3 — Massive' },
      { value: 2, label: '2 — High' },
      { value: 1, label: '1 — Medium' },
      { value: 0.5, label: '0.5 — Low' },
      { value: 0.25, label: '0.25 — Minimal' },
    ],
    defaultValue: 1,
  },
  {
    key: 'confidence',
    label: 'Confidence',
    help: 'How sure you are about the reach, impact and effort estimates.',
    kind: 'select',
    options: [
      { value: 100, label: '100% — High' },
      { value: 80, label: '80% — Medium' },
      { value: 50, label: '50% — Low' },
    ],
    defaultValue: 80,
    format: (v) => `${v}%`,
  },
  {
    key: 'effort',
    label: 'Effort',
    help: 'Total team time in person-months (design + engineering + everything else).',
    kind: 'number',
    min: 0.1,
    step: 0.5,
    defaultValue: 1,
  },
]

/** RICE = (Reach × Impact × Confidence) ÷ Effort, with Confidence as a percentage. */
export function riceScore(s: { reach: number; impact: number; confidence: number; effort: number }): number {
  if (!(s.effort > 0)) return 0
  return (Math.max(0, s.reach) * s.impact * (s.confidence / 100)) / s.effort
}

export function formatScore(n: number): string {
  if (n >= 100) return Math.round(n).toLocaleString('en-US')
  if (n >= 10) return n.toFixed(1)
  return n.toFixed(2)
}

const ref = { id: 'rice' as const, fields: RICE_FIELDS }

export function rankRice(backlog: Backlog): RankedRow[] {
  return backlog.items
    .map((item) => {
      const v = scoresFor(item, ref)
      const score = riceScore(v as Parameters<typeof riceScore>[0])
      return { item, values: v, score, result: formatScore(score) }
    })
    .sort((a, b) => b.score - a.score)
}

