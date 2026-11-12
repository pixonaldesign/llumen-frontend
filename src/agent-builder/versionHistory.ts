import { COMMENT_AUTHOR } from './canvasItems'

/** A saved copy of the canvas; `name` is set once someone names it, which moves it out of the autosaves. */
export type CanvasVersion<Doc> = {
  id: string
  doc: Doc
  savedAt: number
  /** Everyone who had the canvas open while this version was made. */
  authors: readonly string[]
  name?: string
}

export type VersionSummary = Omit<CanvasVersion<unknown>, 'doc'>

/** Edits settle into an autosave after this pause... */
export const AUTOSAVE_IDLE_MS = 3000
/** ...when the last autosave is at least this old. */
export const AUTOSAVE_GAP_MS = 5 * 60_000
export const UNTITLED_VERSION = 'Untitled version'

let lastId = 0
export const newVersionId = () => `version-${Date.now()}-${(lastId += 1)}`

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** How far back each demo version sits, who had it open, and how much of today's canvas it already had. */
const SEEDS: readonly { ago: number; authors: readonly string[]; share: number; name?: string }[] = [
  { ago: 18 * MINUTE, authors: [COMMENT_AUTHOR, 'Layla Haddad'], share: 0.9 },
  { ago: HOUR + 5 * MINUTE, authors: [COMMENT_AUTHOR], share: 0.8 },
  { ago: 3 * HOUR + 20 * MINUTE, authors: [COMMENT_AUTHOR, 'Omar Saeed'], share: 0.7 },
  { ago: DAY + 2 * HOUR, authors: ['Sara Al Mansoori'], share: 0.55 },
  { ago: 3 * DAY, authors: [COMMENT_AUTHOR, 'Layla Haddad'], share: 0.4, name: 'First draft' },
  { ago: 9 * DAY, authors: [COMMENT_AUTHOR], share: 0.25 },
  { ago: 23 * DAY, authors: [COMMENT_AUTHOR], share: 0.12 },
]

/** Demo history for a canvas: `docAt(share)` is the canvas when it had that share of its nodes. */
export function seedVersions<Doc>(now: number, docAt: (share: number) => Doc): CanvasVersion<Doc>[] {
  return SEEDS.map((seed) => ({ id: newVersionId(), doc: docAt(seed.share), savedAt: now - seed.ago, authors: seed.authors, name: seed.name }))
}

/** "1:39 PM" today, "Oct 22, 3:57 PM" before, with the year once it isn't this one. */
export function versionTime(savedAt: number, now: number) {
  const date = new Date(savedAt)
  const today = new Date(now)
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (date.toDateString() === today.toDateString()) return time
  const day = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
  return `${day}, ${time}`
}
