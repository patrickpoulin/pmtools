/**
 * User stories: the "As a / I want / so that" sentence, acceptance criteria and an INVEST check.
 * Stories are written from scratch, separate from the prioritization backlog, and saved in their own list.
 */

/** One acceptance criterion in Given / When / Then form. Any part may be empty. */
export interface AcceptanceCriterion {
  given: string
  when: string
  then: string
}

export type InvestKey = 'independent' | 'negotiable' | 'valuable' | 'estimable' | 'small' | 'testable'

export interface UserStory {
  role: string
  want: string
  benefit: string
  criteria: AcceptanceCriterion[]
  /** Story points, or null when not estimated yet. */
  points: number | null
  /** INVEST qualities the writer has confirmed by hand. */
  invest: Partial<Record<InvestKey, boolean>>
  notes: string
}

/** A saved story with a short name for the list. */
export interface StoryDoc extends UserStory {
  id: string
  title: string
}

export const POINTS = [1, 2, 3, 5, 8, 13, 20]
/** Size limits. The editor enforces the same ones, so loading saved data never cuts anything a user typed. */
export const LIMITS = { title: 200, role: 500, text: 2000, notes: 10000, criteria: 100, stories: 1000 }
/** Above this, most teams split the story before a sprint. */
export const MAX_SPRINT_POINTS = 8
/** More criteria than this usually means more than one story. */
export const MAX_CRITERIA = 7

export const emptyCriterion = (): AcceptanceCriterion => ({ given: '', when: '', then: '' })

export const emptyStory = (): UserStory => ({
  role: '',
  want: '',
  benefit: '',
  criteria: [emptyCriterion()],
  points: null,
  invest: {},
  notes: '',
})

export const INVEST: { key: InvestKey; letter: string; name: string; question: string }[] = [
  { key: 'independent', letter: 'I', name: 'Independent', question: 'Can the team build and ship it without waiting on another story?' },
  { key: 'negotiable', letter: 'N', name: 'Negotiable', question: 'Does it describe the need and leave the design open to discussion?' },
  { key: 'valuable', letter: 'V', name: 'Valuable', question: 'Would the person in the story notice and care when it ships?' },
  { key: 'estimable', letter: 'E', name: 'Estimable', question: 'Does the team know enough to size it?' },
  { key: 'small', letter: 'S', name: 'Small', question: 'Does it fit comfortably in one sprint?' },
  { key: 'testable', letter: 'T', name: 'Testable', question: 'Could someone check, yes or no, that it is done?' },
]

// Prefixes people type out of habit, which the template already supplies.
const PREFIX = {
  role: /^\s*as\s+(?:an?|the)\s+/i,
  want: /^\s*i\s+(?:want|need|would like)\s+/i,
  benefit: /^\s*(?:so\s+that|so|in\s+order\s+to)\s+/i,
}

/** A story part without the template words the user may have typed, or a trailing period. */
export function cleanPart(part: keyof typeof PREFIX, text: string): string {
  return text.replace(PREFIX[part], '').trim().replace(/[.\s]+$/, '')
}

/** "a" or "an" for a role by how it usually sounds: an admin, an editor, but a user, a UX designer. */
export function article(role: string): 'a' | 'an' {
  // Vowel letters that sound like "you" or "won": a user, a UX designer, a unicorn, a European, a one-off.
  if (/^(?:eu|one\b|u(?:[bcfhjkmpqrstvwxyz][aeiou]|ni|x|i\b|s\b))/i.test(role)) return 'a'
  return /^[aeiou]/i.test(role) ? 'an' : 'a'
}

/** The story sentence, e.g. "As an admin, I want to export reports, so that I can audit usage." */
export function storySentence(s: Pick<UserStory, 'role' | 'want' | 'benefit'>): string {
  const role = cleanPart('role', s.role) || '…'
  const want = cleanPart('want', s.want) || '…'
  const benefit = cleanPart('benefit', s.benefit) || '…'
  return `As ${article(role)} ${role}, I want ${want}, so that ${benefit}.`
}

/** "Given …, when …, then …." with empty parts left out. */
export function criterionText(c: AcceptanceCriterion): string {
  const parts = (['given', 'when', 'then'] as const)
    .map((k) => [k, c[k].trim().replace(/[.\s]+$/, '')] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} ${v}`)
  if (!parts.length) return ''
  const text = parts.join(', ')
  return `${text[0].toUpperCase()}${text.slice(1)}.`
}

const filled = (c: AcceptanceCriterion) => Boolean(c.given.trim() || c.when.trim() || c.then.trim())

export const hasStory = (s: UserStory | null | undefined): s is UserStory =>
  Boolean(s && (s.role.trim() || s.want.trim() || s.benefit.trim() || s.criteria.some(filled)))

const GENERIC_ROLES = /^(?:user|users|customer|customers|person|someone|people|stakeholder)$/i
const SOLUTION_WORDS = /\b(?:button|dropdown|drop-down|checkbox|modal|pop-?up|dialog|tab|toggle|screen|icon|menu|database|api|endpoint|click)\b/i
const VAGUE_WORDS = /\b(?:fast|quick(?:ly)?|easy|easily|simple|intuitive|user[- ]friendly|seamless(?:ly)?|nice|better|improved?|appropriate(?:ly)?|properly|etc)\b/i
const SPLIT_WORDS = /\b(?:and|or|as well as|also|plus)\b/i

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? [])
const STOP = new Set('a an the to i my me can be is it of for in on and or so that with able'.split(' '))

/** True when the benefit mostly repeats the want ("I want to export, so that I can export"). */
export function restatesWant(want: string, benefit: string): boolean {
  const b = [...words(benefit)].filter((w) => !STOP.has(w))
  if (!b.length) return false
  const w = words(want)
  return b.filter((x) => w.has(x)).length / b.length >= 0.75
}

export interface Hint {
  invest: InvestKey
  text: string
}

/** Automatic warnings about a story, each tied to the INVEST quality it threatens. */
export function storyHints(s: UserStory): Hint[] {
  const role = cleanPart('role', s.role)
  const want = cleanPart('want', s.want)
  const benefit = cleanPart('benefit', s.benefit)
  const criteria = s.criteria.filter(filled)
  const hints: Hint[] = []
  const add = (invest: InvestKey, text: string) => hints.push({ invest, text })

  if (!role) add('valuable', 'Say who this is for. A specific role or persona tells the team whose problem they are solving.')
  else if (GENERIC_ROLES.test(role))
    add('valuable', `“${role}” is very broad. Which user? For example a new admin, a returning shopper, a finance approver.`)
  if (!want) add('negotiable', 'Describe what they want to do or get.')
  else {
    const ui = want.match(SOLUTION_WORDS)
    if (ui) add('negotiable', `“${ui[0]}” describes a design. Say what the person needs and leave the how to the team.`)
    if (SPLIT_WORDS.test(want)) add('small', '“And” or “or” in the want often means two stories. Could each half ship on its own?')
  }
  if (!benefit) add('valuable', 'Add the “so that”. Without the why, the team can’t judge trade-offs or suggest something better.')
  else if (want && restatesWant(want, benefit))
    add('valuable', 'The “so that” repeats the want. Say what it lets them achieve, or what it saves them.')

  if (!criteria.length) add('testable', 'Add at least one acceptance criterion so everyone agrees what “done” means.')
  else {
    if (!criteria.some((c) => c.then.trim())) add('testable', 'Each criterion needs a “then”: the result you can observe.')
    const vague = criteria.map((c) => `${c.given} ${c.when} ${c.then}`.match(VAGUE_WORDS)).find(Boolean)
    if (vague) add('testable', `“${vague[0]}” can’t be checked. Use a number or an observable result (e.g. “within 2 seconds”).`)
    if (criteria.length > MAX_CRITERIA)
      add('small', `${criteria.length} acceptance criteria is a lot. Consider splitting by rule, path or user.`)
  }
  if (s.points === null) add('estimable', 'No estimate yet. If the team can’t size it, plan a short spike to learn more first.')
  else if (s.points > MAX_SPRINT_POINTS) add('small', `${s.points} points is big for one sprint. Try one of the splitting patterns below.`)
  return hints
}

export type InvestStatus = 'warn' | 'ok' | 'todo'

/** Per INVEST quality: a warning beats a manual tick, and a tick is needed for "ok". */
export function investStatus(s: UserStory): Record<InvestKey, InvestStatus> {
  const hints = storyHints(s)
  return Object.fromEntries(
    INVEST.map(({ key }) => [key, hints.some((h) => h.invest === key) ? 'warn' : s.invest[key] ? 'ok' : 'todo']),
  ) as Record<InvestKey, InvestStatus>
}

/** Number of INVEST qualities that are ticked and have no warning. */
export const readyCount = (s: UserStory) => Object.values(investStatus(s)).filter((v) => v === 'ok').length

/** A story as Markdown, for pasting into Jira, Linear, GitHub or a doc. */
export function storyMarkdown(title: string, s: UserStory): string {
  const lines = [`### ${title}`, '', storySentence(s)]
  const criteria = s.criteria.map(criterionText).filter(Boolean)
  if (criteria.length) lines.push('', '**Acceptance Criteria**', '', ...criteria.map((c) => `- [ ] ${c}`))
  if (s.points !== null) lines.push('', `**Estimate:** ${s.points} ${s.points === 1 ? 'point' : 'points'}`)
  if (s.notes.trim()) lines.push('', '**Notes**', '', s.notes.trim())
  return lines.join('\n')
}

const text = (v: unknown, max = LIMITS.text) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Coerce untrusted JSON (saved data from an older version, a file) into a story, or null if it isn't one. */
export function normalizeStory(raw: unknown): UserStory | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, any>
  const criteria = Array.isArray(r.criteria)
    ? r.criteria.slice(0, LIMITS.criteria).map((c: any) => ({ given: text(c?.given), when: text(c?.when), then: text(c?.then) }))
    : []
  const points = typeof r.points === 'number' && Number.isFinite(r.points) && r.points > 0 ? Math.min(r.points, 100) : null
  const invest: UserStory['invest'] = {}
  for (const { key } of INVEST) if (r.invest?.[key] === true) invest[key] = true
  return {
    role: text(r.role, LIMITS.role),
    want: text(r.want),
    benefit: text(r.benefit),
    criteria: criteria.length ? criteria : [emptyCriterion()],
    points,
    invest,
    notes: text(r.notes, LIMITS.notes),
  }
}

/** A finished example, to show what a good story looks like. */
export const exampleStory = (): Omit<StoryDoc, 'id'> => ({
  title: 'Example: Onboarding checklist',
  role: 'new workspace admin',
  want: 'a short checklist of setup steps after I sign up',
  benefit: 'I can get my team to their first useful report without booking a call with support',
  criteria: [
    { given: 'I have just created a workspace', when: 'I land on the home page', then: 'I see a checklist of 4 setup steps with none completed' },
    { given: 'the checklist is showing', when: 'I connect a data source', then: 'that step is marked done without reloading the page' },
    { given: 'I have completed every step', when: 'I return to the home page', then: 'the checklist is replaced by a link to my first report' },
  ],
  points: 5,
  invest: { independent: true, negotiable: true, valuable: true, estimable: true, small: true, testable: true },
  notes: 'Out of scope: in-app video tours.',
})
