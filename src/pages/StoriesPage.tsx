import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../core/store'
import { downloadBlob } from '../core/io'
import { EXAMPLE_ID, useStories } from '../stories/store'
import {
  INVEST, MAX_CRITERIA, POINTS, article, cleanPart, emptyCriterion, hasStory, investStatus,
  readyCount, storyHints, storyMarkdown, storySentence, type AcceptanceCriterion, type StoryDoc, type UserStory,
} from '../stories/story'

const STATUS_ICON = { ok: '✓', warn: '⚠', todo: '○' } as const

export function StoriesPage() {
  const { stories, addStory, removeStory, restoreExample } = useStories()
  const [params, setParams] = useSearchParams()
  const showGuide = params.has('guide') || !stories.length
  const selected = showGuide ? undefined : stories.find((s) => s.id === params.get('story')) ?? stories[0]
  const select = (id: string) => setParams({ story: id }, { replace: true })
  const written = stories.filter(hasStory)
  const [pdf, setPdf] = useStoryPdf()

  const allMarkdown = () => ['# User stories', ...written.map((s) => storyMarkdown(s.title, s))].join('\n\n') + '\n'

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="eyebrow">Planning</div>
          <h1>User stories</h1>
          <p className="muted" style={{ margin: 0 }}>
            Write a new story step by step: who it’s for, what they need, why it matters, and how you’ll know it’s done.
          </p>
        </div>
        <div className="btn-row">
          <button
            className="btn"
            disabled={!written.length}
            onClick={() => downloadBlob(allMarkdown(), 'user-stories.md', 'text/markdown')}
          >
            Download all (.md)
          </button>
          <button className="btn primary" disabled={!written.length || pdf.busy} onClick={() => setPdf(written, true)}>
            {pdf.busy ? 'Creating PDF…' : 'Export all as PDF'}
          </button>
        </div>
      </div>
      {pdf.error && <div className="notice error" role="alert">{pdf.error}</div>}

      <div className="story-layout">
        <nav className="card story-list" aria-label="User stories">
          <button
            className={`story-guide-link${showGuide ? ' active' : ''}`}
            aria-current={showGuide ? 'page' : undefined}
            onClick={() => setParams({ guide: '' }, { replace: true })}
          >
            <span aria-hidden="true">?</span> How to write a good story
          </button>
          <div className="story-list-head">
            <h2>Your stories</h2>
            <button className="btn primary" onClick={() => select(addStory())}>+ New</button>
          </div>
          <ol>
            {stories.map((story) => (
              <li key={story.id}>
                <button
                  className={story.id === selected?.id ? 'active' : ''}
                  aria-current={story.id === selected?.id ? 'page' : undefined}
                  onClick={() => select(story.id)}
                >
                  <span className="story-list-title">
                    {story.title.trim() || 'Untitled story'}
                    <span className="small muted">
                      {hasStory(story) ? `INVEST ${readyCount(story)} of 6` : 'Not started'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {!stories.length && <p className="small muted" style={{ margin: '4px 8px' }}>No stories yet. Start one with + New.</p>}
        </nav>
        {selected ? (
          <StoryEditor
            key={selected.id}
            story={selected}
            onPdf={() => setPdf([selected])}
            pdfBusy={pdf.busy}
            onDelete={() => {
              // Back to the top of the page and the first story, rather than mid-way down the next one.
              removeStory(selected.id)
              setParams({}, { replace: true })
              window.scrollTo(0, 0)
            }}
          />
        ) : (
          <StoryGuide
            onStart={() => select(addStory())}
            onExample={
              stories.some((s) => s.id === EXAMPLE_ID)
                ? undefined
                : () => {
                    restoreExample()
                    select(EXAMPLE_ID)
                  }
            }
          />
        )}
      </div>
    </div>
  )
}

/** Builds a PDF of the given stories. The PDF code is loaded on demand: it is most of the bundle. */
function useStoryPdf() {
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null })
  const run = async (stories: StoryDoc[], collection = false) => {
    setState({ busy: true, error: null })
    try {
      const { exportStoriesPdf } = await import('../pdf/exportStories')
      exportStoriesPdf(stories, collection)
      setState({ busy: false, error: null })
    } catch (e) {
      console.error(e)
      setState({ busy: false, error: 'The PDF could not be created. Please try again.' })
    }
  }
  return [state, run] as const
}

function StoryEditor({ story, onPdf, pdfBusy, onDelete }: { story: StoryDoc; onPdf: () => void; pdfBusy: boolean; onDelete: () => void }) {
  const updateStory = useStories((s) => s.updateStory)
  const addItem = useStore((s) => s.addItem)
  const [msg, setMsg] = useState<{ text: string; error?: boolean; backlog?: boolean } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (patch: Partial<StoryDoc>) => updateStory(story.id, patch)
  const setCriterion = (i: number, patch: Partial<AcceptanceCriterion>) =>
    set({ criteria: story.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  const title = story.title.trim() || 'Untitled story'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(storyMarkdown(title, story))
      setMsg({ text: 'Story copied as Markdown. Paste it into your tracker or doc.' })
    } catch {
      setMsg({ text: 'Could not copy to the clipboard. Your browser may have blocked it.', error: true })
    }
  }

  const toBacklog = () => {
    addItem({ title, description: storySentence(story) })
    setMsg({ text: `Added “${title}” to your backlog.`, backlog: true })
  }

  const role = cleanPart('role', story.role)

  return (
    <div className="stack">
      <div className="card stack">
        <label className="field">
          Story name
          <input
            value={story.title}
            placeholder="e.g. Invite teammates"
            onChange={(e) => set({ title: e.target.value })}
          />
          <span className="small muted hint">A short name so you can find it in the list. It becomes the heading when you copy it.</span>
        </label>

        <div className="story-parts">
          <label className="field">
            1. Who is it for?
            <span className="story-input">
              <span className="story-prefix">As {article(role || 'a')}</span>
              <input
                value={story.role}
                placeholder="new workspace admin"
                onChange={(e) => set({ role: e.target.value })}
              />
            </span>
            <span className="small muted hint">A specific role or persona, not just “user”.</span>
          </label>
          <label className="field">
            2. What do they want?
            <span className="story-input">
              <span className="story-prefix">I want</span>
              <input
                value={story.want}
                placeholder="to invite my teammates in one step"
                onChange={(e) => set({ want: e.target.value })}
              />
            </span>
            <span className="small muted hint">The need or goal in their words. Leave the design to the team.</span>
          </label>
          <label className="field">
            3. Why does it matter?
            <span className="story-input">
              <span className="story-prefix">so that</span>
              <input
                value={story.benefit}
                placeholder="we can start working together on day one"
                onChange={(e) => set({ benefit: e.target.value })}
              />
            </span>
            <span className="small muted hint">The outcome it unlocks. This is what lets the team suggest a better idea.</span>
          </label>
        </div>

        <blockquote className="story-preview" aria-live="polite">{storySentence(story)}</blockquote>
      </div>

      <div className="card">
        <h3>4. Acceptance criteria</h3>
        <p className="small muted">
          The conditions that must be true for the story to be done. Write each as a scenario: the starting situation,
          what the person does, and the result anyone can check.
        </p>
        <div className="stack" style={{ marginTop: 12 }}>
          {story.criteria.map((c, i) => (
            <fieldset key={i} className="criterion">
              <legend className="small">Criterion {i + 1}</legend>
              {(['given', 'when', 'then'] as const).map((k) => (
                <label key={k} className="story-input">
                  <span className="story-prefix">{k[0].toUpperCase() + k.slice(1)}</span>
                  <input
                    value={c[k]}
                    placeholder={CRITERION_PLACEHOLDER[k]}
                    onChange={(e) => setCriterion(i, { [k]: e.target.value })}
                  />
                </label>
              ))}
              <button
                className="btn ghost icon danger"
                aria-label={`Remove criterion ${i + 1}`}
                disabled={story.criteria.length <= 1}
                onClick={() => set({ criteria: story.criteria.filter((_, j) => j !== i) })}
              >
                ✕
              </button>
            </fieldset>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => set({ criteria: [...story.criteria, emptyCriterion()] })}>
            + Add criterion
          </button>
          <span className="small muted">Most stories need 2 to {MAX_CRITERIA - 2}. Include at least one “unhappy path”.</span>
        </div>
      </div>

      <div className="card grid-2">
        <label className="field">
          5. Estimate
          <select
            value={story.points ?? ''}
            onChange={(e) => set({ points: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">Not estimated</option>
            {POINTS.map((p) => (
              <option key={p} value={p}>{p} {p === 1 ? 'point' : 'points'}</option>
            ))}
          </select>
          <span className="small muted hint">Story points agreed with the team. Anything over 8 is a sign to split.</span>
        </label>
        <label className="field">
          Notes (optional)
          <textarea
            value={story.notes}
            placeholder="Out of scope, open questions, links to designs or research"
            onChange={(e) => set({ notes: e.target.value })}
          />
        </label>
      </div>

      <InvestCheck story={story} onToggle={(key, on) => set({ invest: { ...story.invest, [key]: on } })} />

      <div className="card stack">
        <div className="btn-row">
          <button className="btn primary" onClick={copy} disabled={!hasStory(story)}>Copy as Markdown</button>
          <button className="btn" onClick={onPdf} disabled={!hasStory(story) || pdfBusy}>Export PDF</button>
          <button className="btn" onClick={toBacklog} disabled={!hasStory(story)}>Add to backlog</button>
          {confirmDelete ? (
            <>
              <button className="btn danger" onClick={onDelete}>Yes, delete this story</button>
              <button className="btn ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn ghost danger" onClick={() => setConfirmDelete(true)}>Delete story</button>
          )}
        </div>
        {msg && (
          <div className={`notice${msg.error ? ' error' : ''}`} role="status">
            {msg.text} {msg.backlog && <Link to="/backlog">Open the backlog</Link>}
          </div>
        )}
        <p className="small muted" style={{ margin: 0 }}>
          Stories save automatically in this browser, separately from your backlog. Add one to the backlog when
          you’re ready to prioritize it against everything else.
        </p>
      </div>
    </div>
  )
}

const CRITERION_PLACEHOLDER = {
  given: 'I have invited 3 teammates',
  when: 'one of them opens the invite link',
  then: 'they join my workspace without creating a new one',
}

function InvestCheck({ story, onToggle }: { story: UserStory; onToggle: (key: keyof UserStory['invest'], on: boolean) => void }) {
  const status = investStatus(story)
  const hints = storyHints(story)
  return (
    <div className="card">
      <h3>6. INVEST check</h3>
      <p className="small muted">
        A good story is Independent, Negotiable, Valuable, Estimable, Small and Testable. Warnings come from what you
        wrote above; tick each quality once you and the team agree it holds.
      </p>
      <ul className="invest-list" aria-live="polite">
        {INVEST.map(({ key, letter, name, question }) => (
          <li key={key} className={`invest-${status[key]}`}>
            <span className="invest-letter" aria-hidden="true">{letter}</span>
            <div>
              <label className="invest-label">
                <input
                  type="checkbox"
                  checked={Boolean(story.invest[key])}
                  onChange={(e) => onToggle(key, e.target.checked)}
                />
                <strong>{name}</strong>
                <span className="small muted">{question}</span>
              </label>
              {hints.filter((h) => h.invest === key).map((h) => (
                <div key={h.text} className="small invest-hint">
                  <span aria-hidden="true">{STATUS_ICON.warn}</span> {h.text}
                </div>
              ))}
            </div>
            <span className="invest-status" aria-label={STATUS_LABEL[status[key]]} title={STATUS_LABEL[status[key]]}>
              {STATUS_ICON[status[key]]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const STATUS_LABEL = { ok: 'Looks good', warn: 'Needs attention', todo: 'Not confirmed yet' } as const

const SPLITS: [string, string][] = [
  ['Workflow steps', 'Ship the first and last step of a process, then fill in the middle (e.g. "create draft" before "approve").'],
  ['Business rules', 'One story per rule or variation: standard pricing first, discounts later.'],
  ['Happy path first', 'Build the main success path, then handle errors and edge cases as their own stories.'],
  ['Data or input types', 'Support one file type, payment method or region before the rest.'],
  ['Operations', 'Split "manage" into view, create, edit and delete.'],
  ['Simple, then better', 'Deliver a basic version, then a story for performance, polish or scale.'],
  ['Spike', 'If nobody can estimate it, time-box a short investigation and write the real story after.'],
]

/** Plain explainer of what makes a good story, shown below the editor. */
function StoryGuide({ onStart, onExample }: { onStart: () => void; onExample?: () => void }) {
  return (
    <div className="card">
      <div className="page-head" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>How to write a good user story</h2>
        <div className="btn-row">
          {onExample && <button className="btn" onClick={onExample}>Add the example story</button>}
          <button className="btn primary" onClick={onStart}>Start a new story</button>
        </div>
      </div>
      <p>
        A user story is a short description of a change from the point of view of the person who benefits. It is a
        promise of a conversation, not a full specification: the story says who and why, the acceptance criteria say
        when it is done, and the team works out how together.
      </p>
      <div className="grid-2">
        <div>
          <h3>The three parts</h3>
          <ul className="small">
            <li><strong>As a…</strong> names a real role or persona, so the team pictures someone specific.</li>
            <li><strong>I want…</strong> states the need, not the screen. “Find last month’s invoices” beats “add a date filter dropdown”.</li>
            <li><strong>So that…</strong> gives the reason. It’s the most skipped part and the most useful: it lets the team judge trade-offs and propose simpler options.</li>
          </ul>
        </div>
        <div>
          <h3>Acceptance criteria</h3>
          <ul className="small">
            <li>Write them before the sprint starts, with the team, so estimates include them.</li>
            <li>Use <strong>Given / When / Then</strong>: a starting situation, an action, and an observable result.</li>
            <li>Cover what happens when things go wrong, not only the happy path.</li>
            <li>Avoid words you can’t test, like “fast” or “intuitive”. Use numbers instead.</li>
          </ul>
        </div>
      </div>
      <h3 style={{ marginTop: 12 }}>INVEST</h3>
      <div className="table-wrap">
        <table className="guide-table">
          <tbody>
            {INVEST.map((q) => (
              <tr key={q.key}>
                <td><strong>{q.letter}: {q.name}</strong></td>
                <td>{q.question}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 style={{ marginTop: 20 }}>Too big? Ways to split a story</h3>
      <p className="small muted">Each slice should still deliver something a user can see and use, end to end.</p>
      <div className="table-wrap">
        <table className="guide-table">
          <tbody>
            {SPLITS.map(([name, advice]) => (
              <tr key={name}>
                <td><strong>{name}</strong></td>
                <td>{advice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: '16px 0 0' }}>
        The template comes from Connextra (2001) and was popularized by Mike Cohn; INVEST is from Bill Wake (2003).
      </p>
    </div>
  )
}
