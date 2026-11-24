/**
 * The Downtown Dubai flood alert: Map 3D's cloudburst (the 16 April 2024 storm, time-lapsed) run to
 * 4 PM on its 4 m Downtown grid, baked to depth images by `scripts/bake-downtown-flood.py`. The alert
 * opens on the unmitigated storm; each solution reruns the same storm with its fix and is compared
 * against it.
 */
import type { LngLat } from '../realEstate/estateGeo'
import {
  EMPTY_SCENE,
  type EstateLabel,
  type EstateLine,
  type EstateMapScene,
  type EstateModel,
  type EstatePoint,
} from '../realEstate/estateMapLayers'
import type { EstateAskView, EstateCamera, Horizon, MapDataLayer } from '../realEstate/estateTypes'
import { circle } from './dmGeo'
import { HORIZON_COLOR, LEVEL } from './dmShared'
import { FLOOD_BAKE } from './floodBake'

type Run = keyof typeof FLOOD_BAKE.scenarios
type Hotspot = keyof typeof FLOOD_BAKE.hotspots

const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/llumen-assets/flood`
const { west, east, south, north } = FLOOD_BAKE.bounds
const CORNERS: [LngLat, LngLat, LngLat, LngLat] = [
  [west, north],
  [east, north],
  [east, south],
  [west, south],
]

const RUN_OF: Record<Horizon, Run> = { immediate: 'pumps', intermediate: 'drains', long: 'tunnel' }

export const FLOOD_RAMP = ['#7ce2ff', '#28a0ff', '#2854e6', '#4628be']

const at = (spot: Hotspot) => FLOOD_BAKE.hotspots[spot] as unknown as LngLat
const depth = (run: Run, spot: Hotspot) => FLOOD_BAKE.scenarios[run].hotspots[spot]

/** Depth as the labels read it: centimetres under half a metre, else metres. */
export const depthText = (m: number) => (m < 0.05 ? 'Clear' : m < 0.5 ? `${Math.round(m * 100)} cm` : `${m.toFixed(1)} m`)

const depthColor = (m: number) => (m >= 0.3 ? LEVEL.critical : m >= 0.1 ? LEVEL.watch : LEVEL.ok)

/** The roads the alert names, worst first. */
const ROADS: { spot: Hotspot; title: string }[] = [
  { spot: 'financialCentre', title: 'Financial Centre Rd interchange' },
  { spot: 'alKhail', title: 'Al Khail Rd · Business Bay' },
  { spot: 'burjKhalifaMetro', title: 'Sheikh Zayed Rd · Burj Khalifa metro' },
]

const roadLabels = (run: Run): EstateLabel[] =>
  ROADS.map(({ spot, title }) => {
    const m = depth(run, spot)
    return {
      id: `road-${spot}`,
      at: at(spot),
      heightM: 40,
      color: depthColor(m),
      title,
      text: depthText(m),
      rows: [['Water at 4 PM', depthText(m)]],
      group: 'roads',
    }
  })

const CAMERA: EstateCamera = { center: [55.2765, 25.1925], zoom: 14.2, pitch: 50, bearing: -16 }

/** Where the storage tunnel lets out: the Business Bay bank below Burj Khalifa. */
const OUTFALL: LngLat = [55.27063, 25.18557]

/** The recorded storm replayed as today's forecast: from midnight to 4 PM today. */
const END = new Date(new Date().setHours(FLOOD_BAKE.hours, 0, 0, 0))

const packs = (run: Run) =>
  Array.from({ length: FLOOD_BAKE.scenarios[run].packs }, (_, index) => `${BASE}/downtown-${run}-${String(index).padStart(2, '0')}.webp`)

const scene = (run: Run, parts: Partial<EstateMapScene> = {}): EstateMapScene => ({
  ...EMPTY_SCENE,
  ...parts,
  labels: [...roadLabels(run), ...(parts.labels ?? [])],
  water: {
    packs: packs(run),
    frames: FLOOD_BAKE.scenarios[run].frames,
    framesPerHour: FLOOD_BAKE.framesPerHour,
    depthMaxM: FLOOD_BAKE.depthMaxM,
    corners: CORNERS,
    opacity: 0.95,
    group: 'flood',
  },
})

/** Every depth image the flood views play, to fetch ahead of the player. */
export const FLOOD_PACKS = (Object.keys(FLOOD_BAKE.scenarios) as Run[]).flatMap(packs)

const LAYER = {
  flood: {
    group: 'flood',
    title: 'Modelled flood depth',
    mark: 'area',
    color: { ramp: FLOOD_RAMP, low: '10 cm', high: '1.5 m+' },
  },
  roads: (run: Run): MapDataLayer => ({
    group: 'roads',
    title: 'Roads to watch',
    mark: 'point',
    color: { items: ROADS.map(({ spot, title }) => ({ label: title, color: depthColor(depth(run, spot)), count: depthText(depth(run, spot)) })) },
  }),
} satisfies Record<string, MapDataLayer | ((run: Run) => MapDataLayer)>

const pumpPoints = (): EstatePoint[] =>
  FLOOD_BAKE.pumps.map((pump, index) => ({
    id: `pump-${index}`,
    at: pump as unknown as LngLat,
    color: HORIZON_COLOR.immediate,
    radius: 8,
    group: 'actions',
    tip: { title: 'Mobile pump unit', rows: [['Capacity', '2.5 m³/s']] },
  }))

const TRUCK_URL = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/llumen-assets/models/truck.glb`
/** Each pump truck's heading, so the four don't park in step. */
const TRUCK_BEARINGS = [64, 152, 28, 116]

/** A pump truck parked on each pump. */
const pumpTrucks = (): EstateModel[] =>
  FLOOD_BAKE.pumps.map((pump, index) => ({
    id: `pump-truck-${index}`,
    at: pump as unknown as LngLat,
    url: TRUCK_URL,
    scale: 28,
    bearing: TRUCK_BEARINGS[index % TRUCK_BEARINGS.length],
    color: HORIZON_COLOR.immediate,
    group: 'actions',
  }))

const drainAreas = () =>
  (Object.keys(FLOOD_BAKE.hotspots) as Hotspot[]).map((spot) => ({
    id: `drain-${spot}`,
    ring: circle(at(spot), 420, 24),
    color: HORIZON_COLOR.intermediate,
    opacity: 0,
    outlineWidth: 2,
    dashed: true,
    group: 'actions',
    tip: { title: 'Drain upgrade', rows: [['Adds', '12 mm/h capacity']] as [string, string][] },
  }))

const TUNNEL_BRANCHES: [Hotspot, LngLat[]][] = [
  ['financialCentre', [[55.2808, 25.1958], [55.2752, 25.1905]]],
  ['boulevard', [[55.2716, 25.1922]]],
  ['burjKhalifaMetro', [[55.2672, 25.1955], [55.2688, 25.1895]]],
  ['alKhail', [[55.2842, 25.1823], [55.2765, 25.1838]]],
  ['alWasl', [[55.2602, 25.1902], [55.2652, 25.1868]]],
]

const tunnelLines = (): EstateLine[] =>
  TUNNEL_BRANCHES.map(([spot, via]) => ({
    id: `tunnel-${spot}`,
    path: [at(spot), ...via, OUTFALL],
    color: HORIZON_COLOR.long,
    width: 4,
    flow: true,
    group: 'actions',
    tip: { title: 'Storage tunnel', rows: [['Lets out to', 'Business Bay']] },
  }))

const tunnelPoints = (): EstatePoint[] => [
  ...(Object.keys(FLOOD_BAKE.hotspots) as Hotspot[]).map((spot) => ({
    id: `intake-${spot}`,
    at: at(spot),
    color: HORIZON_COLOR.long,
    radius: 7,
    group: 'actions',
    tip: { title: 'Tunnel intake', rows: [['Capacity', '8 m³/s']] as [string, string][] },
  })),
  { id: 'outfall', at: OUTFALL, color: HORIZON_COLOR.long, radius: 9, group: 'actions', tip: { title: 'Outfall to Business Bay' } },
]

const actionsLayer = (horizon: Horizon, label: string): MapDataLayer => ({
  group: 'actions',
  title: 'Response',
  mark: horizon === 'long' ? 'line' : horizon === 'immediate' ? 'point' : 'area',
  color: { items: [{ label, color: HORIZON_COLOR[horizon] }] },
})

const FLOOD_VIEW: EstateAskView = {
  camera: { ...CAMERA, center: [55.27553, 25.1933], zoom: 15.29 },
  scene: scene('before'),
  layers: [LAYER.flood, LAYER.roads('before')],
  player: { end: END },
}

const RESPONSE: Record<Horizon, { label: string; after: string; parts: Partial<EstateMapScene> }> = {
  immediate: { label: 'Mobile pumps', after: 'With mobile pumps', parts: { points: pumpPoints(), models: pumpTrucks() } },
  intermediate: { label: 'Drain upgrades', after: 'With upgraded drains', parts: { areas: drainAreas() } },
  long: { label: 'Storage tunnel', after: 'With the storage tunnel', parts: { lines: tunnelLines(), points: tunnelPoints() } },
}

const solutionView = (horizon: Horizon): EstateAskView => {
  const run = RUN_OF[horizon]
  const { label, after, parts } = RESPONSE[horizon]
  return {
    camera: CAMERA,
    scene: scene(run, parts),
    layers: [actionsLayer(horizon, label), LAYER.flood, LAYER.roads(run)],
    compare: { before: FLOOD_VIEW, labels: ['No action', after] },
    player: { end: END },
  }
}

export const FLOOD_ASK_VIEWS = {
  flood: FLOOD_VIEW,
  'flood-immediate': solutionView('immediate'),
  'flood-intermediate': solutionView('intermediate'),
  'flood-long': solutionView('long'),
} satisfies Record<string, EstateAskView>

const run = (horizon: Horizon | 'before') => FLOOD_BAKE.scenarios[horizon === 'before' ? 'before' : RUN_OF[horizon]]

/** The alert's figures, for its reply and the simulation. */
export const FLOOD_BRIEFING = {
  rainMm: Math.round(FLOOD_BAKE.rainMm),
  peakMmH: 29,
  floodedHa: (horizon: Horizon | 'before') => Math.round(run(horizon).floodedHa),
  worst: (horizon: Horizon | 'before') => depthText(run(horizon).hotspots.financialCentre),
  roads: ROADS.map(({ spot, title }) => ({
    spot,
    title,
    depth: depthText(depth('before', spot)),
    color: depthColor(depth('before', spot)),
    /** Water on the road at each hour from midnight to 4 PM. */
    byHour: FLOOD_BAKE.scenarios.before.hotspotsByHour[spot] as readonly number[],
  })),
  /** Rain fallen since midnight, at each hour to 4 PM. */
  rainByHour: FLOOD_BAKE.rainByHour as readonly number[],
}
