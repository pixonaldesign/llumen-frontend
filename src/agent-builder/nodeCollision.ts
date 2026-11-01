import type { Point, Size } from './nodeCatalog'

/** The least room kept between two nodes; under the layouts' 48px row gap so a tidy canvas never trips it. */
export const NODE_GAP = 32

type Box = Point & Size
export type NodeBoxes = Readonly<Record<string, Box>>

/** Closer than `gap` on both axes; exactly `gap` apart is fine. */
const crowds = (a: Box, b: Box, gap: number) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap

/** The shortest move that takes `b` clear of `a`, away from `a`'s centre along the axis that needs less. */
function pushOut(a: Box, b: Box, gap: number): Point {
  const right = a.x + a.w + gap - b.x
  const left = b.x + b.w + gap - a.x
  const down = a.y + a.h + gap - b.y
  const up = b.y + b.h + gap - a.y
  const dx = right < left ? right : -left
  const dy = down < up ? down : -up
  return Math.abs(dx) <= Math.abs(dy) ? { x: dx, y: 0 } : { x: 0, y: dy }
}

/**
 * Clears room around the `fixed` nodes: anything crowding them is pushed out, and anything a pushed node
 * now crowds is pushed in turn. A node only gives way to one nearer the start of the chain, so a push never
 * comes back to move the node that caused it. Returns the new positions of the nodes that moved.
 */
export function pushApart(boxes: NodeBoxes, fixed: ReadonlySet<string>, gap = NODE_GAP): Record<string, Point> {
  const at: Record<string, Box> = Object.fromEntries(Object.entries(boxes).map(([id, box]) => [id, { ...box }]))
  const ids = Object.keys(at)
  const depth = new Map<string, number>()
  for (const id of fixed) if (at[id]) depth.set(id, 0)
  const queue = [...depth.keys()]
  // Nodes boxed in on every side could trade pushes forever; this caps it well past any real chain.
  let budget = ids.length * ids.length * 4
  while (queue.length > 0 && budget > 0) {
    const id = queue.shift() as string
    const level = depth.get(id) as number
    const box = at[id]
    for (const other of ids) {
      budget -= 1
      if (other === id || fixed.has(other) || (depth.get(other) ?? Infinity) < level) continue
      const target = at[other]
      if (!crowds(box, target, gap)) continue
      const push = pushOut(box, target, gap)
      target.x += push.x
      target.y += push.y
      depth.set(other, level + 1)
      queue.push(other)
    }
  }
  const moved: Record<string, Point> = {}
  for (const id of ids) {
    const before = boxes[id]
    const after = at[id]
    if (after.x !== before.x || after.y !== before.y) moved[id] = { x: after.x, y: after.y }
  }
  return moved
}

/**
 * The spot nearest `box` where it crowds none of `others`: it stays put if it can, else it lines up beside,
 * above or below them, or in a corner between two.
 */
export function freeSpot(box: Box, others: readonly Box[], gap = NODE_GAP): Point {
  if (!others.some((other) => crowds(box, other, gap))) return { x: box.x, y: box.y }
  const xs = [box.x, ...others.flatMap((other) => [other.x - box.w - gap, other.x + other.w + gap])]
  const ys = [box.y, ...others.flatMap((other) => [other.y - box.h - gap, other.y + other.h + gap])]
  let best: Point = { x: box.x, y: box.y }
  let bestDistance = Infinity
  for (const x of xs) {
    for (const y of ys) {
      const distance = Math.hypot(x - box.x, y - box.y)
      if (distance >= bestDistance) continue
      const candidate = { ...box, x, y }
      if (others.some((other) => crowds(candidate, other, gap))) continue
      best = { x, y }
      bestDistance = distance
    }
  }
  return best
}
