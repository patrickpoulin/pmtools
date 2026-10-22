import type { ChartProps } from '../types'
import { SCALE_MAX, contributions, criteriaOf, rankWeighted, weightShare } from './scoring'

const W = 640
const ROW = 28
const BAR = 18
const M = { l: 200, r: 48, b: 40 }
const LEGEND_ROW = 20

const truncate = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export function WeightedChart({ backlog, palette: p, interactive, onHover }: ChartProps) {
  const rows = rankWeighted(backlog)
  const criteria = criteriaOf(backlog)
  const font = { fontFamily: p.font }

  // Legend wraps onto as many rows as it needs, above the bars.
  let lx = 0
  let ly = 0
  const legend = criteria.map((c) => {
    const label = `${c.name} ${Math.round(weightShare(c, criteria) * 100)}%${c.kind === 'cost' ? ' (cost)' : ''}`
    const w = 18 + label.length * 6.4 + 16
    if (lx > 0 && lx + w > W) {
      lx = 0
      ly += LEGEND_ROW
    }
    const pos = { c, label, x: lx, y: ly }
    lx += w
    return pos
  })
  const top = ly + LEGEND_ROW + 16
  const H = top + Math.max(rows.length, 1) * ROW + M.b
  const PW = W - M.l - M.r
  const x = (v: number) => M.l + (v / SCALE_MAX) * PW
  const ticks = [0, 1, 2, 3, 4, 5]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={`Weighted scores, ranked, for ${rows.length} items`}
      style={{ display: 'block', ...font }}
    >
      <rect x={0} y={0} width={W} height={H} style={{ fill: p.surface }} />
      {legend.map(({ c, label, x: gx, y: gy }) => (
        <g key={c.id}>
          <rect x={gx} y={gy + 3} width={12} height={12} rx={2} style={{ fill: p.categorical[c.color] }} />
          <text x={gx + 18} y={gy + 13} style={{ fill: p.ink2, fontSize: 11, ...font }}>
            {label}
          </text>
        </g>
      ))}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={top} y2={H - M.b} style={{ stroke: p.grid, strokeWidth: 1 }} />
          <text x={x(t)} y={H - M.b + 16} textAnchor="middle" style={{ fill: p.muted, fontSize: 11, ...font }}>
            {t}
          </text>
        </g>
      ))}
      <line x1={M.l} x2={M.l} y1={top} y2={H - M.b} style={{ stroke: p.axis, strokeWidth: 1 }} />
      {rows.map((r, i) => {
        const cy = top + i * ROW + ROW / 2
        let acc = 0
        const parts = contributions(backlog, r.values)
        return (
          <g
            key={r.item.id}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `${i + 1}. ${r.item.title}: weighted score ${r.result}` : undefined}
            className={interactive ? 'rice-row' : undefined}
            onPointerEnter={interactive ? (e) => onHover?.({ item: r.item, x: e.clientX, y: e.clientY }) : undefined}
            onPointerMove={interactive ? (e) => onHover?.({ item: r.item, x: e.clientX, y: e.clientY }) : undefined}
            onPointerLeave={interactive ? () => onHover?.(null) : undefined}
            onFocus={
              interactive
                ? (e) => {
                    const b = (e.currentTarget as SVGGElement).getBoundingClientRect()
                    onHover?.({ item: r.item, x: b.left + b.width / 2, y: b.top })
                  }
                : undefined
            }
            onBlur={interactive ? () => onHover?.(null) : undefined}
          >
            {interactive && <rect x={0} y={cy - ROW / 2} width={W} height={ROW} style={{ fill: 'transparent' }} />}
            <text x={M.l - 10} y={cy + 4} textAnchor="end" style={{ fill: p.ink, fontSize: 12, ...font }}>
              <tspan style={{ fill: p.muted }}>{i + 1}. </tspan>
              {truncate(r.item.title)}
            </text>
            {/* One segment per criterion, separated by a 2px gap. */}
            {parts.map(({ criterion, value }) => {
              const x0 = x(acc)
              acc += value
              const w = x(acc) - x0 - 2
              return w > 0 ? (
                <rect
                  key={criterion.id}
                  x={x0} y={cy - BAR / 2} width={w} height={BAR} rx={2}
                  style={{ fill: p.categorical[criterion.color] }}
                />
              ) : null
            })}
            <text x={x(acc) + 6} y={cy + 4} style={{ fill: p.ink2, fontSize: 11, fontWeight: 600, ...font }}>
              {r.result}
            </text>
          </g>
        )
      })}
      <text x={M.l + PW / 2} y={H - 6} textAnchor="middle" style={{ fill: p.ink2, fontSize: 12, fontWeight: 600, ...font }}>
        Weighted score (out of {SCALE_MAX})
      </text>
    </svg>
  )
}
