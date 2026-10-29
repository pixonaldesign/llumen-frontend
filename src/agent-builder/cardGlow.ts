import { readCardSurface, type CardSurface } from './canvasLook'

/** In CSS pixels: the padding inside the card's black panel, and the card's corner radius. */
export type CardLayout = { padding: number; radius: number }

export const DEFAULT_CARD_LAYOUT: CardLayout = { padding: 10, radius: 16 }

export const CARD_LAYOUT_LIMITS: Record<keyof CardLayout, { min: number; max: number }> = {
  padding: { min: 4, max: 40 },
  radius: { min: 0, max: 32 },
}

export type GlowCategory = 'trigger' | 'data' | 'agents' | 'action'

export const GLOW_CATEGORIES: readonly { id: GlowCategory; label: string }[] = [
  { id: 'trigger', label: 'Triggers' },
  { id: 'data', label: 'Data & Flow' },
  { id: 'agents', label: 'Agents' },
  { id: 'action', label: 'Actions' },
]

export type CardGlowConfig = {
  colors: Record<GlowCategory, string>
  /** Card fill under the frame; `default` keeps the card's own tint. The border is unused. */
  surface: CardSurface
  /** Changes to the card's padding and corner radius; a node's own appearance still wins. */
  layout: Partial<CardLayout>
}

export const DEFAULT_GLOW_COLORS: Record<GlowCategory, string> = {
  trigger: '#2485e5',
  data: '#0fc3f0',
  agents: '#a97aff',
  action: '#de9c3f',
}

export const DEFAULT_CARD_GLOW: CardGlowConfig = {
  colors: DEFAULT_GLOW_COLORS,
  surface: {
    fill: 'default',
    top: { color: '#000000', opacity: 0.7 },
    bottom: { color: '#000000', opacity: 0.1 },
    border: { color: '#ffffff', opacity: 0.1 },
  },
  layout: {},
}

/** The card's padding and corner radius, with the changes made to them. */
export function cardLayout(config: CardGlowConfig): CardLayout {
  return { ...DEFAULT_CARD_LAYOUT, ...config.layout }
}

function readLayout(value: unknown): Partial<CardLayout> {
  const saved = (value ?? {}) as Partial<Record<keyof CardLayout, unknown>>
  const layout: Partial<CardLayout> = {}
  for (const key of ['padding', 'radius'] as const) {
    const number = saved[key]
    const { min, max } = CARD_LAYOUT_LIMITS[key]
    if (typeof number === 'number' && Number.isFinite(number)) layout[key] = Math.min(max, Math.max(min, Math.round(number)))
  }
  return layout
}

/** Versioned so saves made before the defaults last changed don't override them. */
const CONFIG_KEY = 'llumen.cardGlowConfig.v3'
const DEFAULT_COLORS_KEY = 'llumen.cardGlowDefaultColors.v3'
const HEX = /^#[0-9a-f]{6}$/i

/** What Reset goes back to: colours saved as the default, or the built-in ones. */
export function readDefaultGlowColors(): Record<GlowCategory, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(DEFAULT_COLORS_KEY) ?? 'null') as Partial<Record<GlowCategory, unknown>> | null
    if (!saved) return DEFAULT_GLOW_COLORS
    return Object.fromEntries(
      GLOW_CATEGORIES.map(({ id }) => {
        const color = saved[id]
        return [id, typeof color === 'string' && HEX.test(color) ? color : DEFAULT_GLOW_COLORS[id]]
      }),
    ) as Record<GlowCategory, string>
  } catch {
    return DEFAULT_GLOW_COLORS
  }
}

/** Null forgets the saved colours, so Reset goes back to the built-in ones. */
export function saveDefaultGlowColors(colors: Record<GlowCategory, string> | null) {
  try {
    if (colors) localStorage.setItem(DEFAULT_COLORS_KEY, JSON.stringify(colors))
    else localStorage.removeItem(DEFAULT_COLORS_KEY)
  } catch {
    // Storage can be unavailable (private mode); the defaults then last for this session only.
  }
}

export function readCardGlow(): CardGlowConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { ...DEFAULT_CARD_GLOW, colors: readDefaultGlowColors() }
    const saved = JSON.parse(raw) as Partial<CardGlowConfig>
    return {
      colors: { ...readDefaultGlowColors(), ...saved.colors },
      surface: readCardSurface(saved.surface, DEFAULT_CARD_GLOW.surface),
      layout: readLayout(saved.layout),
    }
  } catch {
    return DEFAULT_CARD_GLOW
  }
}

export function saveCardGlow(config: CardGlowConfig) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch {
    // Storage can be unavailable (private mode); the settings still apply for this session.
  }
}

type Rgb = readonly [number, number, number]

function parseHex(hex: string): Rgb {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const toHex = (rgb: Rgb) => `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`

/** `#rrggbb` as the space-separated triplet `rgb(r g b / a)` takes. */
const rgbTriplet = (hex: string) => parseHex(hex).join(' ')

function luminance(rgb: Rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const mix = (from: Rgb, to: Rgb, amount: number): Rgb =>
  [0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * amount) as unknown as Rgb

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/** Below this the accent is lifted toward white, so icons and labels stay legible on the dark UI. */
const MIN_ACCENT_LUMINANCE = 0.12

/** The category colour as UI accent: unchanged unless too dark to read, plus the ink that sits on it. */
export function categoryAccent(hex: string) {
  const base = parseHex(hex)
  let accent = base
  for (let amount = 0.02; luminance(accent) < MIN_ACCENT_LUMINANCE && amount <= 1; amount += 0.02) {
    accent = mix(base, [255, 255, 255], amount)
  }
  const shade = mix(base, [0, 0, 0], 0.82)
  const accentLight = luminance(accent)
  const onAccent = contrast(accentLight, 1) >= contrast(accentLight, luminance(shade)) ? '#ffffff' : toHex(shade)
  return { accent: toHex(accent), onAccent }
}

/** The colour's hue at a fixed HSB saturation and brightness (0–1): the dark ends of the card gradients. */
function atSaturationBrightness(hex: string, saturation: number, brightness: number): Rgb {
  const [r, g, b] = parseHex(hex).map((channel) => channel / 255)
  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)
  const hue = delta === 0 ? 0 : max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  const channel = (n: number) => {
    const k = (n + hue) % 6
    return brightness * (1 - saturation * Math.max(0, Math.min(k, 4 - k, 1))) * 255
  }
  return [channel(5), channel(3), channel(1)]
}

const rgbOf = (rgb: Rgb) => rgb.map(Math.round).join(' ')

/** Every category colour the UI reads: card glow and its dark ends, accent, and the ink on the accent. */
export function categoryVars(colors: Record<GlowCategory, string>): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const { id } of GLOW_CATEGORIES) {
    const { accent, onAccent } = categoryAccent(colors[id])
    vars[`--glow-${id}-rgb`] = rgbTriplet(colors[id])
    vars[`--glow-${id}-deep-rgb`] = rgbOf(atSaturationBrightness(colors[id], 0.15, 0.15))
    vars[`--glow-${id}-edge-rgb`] = rgbOf(atSaturationBrightness(colors[id], 0.2, 0.2))
    vars[`--cat-${id}-accent`] = accent
    vars[`--cat-${id}-on-accent`] = onAccent
  }
  return vars
}
