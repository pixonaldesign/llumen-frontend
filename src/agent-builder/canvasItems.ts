import type { Point, Size } from './nodeCatalog'

/** Placement tools in the content toolbar; `select` is the default pointer. */
export type CanvasTool = 'select' | 'sticky' | 'text' | 'comment' | 'section'

export type Rect = Point & Size

/** FigJam-style section: a named, coloured frame that carries whatever sits inside it. */
export type CanvasSection = Rect & {
  id: string
  name: string
  fill: string
  /** 0–1, applied to `fill`. */
  fillOpacity: number
  /** Border colour, or null for no border. */
  stroke: string | null
  locked?: boolean
}

export type CanvasText = Point & { id: string; text: string; size: number }

export type CanvasComment = Point & {
  id: string
  text: string
  author: string
  createdAt: number
  /** Pinned to this node: `x`/`y` are then an offset from its top-left, so the comment moves with it. */
  nodeId?: string
}

/** Where a comment sits on the canvas. */
export function commentPoint(comment: CanvasComment, positions: Readonly<Record<string, Point>>): Point {
  const at = comment.nodeId ? positions[comment.nodeId] : undefined
  return at ? { x: at.x + comment.x, y: at.y + comment.y } : { x: comment.x, y: comment.y }
}

/** Puts a comment at `point`, pinned to `nodeId` when given. */
export function placeComment(comment: CanvasComment, point: Point, nodeId: string | undefined, positions: Readonly<Record<string, Point>>): CanvasComment {
  const at = nodeId ? positions[nodeId] : undefined
  if (!at) {
    const { id, text, author, createdAt } = comment
    return { id, text, author, createdAt, x: Math.round(point.x), y: Math.round(point.y) }
  }
  return { ...comment, nodeId, x: Math.round(point.x - at.x), y: Math.round(point.y - at.y) }
}

export const SECTION_SWATCHES: readonly { name: string; color: string }[] = [
  { name: 'Grey', color: '#8b8f9c' },
  { name: 'Blue', color: '#4f7cff' },
  { name: 'Teal', color: '#22c3b0' },
  { name: 'Green', color: '#3fb950' },
  { name: 'Yellow', color: '#f5c542' },
  { name: 'Orange', color: '#f08c3a' },
  { name: 'Red', color: '#f05252' },
  { name: 'Purple', color: '#a855f7' },
  { name: 'White', color: '#ffffff' },
]

export const SECTION_DEFAULTS = { fill: '#8b8f9c', fillOpacity: 0.08, stroke: '#5b5e6a' }
/** Smaller drags than this count as a click and drop a default-sized section. */
export const SECTION_MIN_SIZE = 80
export const SECTION_DEFAULT_SIZE: Size = { w: 640, h: 400 }
/** Room left around the contents by Fit to contents. */
export const SECTION_FIT_PADDING = 48

export const TEXT_SIZES: readonly { label: string; size: number }[] = [
  { label: 'Small', size: 16 },
  { label: 'Medium', size: 24 },
  { label: 'Large', size: 40 },
  { label: 'Huge', size: 64 },
]
export const TEXT_DEFAULT_SIZE = 24

export const COMMENT_AUTHOR = 'You'

/** Rect from two corners, in any drag direction. */
export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
}

export const rectContains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h

export const rectContainsPoint = (rect: Rect, point: Point) =>
  point.x >= rect.x && point.y >= rect.y && point.x <= rect.x + rect.w && point.y <= rect.y + rect.h

/** Smallest rect around all of `rects`, or null when there are none. */
export function boundsOf(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null
  const minX = Math.min(...rects.map((rect) => rect.x))
  const minY = Math.min(...rects.map((rect) => rect.y))
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w))
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.h))
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Next free "Section N" name. */
export function nextSectionName(sections: readonly CanvasSection[]) {
  let number = sections.length + 1
  while (sections.some((section) => section.name === `Section ${number}`)) number += 1
  return `Section ${number}`
}

export function formatCommentTime(createdAt: number) {
  return new Date(createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
