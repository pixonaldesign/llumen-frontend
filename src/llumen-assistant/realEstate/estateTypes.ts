import type { SummaryPart } from '../story/StorySummaryText'
import type { LngLat } from './estateGeo'
import type { EstateMapScene } from './estateMapLayers'

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
  /** Diverging · Red → White → Blue */
  diverging: ['#9f1d1d', '#df3f3f', '#f7a0a0', '#f3f4f6', '#cce4fb', '#68b1ee', '#1565c0'],
} as const

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

export type EstateCamera = { center: LngLat; zoom: number; pitch: number; bearing: number }

export type LegendMark = 'tower' | 'heat' | 'area' | 'line' | 'point'

/** The three impact horizons an intervention is weighed on. */
export type Horizon = 'immediate' | 'intermediate' | 'long'

/** A Map Data layer, listed the way the story's Map Data lists its attributes. */
export type MapDataLayer = {
  /** The scene group this layer shows and hides. */
  group: string
  title: string
  mark: LegendMark
  /** Categories by colour, or a low-to-high ramp. */
  color: { items: { label: string; color: string; count?: string }[] } | { ramp: string[]; low?: string; high?: string }
}

type CardBase = {
  id: string
  title: string
  /** `cell` is one 184px square; `full` spans the row. */
  span?: 'full' | 'cell'
  /** Height in 184px rows. */
  height?: 1 | 2
  /** The headline number over a chart, as the story's chart cards show it. */
  kpi?: { value: string; unit?: string }
  /** The chart's colour family; stories assign one per card in turn. */
  tone?: Tone
}

export type EstateCard = CardBase &
  (
    | { kind: 'summary'; parts: SummaryPart[] }
    /** A separator across the row that heads the cards after it: the title centred on a rule. */
    | { kind: 'section' }
    | { kind: 'kpis'; tiles: { label: string; value: string; unit?: string; note?: string }[] }
    | {
        kind: 'cell'
        value: string
        note: string
        /** A sparkline under the note, oldest first. */
        spark?: number[]
        status?: Status
        color?: string
      }
    | { kind: 'progress'; rows: { label: string; value: string; target: string; pct: number; color?: string }[] }
    | {
        kind: 'line'
        x: string[]
        yLabels: string[]
        yMax: number
        /** Dashed series are references (last year, typical), drawn like the story's "Typical". */
        series: { name: string; points: (number | null)[]; dashed?: boolean; color?: string }[]
      }
    | { kind: 'vbars'; bars: { label: string; value: number; display?: string; color?: string }[] }
    | { kind: 'hbars'; bars: { label: string; value: number; display: string; color?: string }[] }
    | { kind: 'split'; total: string; unit: string; parts: { name: string; value: number; display: string }[] }
    | {
        kind: 'grouped'
        legend: string[]
        /** One colour per series; the tone's categorical colours when unset. */
        colors?: string[]
        groups: { label: string; values: number[] }[]
      }
    | { kind: 'donut'; total: string; totalLabel: string; slices: { name: string; value: number; color?: string }[] }
    | {
        kind: 'table'
        columns: string[]
        rows: { cells: string[]; color?: string }[]
        /** Which column carries the row's colour dot. */
        dotColumn?: number
      }
    | { kind: 'note'; text: string }
    /** Label and value pairs in two columns. */
    | { kind: 'specs'; items: [string, string][] }
    /** One selectable decision: the action (the title), the asset it acts on, and what it should buy. */
    | {
        kind: 'intervention'
        code: string
        horizon: Horizon
        asset: string
        benefit: string
      }
    /** The page's what-if controls: one option per scenario, the selected one shown on the cards and map. */
    | { kind: 'scenario'; options: { id: string; label: string; detail: string }[] }
  )

/** A what-if state of a page: its own map and cards (which repeat the page's scenario control). */
export type EstateScenario = { id: string; scene: EstateMapScene; cards: EstateCard[]; layers?: MapDataLayer[] }

export type EstatePage = {
  id: string
  title: string
  /** What this page says, for the page's info popover. */
  finding: string
  camera: EstateCamera
  scene: EstateMapScene
  filters: string[]
  cards: EstateCard[]
  layers: MapDataLayer[]
  /** Sidebar columns the page opens with; 2 when unset. */
  columns?: 2 | 3 | 4
  /** A Policy Lab page: the first scenario shows until another is picked. */
  scenarios?: EstateScenario[]
}

export type EstatePlaceId = 'barsha' | 'facilities' | 'infrastructure'

/** A Briefing place: where its finding's map opens, and what the map shows there. */
export type EstatePlace = { id: EstatePlaceId; camera: EstateCamera; scene: EstateMapScene }

/** What Tell Me More opens on the map: its camera, the scene, and the Map Data that reads it. */
export type EstateAskView = { camera: EstateCamera; scene: EstateMapScene; layers: MapDataLayer[] }

export type EstateStory = {
  id: string
  title: string
  description: string
  /** The Briefing place its first page opens on. */
  place: EstatePlaceId
  pages: [EstatePage, ...EstatePage[]]
}

export type BuildingId = 'dreamscape' | 'opera-crest'

/** A count by category: unit types, nationalities, age groups. */
export type CountRow = { name: string; count: number }

/** One tab of a building's details: its headline figures, a breakdown, demographics and a time series. */
export type BuildingTab = {
  kpis: { label: string; value: string; unit?: string }[]
  breakdown: { title: string; rows: CountRow[] }
  demographics: { title: string; groups: { title: string; bars: { label: string; value: number }[] }[] }
  series: { title: string; unit: string; x: string[]; yLabels: string[]; yMax: number; points: number[] }
}

export type BuildingTabId = 'sales' | 'utilization' | 'ownership' | 'rentals'

/** A tower lit up on the map, and what its details panel reads. */
export type EstateBuilding = {
  id: BuildingId
  name: string
  /** The basemap building it lights up (Mapbox Standard `buildings` featureset). */
  featureId: number
  /** Where the building stands; the feature under it is lit if `featureId` has moved. */
  at: LngLat
  heightM: number
  color: string
  /** Which of the basemap's two building feature-states paints it, each in its own colour. */
  state: 'select' | 'highlight'
  code: string
  use: string
  stage: string
  developer: string
  community: string
  /** For the map label and tooltip. */
  headline: string
  totalValue: { value: string; unit: string; years: string[]; spark: number[] }
  units: number
  unitTypes: CountRow[]
  completion: number
  handover: string
  reports: string[]
  tabs: Record<BuildingTabId, BuildingTab>
}
