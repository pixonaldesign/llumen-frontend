import type { CSSProperties } from 'react'

export type NodeFill = 'default' | 'solid' | 'gradient' | 'mesh'
export type NodeInk = 'light' | 'dark'

/** Per-node look. Solid uses colors[0], gradient colors[0..2], mesh colors[0..3] (0 is the base). */
export type NodeAppearance = {
  /** Set while the paint still matches a preset; cleared by any manual tweak. */
  preset?: string
  fill: NodeFill
  colors: readonly string[]
  /** Gradient direction in degrees. */
  angle: number
  /** Picks the mesh blob layout; Shuffle changes it. */
  seed: number
  /** Mesh blur, 0–1. */
  softness: number
  /** Film grain strength, 0–1. */
  grain: number
  ink: NodeInk
  /** Leave unset to use the node style's own spacing and corners. */
  padding?: number
  radius?: number
}

export type NodeFillPaint = Pick<NodeAppearance, 'fill' | 'colors' | 'angle' | 'seed' | 'softness' | 'grain' | 'ink'>

export const FILL_COLOR_COUNT: Record<NodeFill, number> = { default: 0, solid: 1, gradient: 3, mesh: 4 }

export const DEFAULT_APPEARANCE: NodeAppearance = {
  fill: 'default',
  colors: ['#1f2937', '#2563eb', '#22d3ee', '#a855f7'],
  angle: 135,
  seed: 7,
  softness: 0.6,
  grain: 0,
  ink: 'light',
}

export type AppearancePreset = { id: string; name: string; paint: NodeFillPaint }

export const APPEARANCE_PRESETS: readonly AppearancePreset[] = [
  { id: 'default', name: 'Default', paint: DEFAULT_APPEARANCE },
  {
    id: 'meadow',
    name: 'Meadow',
    paint: { fill: 'mesh', colors: ['#2c9b45', '#a6dc7e', '#0b5f55', '#47bd4f'], angle: 135, seed: 11, softness: 0.7, grain: 0.35, ink: 'light' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    paint: { fill: 'mesh', colors: ['#04060d', '#1f43d6', '#e6ecfb', '#0b1440'], angle: 135, seed: 3, softness: 0.65, grain: 0.45, ink: 'light' },
  },
  {
    id: 'dusk',
    name: 'Dusk',
    paint: { fill: 'mesh', colors: ['#05080b', '#7fb2c6', '#efd3a0', '#e0760f'], angle: 135, seed: 21, softness: 0.75, grain: 0.3, ink: 'light' },
  },
  {
    id: 'ember',
    name: 'Ember',
    paint: { fill: 'mesh', colors: ['#c8d5e3', '#f3e2d3', '#ee7429', '#160905'], angle: 135, seed: 5, softness: 0.7, grain: 0.3, ink: 'dark' },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    paint: { fill: 'mesh', colors: ['#05130e', '#b5e08a', '#187566', '#0a261f'], angle: 135, seed: 14, softness: 0.7, grain: 0.55, ink: 'light' },
  },
  {
    id: 'tide',
    name: 'Tide',
    paint: { fill: 'gradient', colors: ['#071a33', '#16607c', '#6fcfc0', '#000000'], angle: 150, seed: 7, softness: 0.6, grain: 0.2, ink: 'light' },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    paint: { fill: 'solid', colors: ['#2a2b31', '#000000', '#000000', '#000000'], angle: 135, seed: 7, softness: 0.6, grain: 0.15, ink: 'light' },
  },
  {
    id: 'paper',
    name: 'Paper',
    paint: { fill: 'solid', colors: ['#f1ede6', '#000000', '#000000', '#000000'], angle: 135, seed: 7, softness: 0.6, grain: 0.25, ink: 'dark' },
  },
]

/** Small deterministic PRNG so a seed always gives the same mesh. */
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const between = (next: () => number, min: number, max: number) => Math.round(min + next() * (max - min))

/** CSS background for the paint, or null for the style's built-in surface. */
export function fillBackground(paint: NodeFillPaint): string | null {
  const [base, second = base, third = second, fourth = third] = paint.colors
  if (paint.fill === 'solid') return base
  if (paint.fill === 'gradient') return `linear-gradient(${paint.angle}deg, ${base} 0%, ${second} 50%, ${third} 100%)`
  if (paint.fill !== 'mesh') return null
  const next = random(paint.seed)
  const blobs = [second, third, fourth].map(
    (color) =>
      `radial-gradient(${between(next, 55, 110)}% ${between(next, 45, 95)}% at ${between(next, -10, 110)}% ${between(next, -10, 110)}%, ${color} 0%, transparent ${between(next, 58, 76)}%)`,
  )
  return `${blobs.join(', ')}, ${base}`
}

/** Mesh blur in px; flat fills stay sharp. */
export const fillBlur = (paint: NodeFillPaint) => (paint.fill === 'mesh' ? Math.round(paint.softness * 48) : 0)

export const hasCustomFill = <T extends NodeFillPaint>(appearance: T | undefined): appearance is T =>
  Boolean(appearance && appearance.fill !== 'default')

/** Ink as `r g b` for the `--ink-rgb` variable; undefined keeps the style's light ink. */
export const inkRgb = (appearance: NodeFillPaint | undefined) =>
  hasCustomFill(appearance) && appearance.ink === 'dark' ? '20 22 28' : undefined

/** Custom properties a node style reads for spacing, corners, and ink. */
export function appearanceVars(appearance: NodeAppearance | undefined, names: { padding: string[]; radius: string[] }) {
  const vars: Record<string, string> = {}
  if (appearance?.padding !== undefined) for (const name of names.padding) vars[name] = `${appearance.padding}px`
  if (appearance?.radius !== undefined) for (const name of names.radius) vars[name] = `${appearance.radius}px`
  const ink = inkRgb(appearance)
  if (ink) vars['--ink-rgb'] = ink
  return vars as CSSProperties
}

export function paintOf(appearance: NodeAppearance): NodeFillPaint {
  const { fill, colors, angle, seed, softness, grain, ink } = appearance
  return { fill, colors, angle, seed, softness, grain, ink }
}

/** Versioned so saves made before the defaults last changed don't override them. */
const SAVED_APPEARANCES_KEY = 'llumen.nodeAppearances.v2'
const FILLS: readonly NodeFill[] = ['default', 'solid', 'gradient', 'mesh']

function isAppearance(value: unknown): value is NodeAppearance {
  const item = value as Partial<NodeAppearance> | null
  return Boolean(item && FILLS.includes(item.fill as NodeFill) && Array.isArray(item.colors))
}

/** Saved looks by node id; nodes keep stable ids across reloads, so their edits come back. */
export function readSavedAppearances(): Record<string, NodeAppearance> {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_APPEARANCES_KEY) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, NodeAppearance] => isAppearance(entry[1])))
  } catch {
    return {}
  }
}

export function withSavedAppearances<T extends { id: string; appearance?: NodeAppearance }>(nodes: readonly T[]): T[] {
  const saved = readSavedAppearances()
  return nodes.map((node) => (saved[node.id] ? { ...node, appearance: saved[node.id] } : node))
}

/** Records the looks of these nodes, leaving other saved nodes (e.g. the other canvas mode's) untouched. */
export function saveAppearances(nodes: readonly { id: string; appearance?: NodeAppearance }[]) {
  const saved = readSavedAppearances()
  for (const node of nodes) {
    if (node.appearance) saved[node.id] = node.appearance
    else delete saved[node.id]
  }
  try {
    localStorage.setItem(SAVED_APPEARANCES_KEY, JSON.stringify(saved))
  } catch {
    // Storage full or blocked: edits still apply for this session.
  }
}

/** Pieces of a look that can be copied to other nodes on their own. */
export type AppearancePart = 'paint' | 'padding' | 'radius'
export type ApplyScope = 'category' | 'all'

/** `target` with the chosen parts taken from `source`; undefined when the result is the plain default. */
export function copyAppearance(
  target: NodeAppearance | undefined,
  source: NodeAppearance | undefined,
  parts: readonly AppearancePart[],
): NodeAppearance | undefined {
  const from = source ?? DEFAULT_APPEARANCE
  let next: NodeAppearance = target ?? DEFAULT_APPEARANCE
  if (parts.includes('paint')) next = { ...next, ...paintOf(from), preset: from.preset }
  if (parts.includes('padding')) next = { ...next, padding: from.padding }
  if (parts.includes('radius')) next = { ...next, radius: from.radius }
  const plain = next.fill === 'default' && next.padding === undefined && next.radius === undefined
  return plain ? undefined : next
}
