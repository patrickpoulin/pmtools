/**
 * Persona map: one Ideal Customer Profile (the kind of company you sell to) and the people inside it,
 * laid out as a grid with one column per persona and one row per attribute so they compare side by side.
 * Saved in its own list, separate from the backlog and from user stories.
 */

export interface Icp {
  name: string
  industry: string
  size: string
  region: string
  budget: string
  triggers: string
  redFlags: string
}

export type BuyingRole = '' | 'decision' | 'champion' | 'user' | 'influencer' | 'blocker'

export interface Persona {
  id: string
  name: string
  jobTitle: string
  buyingRole: BuyingRole
  /** Fixed palette slot (1 to 8, --series-N), so a persona keeps its color when others move or go. */
  color: number
  goals: string
  pains: string
  jobs: string
  objections: string
  success: string
  channels: string
  /** Empathy map quadrants. */
  says: string
  thinks: string
  does: string
  feels: string
}

export interface PersonaMap {
  icp: Icp
  personas: Persona[]
}

/** Size limits. The editor enforces the same ones, so loading saved data never cuts anything a user typed. */
export const PERSONA_LIMITS = { name: 200, text: 2000, personas: 8 }

export const ICP_FIELDS: { key: keyof Icp; label: string; placeholder: string; hint: string }[] = [
  { key: 'industry', label: 'Industry or type', placeholder: 'B2B SaaS, fintech, logistics…', hint: 'What kind of company gets the most from your product.' },
  { key: 'size', label: 'Company size', placeholder: '50 to 500 employees, $5M to $50M revenue', hint: 'Headcount, revenue or team size, as a range.' },
  { key: 'region', label: 'Region', placeholder: 'North America and UK', hint: 'Where they are, if it changes how you sell or support.' },
  { key: 'budget', label: 'Budget and buying process', placeholder: 'Team budget under $20k a year, no procurement review', hint: 'Who signs, how much they can spend, how long it takes.' },
  { key: 'triggers', label: 'Buying triggers', placeholder: 'Just raised a round, hired a first ops lead', hint: 'The events that make them look for a solution now.' },
  { key: 'redFlags', label: 'Red flags', placeholder: 'Needs on-premise hosting', hint: 'Signs a company is not a fit, so you don’t build for them by accident.' },
]

export const PERSONA_ROWS: { key: 'goals' | 'pains' | 'jobs' | 'objections' | 'success' | 'channels'; label: string; hint: string }[] = [
  { key: 'goals', label: 'Goals', hint: 'What they are trying to achieve in their role.' },
  { key: 'pains', label: 'Pains', hint: 'What gets in the way today, in their words.' },
  { key: 'jobs', label: 'Jobs to Be Done', hint: 'The tasks they hire a product to do.' },
  { key: 'objections', label: 'Objections', hint: 'Why they might say no, or slow the deal down.' },
  { key: 'success', label: 'How They Measure Success', hint: 'The numbers or outcomes they are judged on.' },
  { key: 'channels', label: 'Where to Reach Them', hint: 'Communities, events, tools and people they trust.' },
]

export type EmpathyKey = 'says' | 'thinks' | 'does' | 'feels'

/** The four quadrants of an empathy map, in reading order (top left, top right, bottom left, bottom right). */
export const EMPATHY_QUADRANTS: { key: EmpathyKey; label: string; hint: string; placeholder: string }[] = [
  { key: 'says', label: 'Says', hint: 'Things they say out loud, ideally quotes from interviews.', placeholder: '“I spend every Monday morning fixing numbers.”' },
  { key: 'thinks', label: 'Thinks', hint: 'What they worry about or hope for but might not say.', placeholder: 'Will leadership trust these numbers?' },
  { key: 'does', label: 'Does', hint: 'What they actually do today: habits, workarounds, tools.', placeholder: 'Exports CSVs from 4 tools into one spreadsheet' },
  { key: 'feels', label: 'Feels', hint: 'How they feel about the problem: frustrated, anxious, proud.', placeholder: 'Stressed before every leadership meeting' },
]

export const hasEmpathy = (p: Pick<Persona, EmpathyKey>) => EMPATHY_QUADRANTS.some((q) => p[q.key].trim())

export const BUYING_ROLES: { value: BuyingRole; label: string; hint: string }[] = [
  { value: 'decision', label: 'Decision maker', hint: 'Signs off and owns the budget.' },
  { value: 'champion', label: 'Champion', hint: 'Wants it most and sells it internally.' },
  { value: 'user', label: 'End user', hint: 'Uses it every day.' },
  { value: 'influencer', label: 'Influencer', hint: 'Has a say: IT, security, a peer team.' },
  { value: 'blocker', label: 'Blocker', hint: 'Can stop the deal, often over risk or cost.' },
]

export const buyingRoleLabel = (r: BuyingRole) => BUYING_ROLES.find((b) => b.value === r)?.label ?? ''

export const emptyIcp = (): Icp => ({ name: '', industry: '', size: '', region: '', budget: '', triggers: '', redFlags: '' })

/** The first palette slot no other persona uses (wrapping round once all 8 are taken). */
export function nextColor(personas: Pick<Persona, 'color'>[]): number {
  for (let c = 1; c <= 8; c++) if (!personas.some((p) => p.color === c)) return c
  return (personas.length % 8) + 1
}

export const emptyPersona = (id: string, personas: Pick<Persona, 'color'>[]): Persona => ({
  id,
  name: '',
  jobTitle: '',
  buyingRole: '',
  color: nextColor(personas),
  goals: '',
  pains: '',
  jobs: '',
  objections: '',
  success: '',
  channels: '',
  says: '',
  thinks: '',
  does: '',
  feels: '',
})

export const personaName = (p: Pick<Persona, 'name'>) => p.name.trim() || 'Unnamed persona'

export const hasIcp = (icp: Icp) => Object.values(icp).some((v) => v.trim())

export const hasPersonaMap = (m: PersonaMap) =>
  hasIcp(m.icp) || m.personas.some((p) => [p.name, p.jobTitle, ...PERSONA_ROWS.map((r) => p[r.key]), ...EMPATHY_QUADRANTS.map((q) => p[q.key])].some((v) => v.trim()))

const text = (v: unknown, max = PERSONA_LIMITS.text) => (typeof v === 'string' ? v.slice(0, max) : '')
const ROLE_VALUES = new Set<string>(BUYING_ROLES.map((b) => b.value))

/** Coerce untrusted JSON (saved data from an older version) into a persona map. */
export function normalizePersonaMap(raw: unknown, newId: () => string): PersonaMap {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const icpRaw = r.icp && typeof r.icp === 'object' ? r.icp : {}
  const icp = emptyIcp()
  for (const key of Object.keys(icp) as (keyof Icp)[]) icp[key] = text(icpRaw[key], key === 'name' ? PERSONA_LIMITS.name : PERSONA_LIMITS.text)

  const ids = new Set<string>()
  const personas: Persona[] = []
  for (const p of Array.isArray(r.personas) ? r.personas.slice(0, PERSONA_LIMITS.personas) : []) {
    if (!p || typeof p !== 'object') continue
    let id = typeof p.id === 'string' && p.id ? p.id : newId()
    if (ids.has(id)) id = newId()
    ids.add(id)
    const color = Number.isInteger(p.color) && p.color >= 1 && p.color <= 8 ? p.color : nextColor(personas)
    personas.push({
      id,
      name: text(p.name, PERSONA_LIMITS.name),
      jobTitle: text(p.jobTitle, PERSONA_LIMITS.name),
      buyingRole: ROLE_VALUES.has(p.buyingRole) ? p.buyingRole : '',
      color,
      goals: text(p.goals),
      pains: text(p.pains),
      jobs: text(p.jobs),
      objections: text(p.objections),
      success: text(p.success),
      channels: text(p.channels),
      says: text(p.says),
      thinks: text(p.thinks),
      does: text(p.does),
      feels: text(p.feels),
    })
  }
  return { icp, personas }
}

/** Moves the persona at `from` one place left (-1) or right (+1). */
export function movePersona<T>(list: T[], from: number, by: -1 | 1): T[] {
  const to = from + by
  if (from < 0 || to < 0 || to >= list.length) return list
  const next = [...list]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

/** Keeps line breaks inside a Markdown table cell, and stops a pipe from splitting the cell. */
const cell = (s: string) => s.trim().replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>') || '-'

/** The map as Markdown: the ICP as a list, then the personas as a table with one column each. */
export function personaMapMarkdown(m: PersonaMap): string {
  const lines = ['# Persona Map', '']
  lines.push(`## Ideal Customer Profile${m.icp.name.trim() ? `: ${m.icp.name.trim()}` : ''}`, '')
  const facts = ICP_FIELDS.filter((f) => m.icp[f.key].trim())
  lines.push(...(facts.length ? facts.map((f) => `- **${f.label}:** ${m.icp[f.key].trim().replace(/\r?\n/g, ' ')}`) : ['Not written yet.']))
  lines.push('', '## Personas', '')
  if (!m.personas.length) lines.push('None yet.')
  else {
    const rows: [string, (p: Persona) => string][] = [
      ['Job title', (p) => p.jobTitle],
      ['Buying role', (p) => buyingRoleLabel(p.buyingRole)],
      ...PERSONA_ROWS.map((r) => [r.label, (p: Persona) => p[r.key]] as [string, (p: Persona) => string]),
    ]
    lines.push(`| | ${m.personas.map((p) => cell(personaName(p))).join(' | ')} |`)
    lines.push(`|---|${m.personas.map(() => '---').join('|')}|`)
    for (const [label, get] of rows) lines.push(`| **${label}** | ${m.personas.map((p) => cell(get(p))).join(' | ')} |`)
  }
  const mapped = m.personas.filter(hasEmpathy)
  if (mapped.length) {
    lines.push('', '## Empathy Maps')
    for (const p of mapped) {
      lines.push('', `### ${personaName(p)}`, '')
      for (const q of EMPATHY_QUADRANTS) lines.push(`- **${q.label}:** ${p[q.key].trim().replace(/\r?\n/g, ' ') || '-'}`)
    }
  }
  return lines.join('\n') + '\n'
}

/** A finished example, for the same product as the example user story (a reporting tool). */
export const examplePersonaMap = (): PersonaMap => ({
  icp: {
    name: 'Growing B2B SaaS companies',
    industry: 'B2B software companies that sell by subscription',
    size: '50 to 500 employees, with a small operations or data team',
    region: 'North America and Western Europe',
    budget: 'Team budget under $25k a year. The ops lead decides; finance approves anything over $10k.',
    triggers: 'Just hired a first head of operations, or outgrew spreadsheets after a funding round',
    redFlags: 'Needs on-premise hosting, or already has a full-time data engineering team',
  },
  personas: [
    {
      id: 'example-ops',
      name: 'Olivia, Head of Operations',
      jobTitle: 'Head of Operations',
      buyingRole: 'decision',
      color: 1,
      goals: 'Give leadership one trusted view of the business every Monday',
      pains: 'Numbers differ between teams. Building the weekly report takes a full day.',
      jobs: 'Pull data from several tools into one report, and explain changes week to week',
      objections: 'Worried about another tool her team must maintain',
      success: 'Hours spent on reporting each week; leadership questions answered on the spot',
      channels: 'Ops communities on Slack, LinkedIn, peers at other startups',
      says: '“Why does sales have a different number than finance?”',
      thinks: 'If the board deck is wrong again, it reflects on me.',
      does: 'Rebuilds the same spreadsheet every week and double-checks totals by hand',
      feels: 'Stretched thin, and anxious before every leadership meeting',
    },
    {
      id: 'example-admin',
      name: 'Sam, Workspace Admin',
      jobTitle: 'Operations Analyst',
      buyingRole: 'champion',
      color: 2,
      goals: 'Get the team set up quickly and look good doing it',
      pains: 'Setup guides assume a data engineer. Support calls take days to book.',
      jobs: 'Connect data sources, invite teammates, build the first dashboards',
      objections: 'Fears setup will eat a week of evenings',
      success: 'Time from sign-up to first useful report',
      channels: 'Product docs, YouTube tutorials, in-app help',
      says: '“Is there a guide for people who aren’t engineers?”',
      thinks: 'This is my chance to show I can own a project.',
      does: 'Searches docs and forums at night, asks a friend on another team for help',
      feels: 'Excited about the tool, nervous about breaking something',
    },
    {
      id: 'example-finance',
      name: 'Felix, Finance Approver',
      jobTitle: 'Finance Manager',
      buyingRole: 'blocker',
      color: 3,
      goals: 'Keep software spend predictable',
      pains: 'Tools bought on a card that renew without review',
      jobs: 'Approve purchases, check contracts, forecast costs',
      objections: 'Per-seat pricing that grows with every new hire',
      success: 'Software spend against budget',
      channels: 'Procurement reviews, vendor security questionnaires',
      says: '“What will this cost us when the team doubles?”',
      thinks: 'Another subscription nobody will cancel.',
      does: 'Reviews renewals each quarter and asks for usage numbers before approving',
      feels: 'Skeptical, but open if the pricing is predictable',
    },
  ],
})
