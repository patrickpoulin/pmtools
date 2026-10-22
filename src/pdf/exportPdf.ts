import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { svg2pdf } from 'svg2pdf.js'
import type { Backlog, FieldDef } from '../core/types'
import { slugify } from '../core/io'
import type { MethodDef } from '../methods/types'
import { fieldsFor } from '../methods/types'
import { PRINT_PALETTE } from '../methods/registry'

const REPO = 'github.com/patrickpoulin/pmtools'
const PAGE_W = 612
const PAGE_H = 792
const MX = 48
const CONTENT_W = PAGE_W - MX * 2
const INK: [number, number, number] = [11, 11, 11]
const INK2: [number, number, number] = [82, 81, 78]
const ACCENT: [number, number, number] = [42, 120, 214]

/** jsPDF's built-in fonts are WinAnsi; swap the few characters outside it. */
const safe = (s: string) => s.replace(/→/g, '->').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')

function formatValue(fields: FieldDef[], key: string, v: number) {
  const f = fields.find((x) => x.key === key)
  if (f?.format) return f.format(v)
  if (f?.kind === 'number' && v >= 1000) return v.toLocaleString('en-US')
  return String(v)
}

async function drawChart(doc: jsPDF, method: MethodDef, backlog: Backlog, top: number, maxH: number) {
  const markup = renderToStaticMarkup(
    createElement(method.Chart, { backlog, palette: PRINT_PALETTE, interactive: false }),
  )
  const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement as unknown as SVGSVGElement
  inlineStylesAsAttributes(svg)
  const [, , vw, vh] = svg.getAttribute('viewBox')!.split(' ').map(Number)
  let w = CONTENT_W
  let h = (w * vh) / vw
  if (h > maxH) {
    h = maxH
    w = (h * vw) / vh
  }
  // svg2pdf measures text through the DOM, so the node must be attached while it draws.
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:640px;visibility:hidden'
  host.appendChild(svg)
  document.body.appendChild(host)
  try {
    await svg2pdf(svg, doc, { x: MX + (CONTENT_W - w) / 2, y: top, width: w, height: h })
  } finally {
    host.remove()
  }
  return top + h
}

/** svg2pdf reads presentation attributes, not inline style, so move each declaration onto its element. */
function inlineStylesAsAttributes(root: Element) {
  for (const el of [root, ...root.querySelectorAll('[style]')]) {
    const style = el.getAttribute('style')
    if (!style) continue
    for (const decl of style.split(';')) {
      const i = decl.indexOf(':')
      if (i <= 0) continue
      const prop = decl.slice(0, i).trim()
      let value = decl.slice(i + 1).trim()
      // jsPDF's built-in fonts only have normal and bold.
      if (prop === 'font-weight') value = Number(value) >= 600 || value === 'bold' ? 'bold' : 'normal'
      el.setAttribute(prop, value)
    }
    el.removeAttribute('style')
  }
}

export async function exportMethodPdf(method: MethodDef, backlog: Backlog) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const date = new Date()
  const dateLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.setProperties({ title: safe(`${backlog.name} - ${method.name}`), author: safe(backlog.author), creator: 'PM Tools' })

  // Header
  let y = 56
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...ACCENT)
  doc.text(safe(`${method.name.toUpperCase()} PRIORITIZATION`), MX, y)
  y += 24
  doc.setFontSize(20).setTextColor(...INK)
  const titleLines = doc.splitTextToSize(safe(backlog.name || 'Untitled backlog'), CONTENT_W)
  doc.text(titleLines, MX, y)
  y += titleLines.length * 22
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...INK2)
  const meta = [backlog.author, dateLabel, `${backlog.items.length} items`].filter(Boolean).join('  ·  ')
  doc.text(safe(meta), MX, y)
  y += 14
  doc.setFontSize(9).text(safe(method.formula), MX, y)
  y += 10
  doc.setDrawColor(225, 224, 217).setLineWidth(0.75).line(MX, y, PAGE_W - MX, y)
  y += 16

  // Chart
  const ranked = method.rank(backlog)
  if (backlog.items.length) {
    y = await drawChart(doc, method, backlog, y, PAGE_H - y - 64)
    y += 12
  }

  // Quadrant/summary counts, when the result column is categorical.
  if (method.id === 'impact-effort' && ranked.length) {
    const counts = new Map<string, number>()
    ranked.forEach((r) => counts.set(r.result, (counts.get(r.result) ?? 0) + 1))
    doc.setFontSize(9).setTextColor(...INK2)
    doc.text(safe([...counts].map(([k, n]) => `${k}: ${n}`).join('   ·   ')), MX, y + 4)
    y += 16
  }

  const section = (title: string, lines: string[]) => {
    const body = lines.flatMap((l) => doc.setFontSize(9.5).splitTextToSize(safe(l), CONTENT_W) as string[])
    const needed = 18 + body.length * 13
    if (y + needed > PAGE_H - 56) {
      doc.addPage()
      y = 56
    }
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...INK).text(safe(title), MX, y)
    y += 16
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...INK2)
    doc.text(body, MX, y, { lineHeightFactor: 1.35 })
    y += body.length * 13 + 14
  }

  if (method.summary) {
    y += 4
    section(method.summary.title, method.summary.lines(backlog))
  }

  // Results table. "#" matches the chart: the item's backlog number where the chart shows those, else its rank.
  const order = new Map(backlog.items.map((it, i) => [it.id, i + 1]))
  const showResult = method.showResultInTable !== false
  const fields = fieldsFor(method, backlog)
  autoTable(doc, {
    startY: y,
    margin: { left: MX, right: MX, bottom: 56 },
    head: [['#', 'Item', ...fields.map((f) => f.label), ...(showResult ? [method.resultLabel] : [])]],
    body: ranked.map((r, i) => [
      String(method.chartUsesItemNumbers ? order.get(r.item.id) : i + 1),
      safe(r.item.description ? `${r.item.title}\n${r.item.description}` : r.item.title),
      ...fields.map((f) => formatValue(fields, f.key, r.values[f.key])),
      ...(showResult ? [safe(r.result)] : []),
    ]),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: INK, lineColor: [225, 224, 217], lineWidth: 0.5 },
    headStyles: { fillColor: [244, 243, 239], textColor: INK, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 24, halign: 'right' }, 1: { cellWidth: 'auto' } },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      // Numbers right-align; text values (categories, quadrants) stay left.
      if (data.column.index > 1 && /^[\d.,%]+$/.test(String(data.cell.raw))) data.cell.styles.halign = 'right'
      if (showResult && data.column.index === fields.length + 2) data.cell.styles.fontStyle = 'bold'
    },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24

  const notes = backlog.notes[method.id]?.trim()
  if (notes) section('Decision notes', notes.split('\n'))
  section(`About ${method.name}`, [method.about.summary, '', ...method.reference.map((r) => `•  ${r}`)])

  // Footer on every page
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(137, 135, 129)
    // Author attribution: required by the AGPL additional terms in NOTICE.
    const credit = 'Made with PM Tools by Patrick Poulin  ·  '
    doc.text(credit, MX, PAGE_H - 28)
    doc.textWithLink(REPO, MX + doc.getTextWidth(credit), PAGE_H - 28, { url: `https://${REPO}` })
    doc.text(`Page ${i} of ${pages}`, PAGE_W - MX, PAGE_H - 28, { align: 'right' })
  }

  doc.save(`${slugify(backlog.name)}-${method.id}-${date.toISOString().slice(0, 10)}.pdf`)
}
