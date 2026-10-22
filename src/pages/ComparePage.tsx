import { Link } from 'react-router-dom'
import { useStore } from '../core/store'
import { METHODS } from '../methods/registry'

/** Each item's rank under every method, to see where they agree and disagree. */
export function ComparePage() {
  const backlog = useStore((s) => s.backlog)
  const ranks = METHODS.map((m) => {
    const ranked = m.rank(backlog)
    return {
      method: m,
      byId: new Map(ranked.map((r, i) => [r.item.id, { rank: i + 1, result: r.result }])),
    }
  })
  const spread = (id: string) => {
    const rs = ranks.map((r) => r.byId.get(id)!.rank)
    return Math.max(...rs) - Math.min(...rs)
  }
  const rows = [...backlog.items].sort((a, b) => {
    const avg = (id: string) => ranks.reduce((s, r) => s + r.byId.get(id)!.rank, 0) / ranks.length
    return avg(a.id) - avg(b.id)
  })
  const n = backlog.items.length

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="eyebrow">Cross-check</div>
          <h1>Compare methods</h1>
          <p className="muted" style={{ margin: 0 }}>
            Items are ordered by average rank. A large rank gap means the methods disagree, so that item is worth discussing.
          </p>
        </div>
      </div>
      {!n ? (
        <div className="card empty">
          <p>Your backlog is empty.</p>
          <Link className="btn primary" to="/backlog">Add items</Link>
        </div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                {ranks.map(({ method }) => (
                  <th key={method.id} className="num">{method.name}</th>
                ))}
                <th className="num">Rank gap</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const gap = spread(item.id)
                return (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    {ranks.map(({ method, byId }) => {
                      const r = byId.get(item.id)!
                      return (
                        <td key={method.id} className="num">
                          <strong>#{r.rank}</strong> <span className="muted small">{r.result}</span>
                        </td>
                      )
                    })}
                    <td className="num">
                      {gap >= Math.max(3, Math.ceil(n / 3)) ? <strong>⚠ {gap}</strong> : gap}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
