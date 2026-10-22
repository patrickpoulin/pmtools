import type { MethodId } from '../core/types'
import type { ChartPalette, MethodDef } from './types'
import { impactEffort } from './impact-effort'
import { rice } from './rice'
import { moscow } from './moscow'
import { weighted } from './weighted'

/** Add a new method by creating its folder and listing it here. */
export const METHODS: MethodDef[] = [impactEffort, rice, moscow, weighted]

export const getMethod = (id: string | undefined): MethodDef | undefined =>
  METHODS.find((m) => m.id === (id as MethodId))

export const SCREEN_PALETTE: ChartPalette = {
  surface: 'var(--chart-surface)',
  surface2: 'var(--surface-2)',
  border: 'var(--border)',
  ink: 'var(--text-primary)',
  ink2: 'var(--text-secondary)',
  muted: 'var(--text-muted)',
  grid: 'var(--grid)',
  axis: 'var(--axis)',
  series1: 'var(--series-1)',
  onSeries: '#ffffff',
  tintGood: 'var(--series-3)',
  tintBad: 'var(--series-8)',
  ord1: 'var(--ord-1)',
  ord2: 'var(--ord-2)',
  ord3: 'var(--ord-3)',
  neutral: 'var(--ord-neutral)',
  categorical: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--series-${n})`),
  font: 'system-ui, -apple-system, "Segoe UI", sans-serif',
}

/** Fixed light palette for print. Helvetica maps to jsPDF's built-in font. */
export const PRINT_PALETTE: ChartPalette = {
  surface: '#ffffff',
  surface2: '#f4f3ef',
  border: '#d6d5ce',
  ink: '#0b0b0b',
  ink2: '#52514e',
  muted: '#6f6d68',
  grid: '#e1e0d9',
  axis: '#a3a29a',
  series1: '#2a78d6',
  onSeries: '#ffffff',
  tintGood: '#1baf7a',
  tintBad: '#e34948',
  ord1: '#1c5cab',
  ord2: '#2a78d6',
  ord3: '#86b6ef',
  neutral: '#a3a29a',
  categorical: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  font: 'helvetica',
}
