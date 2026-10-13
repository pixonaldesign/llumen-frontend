/**
 * Demo-only data for the Story select-mode prompts: the Al Mussafah focus region and the
 * school filter applied to a dragged map area.
 */
import { EMISSIONS_LINE, GROUNDWATER_LINE, warpPath } from './StoryCharts'
import { COLUMN_MAX_HEIGHT_M, type StorySceneCamera } from './storyDemoScenes'
import type { ChartCardId } from './storyKpi'
import type { StoryLocation } from './storyAnnotations'

export type StoryMapRegion = {
  id: string
  /** The place the region's legend and summary talk about. */
  label: string
  camera: StorySceneCamera
  /** Column footprint; larger regions use wider columns so they still read at their zoom. */
  columnRadiusM?: number
  columnRamp: [number, string][]
  columns: [number, number, number][]
  junctions: [number, number, number][]
}

/** Per-feature scale factors (1 = unchanged) for an area filter on the map. */
export type StoryAreaEffect = {
  polygon: [number, number][]
  columns: number[]
  junctions: number[]
  regionColumns: number[]
  regionJunctions: number[]
}

/** Everything select-mode prompts changed in the story, so a saved conversation can replay it. */
export type StoryAiSnapshot = {
  cards: ChartCardId[] | null
  region: boolean
  areaEffect: StoryAreaEffect | null
  filterLabels: Record<string, string>
  /** Chart cards re-scoped to the 2024–2025 period; the map is untouched. */
  periodCards?: ChartCardId[]
  /** Top-10 schools annotated on the map, from the data of this slide (inside `location` when set). */
  annotation?: { slide: number; location?: StoryLocation; kind?: 'markers' }
  /** Raw map camera to fly back to (zoom includes the map's zoom offset). */
  camera?: StorySceneCamera
}

/** A map screenshot taken once a prompt's changes finished animating. */
export type StoryMapCapture = {
  image: string
  camera: StorySceneCamera
}

export type AreaFilterStats = {
  columns: number
  junctions: number
  valueBefore: number
  valueAfter: number
  loadBefore: number
  loadAfter: number
  busyBefore: number
  busyAfter: number
  resilient: number
  bins: string[]
  binsBefore: number[]
  binsAfter: number[]
}

export const MUSSAFAH_LABEL = 'Al Mussafah'
export const MUSSAFAH_PERIOD = '2023–2024'

export const AREA_FILTER_LABELS = {
  type: 'Public',
  gender: 'Girls',
  level: 'Cycle 2',
} as const

export const AREA_PROMPT =
  'What would happen to the columns and disks in this area if we filter to one school type (Public), one gender (Girls) and one school level (Cycle 2)?'

export function mussafahPrompt(labels: string[]) {
  const list =
    labels.length === 0
      ? 'these components'
      : labels.length === 1
        ? labels[0]
        : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
  return `Show ${list} data from 2023 to 2024, and focus the map data on the ${MUSSAFAH_LABEL} area.`
}

const KM_PER_DEG_LNG = 101.3
const KM_PER_DEG_LAT = 110.8
const BUSY_RADIUS_M = 340

function hash(index: number, seed: number) {
  const s = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function clampY(y: number) {
  return Math.max(2, Math.min(98, y))
}

const MUSSAFAH_CENTER: [number, number] = [54.516, 24.346]
/** Mussafah's street grid runs about 32° off east–west. */
const GRID_ANGLE = (32 * Math.PI) / 180

function gridPoint(u: number, v: number): [number, number] {
  const dx = u * Math.cos(GRID_ANGLE) - v * Math.sin(GRID_ANGLE)
  const dy = u * Math.sin(GRID_ANGLE) + v * Math.cos(GRID_ANGLE)
  return [MUSSAFAH_CENTER[0] + dx / KM_PER_DEG_LNG, MUSSAFAH_CENTER[1] + dy / KM_PER_DEG_LAT]
}

const HOTSPOT_UV: [number, number] = [1.2, 0.3]

function mussafahColumns() {
  const columns: [number, number, number][] = []
  let index = 0
  for (let i = -7; i <= 7; i += 1) {
    for (let j = -4; j <= 4; j += 1) {
      index += 1
      if (hash(index, 51) < 0.42) continue
      const u = i * 0.4 + (hash(index, 52) - 0.5) * 0.16
      const v = j * 0.4 + (hash(index, 53) - 0.5) * 0.16
      const corridor = Math.exp(-(v * v) / (2 * 0.65 * 0.65))
      const hot = Math.exp(-((u - HOTSPOT_UV[0]) ** 2 + (v - HOTSPOT_UV[1]) ** 2) / (2 * 0.9 * 0.9))
      const height =
        200 + 520 * hash(index, 54) + 2600 * (0.6 * corridor + 0.55 * hot) * (0.45 + 0.55 * hash(index, 55))
      const [lng, lat] = gridPoint(u, v)
      columns.push([lng, lat, Math.min(COLUMN_MAX_HEIGHT_M, height)])
    }
  }
  return columns
}

function mussafahJunctions() {
  const junctions: [number, number, number][] = []
  let index = 0
  for (let i = -4; i <= 4; i += 1) {
    for (let j = -3; j <= 3; j += 1) {
      index += 1
      if (hash(index, 61) < 0.12) continue
      const u = i * 0.62 + 0.2
      const v = j * 0.52 + 0.2
      const corridor = Math.exp(-(v * v) / (2 * 0.8 * 0.8))
      const [lng, lat] = gridPoint(u, v)
      junctions.push([lng, lat, 120 + 170 * hash(index, 62) + 190 * corridor])
    }
  }
  return junctions
}

export const MUSSAFAH_MAX_HEIGHT_M = 3000

export const MUSSAFAH_REGION: StoryMapRegion = {
  id: 'mussafah',
  label: MUSSAFAH_LABEL,
  camera: { center: [54.516, 24.343], zoom: 12.75, pitch: 58, bearing: -24 },
  columnRamp: [
    [150, '#2c18b4'],
    [450, '#3526d8'],
    [800, '#3552ea'],
    [1400, '#2f8ef0'],
    [2200, '#22a6e6'],
    [3000, '#34c8f8'],
  ],
  columns: mussafahColumns(),
  junctions: mussafahJunctions(),
}

function along(lng: number, lat: number) {
  const dx = (lng - MUSSAFAH_CENTER[0]) * KM_PER_DEG_LNG
  const dy = (lat - MUSSAFAH_CENTER[1]) * KM_PER_DEG_LAT
  return Math.max(-1, Math.min(1, (dx * Math.cos(GRID_ANGLE) + dy * Math.sin(GRID_ANGLE)) / 2.8))
}

/** Column heights for a point of the slide's timeline loop. */
export function regionColumnHeights(region: StoryMapRegion, phase: number) {
  const a = Math.sin(2 * Math.PI * phase)
  const b = Math.sin(4 * Math.PI * phase)
  return region.columns.map(([lng, lat, height], index) => {
    const scale = 1 + 0.45 * a * along(lng, lat) + 0.2 * b * (hash(index, 71) * 2 - 1)
    return Math.max(80, Math.min(COLUMN_MAX_HEIGHT_M, height * scale))
  })
}

export function regionJunctionRadii(region: StoryMapRegion, phase: number) {
  const a = Math.sin(2 * Math.PI * phase)
  return region.junctions.map(([lng, lat, radius], index) =>
    Math.max(radius * 0.3, radius * (1 + 0.3 * a * along(lng, lat) + 0.1 * (hash(index, 72) * 2 - 1))),
  )
}

export function busyJunctionCount(radii: number[]) {
  return radii.filter((radius) => radius >= BUSY_RADIUS_M).length
}

export const MUSSAFAH_BUSY = busyJunctionCount(MUSSAFAH_REGION.junctions.map(([, , radius]) => radius))

/** Over-capacity junctions in a region; generated regions keep Mussafah's share. */
export function regionBusyJunctions(region: StoryMapRegion) {
  if (region === MUSSAFAH_REGION) return MUSSAFAH_BUSY
  return Math.round((region.junctions.length * MUSSAFAH_BUSY) / MUSSAFAH_REGION.junctions.length)
}

/** Insight numbers for the Mussafah 2023–2024 cards at a point of the timeline loop. */
export function mussafahInsight(phase: number) {
  const a = Math.sin(2 * Math.PI * phase)
  const b = Math.sin(4 * Math.PI * phase)
  return {
    volumeLabels: ['12k', '8k', '4k', '0'],
    volumeLine: warpPath(EMISSIONS_LINE, (x, y) =>
      clampY(y * 0.72 + 12 - 9 * Math.sin((2 * Math.PI * x) / 50) - 10 * a * Math.sin((Math.PI * x) / 100)),
    ),
    load: Math.round(81 + 6 * a + 2 * b),
    loadLine: warpPath(GROUNDWATER_LINE, (x, y) =>
      clampY(50 + (y - 50) * 0.8 - 18 - 8 * a * (x / 100) - 3 * b * Math.sin((2 * Math.PI * x) / 100)),
    ),
  }
}

export const MUSSAFAH_VOLUME_X = ['Jan 23', 'Jul 23', 'Jan 24', 'Jul 24', 'Dec 24']
export const MUSSAFAH_LOAD_X = ['Q1', 'Q2', 'Q3', 'Q4', 'Q1', 'Q2', 'Q3', 'Q4']

export function pointInPolygon([x, y]: [number, number], polygon: [number, number][]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function countInPolygon(points: [number, number, number][], polygon: [number, number][]) {
  return points.filter(([lng, lat]) => pointInPolygon([lng, lat], polygon)).length
}

function columnFactor(index: number, seed: number) {
  return hash(index, seed) < 0.16 ? 0.72 + 0.2 * hash(index, seed + 1) : 0.14 + 0.3 * hash(index, seed + 2)
}

function junctionFactor(index: number, seed: number) {
  return 0.42 + 0.34 * hash(index, seed)
}

const BIN_EDGES = [500, 1000, 1500, 2000, 3000]
const BIN_LABELS = ['<0.5k', '0.5–1k', '1–1.5k', '1.5–2k', '2–3k', '3k+']

function binIndex(height: number) {
  const index = BIN_EDGES.findIndex((edge) => height < edge)
  return index === -1 ? BIN_EDGES.length : index
}

type AreaFilterInput = {
  polygon: [number, number][]
  columns: [number, number, number][]
  junctions: [number, number, number][]
  heights: number[]
  radii: number[]
  regionColumns: [number, number, number][]
  regionJunctions: [number, number, number][]
  regionHeights: number[]
  regionRadii: number[]
  load: number
  /** Height that maps to a value index of 100. */
  maxHeight: number
}

/** Shrinks the columns and disks inside `polygon` as the school filter narrows the population. */
export function areaFilterEffect(input: AreaFilterInput): { effect: StoryAreaEffect; stats: AreaFilterStats } {
  const inside = (point: [number, number, number]) => pointInPolygon([point[0], point[1]], input.polygon)
  const factorsFor = (points: [number, number, number][], factor: (index: number) => number) =>
    points.map((point, index) => (inside(point) ? factor(index) : 1))

  const columns = factorsFor(input.columns, (index) => columnFactor(index, 31))
  const regionColumns = factorsFor(input.regionColumns, (index) => columnFactor(index, 41))
  const junctions = factorsFor(input.junctions, (index) => junctionFactor(index, 33))
  const regionJunctions = factorsFor(input.regionJunctions, (index) => junctionFactor(index, 43))

  const pairsInside = (points: [number, number, number][], values: number[], factors: number[]) =>
    points.flatMap((point, index) => (inside(point) ? [[values[index] ?? point[2], factors[index]] as const] : []))
  const columnPairs = [
    ...pairsInside(input.columns, input.heights, columns),
    ...pairsInside(input.regionColumns, input.regionHeights, regionColumns),
  ]
  const junctionPairs = [
    ...pairsInside(input.junctions, input.radii, junctions),
    ...pairsInside(input.regionJunctions, input.regionRadii, regionJunctions),
  ]

  const valueIndex = (heights: number[]) =>
    heights.length === 0 ? 0 : Math.round((heights.reduce((sum, h) => sum + h, 0) / heights.length / input.maxHeight) * 100)
  const before = columnPairs.map(([height]) => height)
  const after = columnPairs.map(([height, factor]) => height * factor)
  const binsBefore = BIN_LABELS.map(() => 0)
  const binsAfter = BIN_LABELS.map(() => 0)
  for (const height of before) binsBefore[binIndex(height)] += 1
  for (const height of after) binsAfter[binIndex(height)] += 1
  const meanJunctionFactor =
    junctionPairs.length === 0 ? 1 : junctionPairs.reduce((sum, [, factor]) => sum + factor, 0) / junctionPairs.length

  return {
    effect: { polygon: input.polygon, columns, junctions, regionColumns, regionJunctions },
    stats: {
      columns: columnPairs.length,
      junctions: junctionPairs.length,
      valueBefore: valueIndex(before),
      valueAfter: valueIndex(after),
      loadBefore: input.load,
      loadAfter: Math.round(input.load * meanJunctionFactor),
      busyBefore: busyJunctionCount(junctionPairs.map(([radius]) => radius)),
      busyAfter: busyJunctionCount(junctionPairs.map(([radius, factor]) => radius * factor)),
      resilient: columnPairs.filter(([, factor]) => factor >= 0.7).length,
      bins: BIN_LABELS,
      binsBefore,
      binsAfter,
    },
  }
}
