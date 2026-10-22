import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { ChartPalette, ChartProps } from '../types'
import { scoresFor } from '../types'
import {
  CATEGORIES, COULD, MOSCOW_FIELDS, MUST, MUST_SHARE_LIMIT, MUST_SHOULD_LIMIT, SHOULD, UNSORTED, UNSORTED_NAME, WONT,
  effortBalance, fmtEffort,
} from './scoring'

const W = 960
const GAP = 12
const HEAD = 44
const CARD_H = 28
const CARD_GAP = 6
const BAR_H = 22

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export const categoryColor = (p: ChartPalette, v: number) =>
  v === MUST ? p.ord1 : v === SHOULD ? p.ord2 : v === COULD ? p.ord3 : v === WONT ? p.neutral : 'none'

const SHORT: Record<number, string> = { [MUST]: 'Must', [SHOULD]: 'Should', [COULD]: 'Could', [WONT]: "Won't" }

export function MoscowChart({ backlog, palette: p, interactive, onScore, onHover }: ChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; ox: number; oy: number } | null>(null)
  const method = { id: 'moscow' as const, fields: MOSCOW_FIELDS }
  const font = { fontFamily: p.font }

  const items = backlog.items.map((item, i) => ({ item, n: i + 1, s: scoresFor(item, method) }))
  const hasUnsorted = items.some((it) => it.s.category === UNSORTED)
  const columns = [
    ...(hasUnsorted ? [{ value: UNSORTED, name: UNSORTED_NAME }] : []),
    ...CATEGORIES.map((c) => ({ value: c.value, name: c.name })),
  ]
  const colW = (W - GAP * (columns.length - 1)) / columns.length
  const colX = (i: number) => i * (colW + GAP)
  const chars = Math.floor((colW - 22) / 6.6)
  const byCol = columns.map((c) => items.filter((it) => it.s.category === c.value))
  const rows = Math.max(1, ...byCol.map((c) => c.length))
  const boardH = HEAD + rows * (CARD_H + CARD_GAP) + 4

  const balance = effortBalance(backlog)
  const barY = boardH + 58
  const H = barY + BAR_H + 50

  const toSvg = (e: PointerEvent) => {
    const ctm = svgRef.current?.getScreenCTM()
    return ctm ? new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()) : null
  }

  const drop = (e: PointerEvent) => {
    if (!drag) return
    const pt = toSvg(e)
    setDrag(null)
    if (!pt || !onScore) return
    const col = Math.min(columns.length - 1, Math.max(0, Math.floor((pt.x + GAP / 2) / (colW + GAP))))
    onScore(drag.id, 'category', columns[col].value)
  }

  // Left/right moves through Must → Won't; an unsorted item enters at Must.
  const onKey = (id: string, current: number) => (e: KeyboardEvent) => {
    if (!onScore || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    e.preventDefault()
    const order = [MUST, SHOULD, COULD, WONT]
    const i = order.indexOf(current)
    const next = i < 0 ? 0 : Math.min(order.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))
    onScore(id, 'category', order[next])
  }

  const planned = [MUST, SHOULD, COULD]
  const cap = balance.capacity
  const basis = cap ?? balance.planned
  const over = cap !== null ? Math.max(0, balance.planned - cap) : 0
  // Effort units → x. The scale stretches to fit planned work that overflows capacity.
  const scaleMax = Math.max(cap ?? 0, balance.planned) || 1
  const barX = (effort: number) => (effort / scaleMax) * W
  const markers =
    cap !== null
      ? [
          { at: cap * MUST_SHARE_LIMIT, label: `Must limit ${Math.round(MUST_SHARE_LIMIT * 100)}%` },
          { at: cap * MUST_SHOULD_LIMIT, label: `Must + Should ${Math.round(MUST_SHOULD_LIMIT * 100)}%` },
        ]
      : [{ at: balance.planned * MUST_SHARE_LIMIT, label: `${Math.round(MUST_SHARE_LIMIT * 100)}% Must-have guideline` }]

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={`MoSCoW board with ${items.length} items`}
      style={{ display: 'block', userSelect: 'none', touchAction: drag ? 'none' : 'auto', ...font }}
      onPointerMove={
        interactive && drag
          ? (e) => {
              const pt = toSvg(e)
              if (pt) setDrag({ ...drag, x: pt.x, y: pt.y })
            }
          : undefined
      }
      onPointerUp={interactive ? drop : undefined}
      onPointerCancel={interactive ? () => setDrag(null) : undefined}
    >
      <rect x={0} y={0} width={W} height={H} style={{ fill: p.surface }} />

      {columns.map((c, ci) => {
        const x = colX(ci)
        const stats = balance.byCategory.get(c.value)!
        const color = categoryColor(p, c.value)
        return (
          <g key={c.value}>
            <rect
              x={x} y={0} width={colW} height={boardH} rx={6}
              style={{ fill: p.surface2, stroke: c.value === UNSORTED ? p.axis : 'none', strokeDasharray: '4 3' }}
            />
            {c.value !== UNSORTED && <rect x={x} y={0} width={colW} height={4} rx={2} style={{ fill: color }} />}
            <text x={x + 10} y={22} style={{ fill: p.ink, fontSize: 13, fontWeight: 700, ...font }}>
              {c.name}
            </text>
            <text x={x + 10} y={37} style={{ fill: p.muted, fontSize: 11, ...font }}>
              {stats.count} {stats.count === 1 ? 'item' : 'items'} · effort {fmtEffort(stats.effort)}
            </text>
            {byCol[ci].map(({ item, n, s }, k) => {
              const y = HEAD + k * (CARD_H + CARD_GAP)
              const dragging = drag?.id === item.id
              const dx = dragging ? drag.x - drag.ox : 0
              const dy = dragging ? drag.y - drag.oy : 0
              return (
                <g
                  key={item.id}
                  transform={dragging ? `translate(${dx} ${dy})` : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  role={interactive ? 'button' : undefined}
                  aria-label={
                    interactive ? `${n}. ${item.title}: ${c.name}. Left and right arrow keys change category.` : undefined
                  }
                  className={interactive ? 'moscow-card' : undefined}
                  style={{ cursor: interactive ? (dragging ? 'grabbing' : 'grab') : undefined, opacity: dragging ? 0.85 : 1 }}
                  onPointerDown={
                    interactive
                      ? (e) => {
                          const pt = toSvg(e)
                          if (!pt) return
                          svgRef.current?.setPointerCapture(e.pointerId)
                          setDrag({ id: item.id, x: pt.x, y: pt.y, ox: pt.x, oy: pt.y })
                          onHover?.(null)
                        }
                      : undefined
                  }
                  onPointerEnter={interactive && !drag ? (e) => onHover?.({ item, x: e.clientX, y: e.clientY }) : undefined}
                  onPointerLeave={interactive ? () => onHover?.(null) : undefined}
                  onFocus={
                    interactive
                      ? (e) => {
                          const r = (e.currentTarget as SVGGElement).getBoundingClientRect()
                          onHover?.({ item, x: r.right, y: r.top })
                        }
                      : undefined
                  }
                  onBlur={interactive ? () => onHover?.(null) : undefined}
                  onKeyDown={interactive ? onKey(item.id, s.category) : undefined}
                >
                  <rect
                    x={x + 6} y={y} width={colW - 12} height={CARD_H} rx={4}
                    style={{ fill: p.surface, stroke: p.border, strokeWidth: 1 }}
                  />
                  {c.value !== UNSORTED && (
                    <rect x={x + 6} y={y} width={4} height={CARD_H} rx={2} style={{ fill: color }} />
                  )}
                  <text x={x + 16} y={y + 18} style={{ fill: p.ink, fontSize: 12, pointerEvents: 'none', ...font }}>
                    <tspan style={{ fill: p.muted }}>{n}. </tspan>
                    {truncate(item.title, chars)}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })}

      {/* Effort balance: planned work against capacity (or against itself when no capacity is set). */}
      <text x={0} y={barY - 26} style={{ fill: p.ink, fontSize: 13, fontWeight: 700, ...font }}>
        {cap !== null ? `Planned effort vs capacity (${fmtEffort(cap)})` : 'Planned effort (Must + Should + Could)'}
      </text>
      {balance.planned > 0 || cap !== null ? (
        <>
          {cap !== null && (
            <rect
              x={0} y={barY} width={barX(cap)} height={BAR_H} rx={3}
              style={{ fill: p.surface2, stroke: p.border, strokeWidth: 1 }}
            />
          )}
          {(() => {
            let acc = 0
            return planned.map((v) => {
              const e = balance.byCategory.get(v)!.effort
              const x0 = barX(acc)
              acc += e
              const w = Math.max(0, barX(e) - 2)
              return w > 0 ? (
                <rect key={v} x={x0} y={barY} width={w} height={BAR_H} rx={3} style={{ fill: categoryColor(p, v) }} />
              ) : null
            })
          })()}
          {over > 0 && (
            <rect
              x={barX(cap!)} y={barY - 3} width={barX(over)} height={BAR_H + 6} rx={3}
              style={{ fill: p.tintBad, fillOpacity: 0.18, stroke: p.tintBad, strokeWidth: 1.5 }}
            />
          )}
          {markers.map((m) => (
            <g key={m.label}>
              <line
                x1={barX(m.at)} x2={barX(m.at)} y1={barY - 8} y2={barY + BAR_H + 4}
                style={{ stroke: p.ink, strokeWidth: 1.5, strokeDasharray: '4 3' }}
              />
              <text x={barX(m.at) + 5} y={barY - 8} style={{ fill: p.ink2, fontSize: 11, ...font }}>
                {m.label}
              </text>
            </g>
          ))}
          {cap !== null && (
            <>
              <line
                x1={barX(cap)} x2={barX(cap)} y1={barY - 8} y2={barY + BAR_H + 8}
                style={{ stroke: p.ink, strokeWidth: 2 }}
              />
              <text
                x={barX(cap) - 5} y={barY + BAR_H + 20} textAnchor="end"
                style={{ fill: p.ink, fontSize: 11, fontWeight: 700, ...font }}
              >
                Capacity {fmtEffort(cap)}
                {over > 0 && ` · over by ${fmtEffort(over)}`}
              </text>
            </>
          )}
          {planned.map((v, i) => {
            const e = balance.byCategory.get(v)!.effort
            const lx = i * 230
            const ly = barY + BAR_H + 38
            return (
              <g key={v}>
                <rect x={lx} y={ly - 10} width={12} height={12} rx={2} style={{ fill: categoryColor(p, v) }} />
                <text x={lx + 18} y={ly} style={{ fill: p.ink2, fontSize: 12, ...font }}>
                  {SHORT[v]}: {fmtEffort(e)} ({Math.round((basis > 0 ? e / basis : 0) * 100)}%{cap !== null ? ' of capacity' : ''})
                </text>
              </g>
            )
          })}
        </>
      ) : (
        <text x={0} y={barY + 16} style={{ fill: p.muted, fontSize: 12, ...font }}>
          No effort planned yet. Move items into Must, Should or Could.
        </text>
      )}
    </svg>
  )
}
