import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useStore } from '../core/store'
import { criteriaOf, defaultCriteria } from '../methods/weighted/scoring'
import type { Backlog } from '../core/types'
import { backlogToCsv, backlogToJson, csvToItems, downloadBlob, normalizeBacklog, shareUrl, slugify } from '../core/io'

/** Long URLs get truncated by some chat apps and browsers. */
const SHARE_URL_WARN = 8000

export function BacklogActions() {
  const backlog = useStore((s) => s.backlog)
  const { replaceBacklog, addItem, loadSample, clear } = useStore()
  const jsonRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)
  // Actions that replace the whole backlog wait here for a second click.
  const [pending, setPending] = useState<{ text: string; label: string; run: () => void } | null>(null)
  // Any change to the backlog makes the question out of date, so ask again rather than act on it.
  useEffect(() => {
    setPending(null)
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
  const current = `“${backlog.name}” (${backlog.items.length} ${backlog.items.length === 1 ? 'item' : 'items'})`

  // Nothing to lose: no items, no notes, and the default criteria.
  const untouched =
    !backlog.items.length &&
    !Object.values(backlog.notes).some((n) => n?.trim()) &&
    JSON.stringify(criteriaOf(backlog)) === JSON.stringify(defaultCriteria())

  /** Runs `run` straight away when there is nothing to lose, otherwise asks first. */
  const confirmReplace = (text: string, label: string, run: () => void) => {
    setMsg(null)
    if (untouched) run()
    else setPending({ text, label, run })
  }

  const loadSampleBacklog = () => {
    loadSample()
    setMsg({ text: 'Sample backlog loaded.' })
  }

  const openJson = (b: Backlog) => {
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
        <button
          className="btn ghost"
          onClick={() => confirmReplace(
            `Loading the sample replaces your current backlog, ${current}. Save it as JSON first if you want to keep it.`,
            'Yes, load the sample',
            loadSampleBacklog,
          )}
        >
          Load sample
        </button>
        <button
          className="btn ghost danger"
          onClick={() => {
            setMsg(null)
            setPending({
              text: `This deletes every item in ${current}. It can’t be undone.`,
              label: 'Yes, delete all items',
              run: () => {
                clear()
                setMsg({ text: 'Backlog cleared.' })
              },
            })
          }}
        >
          Clear all
        </button>
      </div>
      {pending && (
        <div className="notice error" role="alert">
          <span>{pending.text}</span>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn danger" onClick={() => { pending.run(); setPending(null) }}>{pending.label}</button>
            <button className="btn ghost" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      )}
      <input
        ref={jsonRef} type="file" accept=".json,application/json" hidden
        onChange={(e) => readFile(e, (t) => {
          const b = normalizeBacklog(JSON.parse(t))
          confirmReplace(
            `Opening “${b.name}” (${b.items.length} items) replaces your current backlog, ${current}. Save it as JSON first if you want to keep it.`,
            'Yes, open the file',
            () => openJson(b),
          )
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
