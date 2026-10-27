/** Slow mesh gradient behind the canvas while idle. */
export type AmbientIdle = {
  /** Peak blob opacity, 0–1. 0 hides the idle gradient. */
  intensity: number
  /** Blob diameter as a fraction of the viewport's longer side. */
  size: number
  /** How far each blob wanders from its anchor, as a fraction of the viewport. */
  drift: number
  /** Seconds for one full wander cycle. */
  cycleSeconds: number
}

/** While a run is active the blobs leave the centre and circle the screen edges. */
export type AmbientRun = {
  /** Peak blob opacity, 0–1. 0 turns the run animation off. */
  intensity: number
  /** Depth of the glowing band along the edges, as a fraction of the viewport's shorter side. */
  reach: number
  /** Blob radius as a fraction of the viewport's shorter side; bigger blobs blend into longer colour runs. */
  spread: number
  /** Seconds for a blob to travel once around the screen. */
  lapSeconds: number
  /** How much the glow breathes, 0–1. */
  pulse: number
  /** Seconds per breath. */
  pulseSeconds: number
  /** Seconds to move between the idle layout and the edges. */
  transitionSeconds: number
}

export type AmbientStop = {
  color: string
  /** 0–1, multiplied with the idle and run intensity. */
  opacity: number
}

/**
 * How the ambient layer draws the colours. Blobs are soft discs; the rest are shaded per pixel:
 * mesh blends every colour point into its neighbours, flow is liquid domain-warped noise,
 * aurora is layered ribbons.
 */
export type AmbientStyle = 'blobs' | 'mesh' | 'flow' | 'aurora'

/** The canvas shader: none, one of the ambient layer's styles, or the smoke or rays (their own WebGL layer over the background). */
export type ShaderStyle = 'none' | AmbientStyle | 'smoke' | 'rays'

export const SHADER_STYLES: readonly { id: ShaderStyle; label: string; hint: string }[] = [
  { id: 'none', label: 'None', hint: 'Just the background; the run animation still plays.' },
  { id: 'blobs', label: 'Blobs', hint: 'Soft discs of colour drifting over the canvas.' },
  { id: 'mesh', label: 'Mesh', hint: 'Colour points that blend into each other across the whole canvas, with no gaps.' },
  { id: 'flow', label: 'Flow', hint: 'Liquid, marbled colour that folds slowly into itself.' },
  { id: 'aurora', label: 'Aurora', hint: 'Layered ribbons of light rippling across the canvas.' },
  { id: 'smoke', label: 'Smoke', hint: 'Slow smoke lit in the colours, fading out toward the screen edges.' },
  {
    id: 'rays',
    label: 'Rays',
    hint: 'A beam of light falling down one side and spilling across the floor. The colours run along the light, from the top of the beam to the end of the floor.',
  },
]

/** None, Smoke, and Rays leave the ambient layer empty at rest; it still draws the run animation, as blobs. */
export const ambientDrawStyle = (style: ShaderStyle): AmbientStyle =>
  style === 'none' || style === 'smoke' || style === 'rays' ? 'blobs' : style

export type SmokeSettings = {
  intensity: number
  /** Shader time per second. */
  speed: number
  /** Noise zoom; higher is finer smoke. */
  scale: number
}

export const DEFAULT_SMOKE: SmokeSettings = { intensity: 0.75, speed: 0.031, scale: 1.03 }
/** Speed the smoke and rays controls label 1×. */
export const SMOKE_UNIT_SPEED = 0.05
export const RAY_UNIT_SPEED = 0.25
export const SMOKE_LIMITS = {
  intensity: { min: 0.05, max: 1.5 },
  speed: { min: 0, max: 0.2 },
  scale: { min: 0.4, max: 3 },
}

/** A beam of light down one side of the screen that bends into a glow across the floor. */
export type RaySettings = {
  intensity: number
  /** White-hot centre of the light, 0–1. */
  core: number
  /** Soft glow around the light, 0–1. */
  haze: number
  /** Beam across the screen, from the left (0) to the right (1). */
  position: number
  /** Beam width, as a share of the screen height. */
  width: number
  /** Floor glow height, from the bottom (0) up. */
  floor: number
  /** Radius of the bend between the beam and the floor, 0–1. */
  bend: number
  /** How far the floor glow reaches across, 0–1. */
  reach: number
  /** Shader time per second. */
  speed: number
  /** How far the beam drifts, 0–1. */
  sway: number
  /** Brightness breathing, 0–1. */
  pulse: number
  /** Streaks flowing along the light, 0–1. */
  shimmer: number
}

export const DEFAULT_RAYS: RaySettings = {
  intensity: 0.77,
  core: 0.36,
  haze: 0.79,
  position: 0.64,
  width: 0.23,
  floor: 0.13,
  bend: 1,
  reach: 0.48,
  speed: 0.26,
  sway: 0.67,
  pulse: 0.46,
  shimmer: 0.63,
}

export const RAY_LIMITS: Record<keyof RaySettings, { min: number; max: number }> = {
  intensity: { min: 0.1, max: 2 },
  core: { min: 0, max: 1 },
  haze: { min: 0, max: 1 },
  position: { min: 0, max: 1 },
  width: { min: 0.03, max: 0.5 },
  floor: { min: 0, max: 0.6 },
  bend: { min: 0, max: 1 },
  reach: { min: 0, max: 1 },
  speed: { min: 0, max: 1 },
  sway: { min: 0, max: 1 },
  pulse: { min: 0, max: 1 },
  shimmer: { min: 0, max: 1 },
}

export type CanvasAmbient = {
  style: ShaderStyle
  /** Colour stops, cycled across the blobs or mesh points, or blended along the flow and aurora palettes. */
  stops: AmbientStop[]
  /** 0 is a hard-edged disc, 1 fades from the very centre. */
  softness: number
  /** Shape of each blob's fade: 0 is a straight ramp, 1 an eased curve with no visible rings. */
  smoothness: number
  /** Fine noise over the gradient, 0–1, to break up colour banding. */
  dither: number
  /** How strongly mesh, flow, and aurora shapes bend and fold, 0–1. */
  warp: number
  /** Gaussian blur over the colours, in CSS pixels. */
  blur: number
  /** Visible film grain over the gradient, 0–1. */
  grain: number
  /** Darkens the screen edges, 0–1. */
  vignette: number
  idle: AmbientIdle
  run: AmbientRun
  smoke: SmokeSettings
  rays: RaySettings
}

export const AMBIENT_MIN_STOPS = 1
export const AMBIENT_MAX_STOPS = 8
/** Offered in order when adding a stop, skipping colours already in use. */
const NEW_STOP_COLORS = ['#4f7cff', '#a855f7', '#22d3ee', '#34d399', '#f59e0b', '#fb7185', '#6366f1', '#f43f5e']

const DEFAULT_COLORS = ['#2a4147', '#6284a3', '#1f317a', '#000000']

export const DEFAULT_AMBIENT_IDLE: AmbientIdle = { intensity: 0.6, size: 0.69, drift: 0.13, cycleSeconds: 23 }
export const DEFAULT_AMBIENT_RUN: AmbientRun = {
  intensity: 0.32,
  reach: 0.08,
  spread: 0.5,
  lapSeconds: 7,
  pulse: 0.44,
  pulseSeconds: 1.8,
  transitionSeconds: 1.6,
}
export const stopsFromColors = (colors: readonly string[]): AmbientStop[] => colors.map((color) => ({ color, opacity: 1 }))

export const DEFAULT_AMBIENT: CanvasAmbient = {
  style: 'aurora',
  stops: stopsFromColors(DEFAULT_COLORS),
  softness: 0.71,
  smoothness: 1,
  dither: 0.16,
  warp: 1,
  blur: 66,
  grain: 0.25,
  vignette: 0.08,
  idle: DEFAULT_AMBIENT_IDLE,
  run: DEFAULT_AMBIENT_RUN,
  smoke: DEFAULT_SMOKE,
  rays: DEFAULT_RAYS,
}

export const AMBIENT_MAX_BLUR = 160

/** A stop for the "Add color" action: the first unused colour from a fixed list. */
export function nextStop(stops: readonly AmbientStop[]): AmbientStop {
  const used = new Set(stops.map((stop) => stop.color.toLowerCase()))
  return { color: NEW_STOP_COLORS.find((color) => !used.has(color)) ?? stops.at(-1)?.color ?? NEW_STOP_COLORS[0], opacity: 1 }
}

const HEX = /^#[0-9a-f]{6}$/i

const numberOr = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

function pick<T extends Record<string, number>>(saved: unknown, defaults: T): T {
  const source = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, numberOr(source[key], value)])) as T
}

/** Saved stops; older saves stored plain `colors` strings, which become fully opaque stops. */
function sanitizeStops(stops: unknown, colors: unknown): AmbientStop[] {
  if (Array.isArray(stops)) {
    const valid = stops
      .filter((stop): stop is AmbientStop => !!stop && typeof stop === 'object' && typeof stop.color === 'string' && HEX.test(stop.color))
      .map((stop) => ({ color: stop.color, opacity: clamp01(numberOr(stop.opacity, 1)) }))
      .slice(0, AMBIENT_MAX_STOPS)
    if (valid.length >= AMBIENT_MIN_STOPS) return valid
  }
  if (Array.isArray(colors) && colors.length >= AMBIENT_MIN_STOPS && colors.every((color) => typeof color === 'string' && HEX.test(color))) {
    return stopsFromColors(colors.slice(0, AMBIENT_MAX_STOPS))
  }
  return DEFAULT_AMBIENT.stops
}

/** Saved ambient settings, falling back field by field to the defaults. */
export function sanitizeAmbient(saved: unknown): CanvasAmbient {
  const source = (saved && typeof saved === 'object' ? saved : {}) as Partial<Record<keyof CanvasAmbient | 'colors', unknown>>
  return {
    style: SHADER_STYLES.find((style) => style.id === source.style)?.id ?? DEFAULT_AMBIENT.style,
    stops: sanitizeStops(source.stops, source.colors),
    softness: numberOr(source.softness, DEFAULT_AMBIENT.softness),
    smoothness: numberOr(source.smoothness, DEFAULT_AMBIENT.smoothness),
    dither: numberOr(source.dither, DEFAULT_AMBIENT.dither),
    warp: numberOr(source.warp, DEFAULT_AMBIENT.warp),
    blur: Math.min(AMBIENT_MAX_BLUR, Math.max(0, numberOr(source.blur, DEFAULT_AMBIENT.blur))),
    grain: clamp01(numberOr(source.grain, DEFAULT_AMBIENT.grain)),
    vignette: clamp01(numberOr(source.vignette, DEFAULT_AMBIENT.vignette)),
    idle: pick(source.idle, DEFAULT_AMBIENT_IDLE),
    run: pick(source.run, DEFAULT_AMBIENT_RUN),
    smoke: sanitizeSmoke(source.smoke),
    rays: sanitizeRays(source.rays),
  }
}

function sanitizeRays(saved: unknown): RaySettings {
  const source = pick(saved, DEFAULT_RAYS)
  const keys = Object.keys(DEFAULT_RAYS) as (keyof RaySettings)[]
  return Object.fromEntries(
    keys.map((key) => [key, Math.min(RAY_LIMITS[key].max, Math.max(RAY_LIMITS[key].min, source[key]))]),
  ) as RaySettings
}

export function sanitizeSmoke(saved: unknown): SmokeSettings {
  const source = pick(saved, DEFAULT_SMOKE)
  const within = (value: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, value))
  return {
    intensity: within(source.intensity, SMOKE_LIMITS.intensity),
    speed: within(source.speed, SMOKE_LIMITS.speed),
    scale: within(source.scale, SMOKE_LIMITS.scale),
  }
}
