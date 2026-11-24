import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PRINT_PALETTE } from '../methods/registry'
import { ACCENT, CONTENT_W, INK, INK2, MX, PAGE_H, PAGE_W, RULE, drawFooter, lastTableY, pdfText } from './common'
import { EMPATHY_QUADRANTS, ICP_FIELDS, hasEmpathy, PERSONA_ROWS, buyingRoleLabel, personaName, type Persona, type PersonaMap } from '../personas/persona'

const TOP = 56
const BOTTOM = PAGE_H - 56
/** Persona columns per table, so each column stays wide enough to read on a portrait page. */
const PER_TABLE = 3

const hexRgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]

export function exportPersonasPdf(map: PersonaMap) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const date = new Date()
  const dateLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.setProperties({ title: 'Persona Map', creator: 'PM Tools' })
  const margin = { left: MX, right: MX, top: TOP, bottom: PAGE_H - BOTTOM }

  let y = TOP
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...ACCENT)
  doc.text('PLANNING', MX, y)
  y += 12
  doc.setFontSize(20).setTextColor(...INK).text('Persona Map', MX, y + 16)
  y += 26
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...INK2).text(dateLabel, MX, y + 8)
  y += 18
  doc.setDrawColor(...RULE).setLineWidth(0.75).line(MX, y, PAGE_W - MX, y)
  y += 22

  const heading = (text: string) => {
    if (y + 60 > BOTTOM) {
      doc.addPage()
      y = TOP
    }
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...INK)
    const lines = doc.splitTextToSize(pdfText(text), CONTENT_W) as string[]
    doc.text(lines, MX, y + 10)
    y += lines.length * 15 + 6
  }

  heading(`Ideal Customer Profile${map.icp.name.trim() ? `: ${map.icp.name.trim()}` : ''}`)
  autoTable(doc, {
    startY: y,
    margin,
    body: ICP_FIELDS.map((f) => [f.label, pdfText(map.icp[f.key].trim() || '-')]),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 4, bottom: 4, left: 0, right: 8 }, textColor: INK, valign: 'top' },
    columnStyles: { 0: { cellWidth: 140, fontStyle: 'bold', textColor: INK2 } },
  })
  y = lastTableY(doc) + 16

  heading('Personas')
  if (!map.personas.length) {
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...INK2).text('None yet.', MX, y + 8)
  }
  const rows: [string, (p: Persona) => string][] = [
    ['Job title', (p) => p.jobTitle],
    ['Buying role', (p) => buyingRoleLabel(p.buyingRole)],
    ...PERSONA_ROWS.map((r) => [r.label, (p: Persona) => p[r.key]] as [string, (p: Persona) => string]),
  ]
  for (let i = 0; i < map.personas.length; i += PER_TABLE) {
    const group = map.personas.slice(i, i + PER_TABLE)
    autoTable(doc, {
      startY: y,
      margin,
      head: [['', ...group.map((p) => pdfText(personaName(p)))]],
      body: rows.map(([label, get]) => [label, ...group.map((p) => pdfText(get(p).trim() || '-'))]),
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: INK, lineColor: RULE, lineWidth: 0.5, valign: 'top' },
      headStyles: { fillColor: [244, 243, 239], textColor: INK, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 96, fontStyle: 'bold', textColor: INK2 } },
      // Each persona's column keeps its color from the screen, as a bar above its name.
      didDrawCell: (data) => {
        if (data.section !== 'head' || data.column.index === 0) return
        const p = group[data.column.index - 1]
        doc.setFillColor(...hexRgb(PRINT_PALETTE.categorical[(p.color - 1) % 8]))
        doc.rect(data.cell.x, data.cell.y, data.cell.width, 3, 'F')
      },
    })
    y = lastTableY(doc) + 16
  }

  const mapped = map.personas.filter(hasEmpathy)
  if (mapped.length) {
    doc.addPage()
    y = TOP
    heading('Empathy Maps')
    for (const p of mapped) {
      const [says, thinks, does, feels] = EMPATHY_QUADRANTS.map((q) => pdfText(`${q.label.toUpperCase()}\n${p[q.key].trim() || '-'}`))
      autoTable(doc, {
        startY: y,
        margin,
        // A two by two grid like on screen: says and thinks on top, does and feels below.
        head: [[{ content: pdfText(personaName(p)), colSpan: 2 }]],
        body: [[says, thinks], [does, feels]],
        rowPageBreak: 'avoid',
        alternateRowStyles: { fillColor: [255, 255, 255] },
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 7, textColor: INK, lineColor: RULE, lineWidth: 0.5, valign: 'top', minCellHeight: 56 },
        headStyles: { fillColor: [244, 243, 239], textColor: INK, fontStyle: 'bold', minCellHeight: 0 },
        columnStyles: { 0: { cellWidth: CONTENT_W / 2 }, 1: { cellWidth: CONTENT_W / 2 } },
        didDrawCell: (data) => {
          if (data.section !== 'head') return
          doc.setFillColor(...hexRgb(PRINT_PALETTE.categorical[(p.color - 1) % 8]))
          doc.rect(data.cell.x, data.cell.y, data.cell.width, 3, 'F')
        },
      })
      y = lastTableY(doc) + 16
    }
  }

  drawFooter(doc)
  doc.save(`persona-map-${date.toISOString().slice(0, 10)}.pdf`)
}
