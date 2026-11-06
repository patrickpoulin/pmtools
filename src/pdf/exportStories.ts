import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { slugify } from '../core/io'
import {
  INVEST, cleanPart, criterionText, investStatus, storyHints, storySentence, type StoryDoc,
} from '../stories/story'

const REPO = 'github.com/patrickpoulin/pmtools'
const PAGE_W = 612
const PAGE_H = 792
const MX = 48
const TOP = 56
const BOTTOM = PAGE_H - 56
const CONTENT_W = PAGE_W - MX * 2
const INK: [number, number, number] = [11, 11, 11]
const INK2: [number, number, number] = [82, 81, 78]
const ACCENT: [number, number, number] = [42, 120, 214]
const ACCENT_SOFT: [number, number, number] = [230, 240, 252]
const DANGER: [number, number, number] = [180, 47, 47]
const RULE: [number, number, number] = [225, 224, 217]

const SYMBOLS: Record<string, string> = {
  '→': '->', '←': '<-', '⇒': '=>', '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~', '−': '-', '‐': '-', '‑': '-',
  '✓': 'v', '✔': 'v', '✕': 'x', '✗': 'x', 'Ł': 'L', 'ł': 'l', 'Đ': 'D', 'đ': 'd', 'ı': 'i', '\t': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
}
const WIN_ANSI_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
const printable = (ch: string) => {
  const c = ch.codePointAt(0)!
  return c === 10 || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRAS.includes(ch)
}

/**
 * Story text is free-form user input, and jsPDF's built-in fonts only cover WinAnsi. Spell out common
 * symbols, strip accents WinAnsi lacks, show other letters as "?" and drop emoji, so nothing prints as garbage.
 */
export function pdfText(s: string): string {
  let out = ''
  for (const ch of s) {
    if (ch in SYMBOLS) out += SYMBOLS[ch]
    else if (printable(ch)) out += ch
    else {
      const base = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '')
      if (base && [...base].every(printable)) out += base
      else if (/\p{L}|\p{N}/u.test(ch)) out += '?'
    }
  }
  return out
}

const STATUS_TEXT = { ok: 'Confirmed', warn: 'Needs attention', todo: 'Not confirmed' } as const

/** One story gets its own title; `collection` prints any number of stories under "User stories". */
export function exportStoriesPdf(stories: StoryDoc[], collection = false) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const date = new Date()
  const dateLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const single = !collection && stories.length === 1
  const docTitle = single ? stories[0].title.trim() || 'Untitled story' : 'User stories'
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
    room(lines.length * lh)
    doc.text(lines, MX + indent, y + size * 0.8, { lineHeightFactor: 1.35 })
    y += lines.length * lh
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
    y = lastY(doc) + 6

    const criteria = story.criteria.filter((c) => criterionText(c))
    heading('Acceptance criteria')
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
      y = lastY(doc) + 4
    } else {
      para('None written yet.', 9.5, INK2)
    }

    heading('INVEST check')
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
    y = lastY(doc) + 4

    if (story.notes.trim()) {
      heading('Notes')
      para(story.notes.trim(), 9.5, INK2)
    }
  })

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

  doc.save(`${slugify(docTitle)}-${date.toISOString().slice(0, 10)}.pdf`)
}

const lastY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
