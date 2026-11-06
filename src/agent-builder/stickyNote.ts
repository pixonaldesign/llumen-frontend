/** FigJam-style sticky notes: colour, type, and author line, stored on the node's config. */

export type StickyColorId = 'white' | 'grey' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'violet' | 'pink'
export type StickyFont = 'simple' | 'bookish' | 'technical' | 'scribbled'
export type StickySize = 'small' | 'medium' | 'large' | 'xlarge'

export type StickyStyle = {
  color: StickyColorId
  font: StickyFont
  size: StickySize
  bold: boolean
  strike: boolean
  /** Opens from the note's footer; null for none. */
  link: string | null
  author: string
}

/** Muted pastels: light enough for dark ink, dim enough not to glare on the dark canvas. */
export const STICKY_COLORS: readonly { id: StickyColorId; name: string; fill: string }[] = [
  { id: 'white', name: 'White', fill: '#d8d9de' },
  { id: 'grey', name: 'Grey', fill: '#a4a6af' },
  { id: 'red', name: 'Red', fill: '#e0918a' },
  { id: 'orange', name: 'Orange', fill: '#e3ab7f' },
  { id: 'yellow', name: 'Yellow', fill: '#e2c97c' },
  { id: 'green', name: 'Green', fill: '#96c69c' },
  { id: 'teal', name: 'Teal', fill: '#88c8c0' },
  { id: 'blue', name: 'Blue', fill: '#92b3e0' },
  { id: 'violet', name: 'Violet', fill: '#b2a3e2' },
  { id: 'pink', name: 'Pink', fill: '#dc9fc1' },
]

export const STICKY_FONTS: readonly { id: StickyFont; label: string; family: string }[] = [
  { id: 'simple', label: 'Simple', family: 'inherit' },
  { id: 'bookish', label: 'Bookish', family: "Georgia, 'Times New Roman', serif" },
  { id: 'technical', label: 'Technical', family: "ui-monospace, 'SF Mono', Menlo, monospace" },
  { id: 'scribbled', label: 'Scribbled', family: "'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive" },
]

export const STICKY_SIZES: readonly { id: StickySize; label: string; px: number }[] = [
  { id: 'small', label: 'Small', px: 16 },
  { id: 'medium', label: 'Medium', px: 22 },
  { id: 'large', label: 'Large', px: 30 },
  { id: 'xlarge', label: 'Extra large', px: 44 },
]

/** Signed-in user; shown on the notes they write. */
export const STICKY_AUTHOR = 'Mahmoud Khairy'
/** A new note is square, like FigJam's. */
export const STICKY_SIZE = 240
export const STICKY_MIN_SIZE = 120

export const DEFAULT_STICKY: StickyStyle = {
  color: 'yellow',
  font: 'simple',
  size: 'small',
  bold: false,
  strike: false,
  link: null,
  author: STICKY_AUTHOR,
}

export const stickyStyle = (saved: Partial<StickyStyle> | undefined): StickyStyle => ({ ...DEFAULT_STICKY, ...saved })

export const stickyFill = (color: StickyColorId) => (STICKY_COLORS.find((option) => option.id === color) ?? STICKY_COLORS[4]).fill
export const stickyFamily = (font: StickyFont) => (STICKY_FONTS.find((option) => option.id === font) ?? STICKY_FONTS[0]).family
export const stickyPx = (size: StickySize) => (STICKY_SIZES.find((option) => option.id === size) ?? STICKY_SIZES[0]).px

/** Lists are plain text with a bullet on each line, so editing stays what-you-see. */
export const BULLET = '• '

export function isList(text: string) {
  const lines = text.split('\n').filter((line) => line.trim())
  return lines.length > 0 && lines.every((line) => line.startsWith(BULLET.trim()))
}

export function toggleList(text: string) {
  if (!text) return BULLET
  if (isList(text)) return text.split('\n').map((line) => line.replace(/^•\s?/, '')).join('\n')
  return text
    .split('\n')
    .map((line) => (line.trim() ? BULLET + line : line))
    .join('\n')
}

/** `https://` is assumed when the link has no scheme. */
export function normaliseLink(value: string) {
  const link = value.trim()
  if (!link) return null
  return /^[a-z][a-z0-9+.-]*:/i.test(link) ? link : `https://${link}`
}

export function linkLabel(link: string) {
  try {
    const url = new URL(link)
    return url.host + (url.pathname === '/' ? '' : url.pathname)
  } catch {
    return link
  }
}
