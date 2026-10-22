import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { METHODS, SCREEN_PALETTE } from '../methods/registry'
import { sampleBacklog } from '../core/sample'

export function HomePage() {
  const sample = useMemo(sampleBacklog, [])

  return (
    <div className="stack">
      <section className="hero">
        <h1>Make product decisions you can explain.</h1>
        <p>
          Free prioritization tools for product managers. Add your backlog once, score it with proven methods, see
          the trade-offs on a chart, and export a PDF to share with stakeholders.
        </p>
        <div className="btn-row">
          <Link className="btn primary" to="/backlog">Start with your backlog</Link>
          <Link className="btn" to="/method/impact-effort">Try it with sample data</Link>
        </div>
      </section>

      <section className="method-grid">
        {METHODS.map(({ id, name, tagline, bestFor, Chart }) => (
          <Link key={id} to={`/method/${id}`} className="card method-card">
            <div aria-hidden="true" className="method-preview">
              <Chart backlog={sample} palette={SCREEN_PALETTE} />
            </div>
            <h2 style={{ margin: 0 }}>{name}</h2>
            <p className="best-for">{bestFor}</p>
            <p className="muted" style={{ margin: 0 }}>{tagline}</p>
          </Link>
        ))}
      </section>

      <section className="card">
        <h2>How it works</h2>
        <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div>
            <h3>1. List your ideas</h3>
            <p className="muted small">Type them in, paste from a spreadsheet as CSV, or open a link from a teammate.</p>
          </div>
          <div>
            <h3>2. Score and visualize</h3>
            <p className="muted small">Each method has its own inputs and chart. Compare methods to find where they disagree.</p>
          </div>
          <div>
            <h3>3. Decide and share</h3>
            <p className="muted small">Write down your decision and export a PDF with the chart, scores and reasoning.</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Private by design</h2>
        <p className="muted small" style={{ margin: 0 }}>
          There are no accounts and no server. Everything you enter stays in your browser’s local storage, and PDFs
          are created on your device. Share links carry the backlog inside the URL itself.
        </p>
      </section>
    </div>
  )
}
