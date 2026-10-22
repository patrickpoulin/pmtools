import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { ChartProps } from '../types'
import { scoresFor } from '../types'
import { IE_FIELDS, QUADRANTS } from './scoring'

const W = 640
const H = 480
const M = { l: 56, r: 16, t: 16, b: 52 }
const PW = W - M.l - M.r
const PH = H - M.t - M.b
// Padding past 1 and 10 leaves a band for the quadrant labels.
const LO = 0
const HI = 11
const R = 11

const x = (effort: number) => M.l + ((effort - LO) / (HI - LO)) * PW
const y = (impact: number) => M.t + PH - ((impact - LO) / (HI - LO)) * PH
const clamp = (v: number) => Math.min(10, Math.max(1, Math.round(v * 2) / 2))

export function ImpactEffortChart({ backlog, palette: p, interactive, onScore, onHover }: ChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const { effortMid, impactMid } = backlog.settings.impactEffort
  const method = { id: 'impact-effort' as const, fields: IE_FIELDS }

  // Items sharing a position fan out in a small ring so none is hidden.
  const seen = new Map<string, number>()
  const counts = new Map<string, number>()
  const pts = backlog.items.map((item, i) => {
    const s = scoresFor(item, method)
    const key = `${s.impact}|${s.effort}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
    return { item, n: i + 1, s, key }
  })
  const placed = pts.map((pt) => {
    const k = seen.get(pt.key) ?? 0
    seen.set(pt.key, k + 1)
    const total = counts.get(pt.key)!
    const off = total > 1 ? R + 2 : 0
    const a = (k / total) * Math.PI * 2 - Math.PI / 2
    return { ...pt, cx: x(pt.s.effort) + Math.cos(a) * off, cy: y(pt.s.impact) + Math.sin(a) * off }
  })

  const toValues = (e: PointerEvent) => {
    const svg = svgRef.current!
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return {
      effort: clamp(LO + ((pt.x - M.l) / PW) * (HI - LO)),
      impact: clamp(LO + ((M.t + PH - pt.y) / PH) * (HI - LO)),
    }
  }

  const onMove = (e: PointerEvent) => {
    if (!dragId || !onScore) return
    const v = toValues(e)
    if (!v) return
    onScore(dragId, 'effort', v.effort)
    onScore(dragId, 'impact', v.impact)
  }

  const onKey = (id: string, s: Record<string, number>) => (e: KeyboardEvent) => {
    if (!onScore) return
    const step = e.shiftKey ? 1 : 0.5
    const moves: Record<string, [string, number]> = {
      ArrowUp: ['impact', step],
      ArrowDown: ['impact', -step],
      ArrowRight: ['effort', step],
      ArrowLeft: ['effort', -step],
    }
    const mv = moves[e.key]
    if (!mv) return
    e.preventDefault()
    onScore(id, mv[0], clamp(s[mv[0]] + mv[1]))
  }

  const quads = [
    { q: 'quick-win', x0: LO, x1: effortMid, y0: impactMid, y1: HI, tint: p.tintGood, anchor: 'start' },
    { q: 'major-project', x0: effortMid, x1: HI, y0: impactMid, y1: HI, tint: undefined, anchor: 'end' },
    { q: 'fill-in', x0: LO, x1: effortMid, y0: LO, y1: impactMid, tint: undefined, anchor: 'start' },
    { q: 'money-pit', x0: effortMid, x1: HI, y0: LO, y1: impactMid, tint: p.tintBad, anchor: 'end' },
  ] as const

  const font = { fontFamily: p.font }
  const ticks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={`Impact vs Effort matrix with ${backlog.items.length} items`}
      style={{ display: 'block', touchAction: dragId ? 'none' : 'auto', userSelect: 'none', ...font }}
      onPointerMove={interactive ? onMove : undefined}
      onPointerUp={interactive ? () => setDragId(null) : undefined}
      onPointerCancel={interactive ? () => setDragId(null) : undefined}
    >
      <rect x={0} y={0} width={W} height={H} style={{ fill: p.surface }} />
      {quads.map(({ q, x0, x1, y0, y1, tint, anchor }) => {
        const top = q === 'quick-win' || q === 'major-project'
        return (
          <g key={q}>
            {tint && (
              <rect
                x={x(x0)}
                y={y(y1)}
                width={x(x1) - x(x0)}
                height={y(y0) - y(y1)}
                style={{ fill: tint, fillOpacity: 0.09 }}
              />
            )}
            <text
              x={anchor === 'start' ? x(x0) + 10 : x(x1) - 10}
              y={top ? y(y1) + 18 : y(y0) - 8}
              textAnchor={anchor}
              style={{ fill: p.ink2, fontSize: 13, fontWeight: 600, ...font }}
            >
              {QUADRANTS[q].name}
            </text>
          </g>
        )
      })}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={M.t} y2={M.t + PH} style={{ stroke: p.grid, strokeWidth: 1 }} />
          <line x1={M.l} x2={M.l + PW} y1={y(t)} y2={y(t)} style={{ stroke: p.grid, strokeWidth: 1 }} />
          <text x={x(t)} y={M.t + PH + 18} textAnchor="middle" style={{ fill: p.muted, fontSize: 11, ...font }}>
            {t}
          </text>
          <text x={M.l - 10} y={y(t) + 4} textAnchor="end" style={{ fill: p.muted, fontSize: 11, ...font }}>
            {t}
          </text>
        </g>
      ))}
      <line x1={M.l} x2={M.l + PW} y1={M.t + PH} y2={M.t + PH} style={{ stroke: p.axis, strokeWidth: 1 }} />
      <line x1={M.l} x2={M.l} y1={M.t} y2={M.t + PH} style={{ stroke: p.axis, strokeWidth: 1 }} />
      <line
        x1={x(effortMid)} x2={x(effortMid)} y1={M.t} y2={M.t + PH}
        style={{ stroke: p.axis, strokeWidth: 1.5, strokeDasharray: '5 4' }}
      />
      <line
        x1={M.l} x2={M.l + PW} y1={y(impactMid)} y2={y(impactMid)}
        style={{ stroke: p.axis, strokeWidth: 1.5, strokeDasharray: '5 4' }}
      />
      <text x={M.l + PW / 2} y={H - 10} textAnchor="middle" style={{ fill: p.ink2, fontSize: 12, fontWeight: 600, ...font }}>
        Effort (1 = low, 10 = high)
      </text>
      <text
        transform={`translate(16 ${M.t + PH / 2}) rotate(-90)`}
        textAnchor="middle"
        style={{ fill: p.ink2, fontSize: 12, fontWeight: 600, ...font }}
      >
        Impact (1 = low, 10 = high)
      </text>
      {placed.map(({ item, n, s, cx, cy }) => (
        <g
          key={item.id}
          tabIndex={interactive ? 0 : undefined}
          role={interactive ? 'button' : undefined}
          aria-label={
            interactive
              ? `${n}. ${item.title}: impact ${s.impact}, effort ${s.effort}. Arrow keys to move.`
              : undefined
          }
          className={interactive ? 'ie-dot' : undefined}
          style={{ cursor: interactive ? (dragId === item.id ? 'grabbing' : 'grab') : undefined }}
          onPointerDown={
            interactive
              ? (e) => {
                  ;(e.currentTarget.ownerSVGElement ?? svgRef.current)?.setPointerCapture(e.pointerId)
                  setDragId(item.id)
                  onHover?.(null)
                }
              : undefined
          }
          onPointerEnter={interactive && !dragId ? (e) => onHover?.({ item, x: e.clientX, y: e.clientY }) : undefined}
          onPointerLeave={interactive ? () => onHover?.(null) : undefined}
          onFocus={interactive ? (e) => {
            const r = (e.currentTarget as SVGGElement).getBoundingClientRect()
            onHover?.({ item, x: r.right, y: r.top })
          } : undefined}
          onBlur={interactive ? () => onHover?.(null) : undefined}
          onKeyDown={interactive ? onKey(item.id, s) : undefined}
        >
          {/* Larger invisible hit target than the mark. */}
          {interactive && <circle cx={cx} cy={cy} r={R + 8} style={{ fill: 'transparent' }} />}
          <circle cx={cx} cy={cy} r={R} style={{ fill: p.series1, stroke: p.surface, strokeWidth: 2 }} />
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            style={{ fill: p.onSeries, fontSize: n > 9 ? 10 : 11, fontWeight: 700, pointerEvents: 'none', ...font }}
          >
            {n}
          </text>
        </g>
      ))}
    </svg>
  )
}
