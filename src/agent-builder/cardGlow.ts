import { DEFAULT_CANVAS_CARDS, readCardSurface, type CardSurface } from './canvasLook'

/** Card layout and design for minimal cards; the canvas background is set on its own. */
export type CardGlow = 'classic' | 'sections' | 'panel' | 'gradient' | 'iconHeader'

/** In CSS pixels. Padding is the card's own, or in the panel styles the padding inside each panel. */
export type CardLayout = { padding: number; radius: number }

const PANEL_LAYOUT: CardLayout = { padding: 10, radius: 16 }

export const CARD_GLOWS: readonly {
  id: CardGlow
  label: string
  description: string
  /** Whether the icon container and values panel options apply, and the card background is the canvas-wide one. */
  nodeOptions: boolean
  layout: CardLayout
}[] = [
  {
    id: 'classic',
    label: 'Style 1',
    description: 'Dark card with a hairline border, values in their own panel underneath',
    nodeOptions: true,
    layout: { padding: 16, radius: 20 },
  },
  {
    id: 'sections',
    label: 'Style 2',
    description: 'Header, content, and footer on a card tinted from the category colour; the footer previews run data',
    nodeOptions: false,
    layout: { padding: 16, radius: 20 },
  },
  {
    id: 'panel',
    label: 'Style 3',
    description: 'A frame in the category colour holding the header, with the content and run data in black panels inside',
    nodeOptions: false,
    layout: PANEL_LAYOUT,
  },
  {
    id: 'gradient',
    label: 'Style 4',
    description: 'Style 3 with a frame that fades from the category colour to a dark shade of it, and a white header',
    nodeOptions: false,
    layout: PANEL_LAYOUT,
  },
  {
    id: 'iconHeader',
    label: 'Style 5',
    description: 'Style 4 without the category name: the header holds only the node’s icon and its actions',
    nodeOptions: false,
    layout: PANEL_LAYOUT,
  },
]

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

export type IconContainer = 'tile' | 'circle' | 'none'

export const ICON_CONTAINERS: readonly { id: IconContainer; label: string; hint: string }[] = [
  { id: 'tile', label: 'Tile', hint: 'A rounded square in the category colour behind the icon.' },
  { id: 'circle', label: 'Circle', hint: 'A flat circle in the category colour behind the icon, like the node library cards.' },
  { id: 'none', label: 'None', hint: 'A larger icon in the category colour, with nothing behind it.' },
]

export type CardGlowConfig = {
  style: CardGlow
  colors: Record<GlowCategory, string>
  /** What sits behind the card's category icon. */
  iconContainer: IconContainer
  /** Values in their own well, tinted from the category colour, with labels in that colour. */
  valuesPanel: boolean
  /** Card fill under the frame for the styles that tint the card themselves; `default` keeps their tint. The border is unused. */
  surface: CardSurface
  /** Changes to each style's padding and corner radius; a node's own appearance still wins. */
  layout: Partial<Record<CardGlow, Partial<CardLayout>>>
}

export const DEFAULT_GLOW_COLORS: Record<GlowCategory, string> = {
  trigger: '#166bc0',
  data: '#17b2d9',
  agents: '#4f2fee',
  action: '#3caf98',
}

export const DEFAULT_CARD_GLOW: CardGlowConfig = {
  style: 'classic',
  colors: DEFAULT_GLOW_COLORS,
  iconContainer: 'circle',
  valuesPanel: true,
  surface: { fill: 'default', top: DEFAULT_CANVAS_CARDS.top, bottom: DEFAULT_CANVAS_CARDS.bottom, border: DEFAULT_CANVAS_CARDS.border },
  layout: {},
}

/** The style's padding and corner radius, with the changes made to them. */
export function cardLayout(config: CardGlowConfig): CardLayout {
  const base = (CARD_GLOWS.find((option) => option.id === config.style) ?? CARD_GLOWS[0]).layout
  return { ...base, ...config.layout[config.style] }
}

function readLayout(value: unknown): CardGlowConfig['layout'] {
  const saved = (value ?? {}) as Record<string, Partial<Record<keyof CardLayout, unknown>> | undefined>
  const layout: CardGlowConfig['layout'] = {}
  for (const { id } of CARD_GLOWS) {
    const entry: Partial<CardLayout> = {}
    for (const key of ['padding', 'radius'] as const) {
      const number = saved[id]?.[key]
      const { min, max } = CARD_LAYOUT_LIMITS[key]
      if (typeof number === 'number' && Number.isFinite(number)) entry[key] = Math.min(max, Math.max(min, Math.round(number)))
    }
    if (Object.keys(entry).length) layout[id] = entry
  }
  return layout
}

/** Saved as on/off before the circle; on was the tile. */
const readIconContainer = (saved: unknown): IconContainer =>
  saved === false ? 'none' : saved === true ? 'tile' : ICON_CONTAINERS.some((option) => option.id === saved) ? (saved as IconContainer) : DEFAULT_CARD_GLOW.iconContainer

/** Versioned so saves made before the defaults last changed don't override them. */
const CONFIG_KEY = 'llumen.cardGlowConfig.v2'
const DEFAULT_COLORS_KEY = 'llumen.cardGlowDefaultColors.v2'
const HEX = /^#[0-9a-f]{6}$/i

const isStyle = (value: unknown): value is CardGlow => CARD_GLOWS.some((option) => option.id === value)

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

/** Older saves carry settings for styles that are gone; only the fields above are read back. */
export function readCardGlow(): CardGlowConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { ...DEFAULT_CARD_GLOW, colors: readDefaultGlowColors() }
    const saved = JSON.parse(raw) as Partial<CardGlowConfig>
    return {
      style: isStyle(saved.style) ? saved.style : DEFAULT_CARD_GLOW.style,
      colors: { ...readDefaultGlowColors(), ...saved.colors },
      iconContainer: readIconContainer(saved.iconContainer),
      valuesPanel: saved.valuesPanel ?? true,
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
