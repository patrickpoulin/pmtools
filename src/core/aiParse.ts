/**
 * "Parse with AI": a prompt the user copies into any AI chat, and a parser for the JSON it sends back.
 * Nothing here calls an AI. The user chooses what to share and with which tool.
 */
import { ITEM_LIMITS } from './io'
import { STORY_TAG } from '../stories/story'

export { STORY_TAG }

export const AI_PROMPT = `You are helping a product manager turn requirements into a backlog for prioritization.

Read the requirements at the end of this message and return one JSON array, and nothing else, in a single \`\`\`json code block. Each element is an object with these fields:

- "title": a short name for the requirement, under 80 characters
- "description": 1 to 3 sentences on what is needed and why, using the original wording where you can
- "isStory": true if it describes what a user needs to do or achieve (it could be written as "As a ..., I want ..., so that ..."), false for technical, compliance or internal work
- "source": the original line or lines it came from, copied word for word

Rules:
- One item per requirement. Split a requirement that asks for several separate things.
- Merge requirements that say the same thing, and keep all of their source lines.
- Only include what the text asks for. Do not invent requirements, details or acceptance criteria.
- Do not add scores, priorities, estimates or effort.
- Keep the author's wording and terms. Do not translate.
- Skip headings, greetings, signatures and other text that is not a requirement.

Example:
\`\`\`json
[
  {
    "title": "Export invoices to CSV",
    "description": "Finance needs to export the invoice list to CSV so they can reconcile it in their spreadsheet.",
    "isStory": true,
    "source": "Finance should be able to export invoices as CSV for month-end reconciliation."
  }
]
\`\`\`

Requirements:
`

export interface ParsedItem {
  title: string
  description: string
  isStory: boolean
  source: string
}

const text = (v: unknown): string => {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join('\n')
  return ''
}

const yes = (v: unknown) => v === true || (typeof v === 'string' && /^\s*(true|yes)\s*$/i.test(v))

/** The JSON in an AI reply: the first ```json block if there is one, else from the first [ or { to the last ] or }. */
function extractJson(reply: string): unknown {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1] : reply
  const start = body.search(/[[{]/)
  const end = Math.max(body.lastIndexOf(']'), body.lastIndexOf('}'))
  if (start < 0 || end < start) throw new Error('No JSON found. Paste the reply that starts with [ and ends with ].')
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch {
    throw new Error('The JSON is incomplete or has a typo. Ask the AI to send the whole array again as valid JSON.')
  }
}

/** Turn a pasted AI reply into items to review. Accepts a bare array or an object with an "items" array. */
export function parseAiReply(reply: string): ParsedItem[] {
  if (!reply.trim()) throw new Error('Paste the AI reply first.')
  const json = extractJson(reply)
  const list = Array.isArray(json) ? json : (json as { items?: unknown })?.items
  if (!Array.isArray(list)) throw new Error('Expected a list of items, like [ { "title": … } ].')
  const items = list
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({
      title: text(r.title).slice(0, ITEM_LIMITS.title),
      description: text(r.description).slice(0, ITEM_LIMITS.description),
      isStory: yes(r.isStory),
      source: text(r.source),
    }))
    .filter((it) => it.title)
  if (!items.length) throw new Error('None of the items has a title.')
  return items.slice(0, ITEM_LIMITS.items)
}

const key = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ')

/** Whether an item with the same title, ignoring case and spacing, is already in the backlog. */
export function isDuplicate(title: string, existing: { title: string }[]): boolean {
  const k = key(title)
  return existing.some((e) => key(e.title) === k)
}
