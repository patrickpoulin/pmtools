import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../core/store'
import { decodeShare } from '../core/io'
import type { Backlog } from '../core/types'

/** Landing page for share links (#/import?d=…). Asks before replacing the visitor's own backlog. */
export function ImportPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const current = useStore((s) => s.backlog)
  const replaceBacklog = useStore((s) => s.replaceBacklog)

  const result = useMemo((): { backlog?: Backlog; error?: string } => {
    const d = params.get('d')
    if (!d) return { error: 'This link does not contain a backlog.' }
    try {
      return { backlog: decodeShare(d) }
    } catch (e) {
      return { error: (e as Error).message }
    }
  }, [params])

  if (!result.backlog) {
    return (
      <div className="card stack">
        <h1>Couldn’t open shared backlog</h1>
        <div className="notice error">{result.error}</div>
        <Link className="btn" to="/">Go to home</Link>
      </div>
    )
  }

  const b = result.backlog
  return (
    <div className="card stack" style={{ maxWidth: 720 }}>
      <div>
        <div className="eyebrow">Shared backlog</div>
        <h1>{b.name}</h1>
        <p className="muted">
          {b.author && <>From {b.author} · </>}
          {b.items.length} items
        </p>
      </div>
      <ol>
        {b.items.slice(0, 12).map((i) => <li key={i.id}>{i.title}</li>)}
        {b.items.length > 12 && <li className="muted">…and {b.items.length - 12} more</li>}
      </ol>
      {current.items.length > 0 && (
        <div className="notice">
          Opening this replaces your current backlog, “{current.name}” ({current.items.length} items). To keep it,
          save it as JSON from the Backlog page first.
        </div>
      )}
      <div className="btn-row">
        <button
          className="btn primary"
          onClick={() => {
            replaceBacklog(b)
            navigate('/backlog')
          }}
        >
          Open this backlog
        </button>
        <Link className="btn ghost" to="/">Cancel</Link>
      </div>
    </div>
  )
}
