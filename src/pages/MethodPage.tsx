import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../core/store'
import type { MethodDef } from '../methods/types'
import { InteractiveChart } from '../components/InteractiveChart'
import { ScoreTable } from '../components/ScoreTable'
import { QUADRANTS } from '../methods/impact-effort/scoring'
import { CATEGORIES, UNSORTED, WONT, effortBalance, fmtEffort, scopeChecks } from '../methods/moscow/scoring'
import { HomePage } from './HomePage'
import { MAX_CRITERIA, criteriaOf, weightShare } from '../methods/weighted/scoring'
import { SCREEN_PALETTE, getMethod } from '../methods/registry'

export function MethodPage() {
  const method = getMethod(useParams().id)
  if (!method) return <HomePage />
  return <MethodView key={method.id} method={method} />
}

function MethodView({ method }: { method: MethodDef }) {
  const backlog = useStore((s) => s.backlog)
  const setNotes = useStore((s) => s.setNotes)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportPdf = async () => {
    setExporting(true)
    setError(null)
    try {
      // Loaded on demand: the PDF libraries are most of the bundle.
      const { exportMethodPdf } = await import('../pdf/exportPdf')
      await exportMethodPdf(method, backlog)
    } catch (e) {
      console.error(e)
      setError('The PDF could not be created. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const chart = (
    <div className="card chart-card">
      <InteractiveChart method={method} />
      {method.chartHint && (
        <p className="small muted" style={{ margin: '8px 4px 0' }}>{method.chartHint}</p>
      )}
    </div>
  )
  const panel =
    method.id === 'impact-effort' ? <QuadrantPanel method={method} />
    : method.id === 'moscow' ? <BalancePanel />
    : <TopPicks method={method} />
  // Methods without a full-width guide keep the compact explainer beside the chart.
  const side = method.guide ? panel : (
    <div className="stack">
      {panel}
      <AboutCard method={method} />
    </div>
  )

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="eyebrow">Prioritization method</div>
          <h1>{method.name}</h1>
          <p className="muted" style={{ margin: 0 }}>{method.tagline}</p>
        </div>
        <div className="btn-row">
          <Link className="btn" to="/backlog">Edit backlog</Link>
          <button className="btn primary" onClick={exportPdf} disabled={exporting || !backlog.items.length}>
            {exporting ? 'Creating PDF…' : 'Export PDF'}
          </button>
        </div>
      </div>
      {error && <div className="notice error" role="alert">{error}</div>}

      {!backlog.items.length ? (
        <div className="card empty">
          <p>Your backlog is empty.</p>
          <Link className="btn primary" to="/backlog">Add items</Link>
        </div>
      ) : (
        <>
          {method.id === 'weighted' && <CriteriaEditor />}

          <div className="card">
            <h2>Scores</h2>
            <p className="small muted">
              Score each item here and the chart below updates as you go. Hover over a column heading to see what it means.
            </p>
            <ScoreTable method={method} />
          </div>

          {method.wideChart ? (
            <>
              {chart}
              {side}
            </>
          ) : (
            <div className="method-layout">
              {chart}
              {side}
            </div>
          )}

          {method.guide && <MethodGuide method={method} guide={method.guide} />}

          <div className="card">
            <label className="field">
              <h2 style={{ color: 'var(--text-primary)' }}>Decision notes</h2>
              <span className="small muted" style={{ fontWeight: 400 }}>
                Record what you decided and why. Notes are included in the PDF.
              </span>
              <textarea
                value={backlog.notes[method.id] ?? ''}
                placeholder="e.g. Committing to the top 3 for Q3. Deferring SSO until the enterprise pipeline is confirmed."
                onChange={(e) => setNotes(method.id, e.target.value)}
              />
            </label>
          </div>
        </>
      )}
    </div>
  )
}

function AboutCard({ method }: { method: MethodDef }) {
  return (
    <div className="card">
      <h3>How {method.name} works</h3>
      <p className="small">{method.about.summary}</p>
      <p className="small"><code>{method.formula}</code></p>
      <details className="about small">
        <summary>When to use it</summary>
        <ul>{method.about.whenToUse.map((t) => <li key={t}>{t}</li>)}</ul>
      </details>
      <details className="about small">
        <summary>Common pitfalls</summary>
        <ul>{method.about.pitfalls.map((t) => <li key={t}>{t}</li>)}</ul>
      </details>
    </div>
  )
}

/** Full-width explainer with a "what to do" row per quadrant or category. */
function MethodGuide({ method, guide }: { method: MethodDef; guide: NonNullable<MethodDef['guide']> }) {
  return (
    <div className="card">
      <h2>How {method.name} works</h2>
      <p>{method.about.summary}</p>
      <div className="table-wrap">
        <table className="guide-table">
          <thead>
            <tr>
              <th>{guide.heading}</th>
              <th>What to do</th>
            </tr>
          </thead>
          <tbody>
            {guide.rows.map((q) => (
              <tr key={q.name}>
                <td>
                  <strong>{q.name}</strong>
                  {q.position && <div className="small muted">{q.position}</div>}
                </td>
                <td>{q.advice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid-2" style={{ marginTop: 20 }}>
        <div>
          <h3>When to use it</h3>
          <ul className="small">{method.about.whenToUse.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div>
          <h3>Common pitfalls</h3>
          <ul className="small">{method.about.pitfalls.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
    </div>
  )
}

function QuadrantPanel({ method }: { method: MethodDef }) {
  const backlog = useStore((s) => s.backlog)
  const setMids = useStore((s) => s.setImpactEffortMids)
  const { effortMid, impactMid } = backlog.settings.impactEffort
  const order = new Map(backlog.items.map((it, i) => [it.id, i + 1]))
  const ranked = method.rank(backlog)

  return (
    <div className="card">
      <h3>Quadrants</h3>
      <div className="quadrant-list">
        {Object.values(QUADRANTS).map((q) => {
          const rows = ranked.filter((r) => r.result === q.name)
          return (
            <div key={q.name}>
              <strong className="small">{q.name} ({rows.length})</strong>
              <ol>
                {rows.map((r) => (
                  <li key={r.item.id}>
                    <span className="dot-num">{order.get(r.item.id)}</span> {r.item.title}
                  </li>
                ))}
                {!rows.length && <li className="muted">None</li>}
              </ol>
            </div>
          )
        })}
      </div>
      <div className="grid-2" style={{ marginTop: 16, gap: 12 }}>
        <label className="field">
          Impact divider: {impactMid}
          <input type="range" min={1.5} max={9.5} step={0.5} value={impactMid} onChange={(e) => setMids({ impactMid: Number(e.target.value) })} />
        </label>
        <label className="field">
          Effort divider: {effortMid}
          <input type="range" min={1.5} max={9.5} step={0.5} value={effortMid} onChange={(e) => setMids({ effortMid: Number(e.target.value) })} />
        </label>
      </div>
    </div>
  )
}

function TopPicks({ method }: { method: MethodDef }) {
  const backlog = useStore((s) => s.backlog)
  const ranked = method.rank(backlog)
  return (
    <div className="card">
      <h3>Top priorities</h3>
      <ol style={{ margin: 0, paddingLeft: '1.2em' }}>
        {ranked.slice(0, 5).map((r) => (
          <li key={r.item.id} style={{ marginBottom: 4 }}>
            {r.item.title} <span className="muted small">· {r.result}</span>
          </li>
        ))}
      </ol>
      {ranked.length > 5 && <p className="small muted" style={{ margin: '8px 0 0' }}>…and {ranked.length - 5} more in the table below.</p>}
    </div>
  )
}

/** MoSCoW summary: capacity input, effort per category and checks against the DSDM guidelines. */
function BalancePanel() {
  const backlog = useStore((s) => s.backlog)
  const setCapacity = useStore((s) => s.setMoscowCapacity)
  const b = effortBalance(backlog)
  const checks = scopeChecks(backlog)
  const unsorted = b.byCategory.get(UNSORTED)!.count
  const icon = { ok: '✓', warn: '⚠', info: 'ℹ' } as const

  return (
    <div className="card">
      <h3>Scope check</h3>
      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        <div className="stack">
          <label className="field">
            Capacity for this release
            <CapacityInput value={b.capacity} onChange={setCapacity} />
            <span className="small muted" style={{ fontWeight: 400 }}>
              Total effort the team has available, in the same unit as the Effort column (for example, 4 people × 3
              months = 12 person-months). Leave blank to skip the capacity check.
            </span>
          </label>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="num">Items</th>
                  <th className="num">Effort</th>
                  {b.capacity !== null && <th className="num">Of capacity</th>}
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((c) => {
                  const s = b.byCategory.get(c.value)!
                  const planned = c.value !== WONT
                  return (
                    <tr key={c.value}>
                      <td>{c.name}</td>
                      <td className="num">{s.count}</td>
                      <td className="num">{fmtEffort(s.effort)}</td>
                      {b.capacity !== null && (
                        <td className="num">{planned ? `${Math.round((s.effort / b.capacity) * 100)}%` : '—'}</td>
                      )}
                    </tr>
                  )
                })}
                <tr>
                  <td><strong>Planned (Must + Should + Could)</strong></td>
                  <td />
                  <td className="num"><strong>{fmtEffort(b.planned)}</strong></td>
                  {b.capacity !== null && <td className="num"><strong>{Math.round(b.plannedShare * 100)}%</strong></td>}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <ul className="scope-checks" aria-live="polite">
          {checks.map((c) => (
            <li key={c.text} className={`notice${c.tone === 'warn' ? ' error' : ''}`}>
              <span aria-hidden="true">{icon[c.tone]}</span> {c.text}
            </li>
          ))}
          {unsorted > 0 && (
            <li className="notice">
              <span aria-hidden="true">{icon.info}</span> {unsorted} {unsorted === 1 ? 'item is' : 'items are'} still
              unsorted and not counted. Drag {unsorted === 1 ? 'it' : 'them'} into a column.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

/** Optional positive number; an empty field clears the capacity. */
function CapacityInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  useEffect(() => {
    setDraft(value === null ? '' : String(value))
  }, [value])
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step={0.5}
      placeholder="Not set"
      value={draft}
      style={{ maxWidth: 160, display: 'block' }}
      onChange={(e) => {
        setDraft(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value === '') onChange(null)
        else if (Number.isFinite(n) && n > 0) onChange(n)
      }}
      onBlur={() => setDraft(value === null ? '' : String(value))}
    />
  )
}

/** Weighted Scoring setup: the criteria, their weights and whether each is a benefit or a cost. */
function CriteriaEditor() {
  const backlog = useStore((s) => s.backlog)
  const { addCriterion, updateCriterion, removeCriterion } = useStore()
  const criteria = criteriaOf(backlog)
  const total = criteria.reduce((s, c) => s + Math.max(0, c.weight), 0)

  return (
    <div className="card">
      <h2>Criteria</h2>
      <p className="small muted">
        Agree on these before scoring. Weights are relative, so 30 / 20 / 10 works the same as 3 / 2 / 1, and the Share
        column shows each as a percentage. Mark effort-like criteria as <strong>Cost</strong> so a high score counts
        against the item.
      </p>
      <div className="table-wrap">
        <table className="criteria-table">
          <thead>
            <tr>
              <th><span className="visually-hidden">Color</span></th>
              <th>Criterion</th>
              <th>Weight</th>
              <th className="num">Share</th>
              <th>Type</th>
              <th><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => (
              <tr key={c.id}>
                <td><span className="swatch" style={{ background: SCREEN_PALETTE.categorical[c.color] }} /></td>
                <td>
                  <input
                    type="text"
                    aria-label="Criterion name"
                    value={c.name}
                    onChange={(e) => updateCriterion(c.id, { name: e.target.value })}
                  />
                </td>
                <td>
                  <WeightInput
                    value={c.weight}
                    label={`Weight for ${c.name}`}
                    onChange={(weight) => updateCriterion(c.id, { weight })}
                  />
                </td>
                <td className="num">{total > 0 ? `${Math.round(weightShare(c, criteria) * 100)}%` : '—'}</td>
                <td>
                  <select
                    aria-label={`Type of ${c.name}`}
                    value={c.kind}
                    onChange={(e) => updateCriterion(c.id, { kind: e.target.value as 'benefit' | 'cost' })}
                  >
                    <option value="benefit">Benefit (higher is better)</option>
                    <option value="cost">Cost (higher is worse)</option>
                  </select>
                </td>
                <td>
                  <button
                    className="btn ghost icon danger"
                    aria-label={`Remove ${c.name}`}
                    disabled={criteria.length <= 1}
                    onClick={() => removeCriterion(c.id)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total === 0 && (
        <div className="notice error" style={{ marginTop: 12 }}>Give at least one criterion a weight above 0.</div>
      )}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={addCriterion} disabled={criteria.length >= MAX_CRITERIA}>
          + Add criterion
        </button>
        <span className="small muted">
          {criteria.length} of {MAX_CRITERIA}. Most teams use 3–6.
        </span>
      </div>
    </div>
  )
}

/** Non-negative weight; keeps a draft so the field can be cleared and retyped. */
function WeightInput({ value, label, onChange }: { value: number; label: string; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => {
    setDraft(String(value))
  }, [value])
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      min={0}
      step={5}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value !== '' && Number.isFinite(n) && n >= 0) onChange(n)
      }}
      onBlur={() => setDraft(String(value))}
    />
  )
}
