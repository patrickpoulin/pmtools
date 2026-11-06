/**
 * jsPDF's built-in fonts only cover WinAnsi (Windows-1252): Latin-1 plus a few typographic marks.
 * Anything else prints as garbage, so user text is mapped onto that set before it goes in a PDF.
 */
const WIN_ANSI_EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'

const REPLACEMENTS: Record<string, string> = {
  '→': '->',
  '←': '<-',
  '↔': '<->',
  '⇒': '=>',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
  '≈': '~',
  '−': '-',
  '‐': '-',
  '‑': '-',
  '‒': '-',
  '―': '-',
  '′': "'",
  '″': '"',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '✓': 'v',
  '✔': 'v',
  '✕': 'x',
  '✗': 'x',
  '✘': 'x',
  // Letters with no accent-free decomposition.
  'Ł': 'L',
  'ł': 'l',
  'Đ': 'D',
  'đ': 'd',
  'Ħ': 'H',
  'ħ': 'h',
  'ı': 'i',
  // Tabs, non-breaking and thin spaces.
  '\t': ' ',
  '\u00a0': ' ',
  '\u2009': ' ',
  '\u202f': ' ',
}

const printable = (ch: string) => {
  const c = ch.codePointAt(0)!
  return c === 10 || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRAS.includes(ch)
}

/**
 * Text that prints correctly in a jsPDF built-in font: known symbols spelled out, accents kept where
 * WinAnsi has them (é) or stripped where it doesn't (ő -> o), other letters (Cyrillic, CJK) shown as
 * "?" so the text stays visible, and anything else (emoji, symbols) dropped.
 */
export function pdfSafe(s: string): string {
  let out = ''
  for (const ch of s) {
    if (ch in REPLACEMENTS) out += REPLACEMENTS[ch]
    else if (printable(ch)) out += ch
    else {
      const base = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '')
      if (base && [...base].every(printable)) out += base
      else if (/\p{L}|\p{N}/u.test(ch)) out += '?'
    }
  }
  return out
}
