export type MethodId = 'impact-effort' | 'rice' | 'moscow' | 'weighted'

/** Scores an item has for one method, keyed by field name. Missing = not yet scored. */
export type MethodScores = Record<string, number>

export interface Item {
  id: string
  title: string
  description: string
  tags: string[]
  scores: Partial<Record<MethodId, MethodScores>>
}

export interface Backlog {
  name: string
  author: string
  items: Item[]
  /** Free-text decision notes per method, printed in the PDF. */
  notes: Partial<Record<MethodId, string>>
  settings: {
    /** Impact vs Effort quadrant dividers, on the 1–10 scale. */
    impactEffort: { effortMid: number; impactMid: number }
    /** Effort available for the release, in the same unit as MoSCoW effort. Null = not set. */
    moscow: { capacity: number | null }
    weighted: { criteria: Criterion[] }
  }
}

/** A user-defined Weighted Scoring criterion. Scores are stored under its id, so renaming keeps them. */
export interface Criterion {
  id: string
  name: string
  /** Relative weight; normalized to a share of the total when scoring. */
  weight: number
  /** Cost criteria (effort, risk) are inverted: a 5 counts as a 1. */
  kind: 'benefit' | 'cost'
  /** Categorical color slot 0–7, fixed at creation so colors follow the criterion, not its position. */
  color: number
}

export interface FieldOption {
  value: number
  label: string
}

export interface FieldDef {
  key: string
  label: string
  help: string
  /** 'number' renders a numeric input; 'select' renders the fixed options. */
  kind: 'number' | 'select'
  min?: number
  max?: number
  step?: number
  options?: FieldOption[]
  defaultValue: number
  /** How the value is written in exports (PDF table). Defaults to the number itself. */
  format?: (v: number) => string
}
