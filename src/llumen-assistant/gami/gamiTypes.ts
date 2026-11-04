import type { SummaryPart } from '../story/StorySummaryText'
import type { LngLat } from './gamiGeo'
import type { GamiMapScene } from './gamiMapLayers'

/**
 * The Create Asset flow's palettes (the asset builder's `ColorPalette` presets). Cards and map layers
 * take every colour from these.
 */
export const PALETTE = {
  /** Categorical · Default */
  categorical: ['#6a9ef0', '#bdb6f4', '#26ada0', '#7ad488', '#fceed6', '#f38666', '#cac5f6', '#ed7986', '#534d8f', '#a8ded9'],
  /** Sequential · Blue → White */
  blue: ['#2b61f5', '#356eea', '#4f86ea', '#6a9ef3', '#a8c9fa', '#d8e6fd', '#f7f9ff'],
  /** Sequential · Teal → White */
  teal: ['#159a7d', '#23b899', '#45cdb9', '#94e8dc', '#b8f0e6', '#d5f8f2', '#eefcfa'],
  /** Sequential · Purple → White */
  purple: ['#5a2fc7', '#764fd8', '#9673e8', '#b899f5', '#d6c2fb', '#e9ddff', '#f6f2ff'],
  /** Sequential · Red → White */
  red: ['#c62828', '#f56b6b', '#ff9292', '#ffbbbb', '#ffd5d5', '#ffe7e7', '#fff7f7'],
  /** Diverging · Red → White → Blue */
  diverging: ['#9f1d1d', '#df3f3f', '#f7a0a0', '#f3f4f6', '#cce4fb', '#68b1ee', '#1565c0'],
} as const

/** A card's one series colour, the asset builder's default. */
export const SERIES = PALETTE.blue[3]

/** Status along the diverging palette: critical at its red end, good at its blue end. */
export const STATUS = {
  critical: PALETTE.diverging[1],
  moderate: PALETTE.diverging[2],
  mild: PALETTE.diverging[3],
  good: PALETTE.diverging[5],
} as const

export type Status = keyof typeof STATUS

/** A card's colour family: one of the sequential presets, so neighbouring cards don't all read blue. */
export type Tone = 'blue' | 'teal' | 'purple'

export const TONES: readonly Tone[] = ['teal', 'blue', 'purple']

/** The shade a tone fills single-series charts with. */
export const TONE_ACCENT: Record<Tone, string> = {
  blue: PALETTE.blue[3],
  teal: PALETTE.teal[2],
  purple: PALETTE.purple[3],
}

/** Where each tone enters the categorical palette, so multi-series charts open on their own colour. */
const TONE_START: Record<Tone, number> = { blue: 0, teal: 2, purple: 1 }

/** The `i`th categorical colour, starting from `tone`'s entry. */
export const category = (index: number, tone: Tone = 'blue') =>
  PALETTE.categorical[(index + TONE_START[tone]) % PALETTE.categorical.length]

/** A sequential preset's first `steps` shades: dark to light, which reads low to high on the dark map. */
export const ramp = (colors: readonly string[], steps = 5) => colors.slice(0, steps)

/** `t` (0–1) along a low-to-high ramp. */
export function rampAt(colors: readonly string[], t: number) {
  const index = Math.round(Math.min(1, Math.max(0, t)) * (colors.length - 1))
  return colors[index]
}

export type GamiCamera = { center: LngLat; zoom: number; pitch: number; bearing: number }

/** An outlined area: a wall `wallM` high along the outline, labelled with `name` and `text`. */
export type GamiPolygon = {
  id: string
  name: string
  text: string
  color: string
  ring: LngLat[]
  wallM: number
  /** Where the name label sits; west keeps it clear of labels running east. Defaults to the top. */
  labelSide?: 'top' | 'west'
}

export type LegendMark = 'column' | 'disk' | 'line' | 'heat' | 'area'

/** A Map Data layer, listed the way the story's Map Data lists its attributes. */
export type MapDataLayer = {
  /** The scene group this layer shows and hides. */
  group: string
  title: string
  mark: LegendMark
  /** Categories by colour, or a low-to-high ramp. */
  color: { items: { label: string; color: string; count?: string }[] } | { ramp: string[]; low?: string; high?: string }
  /** Disks scale with value (Size); columns rise with it (Height, in the ramp's colours). */
  scale?: 'size' | 'height'
}

export type PartId = 'motor' | 'gimbal' | 'inu'

type CardBase = {
  id: string
  title: string
  /** `cell` is one 184px square; `full` spans the sidebar's two cells. */
  span?: 'full' | 'cell'
  /** Height in 184px rows. */
  height?: 1 | 2
  /** The headline number over a chart, as the story's chart cards show it. */
  kpi?: { value: string; unit?: string }
  /** The chart's colour family; stories assign one per card in turn. */
  tone?: Tone
}

export type GamiCard = CardBase &
  (
    | { kind: 'summary'; parts: SummaryPart[] }
    | { kind: 'kpis'; tiles: { label: string; value: string; unit?: string; note?: string }[] }
    | {
        kind: 'cell'
        value: string
        note: string
        /** A sparkline under the note, oldest first, in the status colour. */
        spark?: number[]
        status?: Status
      }
    | { kind: 'progress'; rows: { label: string; value: string; target: string; pct: number }[] }
    | {
        kind: 'line'
        x: string[]
        yLabels: string[]
        yMax: number
        /** Dashed series are references (plan, typical), drawn like the story's "Typical". */
        series: { name: string; points: (number | null)[]; dashed?: boolean; status?: Status }[]
      }
    | { kind: 'vbars'; bars: { label: string; value: number; display?: string; status?: Status }[] }
    | { kind: 'hbars'; bars: { label: string; value: number; display: string; status?: Status }[] }
    | { kind: 'split'; total: string; unit: string; parts: { name: string; value: number; display: string }[] }
    | { kind: 'stacked'; legend: string[]; bars: { label: string; parts: number[] }[] }
    | {
        kind: 'grouped'
        legend: string[]
        groups: { label: string; values: number[] }[]
        /** The series are steps in time, shaded along the sequential palette instead of by category. */
        ordered?: boolean
      }
    | { kind: 'donut'; total: string; totalLabel: string; slices: { name: string; value: number; status?: Status }[] }
    | {
        kind: 'table'
        columns: string[]
        rows: { cells: string[]; status?: Status }[]
        /** Which column carries the status. */
        statusColumn?: number
      }
    | { kind: 'range'; min: number; max: number; ticks: number[]; rows: { label: string; from: number; to: number; status?: Status }[] }
    | { kind: 'countdown'; target: string }
    | { kind: 'part'; part: PartId; size?: 'cell' | 'large' }
  )

export type GamiPage = {
  id: string
  title: string
  /** What this page says, for the page's info popover. */
  finding: string
  camera: GamiCamera
  scene: GamiMapScene
  polygons: GamiPolygon[]
  filters: string[]
  cards: GamiCard[]
  layers: MapDataLayer[]
}

export type GamiStory = {
  id: string
  title: string
  description: string
  /** The Briefing place its first page opens on. */
  place: GamiPlaceId
  /** Opens on this camera (the whole planet) and dives into the first page before drawing it. */
  intro?: GamiCamera
  /** Sidebar width in 184px cells on every page (2 unless set). */
  columns?: 2 | 3 | 4
  pages: [GamiPage, GamiPage]
}

export type GamiPlaceId = 'kingdom' | 'eastern' | 'wds' | 'western'

export type GamiPart = {
  id: PartId
  name: string
  short: string
  supplier: string
  city: string
  monthlyNeed: string
  stockDays: number
  programmes: string[]
  /** What the part does in the aircraft. */
  role: string
  specs: [string, string][]
  /** Days of stock, every two weeks from today, at the current build rate. */
  stock: number[]
  exposure: { label: string; value: number; display: string }[]
  /** Monthly units delivered from Poland, the last six months. */
  deliveries: number[]
  alternative: { supplier: string; city: string; capacity: string; leadTime: string; cost: string; qualified: string }
  /** The switch to the bridge supplier, step by step. */
  plan: { step: string; when: string }[]
}
