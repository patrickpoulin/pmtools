import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useStore } from '../core/store'
import { isBlank } from '../core/sample'
import type { Backlog } from '../core/types'
import { criteriaOf } from '../methods/weighted/scoring'
import { backlogToCsv, backlogToJson, csvToItems, downloadBlob, normalizeBacklog, shareUrl, slugify } from '../core/io'

/** Long URLs get truncated by some chat apps and browsers. */
const SHARE_URL_WARN = 8000

export function BacklogActions() {
  const backlog = useStore((s) => s.backlog)
  const { replaceBacklog, addItem } = useStore()
  const jsonRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)
  // An opened file waits here for a second click when it would replace work.
  const [pendingFile, setPendingFile] = useState<Backlog | null>(null)
  // A change to the backlog makes the question out of date.
  useEffect(() => {
    setPendingFile(null)
  }, [backlog])

  const readFile = (e: ChangeEvent<HTMLInputElement>, handle: (text: string) => void) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    file.text().then((text) => {
      try {
        handle(text)
      } catch (err) {
        setMsg({ text: (err as Error).message, error: true })
      }
    })
  }

  const copyShare = async () => {
    const url = shareUrl(backlog)
    try {
      await navigator.clipboard.writeText(url)
      setMsg({
        text:
          url.length > SHARE_URL_WARN
            ? `Link copied, but it is long (${url.length.toLocaleString()} characters) and some apps may cut it off. For large backlogs, share the JSON file instead.`
            : 'Share link copied. Anyone who opens it gets a copy of this backlog.',
      })
    } catch {
      setMsg({ text: 'Could not copy to the clipboard. Your browser may have blocked it.', error: true })
    }
  }

  const base = slugify(backlog.name)

  const openFile = (b: Backlog) => {
    setPendingFile(null)
    replaceBacklog(b)
    setMsg({ text: `Opened "${b.name}" with ${b.items.length} items.` })
  }

  return (
    <div className="stack">
      <div className="btn-row">
        <button className="btn primary" onClick={copyShare}>Copy share link</button>
        <button className="btn" onClick={() => downloadBlob(backlogToJson(backlog), `${base}.json`, 'application/json')}>
          Save JSON
        </button>
        <button className="btn" onClick={() => jsonRef.current?.click()}>Open JSON</button>
        <button className="btn" onClick={() => csvRef.current?.click()}>Import CSV</button>
        <button className="btn" onClick={() => downloadBlob(backlogToCsv(backlog), `${base}.csv`, 'text/csv')}>
          Export CSV
        </button>
      </div>
      <input
        ref={jsonRef} type="file" accept=".json,application/json" hidden
        onChange={(e) => readFile(e, (t) => {
          const b = normalizeBacklog(JSON.parse(t))
          setMsg(null)
          if (isBlank(backlog)) openFile(b)
          else setPendingFile(b)
        })}
      />
      <input
        ref={csvRef} type="file" accept=".csv,text/csv" hidden
        onChange={(e) => readFile(e, (t) => {
          const items = csvToItems(t, criteriaOf(backlog))
          items.forEach(({ id: _id, ...it }) => addItem(it))
          setMsg({ text: `Added ${items.length} items from CSV.` })
        })}
      />
      {pendingFile && (
        <div className="notice error" role="alert">
          <span>
            Opening “{pendingFile.name}” ({pendingFile.items.length} items) replaces your current backlog, “{backlog.name}”
            ({backlog.items.length} items). Save it as JSON first if you want to keep it.
          </span>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn danger" onClick={() => openFile(pendingFile)}>Yes, open the file</button>
            <button className="btn ghost" onClick={() => setPendingFile(null)}>Cancel</button>
          </div>
        </div>
      )}
      {msg && (
        <div className={`notice${msg.error ? ' error' : ''}`} role="status">
          {msg.text}
        </div>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        CSV needs a <code>title</code> column. Optional columns: <code>description</code>, <code>tags</code>{' '}
        (separated by ;), and scores such as <code>rice.reach</code>, <code>rice.effort</code>,{' '}
        <code>impact-effort.impact</code>, or <code>weighted.</code> plus a criterion name. Use Export CSV to get a template.
      </p>
    </div>
  )
}
