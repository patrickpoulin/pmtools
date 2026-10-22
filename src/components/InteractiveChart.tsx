import { useState } from 'react'
import type { Item } from '../core/types'
import { useStore } from '../core/store'
import type { MethodDef } from '../methods/types'
import { SCREEN_PALETTE } from '../methods/registry'

/** A method's chart wired to the store, with an HTML hover tooltip. */
export function InteractiveChart({ method }: { method: MethodDef }) {
  const backlog = useStore((s) => s.backlog)
  const setScore = useStore((s) => s.setScore)
  const [hover, setHover] = useState<{ item: Item; x: number; y: number } | null>(null)
  const { Chart } = method

  return (
    <>
      <Chart
        backlog={backlog}
        palette={SCREEN_PALETTE}
        interactive
        onScore={(id, key, value) => setScore(id, method.id, key, value)}
        onHover={setHover}
      />
      {hover && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(hover.x + 14, window.innerWidth - 280),
            top: Math.max(hover.y - 12, 8),
          }}
          role="status"
        >
          <strong>{hover.item.title}</strong>
          {method.describe(hover.item, backlog).map((l) => (
            <div key={l} className="muted">
              {l}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
