import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../core/store'
import { METHODS } from '../methods/registry'
import { BacklogActions } from '../components/BacklogActions'

export function BacklogPage() {
  const backlog = useStore((s) => s.backlog)
  const { setMeta, addItem, updateItem, removeItem, moveItem } = useStore()
  const [title, setTitle] = useState('')

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    addItem({ title: title.trim() })
    setTitle('')
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="eyebrow">Step 1</div>
          <h1>Your backlog</h1>
          <p className="muted" style={{ margin: 0 }}>
            Add the ideas you want to prioritize. You enter them once here, and every method scores the same list.
          </p>
        </div>
        <div className="btn-row">
          {METHODS.map((m) => (
            <Link key={m.id} className="btn" to={`/method/${m.id}`}>
              Score with {m.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="card grid-2">
        <label className="field">
          Backlog name
          <input value={backlog.name} onChange={(e) => setMeta({ name: e.target.value })} />
        </label>
        <label className="field">
          Author or team (shown on PDFs)
          <input value={backlog.author} placeholder="e.g. Growth squad" onChange={(e) => setMeta({ author: e.target.value })} />
        </label>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th style={{ minWidth: 200 }}>Title</th>
                <th style={{ minWidth: 240 }}>Description</th>
                <th style={{ minWidth: 140 }}>Tags</th>
                <th><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {backlog.items.map((item, i) => (
                <tr key={item.id} className="item-row">
                  <td><span className="dot-num">{i + 1}</span></td>
                  <td>
                    <input aria-label={`Title of item ${i + 1}`} value={item.title} onChange={(e) => updateItem(item.id, { title: e.target.value })} />
                  </td>
                  <td>
                    <input aria-label={`Description of item ${i + 1}`} value={item.description} placeholder="Why it matters" onChange={(e) => updateItem(item.id, { description: e.target.value })} />
                  </td>
                  <td>
                    <TagsInput value={item.tags} onChange={(tags) => updateItem(item.id, { tags })} label={`Tags for item ${i + 1}`} />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn ghost icon" aria-label="Move up" disabled={i === 0} onClick={() => moveItem(item.id, -1)}>↑</button>
                    <button className="btn ghost icon" aria-label="Move down" disabled={i === backlog.items.length - 1} onClick={() => moveItem(item.id, 1)}>↓</button>
                    <button className="btn ghost icon danger" aria-label={`Delete ${item.title}`} onClick={() => removeItem(item.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!backlog.items.length && <div className="empty">No items yet. Add one below, import a CSV, or load the sample.</div>}
        </div>
        <form onSubmit={add} className="btn-row" style={{ marginTop: 16 }}>
          <input
            aria-label="New item title"
            placeholder="Add an item, e.g. “Self-serve onboarding”, then press Enter"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ flex: 1, minWidth: 220, width: 'auto' }}
          />
          <button className="btn primary" type="submit" disabled={!title.trim()}>Add item</button>
        </form>
      </div>

      <div className="card">
        <h2>Save, share and import</h2>
        <p className="small muted">
          Your backlog saves automatically in this browser. Use these to back it up, move it to another device,
          or share it with your team.
        </p>
        <BacklogActions />
      </div>
    </div>
  )
}

/** Comma-separated tags, edited as text and committed on blur. */
function TagsInput({ value, onChange, label }: { value: string[]; onChange: (t: string[]) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      aria-label={label}
      placeholder="comma, separated"
      value={draft ?? value.join(', ')}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null) onChange(draft.split(',').map((t) => t.trim()).filter(Boolean))
        setDraft(null)
      }}
    />
  )
}
