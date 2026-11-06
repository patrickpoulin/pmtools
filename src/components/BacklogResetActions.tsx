import { useState } from 'react'
import { useStore } from '../core/store'

/** Load sample and Clear all, kept at the top of the backlog so they are easy to find. */
export function BacklogResetActions() {
  const { loadSample, clear } = useStore()
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  return (
    <div className="btn-row">
      {msg && <span className="small muted" role="status">{msg}</span>}
      <button className="btn ghost" onClick={() => { loadSample(); setConfirmClear(false); setMsg('Sample backlog loaded.') }}>
        Load sample
      </button>
      {confirmClear ? (
        <>
          <button className="btn danger" onClick={() => { clear(); setConfirmClear(false); setMsg('Backlog cleared.') }}>
            Yes, delete all items
          </button>
          <button className="btn ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
        </>
      ) : (
        <button className="btn ghost danger" onClick={() => { setMsg(null); setConfirmClear(true) }}>Clear all</button>
      )}
    </div>
  )
}
