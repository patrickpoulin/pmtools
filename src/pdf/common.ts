import type { jsPDF } from 'jspdf'

/** Shared page setup for every PDF: US Letter in points, with the same margins and palette. */
export const PAGE_W = 612
export const PAGE_H = 792
export const MX = 48
export const CONTENT_W = PAGE_W - MX * 2
export const INK: [number, number, number] = [11, 11, 11]
export const INK2: [number, number, number] = [82, 81, 78]
export const ACCENT: [number, number, number] = [42, 120, 214]
export const RULE: [number, number, number] = [225, 224, 217]

const REPO = 'github.com/patrickpoulin/pmtools'

/** Author credit and page numbers on every page. Required by the AGPL additional terms in NOTICE: keep it. */
export function drawFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(137, 135, 129)
    const credit = 'Made with PM Tools by Patrick Poulin  ·  '
    doc.text(credit, MX, PAGE_H - 28)
    doc.textWithLink(REPO, MX + doc.getTextWidth(credit), PAGE_H - 28, { url: `https://${REPO}` })
    doc.text(`Page ${i} of ${pages}`, PAGE_W - MX, PAGE_H - 28, { align: 'right' })
  }
}

/** Where the last jspdf-autotable table ended. */
export const lastTableY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

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
