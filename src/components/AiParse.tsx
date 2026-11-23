import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../core/store'
import { ITEM_LIMITS } from '../core/io'
import { AI_PROMPT, STORY_TAG, isDuplicate, parseAiReply } from '../core/aiParse'

interface Row {
  key: number
  include: boolean
  title: string
  description: string
  isStory: boolean
  source: string
  duplicate: boolean
}

/** Collapsed section: copy a prompt into any AI chat, paste the JSON back, review it, add it to the backlog. */
export function AiParse() {
  const items = useStore((s) => s.backlog.items)
  const addItem = useStore((s) => s.addItem)
  const [reply, setReply] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)

  const room = ITEM_LIMITS.items - items.length
  const chosen = rows?.filter((r) => r.include && r.title.trim()) ?? []

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT)
      setMsg({ text: 'Prompt copied. Paste it into your AI chat, add your requirements under it, and send.' })
    } catch {
      setMsg({ text: 'Could not copy to the clipboard. Select the prompt text and copy it instead.', error: true })
    }
  }

  const read = () => {
    try {
      const parsed = parseAiReply(reply)
      setRows(parsed.map((p, i) => {
        const duplicate = isDuplicate(p.title, items)
        return { ...p, key: i, include: !duplicate, duplicate }
      }))
      setMsg(null)
    } catch (err) {
      setRows(null)
      setMsg({ text: (err as Error).message, error: true })
    }
  }

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs && rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const add = () => {
    chosen.forEach((r) =>
      addItem({ title: r.title.trim(), description: r.description.trim(), tags: r.isStory ? [STORY_TAG] : [] }),
    )
    setMsg({ text: `Added ${chosen.length} ${chosen.length === 1 ? 'item' : 'items'} to the backlog, unscored.` })
    setRows(null)
    setReply('')
  }

  return (
    <details className="card ai-parse">
      <summary><h2>Parse with AI</h2></summary>
      <div className="stack" style={{ marginTop: 12 }}>
        <p className="small muted" style={{ margin: 0 }}>
          Have a list of requirements in a doc, email or meeting notes? Use any AI chat to turn it into backlog items.
          pmtools doesn't send anything anywhere: you choose what to share, and with which AI.
        </p>

        <div className="stack">
          <h3 style={{ margin: 0 }}>1. Copy the Prompt</h3>
          <p className="small muted" style={{ margin: 0 }}>
            Paste it into Claude, ChatGPT or another AI chat, then paste your requirements under it and send.
          </p>
          <textarea readOnly value={AI_PROMPT} aria-label="Prompt for the AI" rows={8} className="small" />
          <div className="btn-row">
            <button className="btn primary" onClick={copyPrompt}>Copy prompt</button>
          </div>
        </div>

        <div className="stack">
          <h3 style={{ margin: 0 }}>2. Paste the Results</h3>
          <label className="field">
            The AI's reply (the JSON list)
            <textarea
              value={reply}
              rows={6}
              placeholder='[ { "title": "…", "description": "…", "isStory": true, "source": "…" } ]'
              onChange={(e) => setReply(e.target.value)}
            />
          </label>
          <div className="btn-row">
            <button className="btn primary" onClick={read} disabled={!reply.trim()}>Review items</button>
          </div>
        </div>

        {rows && (
          <div className="stack">
            <h3 style={{ margin: 0 }}>3. Review and Add</h3>
            <p className="small muted" style={{ margin: 0 }}>
              Untick anything you don't want and fix titles as needed. Items are added unscored, so you can score them
              in any method. Items marked as user stories get the "{STORY_TAG}" tag and a Write story button that starts
              them in the <Link to="/stories">user story writer</Link>.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Add</th>
                    <th style={{ minWidth: 200 }}>Title</th>
                    <th style={{ minWidth: 240 }}>Description</th>
                    <th>User story</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.key} className="item-row">
                      <td>
                        <input
                          type="checkbox" checked={r.include} aria-label={`Add item ${i + 1}`}
                          onChange={(e) => update(r.key, { include: e.target.checked })}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Title of parsed item ${i + 1}`} value={r.title} maxLength={ITEM_LIMITS.title}
                          onChange={(e) => update(r.key, { title: e.target.value })}
                        />
                        {r.duplicate && <div className="small muted">Already in your backlog</div>}
                        {r.source && (
                          <details className="about small">
                            <summary>Source</summary>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{r.source}</div>
                          </details>
                        )}
                      </td>
                      <td>
                        <textarea
                          aria-label={`Description of parsed item ${i + 1}`} value={r.description} rows={2}
                          maxLength={ITEM_LIMITS.description}
                          onChange={(e) => update(r.key, { description: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox" checked={r.isStory} aria-label={`Item ${i + 1} is a user story`}
                          onChange={(e) => update(r.key, { isStory: e.target.checked })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {chosen.length > room && (
              <div className="notice error" role="alert">
                The backlog holds up to {ITEM_LIMITS.items} items and has room for {Math.max(room, 0)} more.
                Untick some items or remove old ones first.
              </div>
            )}
            <div className="btn-row">
              <button className="btn primary" onClick={add} disabled={!chosen.length || chosen.length > room}>
                Add {chosen.length} {chosen.length === 1 ? 'item' : 'items'} to backlog
              </button>
              <button className="btn ghost" onClick={() => setRows(null)}>Cancel</button>
            </div>
          </div>
        )}

        {msg && (
          <div className={`notice${msg.error ? ' error' : ''}`} role="status">
            {msg.text}
          </div>
        )}
      </div>
    </details>
  )
}
