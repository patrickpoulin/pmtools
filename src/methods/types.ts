import type { ComponentType } from 'react'
import type { Backlog, FieldDef, Item, MethodId, MethodScores } from '../core/types'

/** Colors and type for a chart. Screen charts get CSS variables; the PDF gets fixed light-mode hex. */
export interface ChartPalette {
  surface: string
  surface2: string
  border: string
  ink: string
  ink2: string
  muted: string
  grid: string
  axis: string
  series1: string
  onSeries: string
  tintGood: string
  tintBad: string
  /** Ordinal ramp, most to least important (MoSCoW Must → Could). */
  ord1: string
  ord2: string
  ord3: string
  neutral: string
  /** Categorical palette, 8 slots in fixed order (series identity). */
  categorical: string[]
  font: string
}

export interface ChartProps {
  backlog: Backlog
  palette: ChartPalette
  /** Off for the PDF render: no drag, focus or hover handlers. */
  interactive?: boolean
  onScore?: (id: string, key: string, value: number) => void
  onHover?: (hover: { item: Item; x: number; y: number } | null) => void
}

export interface RankedRow {
  item: Item
  values: MethodScores
  /** Text shown in the result column: a quadrant name, a formatted score, etc. */
  result: string
  /** Numeric score where the method has one (RICE); used for sorting/compare. */
  score?: number
}

export interface MethodDef {
  id: MethodId
  name: string
  tagline: string
  /** Short positioning line shown on the home page card. */
  bestFor: string
  formula: string
  /** Fixed for most methods; computed from the backlog when users define them (Weighted Scoring). */
  fields: FieldDef[] | ((backlog: Backlog) => FieldDef[])
  resultLabel: string
  /** False when a field already shows the result (MoSCoW's category). */
  showResultInTable?: boolean
  /** Chart spans the full page width, with the side panel below it. */
  wideChart?: boolean
  /** True when the chart labels items by backlog number rather than rank. */
  chartUsesItemNumbers?: boolean
  chartHint?: string
  /** Full-width "what to do" table on the method page. */
  guide?: { heading: string; rows: { name: string; position?: string; advice: string }[] }
  about: {
    summary: string
    whenToUse: string[]
    pitfalls: string[]
  }
  /** Findings printed in the PDF under the chart (e.g. MoSCoW's capacity checks). */
  summary?: { title: string; lines: (backlog: Backlog) => string[] }
  /** Plain-text scale definitions printed in the PDF appendix. */
  reference: string[]
  rank: (backlog: Backlog) => RankedRow[]
  Chart: ComponentType<ChartProps>
  /** Short tooltip lines for a hovered item. */
  describe: (item: Item, backlog: Backlog) => string[]
}

export const fieldsFor = (method: Pick<MethodDef, 'fields'>, backlog: Backlog): FieldDef[] =>
  typeof method.fields === 'function' ? method.fields(backlog) : method.fields

/** An item's scores for a method, with the field defaults filled in where unscored. */
export function scoresFor(item: Item, method: { id: MethodId; fields: FieldDef[] }): MethodScores {
  const s = item.scores[method.id] ?? {}
  return Object.fromEntries(method.fields.map((f) => [f.key, s[f.key] ?? f.defaultValue]))
}

/**
 * Fit an untrusted value (file, share link, CSV) to what the field's input can show, or undefined to
 * use the field default instead:
 * - a select snaps to its nearest option (RICE confidence 90 -> 100), but a value outside the options'
 *   range is dropped rather than guessed (MoSCoW category 9 is not a Must);
 * - a number is clamped to its range, except a `blankAtZero` field drops zero or less (RICE effort 0
 *   means "not estimated", not "almost free", which would put the item at the top).
 */
export function fitToField(field: FieldDef, v: number): number | undefined {
  if (!Number.isFinite(v)) return undefined
  if (field.kind === 'select') {
    const values = (field.options ?? []).map((o) => o.value)
    if (!values.length || v < Math.min(...values) || v > Math.max(...values)) return undefined
    return values.reduce((best, o) => (Math.abs(o - v) < Math.abs(best - v) ? o : best))
  }
  if (field.blankAtZero && v <= 0) return undefined
  return Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, v))
}
