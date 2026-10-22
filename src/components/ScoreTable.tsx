import { useEffect, useState } from 'react'
import { useStore } from '../core/store'
import type { FieldDef } from '../core/types'
import type { MethodDef } from '../methods/types'
import { fieldsFor, scoresFor } from '../methods/types'

function ScoreInput({ field, value, onChange, label }: {
  field: FieldDef
  value: number
  onChange: (v: number) => void
  label: string
}) {
  if (field.kind === 'select') {
    return (
      <select aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {field.options!.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }
  return <NumberInput field={field} value={value} onChange={onChange} label={label} />
}

/** Keeps a text draft so a field can be cleared and retyped; commits only valid in-range numbers. */
function NumberInput({ field, value, onChange, label }: {
  field: FieldDef
  value: number
  onChange: (v: number) => void
  label: string
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => {
    setDraft(String(value))
  }, [value])
  const valid = (v: number) =>
    Number.isFinite(v) && (field.min === undefined || v >= field.min) && (field.max === undefined || v <= field.max)

  return (
    <input
      className="score-input"
      aria-label={label}
      type="number"
      inputMode="decimal"
      min={field.min}
      max={field.max}
      step={field.step}
      value={draft}
      aria-invalid={draft !== '' && !valid(Number(draft))}
      onChange={(e) => {
        setDraft(e.target.value)
        const v = Number(e.target.value)
        if (e.target.value !== '' && valid(v)) onChange(v)
      }}
      onBlur={() => setDraft(String(value))}
    />
  )
}

/** Inputs for every item, in backlog order, plus the computed result. */
export function ScoreTable({ method }: { method: MethodDef }) {
  const backlog = useStore((s) => s.backlog)
  const setScore = useStore((s) => s.setScore)
  const results = new Map(method.rank(backlog).map((r) => [r.item.id, r.result]))
  const showResult = method.showResultInTable !== false
  const fields = fieldsFor(method, backlog)

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            {fields.map((f) => (
              <th key={f.key} title={f.help}>
                {f.label} <span aria-hidden="true" className="muted">ⓘ</span>
              </th>
            ))}
            {showResult && <th className="num">{method.resultLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {backlog.items.map((item, i) => {
            const v = scoresFor(item, { id: method.id, fields })
            return (
              <tr key={item.id}>
                <td><span className="dot-num">{i + 1}</span></td>
                <td>{item.title}</td>
                {fields.map((f) => (
                  <td key={f.key}>
                    <ScoreInput
                      field={f}
                      value={v[f.key]}
                      label={`${f.label} for ${item.title}`}
                      onChange={(val) => setScore(item.id, method.id, f.key, val)}
                    />
                  </td>
                ))}
                {showResult && <td className="num result-cell">{results.get(item.id)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
