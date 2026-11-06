import { useEffect, useState } from 'react'
import { useStore } from '../core/store'
import { isBlank } from '../core/sample'

/** Load sample and Clear all, kept at the top of the backlog so they are easy to find. */
export function BacklogResetActions() {
  const backlog = useStore((s) => s.backlog)
  const { loadSample, clear } = useStore()
  const [msg, setMsg] = useState<string | null>(null)
  // Both replace the whole backlog, so each waits for a second click unless there is nothing to lose.
  const [confirm, setConfirm] = useState<'sample' | 'clear' | null>(null)
  // A change to the backlog makes an open question out of date.
  useEffect(() => {
    setConfirm(null)
  }, [backlog])

  const load = () => {
    loadSample()
    setMsg('Sample backlog loaded.')
  }

  if (confirm) {
    return (
      <div className="btn-row">
        <span className="small muted">
          {confirm === 'sample' ? 'This replaces your current backlog.' : 'This deletes every item.'}
        </span>
        <button
          className="btn danger"
          onClick={() => {
            setConfirm(null)
            if (confirm === 'sample') load()
            else {
              clear()
              setMsg('Backlog cleared.')
            }
          }}
        >
          {confirm === 'sample' ? 'Yes, load the sample' : 'Yes, delete all items'}
        </button>
        <button className="btn ghost" onClick={() => setConfirm(null)}>Cancel</button>
      </div>
    )
  }

  return (
    <div className="btn-row">
      {msg && <span className="small muted" role="status">{msg}</span>}
      <button className="btn ghost" onClick={() => { setMsg(null); if (isBlank(backlog)) load(); else setConfirm('sample') }}>
        Load sample
      </button>
      <button className="btn ghost danger" onClick={() => { setMsg(null); setConfirm('clear') }}>Clear all</button>
    </div>
  )
}
