import { useState } from 'react'
import { Link } from 'react-router-dom'
import { downloadBlob } from '../core/io'
import { usePersonas } from '../personas/store'
import {
  BUYING_ROLES, ICP_FIELDS, PERSONA_LIMITS, PERSONA_ROWS, hasPersonaMap, personaMapMarkdown, personaName,
  type BuyingRole, type Persona,
} from '../personas/persona'

export function PersonasPage() {
  const { icp, personas, updateIcp, addPersona, clearMap, loadExample } = usePersonas()
  const map = { icp, personas }
  const filled = hasPersonaMap(map)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)
  const [pdf, setPdf] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null })
  const [confirmClear, setConfirmClear] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(personaMapMarkdown(map))
      setMsg({ text: 'Persona map copied as Markdown. Paste it into your doc or wiki.' })
    } catch {
      setMsg({ text: 'Could not copy to the clipboard. Your browser may have blocked it.', error: true })
    }
  }

  // The PDF code is loaded on demand: it is most of the bundle.
  const exportPdf = async () => {
    setPdf({ busy: true, error: null })
    try {
      const { exportPersonasPdf } = await import('../pdf/exportPersonas')
      exportPersonasPdf(map)
      setPdf({ busy: false, error: null })
    } catch (e) {
      console.error(e)
      setPdf({ busy: false, error: 'The PDF could not be created. Please try again.' })
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="eyebrow">Planning</div>
          <h1>Persona Map</h1>
          <p className="muted" style={{ margin: 0 }}>
            Describe the companies you serve best, then the people inside them, side by side.
          </p>
        </div>
        <div className="btn-row">
          <button className="btn" disabled={!filled} onClick={copy}>Copy as Markdown</button>
          <button className="btn" disabled={!filled} onClick={() => downloadBlob(personaMapMarkdown(map), 'persona-map.md', 'text/markdown')}>
            Download (.md)
          </button>
          <button className="btn primary" disabled={!filled || pdf.busy} onClick={exportPdf}>
            {pdf.busy ? 'Creating PDF…' : 'Export PDF'}
          </button>
        </div>
      </div>
      {pdf.error && <div className="notice error" role="alert">{pdf.error}</div>}
      {msg && <div className={`notice${msg.error ? ' error' : ''}`} role="status">{msg.text}</div>}

      <section className="card stack">
        <div>
          <h2 style={{ marginTop: 0 }}>Ideal Customer Profile</h2>
          <p className="small muted" style={{ margin: 0 }}>
            The kind of company that gets the most value from your product and is easiest to win and keep. Writing it
            down stops the team from building for whoever shouted loudest last week.
          </p>
        </div>
        <label className="field">
          Profile name
          <input
            value={icp.name}
            maxLength={PERSONA_LIMITS.name}
            placeholder="e.g. Growing B2B SaaS companies"
            onChange={(e) => updateIcp({ name: e.target.value })}
          />
        </label>
        <div className="grid-2">
          {ICP_FIELDS.map((f) => (
            <label key={f.key} className="field">
              {f.label}
              <textarea
                rows={2}
                className="short"
                value={icp[f.key]}
                maxLength={PERSONA_LIMITS.text}
                placeholder={f.placeholder}
                onChange={(e) => updateIcp({ [f.key]: e.target.value })}
              />
              <span className="small muted hint">{f.hint}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="page-head" style={{ marginBottom: 12, alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Personas</h2>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              The people at that company who buy, use or block your product. One column each, so you can compare them across.
            </p>
          </div>
          <button className="btn primary" disabled={personas.length >= PERSONA_LIMITS.personas} onClick={() => addPersona()}>
            + Add persona
          </button>
        </div>
        {personas.length ? (
          <div className="table-wrap">
            <table className="persona-grid">
              <thead>
                <tr>
                  <th scope="col"><span className="visually-hidden">Attribute</span></th>
                  {personas.map((p, i) => (
                    <PersonaHead key={p.id} persona={p} index={i} count={personas.length} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERSONA_ROWS.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">
                      {row.label}
                      <span className="small muted">{row.hint}</span>
                    </th>
                    {personas.map((p) => (
                      <PersonaCell key={p.id} persona={p} field={row.key} label={row.label} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No personas yet. Add the people who buy and use your product.</p>
        )}
        {personas.length >= PERSONA_LIMITS.personas && (
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            {PERSONA_LIMITS.personas} personas is the limit. Most teams focus on 3 to 5.
          </p>
        )}
      </section>

      <section className="card stack">
        <div className="btn-row">
          <Link className="btn" to="/stories">Write a story for a persona</Link>
          <button className="btn" onClick={loadExample} disabled={confirmClear}>Load the example</button>
          {confirmClear ? (
            <>
              <button className="btn danger" onClick={() => { clearMap(); setConfirmClear(false) }}>Yes, clear the map</button>
              <button className="btn ghost" onClick={() => setConfirmClear(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn ghost danger" disabled={!filled && !personas.length} onClick={() => setConfirmClear(true)}>
              Clear the map
            </button>
          )}
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Your persona map saves automatically in this browser, separately from your backlog and stories. Loading
          the example replaces what is here.
        </p>
      </section>

      <PersonaGuide />
    </div>
  )
}

function PersonaHead({ persona, index, count }: { persona: Persona; index: number; count: number }) {
  const { updatePersona, removePersona, movePersona } = usePersonas()
  const [confirm, setConfirm] = useState(false)
  const name = personaName(persona)
  const set = (patch: Partial<Persona>) => updatePersona(persona.id, patch)
  return (
    <th scope="col" style={{ borderTopColor: `var(--series-${persona.color})` }}>
      <div className="persona-head">
        <input
          className="persona-name"
          aria-label={`Persona ${index + 1} name`}
          value={persona.name}
          maxLength={PERSONA_LIMITS.name}
          placeholder="Name, e.g. Olivia, Head of Ops"
          onChange={(e) => set({ name: e.target.value })}
        />
        <input
          aria-label={`${name}: job title`}
          value={persona.jobTitle}
          maxLength={PERSONA_LIMITS.name}
          placeholder="Job title"
          onChange={(e) => set({ jobTitle: e.target.value })}
        />
        <select
          aria-label={`${name}: buying role`}
          value={persona.buyingRole}
          onChange={(e) => set({ buyingRole: e.target.value as BuyingRole })}
        >
          <option value="">Buying role…</option>
          {BUYING_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <div className="btn-row persona-actions">
          {confirm ? (
            <>
              <button className="btn danger icon" onClick={() => removePersona(persona.id)}>Yes, remove</button>
              <button className="btn ghost icon" onClick={() => setConfirm(false)}>Cancel</button>
            </>
          ) : (
            <>
              <button className="btn ghost icon" aria-label={`Move ${name} left`} disabled={index === 0} onClick={() => movePersona(persona.id, -1)}>
                ←
              </button>
              <button className="btn ghost icon" aria-label={`Move ${name} right`} disabled={index === count - 1} onClick={() => movePersona(persona.id, 1)}>
                →
              </button>
              <button className="btn ghost icon danger" aria-label={`Remove ${name}`} onClick={() => setConfirm(true)}>
                ✕
              </button>
            </>
          )}
        </div>
      </div>
    </th>
  )
}

function PersonaCell({ persona, field, label }: { persona: Persona; field: (typeof PERSONA_ROWS)[number]['key']; label: string }) {
  const updatePersona = usePersonas((s) => s.updatePersona)
  return (
    <td>
      <textarea
        aria-label={`${personaName(persona)}: ${label}`}
        rows={3}
        value={persona[field]}
        maxLength={PERSONA_LIMITS.text}
        onChange={(e) => updatePersona(persona.id, { [field]: e.target.value })}
      />
    </td>
  )
}

/** Plain explainer of ICPs and personas, below the map. */
function PersonaGuide() {
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>How to Map Personas</h2>
      <p>
        A persona map answers two questions before you plan anything: which companies should we build for, and who
        inside them do we need to win over? Good maps come from talking to customers, not from imagination.
      </p>
      <div className="grid-2">
        <div>
          <h3>Ideal Customer Profile</h3>
          <ul className="small">
            <li>Describes a <strong>company</strong>, not a person: industry, size, region, budget.</li>
            <li>Start from your best customers today: who got value fastest, stayed longest and cost least to support.</li>
            <li>Name the red flags too. Saying who you are <em>not</em> for keeps the roadmap focused.</li>
          </ul>
        </div>
        <div>
          <h3>Personas</h3>
          <ul className="small">
            <li>Describe the <strong>people</strong> at that company. Most B2B purchases involve several of them.</li>
            <li>Give each a buying role. The person who signs is rarely the person who uses the product every day.</li>
            <li>Keep to 3 to 5. More than that and nobody remembers them.</li>
            <li>Write pains and goals in their words, from interviews and support tickets.</li>
          </ul>
        </div>
      </div>
      <h3 style={{ marginTop: 12 }}>Buying Roles</h3>
      <div className="table-wrap">
        <table className="guide-table">
          <tbody>
            {BUYING_ROLES.map((r) => (
              <tr key={r.value}>
                <td><strong>{r.label}</strong></td>
                <td>{r.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: '16px 0 0' }}>
        Use your personas in the “As a…” part of your <Link to="/stories">user stories</Link>, so every story names
        someone real.
      </p>
    </section>
  )
}
