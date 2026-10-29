import { DEFAULT_AMBIENT, sanitizeAmbient, sanitizeSmoke, type CanvasAmbient } from './canvasAmbient'
import { DEFAULT_APPEARANCE, paintOf, type NodeFill, type NodeFillPaint } from './nodeAppearance'

export type CanvasPaint = NodeFillPaint & { preset?: string }
export type CanvasDots = { color: string; opacity: number; size: number }
/** A colour at an opacity, 0–1. */
export type Tint = { color: string; opacity: number }
export type CardFill = 'default' | 'solid' | 'gradient'
/** How node cards without a custom appearance are surfaced. Default keeps each node style's own dark card. */
export type CanvasCards = {
  fill: CardFill
  /** Solid colour, or the top of the gradient. */
  top: Tint
  /** Bottom of the gradient. */
  bottom: Tint
  border: Tint
  /** Backdrop blur behind the cards, in CSS pixels. Never below `GRAIN_SHIELD_BLUR` while the canvas has grain or dither. */
  blur: number
}
/** A card's fill and border, without the blur. */
export type CardSurface = Omit<CanvasCards, 'blur'>
/** Connection dots on the node edges. */
export type CanvasPorts = { fill: Tint; border: Tint; borderWidth: number; size: number }
export type RunOutcome = 'pass' | 'fail'
/** One outcome's glow, rising from the bottom of the screen. */
export type ResultGlow = {
  color: string
  /** Overall strength, 0–1. */
  opacity: number
  /** Brightness of the whitened core at the bottom centre, 0–1. */
  intensity: number
  /** Width across the screen, as a share of its width. */
  spread: number
  /** Share of the screen height the glow reaches. */
  height: number
  /** 0 is a tight glow with a hard edge, 1 a wide haze that fades from the bottom. */
  softness: number
  /** Pulse depth, 0–1; 0 holds steady. */
  pulse: number
  /** Length of one pulse. */
  pulseSeconds: number
}
/** Glow shown when a workflow run finishes. */
export type CanvasRunResult = {
  pass: ResultGlow
  fail: ResultGlow
  /** How long the glow stays, fade in and out included. */
  seconds: number
}
/** Canvas-wide background, dot grid, ambient gradient, card surface, ports, and run result; saved per browser, not part of the undo history. */
export type CanvasLook = {
  /** The background itself, under the shader. */
  paint: CanvasPaint
  dots: CanvasDots
  /** The shader over the background: its type, colours, and run animation. */
  ambient: CanvasAmbient
  cards: CanvasCards
  ports: CanvasPorts
  result: CanvasRunResult
}

const WHITE = '#ffffff'
/** Background types for the canvas; the moving looks are shader types instead. */
export const CANVAS_FILLS: readonly NodeFill[] = ['default', 'solid', 'gradient']
export const DEFAULT_CANVAS_DOTS: CanvasDots = { color: '#242424', opacity: 0, size: 1 }
export const DEFAULT_CANVAS_CARDS: CanvasCards = {
  fill: 'gradient',
  top: { color: WHITE, opacity: 0.1 },
  bottom: { color: WHITE, opacity: 0.05 },
  border: { color: WHITE, opacity: 0.1 },
  blur: 40,
}
export const DEFAULT_CANVAS_PORTS: CanvasPorts = {
  fill: { color: WHITE, opacity: 0.2 },
  border: { color: WHITE, opacity: 0.4 },
  borderWidth: 0,
  size: 10,
}
const DEFAULT_GLOW: Omit<ResultGlow, 'color'> = {
  opacity: 0.3,
  intensity: 0.12,
  spread: 0.83,
  height: 0.28,
  softness: 1,
  pulse: 0.2,
  pulseSeconds: 3,
}
export const DEFAULT_RUN_RESULT: CanvasRunResult = {
  pass: { ...DEFAULT_GLOW, color: '#22c55e' },
  fail: { ...DEFAULT_GLOW, color: '#ef4444' },
  seconds: 3,
}
export const RESULT_LIMITS = {
  spread: { min: 0.2, max: 1.5 },
  height: { min: 0.1, max: 0.6 },
  pulseSeconds: { min: 0.4, max: 3 },
  seconds: { min: 1, max: 8 },
}
export const CARD_MAX_BLUR = 40
export const PORT_MIN_SIZE = 6
export const PORT_MAX_SIZE = 18
export const PORT_MAX_BORDER = 3
/** Smallest backdrop blur that smooths the ambient grain and dither out from behind see-through cards. */
export const GRAIN_SHIELD_BLUR = 12

export const CARD_PRESETS: readonly { id: string; name: string; cards: CardSurface }[] = [
  {
    id: 'glass',
    name: 'Glass',
    cards: { fill: 'gradient', top: { color: WHITE, opacity: 0.1 }, bottom: { color: WHITE, opacity: 0.05 }, border: { color: WHITE, opacity: 0.1 } },
  },
  {
    id: 'frost',
    name: 'Frost',
    cards: { fill: 'gradient', top: { color: WHITE, opacity: 0.2 }, bottom: { color: WHITE, opacity: 0.08 }, border: { color: WHITE, opacity: 0.22 } },
  },
  {
    id: 'smoke',
    name: 'Smoke',
    cards: { fill: 'gradient', top: { color: '#0b0d12', opacity: 0.55 }, bottom: { color: '#0b0d12', opacity: 0.35 }, border: { color: WHITE, opacity: 0.08 } },
  },
  {
    id: 'slate',
    name: 'Slate',
    cards: { fill: 'solid', top: { color: '#1d1e23', opacity: 1 }, bottom: { color: '#1d1e23', opacity: 1 }, border: { color: WHITE, opacity: 0.08 } },
  },
]

/** Backdrop blur the cards actually get. */
export function cardBlur(cards: CanvasCards, ambient: CanvasAmbient) {
  const noisy = cards.fill !== 'default' && (ambient.grain > 0 || ambient.dither > 0)
  return noisy ? Math.max(cards.blur, GRAIN_SHIELD_BLUR) : cards.blur
}

export const tintCss = ({ color, opacity }: Tint) => `rgba(${hexToRgb(color)}, ${opacity})`

export const DEFAULT_CANVAS_LOOK: CanvasLook = {
  paint: { ...paintOf(DEFAULT_APPEARANCE), fill: 'solid', colors: ['#050f1a', '#2563eb', '#22d3ee', '#a855f7'], grain: 0.58 },
  dots: DEFAULT_CANVAS_DOTS,
  ambient: DEFAULT_AMBIENT,
  cards: DEFAULT_CANVAS_CARDS,
  ports: DEFAULT_CANVAS_PORTS,
  result: DEFAULT_RUN_RESULT,
}

export const DOT_SWATCHES: readonly { name: string; color: string }[] = [
  { name: 'Subtle', color: '#242424' },
  { name: 'Grey', color: '#5b5e6a' },
  { name: 'White', color: '#ffffff' },
  { name: 'Accent', color: '#73adf5' },
  { name: 'Black', color: '#000000' },
]

/** Versioned so saves made before the defaults last changed don't override them. */
const STORAGE_KEY = 'llumen.canvasLook.v3'
const HEX = /^#[0-9a-f]{6}$/i

const isHex = (value: unknown): value is string => typeof value === 'string' && HEX.test(value)
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const CARD_FILLS: readonly CardFill[] = ['default', 'solid', 'gradient']

function readTint(value: unknown, fallback: Tint): Tint {
  const tint = (value ?? {}) as Partial<Tint>
  return {
    color: isHex(tint.color) ? tint.color : fallback.color,
    opacity: isNumber(tint.opacity) ? clamp(tint.opacity, 0, 1) : fallback.opacity,
  }
}

/** Older saves stored a `glass` surface as plain white opacities. */
function readCards(value: unknown): CanvasCards {
  const saved = (value ?? {}) as Record<string, unknown>
  const base = DEFAULT_CANVAS_CARDS
  const blur = isNumber(saved.blur) ? clamp(saved.blur, 0, CARD_MAX_BLUR) : base.blur
  if ('surface' in saved) {
    if (saved.surface !== 'glass') return { ...base, blur }
    const white = (opacity: unknown, fallback: number): Tint => ({ color: WHITE, opacity: isNumber(opacity) ? opacity : fallback })
    return {
      fill: 'gradient',
      top: white(saved.fill, base.top.opacity),
      bottom: white(saved.fillEnd, base.bottom.opacity),
      border: white(saved.border, base.border.opacity),
      blur,
    }
  }
  return { ...readCardSurface(saved, base), blur }
}

export function readCardSurface(value: unknown, base: CardSurface): CardSurface {
  const saved = (value ?? {}) as Partial<Record<keyof CardSurface, unknown>>
  return {
    fill: CARD_FILLS.includes(saved.fill as CardFill) ? (saved.fill as CardFill) : base.fill,
    top: readTint(saved.top, base.top),
    bottom: readTint(saved.bottom, base.bottom),
    border: readTint(saved.border, base.border),
  }
}

function readPorts(value: unknown): CanvasPorts {
  const saved = (value ?? {}) as Partial<Record<keyof CanvasPorts, unknown>>
  const base = DEFAULT_CANVAS_PORTS
  return {
    fill: readTint(saved.fill, base.fill),
    border: readTint(saved.border, base.border),
    borderWidth: isNumber(saved.borderWidth) ? clamp(saved.borderWidth, 0, PORT_MAX_BORDER) : base.borderWidth,
    size: isNumber(saved.size) ? clamp(saved.size, PORT_MIN_SIZE, PORT_MAX_SIZE) : base.size,
  }
}

const range = (input: unknown, limits: { min: number; max: number }, fallback: number) =>
  isNumber(input) ? clamp(input, limits.min, limits.max) : fallback
const UNIT = { min: 0, max: 1 }

/** `shared` holds the height and pulse time that older saves kept for both outcomes. */
function readGlow(value: unknown, base: ResultGlow, shared: Record<string, unknown>): ResultGlow {
  const saved = (value ?? {}) as Partial<Record<keyof ResultGlow, unknown>>
  const tint = readTint(saved, base)
  return {
    ...tint,
    intensity: range(saved.intensity, UNIT, base.intensity),
    spread: range(saved.spread, RESULT_LIMITS.spread, base.spread),
    height: range(saved.height ?? shared.height, RESULT_LIMITS.height, base.height),
    softness: range(saved.softness, UNIT, base.softness),
    pulse: range(saved.pulse, UNIT, base.pulse),
    pulseSeconds: range(saved.pulseSeconds ?? shared.pulseSeconds, RESULT_LIMITS.pulseSeconds, base.pulseSeconds),
  }
}

function readRunResult(value: unknown): CanvasRunResult {
  const saved = (value ?? {}) as Record<string, unknown>
  const base = DEFAULT_RUN_RESULT
  return {
    pass: readGlow(saved.pass, base.pass, saved),
    fail: readGlow(saved.fail, base.fail, saved),
    seconds: range(saved.seconds, RESULT_LIMITS.seconds, base.seconds),
  }
}

/** Saved look, falling back field by field to the defaults when storage is missing or stale. */
export function readCanvasLook(): CanvasLook {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<{
      paint: Partial<CanvasPaint>
      smoke: unknown
      dots: Partial<CanvasDots>
      ambient: unknown
      cards: unknown
      ports: unknown
      result: unknown
    }> | null
    if (!saved) return DEFAULT_CANVAS_LOOK
    const paint = saved.paint ?? {}
    const dots = saved.dots ?? {}
    const base = DEFAULT_CANVAS_LOOK.paint
    const colors = Array.isArray(paint.colors) && paint.colors.length === 4 && paint.colors.every(isHex) ? paint.colors : base.colors
    const ambient = sanitizeAmbient(saved.ambient)
    /** Older saves kept the smoke beside the paint, drawn over a base colour. */
    const legacySmoke = (saved.smoke ?? null) as { on?: unknown; base?: unknown } | null
    const smokeBase = legacySmoke?.on === true ? (isHex(legacySmoke.base) ? legacySmoke.base : '#000000') : null
    /** The mesh moved to the shader types; its colours carry over as a gradient. */
    const fill = paint.fill === 'mesh' ? 'gradient' : CANVAS_FILLS.includes(paint.fill as NodeFill) ? (paint.fill as NodeFill) : base.fill
    return {
      paint: {
        fill: smokeBase ? 'solid' : fill,
        colors: smokeBase ? [smokeBase, ...colors.slice(1)] : colors,
        angle: isNumber(paint.angle) ? paint.angle : base.angle,
        seed: isNumber(paint.seed) ? paint.seed : base.seed,
        softness: isNumber(paint.softness) ? paint.softness : base.softness,
        grain: isNumber(paint.grain) ? paint.grain : base.grain,
        ink: base.ink,
        preset: typeof paint.preset === 'string' ? paint.preset : undefined,
      },
      dots: {
        color: isHex(dots.color) ? dots.color : DEFAULT_CANVAS_DOTS.color,
        opacity: isNumber(dots.opacity) ? dots.opacity : DEFAULT_CANVAS_DOTS.opacity,
        size: isNumber(dots.size) ? dots.size : DEFAULT_CANVAS_DOTS.size,
      },
      ambient: smokeBase ? { ...ambient, style: 'smoke', smoke: sanitizeSmoke(legacySmoke) } : ambient,
      cards: readCards(saved.cards),
      ports: readPorts(saved.ports),
      result: readRunResult(saved.result),
    }
  } catch {
    return DEFAULT_CANVAS_LOOK
  }
}

export function saveCanvasLook(look: CanvasLook) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(look))
  } catch {
    // Storage can be unavailable (private mode); the look still applies for this session.
  }
}

/** `#rrggbb` as `r, g, b` for rgba(). */
export function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16)
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`
}
