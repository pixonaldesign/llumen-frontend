import type { LngLat } from './gamiGeo'
import type { GamiIcon, GamiMapScene } from './gamiMapLayers'

/** GAMI's semantic colours; keep one meaning per colour across cards and map. */
export const TONE = {
  red: '#ee3f39',
  amber: '#f5a729',
  yellow: '#e8d44d',
  green: '#1fce7a',
  teal: '#2de8c8',
  gold: '#ffc401',
  violet: '#7b68ee',
  grey: '#8a94a6',
  blue: '#3b79be',
  sky: '#70aeff',
  ice: '#a9d2ff',
} as const

export type Tone = keyof typeof TONE

export type GamiCamera = { center: LngLat; zoom: number; pitch: number; bearing: number }

/** An outlined area: a wall `wallM` high along the outline, labelled with `name` and `text`. */
export type GamiPolygon = {
  id: string
  name: string
  text: string
  color: string
  ring: LngLat[]
  wallM: number
  /** Where the name label sits; west keeps it clear of pin labels, which run east. Defaults to the top. */
  labelSide?: 'top' | 'west'
}

export type LegendMark = 'column' | 'disk' | 'arc' | 'heat' | 'pin' | 'area'

export type MapDataLayer = {
  /** The scene group this layer shows and hides. */
  group: string
  title: string
  items: { mark: LegendMark; color: string; label: string; count?: string }[]
  /** A heat layer's ramp, low to high. */
  ramp?: { colors: string[]; low: string; high: string }
}

export type PartId = 'motor' | 'gimbal' | 'inu'

type CardBase = {
  id: string
  title: string
  /** `cell` is one 184px square; `full` spans both columns. */
  span?: 'full' | 'cell'
  /** Height in 184px rows. */
  height?: 1 | 2
  footer?: string
}

export type GamiCard = CardBase &
  (
    | { kind: 'summary'; parts: { text: string; tone?: Tone }[] }
    | {
        kind: 'kpis'
        tiles: { label: string; value: string; unit?: string; note?: string; tone?: Tone; icon?: GamiIcon }[]
        /** The critical-alert treatment: a red glow around the card. */
        glow?: boolean
      }
    | { kind: 'progress'; rows: { label: string; value: string; target: string; pct: number; tone: Tone }[] }
    | {
        kind: 'line'
        x: string[]
        yMax: number
        ySuffix?: string
        series: { name: string; tone: Tone; points: (number | null)[]; faded?: boolean }[]
        /** A dashed reference line, e.g. the 2030 goal. */
        goal?: { value: number; label: string }
      }
    | { kind: 'vbars'; bars: { label: string; value: number; display?: string; tone: Tone }[]; unit?: string }
    | { kind: 'hbars'; bars: { label: string; value: number; display: string; tone: Tone }[] }
    | { kind: 'stacked'; legend: { name: string; tone: Tone }[]; bars: { label: string; parts: number[] }[] }
    | { kind: 'grouped'; legend: { name: string; color: string }[]; groups: { label: string; values: number[] }[] }
    | { kind: 'donut'; total: string; totalLabel: string; slices: { name: string; value: number; tone: Tone }[] }
    | {
        kind: 'table'
        columns: string[]
        rows: { cells: string[]; tone?: Tone; highlight?: boolean }[]
        /** Which column carries the status pill. */
        pillColumn?: number
      }
    | { kind: 'range'; min: number; max: number; ticks: number[]; rows: { label: string; from: number; to: number; tone: Tone }[] }
    | { kind: 'countdown'; target: string }
    | { kind: 'part'; part: PartId }
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
  tone: Tone
  specs: [string, string][]
  /** The deep dive's assets. */
  stock: number[]
  exposure: { label: string; value: number; display: string }[]
  alternative: { supplier: string; city: string; capacity: string; leadTime: string; cost: string }
}
