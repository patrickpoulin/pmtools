import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { slugify } from '../core/io'
import { ACCENT, CONTENT_W, INK, INK2, MX, PAGE_H, PAGE_W, RULE, drawFooter, lastTableY, pdfText } from './common'
import {
  INVEST, cleanPart, criterionText, investStatus, storyHints, storySentence, type StoryDoc,
} from '../stories/story'

const TOP = 56
const BOTTOM = PAGE_H - 56
const ACCENT_SOFT: [number, number, number] = [230, 240, 252]
const DANGER: [number, number, number] = [180, 47, 47]

export { pdfText }

const STATUS_TEXT = { ok: 'Confirmed', warn: 'Needs attention', todo: 'Not confirmed' } as const

/** One story gets its own title; `collection` prints any number of stories under "User Stories". */
export function exportStoriesPdf(stories: StoryDoc[], collection = false) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const date = new Date()
  const dateLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const single = !collection && stories.length === 1
  const docTitle = single ? stories[0].title.trim() || 'Untitled story' : 'User Stories'
  doc.setProperties({ title: pdfText(docTitle), creator: 'PM Tools' })

  let y = TOP
  const room = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage()
      y = TOP
    }
  }
  /** Wrapped paragraph at the current position. */
  const para = (text: string, size: number, color: [number, number, number], bold = false, indent = 0) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(...color)
    const lines = doc.splitTextToSize(pdfText(text), CONTENT_W - indent) as string[]
    const lh = size * 1.35
    // Line by line, so a paragraph longer than a page continues on the next one.
    for (const line of lines) {
      room(lh)
      doc.text(line, MX + indent, y + size * 0.8)
      y += lh
    }
  }
  const heading = (text: string) => {
    room(40)
    y += 10
    para(text, 11, INK, true)
    y += 4
  }

  // Cover header
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...ACCENT)
  doc.text(single ? 'USER STORY' : 'USER STORIES', MX, y)
  y += 12
  para(docTitle, 20, INK, true)
  y += 2
  para([dateLabel, single ? '' : `${stories.length} stories`].filter(Boolean).join('  ·  '), 10, INK2)
  y += 6
  doc.setDrawColor(...RULE).setLineWidth(0.75).line(MX, y, PAGE_W - MX, y)
  y += 18

  stories.forEach((story, n) => {
    if (n > 0) {
      doc.addPage()
      y = TOP
    }
    if (!single) {
      para(story.title.trim() || 'Untitled story', 15, INK, true)
      y += 8
    }

    // The story sentence, in a tinted box with an accent bar like on screen.
    doc.setFont('helvetica', 'normal').setFontSize(12)
    const sentence = doc.splitTextToSize(pdfText(storySentence(story)), CONTENT_W - 28) as string[]
    const boxH = sentence.length * 16 + 20
    room(boxH)
    doc.setFillColor(...ACCENT_SOFT).rect(MX, y, CONTENT_W, boxH, 'F')
    doc.setFillColor(...ACCENT).rect(MX, y, 3, boxH, 'F')
    doc.setTextColor(...INK).text(sentence, MX + 16, y + 10 + 12 * 0.8, { lineHeightFactor: 16 / 12 })
    y += boxH + 8

    const facts = [
      ['Who', cleanPart('role', story.role)],
      ['Wants', cleanPart('want', story.want)],
      ['So that', cleanPart('benefit', story.benefit)],
      ['Estimate', story.points === null ? 'Not estimated' : `${story.points} ${story.points === 1 ? 'point' : 'points'}`],
    ]
    autoTable(doc, {
      startY: y,
      margin: { left: MX, right: MX, top: TOP, bottom: PAGE_H - BOTTOM },
      body: facts.map(([k, v]) => [k, pdfText(v || '-')]),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 3, bottom: 3, left: 0, right: 8 }, textColor: INK },
      columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold', textColor: INK2 } },
    })
    y = lastTableY(doc) + 6

    const criteria = story.criteria.filter((c) => criterionText(c))
    heading('Acceptance Criteria')
    if (criteria.length) {
      autoTable(doc, {
        startY: y,
        margin: { left: MX, right: MX, top: TOP, bottom: PAGE_H - BOTTOM },
        head: [['#', 'Given', 'When', 'Then']],
        body: criteria.map((c, i) => [String(i + 1), pdfText(c.given), pdfText(c.when), pdfText(c.then)]),
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, textColor: INK, lineColor: RULE, lineWidth: 0.5, valign: 'top' },
        headStyles: { fillColor: [244, 243, 239], textColor: INK, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 22, halign: 'right' } },
      })
      y = lastTableY(doc) + 4
    } else {
      para('None written yet.', 9.5, INK2)
    }

    heading('INVEST Check')
    const status = investStatus(story)
    const hints = storyHints(story)
    autoTable(doc, {
      startY: y,
      margin: { left: MX, right: MX, top: TOP, bottom: PAGE_H - BOTTOM },
      body: INVEST.map(({ key, name, question }) => {
        const notes = hints.filter((h) => h.invest === key).map((h) => h.text)
        return [name, pdfText([question, ...notes].join('\n')), STATUS_TEXT[status[key]]]
      }),
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, textColor: INK, lineColor: RULE, lineWidth: 0.5, valign: 'top' },
      columnStyles: { 0: { cellWidth: 80, fontStyle: 'bold' }, 2: { cellWidth: 92 } },
      didParseCell: (data) => {
        if (data.column.index !== 2) return
        const v = data.cell.raw
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = v === STATUS_TEXT.warn ? DANGER : v === STATUS_TEXT.ok ? ACCENT : INK2
      },
    })
    y = lastTableY(doc) + 4

    if (story.notes.trim()) {
      heading('Notes')
      para(story.notes.trim(), 9.5, INK2)
    }
  })

  drawFooter(doc)

  // slugify() falls back to "backlog" for titles with no Latin letters or digits.
  const slug = slugify(docTitle)
  doc.save(`${slug === 'backlog' ? 'user-story' : slug}-${date.toISOString().slice(0, 10)}.pdf`)
}
