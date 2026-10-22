import type { ChartProps } from '../types'
import { formatScore, rankRice } from './scoring'

const W = 640
const ROW = 28
const BAR = 18
const M = { l: 224, r: 64, t: 12, b: 48 }

const truncate = (s: string, n = 30) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export function RiceChart({ backlog, palette: p, interactive, onHover }: ChartProps) {
  const rows = rankRice(backlog)
  const H = M.t + Math.max(rows.length, 1) * ROW + M.b
  const PW = W - M.l - M.r
  const max = Math.max(...rows.map((r) => r.score ?? 0), 1)
  const nice = niceMax(max)
  const x = (v: number) => M.l + (v / nice) * PW
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * nice)
  const font = { fontFamily: p.font }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={`RICE scores, ranked, for ${rows.length} items`}
      style={{ display: 'block', ...font }}
    >
      <rect x={0} y={0} width={W} height={H} style={{ fill: p.surface }} />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={M.t} y2={H - M.b} style={{ stroke: p.grid, strokeWidth: 1 }} />
          <text x={x(t)} y={H - M.b + 18} textAnchor="middle" style={{ fill: p.muted, fontSize: 11, ...font }}>
            {Number.isInteger(t) ? t.toLocaleString('en-US') : formatScore(t)}
          </text>
        </g>
      ))}
      <line x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} style={{ stroke: p.axis, strokeWidth: 1 }} />
      {rows.map((r, i) => {
        const cy = M.t + i * ROW + ROW / 2
        const w = Math.max(x(r.score ?? 0) - M.l, 0)
        const rad = Math.min(4, w)
        const y0 = cy - BAR / 2
        // Bar anchored square on the baseline, rounded at the data end.
        const d = w > 0
          ? `M${M.l},${y0} h${w - rad} a${rad},${rad} 0 0 1 ${rad},${rad} v${BAR - 2 * rad} a${rad},${rad} 0 0 1 ${-rad},${rad} h${-(w - rad)} z`
          : ''
        return (
          <g
            key={r.item.id}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `${i + 1}. ${r.item.title}: RICE ${r.result}` : undefined}
            className={interactive ? 'rice-row' : undefined}
            onPointerEnter={interactive ? (e) => onHover?.({ item: r.item, x: e.clientX, y: e.clientY }) : undefined}
            onPointerMove={interactive ? (e) => onHover?.({ item: r.item, x: e.clientX, y: e.clientY }) : undefined}
            onPointerLeave={interactive ? () => onHover?.(null) : undefined}
            onFocus={interactive ? (e) => {
              const b = (e.currentTarget as SVGGElement).getBoundingClientRect()
              onHover?.({ item: r.item, x: b.left + b.width / 2, y: b.top })
            } : undefined}
            onBlur={interactive ? () => onHover?.(null) : undefined}
          >
            {interactive && <rect x={0} y={cy - ROW / 2} width={W} height={ROW} style={{ fill: 'transparent' }} />}
            <text x={M.l - 10} y={cy + 4} textAnchor="end" style={{ fill: p.ink, fontSize: 12, ...font }}>
              <tspan style={{ fill: p.muted }}>{i + 1}. </tspan>
              {truncate(r.item.title)}
            </text>
            {d && <path d={d} style={{ fill: p.series1 }} />}
            <text x={M.l + w + 6} y={cy + 4} style={{ fill: p.ink2, fontSize: 11, fontWeight: 600, ...font }}>
              {r.result}
            </text>
          </g>
        )
      })}
      <text x={M.l + PW / 2} y={H - 6} textAnchor="middle" style={{ fill: p.ink2, fontSize: 12, fontWeight: 600, ...font }}>
        RICE score
      </text>
    </svg>
  )
}

function niceMax(v: number) {
  const mag = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= v) return m * mag
  return 10 * mag
}
