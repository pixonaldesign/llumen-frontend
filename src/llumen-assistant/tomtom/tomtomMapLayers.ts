/**
 * The TomTom demo's map layers, shared by the Briefing backdrop, the story and the ask stage: the night
 * Abu Dhabi basemap with 3D fences around drive-time catchments, traffic flowing along the arterials,
 * disks under each site's trade area, and pins for candidate sites, current stations and rivals. Towers
 * and heat from the Standard style's buildings stay available. Every element belongs to a `group`, which
 * the Map Data panel can hide.
 */
import mapboxgl from 'mapbox-gl'
import type { LngLat } from './tomtomGeo'
import './tomtomMap.css'

export const TOMTOM_MAP_STYLE = 'mapbox://styles/pixonal/cmu15yibh003r01r16sdc7t05'

const BASEMAP = 'basemap'
const BUILDINGS = { featuresetId: 'buildings', importId: BASEMAP }

/** A basemap building, as feature state addresses it: the featureset goes in `target`, not beside `id`. */
const building = (id: number) => ({ id, target: BUILDINGS }) as unknown as mapboxgl.TargetFeature

/** What a hover tooltip reads. */
export type TomtomTip = { title: string; rows?: [string, string][] }

export type TomtomTower = {
  id: string
  featureId: number
  at: LngLat
  heightM: number
  color: string
  state: 'select' | 'highlight'
  /**
   * The basemap building's outline, a little outside it: the tower is then painted as its own extrusion
   * in `color`, rising as the scene grows, and leaves the basemap's two building states alone.
   */
  footprint?: LngLat[]
  /** Whether its roof carries a label; its hover tooltip shows either way. */
  label?: boolean
  title: string
  text: string
  tip: TomtomTip
  group: string
}

/** A translucent wall standing on `ring`, a drive-time catchment's edge. */
export type TomtomFence = { id: string; ring: LngLat[]; color: string; heightM: number; group: string }

/** Traffic along a street, running from the first point to the last; `weight` (0–1) widens and brightens it. */
export type TomtomFlow = { id: string; path: LngLat[]; color: string; weight: number; group: string }

/** A disk on the ground: a site's trade area. */
export type TomtomDisk = { id: string; at: LngLat; radiusM: number; color: string; group: string }

/**
 * A place on the map: a candidate `site` pin (numbered by `rank`), a current `station` pin, or a `rival`
 * dot. `label` adds its name card above it.
 */
export type TomtomPin = {
  id: string
  at: LngLat
  color: string
  kind: 'site' | 'station' | 'rival'
  rank?: number
  label?: boolean
  title: string
  text: string
  tip: TomtomTip
  group: string
}

const painted = (tower: TomtomTower) => tower.footprint !== undefined
/** Clears the basemap roof the painted extrusion caps. */
const PAINT_TOP_M = 1.5

export type TomtomHeatPoint = { at: LngLat; weight: number; group: string }

export type TomtomMapScene = {
  towers: TomtomTower[]
  heat: TomtomHeatPoint[]
  heatRadiusM: number
  /** Low to high density. */
  heatRamp: string[]
  fences?: TomtomFence[]
  flows?: TomtomFlow[]
  disks?: TomtomDisk[]
  pins?: TomtomPin[]
}

export const EMPTY_SCENE: TomtomMapScene = { towers: [], heat: [], heatRadiusM: 220, heatRamp: ['#5a2fc7', '#f6f2ff'] }

const NO_GROUPS: ReadonlySet<string> = new Set()

/** Web-mercator meters per pixel at zoom 0 for 512px tiles, at Abu Dhabi's latitude. */
const METERS_PER_PX_Z0 = (40075016.686 / 512) * Math.cos((24.47 * Math.PI) / 180)

function metersToPixels(meters: mapboxgl.ExpressionSpecification | number): mapboxgl.ExpressionSpecification {
  const base: mapboxgl.ExpressionSpecification = ['/', meters, METERS_PER_PX_Z0]
  return ['interpolate', ['exponential', 2], ['zoom'], 0, base, 22, ['*', base, 2 ** 22]]
}

const heatId = (prefix: string) => `${prefix}-heat`
const paintId = (prefix: string) => `${prefix}-paint`
const fenceId = (prefix: string) => `${prefix}-fence`
const floorId = (prefix: string) => `${prefix}-fence-floor`
const flowId = (prefix: string) => `${prefix}-flow`
const diskId = (prefix: string) => `${prefix}-disk`

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

function heatColor(ramp: string[]): mapboxgl.ExpressionSpecification {
  const stops: (number | string)[] = [0, 'rgba(0,0,0,0)']
  ramp.forEach((color, index) => {
    stops.push(0.12 + (0.88 * index) / Math.max(1, ramp.length - 1), color)
  })
  return ['interpolate', ['linear'], ['heatmap-density'], ...stops] as mapboxgl.ExpressionSpecification
}

function addSource(map: mapboxgl.Map, id: string, lineMetrics = false) {
  if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY, lineMetrics })
}

/** The site layers under the towers: catchment floors and disks, then traffic, then the fences standing over them. */
function mountSiteLayers(map: mapboxgl.Map, prefix: string) {
  const floor = floorId(prefix)
  if (map.getLayer(floor)) return
  addSource(map, floor)
  map.addLayer({
    id: floor,
    type: 'fill',
    source: floor,
    slot: 'middle',
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'opacity'], 'fill-emissive-strength': 1 },
  })
  map.addLayer({
    id: `${floor}-edge`,
    type: 'line',
    source: floor,
    slot: 'middle',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1.6,
      'line-opacity': ['*', ['get', 'opacity'], 5],
      'line-emissive-strength': 1,
    },
  })
  const disk = diskId(prefix)
  addSource(map, disk)
  map.addLayer({
    id: `${disk}-halo`,
    type: 'circle',
    source: disk,
    slot: 'middle',
    paint: {
      'circle-radius': metersToPixels(['*', ['get', 'radius'], 1.25]),
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.16,
      'circle-blur': 0.9,
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
      'circle-emissive-strength': 1,
    },
  })
  map.addLayer({
    id: disk,
    type: 'circle',
    source: disk,
    slot: 'middle',
    paint: {
      'circle-radius': metersToPixels(['get', 'radius']),
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.16,
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 1.2,
      'circle-stroke-opacity': 0.7,
      'circle-pitch-alignment': 'map',
      'circle-pitch-scale': 'map',
      'circle-emissive-strength': 1,
    },
  })
  const flow = flowId(prefix)
  addSource(map, flow, true)
  map.addLayer({
    id: `${flow}-glow`,
    type: 'line',
    source: flow,
    slot: 'middle',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, ['*', ['get', 'width'], 2.2], 16, ['*', ['get', 'width'], 5]],
      'line-blur': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 9],
      'line-opacity': 0.42,
      'line-emissive-strength': 1,
      'line-trim-offset': [0, 1],
    },
  })
  map.addLayer({
    id: `${flow}-base`,
    type: 'line',
    source: flow,
    slot: 'middle',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, ['get', 'width'], 16, ['*', ['get', 'width'], 2.4]],
      'line-opacity': 0.9,
      'line-emissive-strength': 1,
      'line-trim-offset': [0, 1],
    },
  })
  map.addLayer({
    id: flow,
    type: 'line',
    source: flow,
    slot: 'middle',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-width': ['interpolate', ['linear'], ['zoom'], 12, ['*', ['get', 'width'], 0.9], 16, ['*', ['get', 'width'], 2]],
      'line-gradient': cometGradient(0),
      'line-emissive-strength': 1,
      'line-trim-offset': [0, 1],
    },
  })
  const fence = fenceId(prefix)
  addSource(map, fence)
  map.addLayer({
    id: fence,
    type: 'fill-extrusion',
    source: fence,
    slot: 'middle',
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.5,
      'fill-extrusion-emissive-strength': 1,
      'fill-extrusion-vertical-gradient': true,
    },
  })
}

/** Paints the basemap's two building states in the towers' colours, and adds the heat and site layers. */
export function mountTomtomLayers(map: mapboxgl.Map, prefix: string, towers: TomtomTower[]) {
  for (const tower of towers) {
    if (painted(tower)) continue
    map.setConfigProperty(BASEMAP, tower.state === 'select' ? 'colorBuildingSelect' : 'colorBuildingHighlight', tower.color)
  }
  mountSiteLayers(map, prefix)
  startFlows(map, prefix)
  const paint = paintId(prefix)
  if (!map.getSource(paint)) {
    map.addSource(paint, { type: 'geojson', data: EMPTY })
    map.addLayer({
      id: paint,
      type: 'fill-extrusion',
      source: paint,
      slot: 'middle',
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.96,
        'fill-extrusion-emissive-strength': 0.8,
        'fill-extrusion-vertical-gradient': true,
      },
    })
  }
  const id = heatId(prefix)
  if (map.getSource(id)) return
  map.addSource(id, { type: 'geojson', data: EMPTY })
  map.addLayer({
    id,
    type: 'heatmap',
    source: id,
    slot: 'middle',
    paint: {
      'heatmap-weight': ['get', 'weight'],
      'heatmap-intensity': 1,
      'heatmap-radius': metersToPixels(['get', 'radius']),
      'heatmap-opacity': 0.55,
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 1, '#fff'],
    },
  })
}

/* —— Traffic: pulses of light running along each street —— */

const FLOW_PERIOD_MS = 2600
const FLOW_PULSES = 5
/** A pulse's tail, as a share of the gap between pulses. */
const FLOW_TAIL = 0.55
const FLOW_FRAME_MS = 33
const PULSE_RGB = '255, 240, 228'

/** Light pulses along a line (by `line-progress`), shifted on by `t` (0–1) of the gap between them. */
function cometGradient(t: number): mapboxgl.ExpressionSpecification {
  const heads = Array.from({ length: FLOW_PULSES + 2 }, (_, k) => (k - 1 + t) / FLOW_PULSES)
  const alpha = (p: number) =>
    heads.reduce((best, head) => {
      const start = head - FLOW_TAIL / FLOW_PULSES
      return p >= start && p <= head ? Math.max(best, ((p - start) / (head - start)) ** 1.6) : best
    }, 0)
  const marks = heads
    .flatMap((head) => [head - FLOW_TAIL / FLOW_PULSES, head, head + 0.006])
    .filter((p) => p > 0.0005 && p < 0.9995)
    .sort((a, b) => a - b)
  const stops: number[] = [0]
  for (const p of marks) if (p - stops[stops.length - 1] > 0.0004) stops.push(p)
  stops.push(1)
  const color = (p: number) => `rgba(${PULSE_RGB}, ${Math.min(1, alpha(p) * 0.95).toFixed(3)})`
  return ['interpolate', ['linear'], ['line-progress'], ...stops.flatMap((p) => [p, color(p)])] as mapboxgl.ExpressionSpecification
}

const flowLoops = new WeakMap<mapboxgl.Map, Set<string>>()

/** Keeps the pulses moving for as long as the map lives; frozen under reduced motion. */
function startFlows(map: mapboxgl.Map, prefix: string) {
  let prefixes = flowLoops.get(map)
  if (!prefixes) {
    prefixes = new Set()
    flowLoops.set(map, prefixes)
  }
  if (prefixes.has(prefix)) return
  prefixes.add(prefix)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  let frame = 0
  let last = 0
  // Each tick restyles the map, and a map that is restyled every frame never fires `load`; so hold
  // still until it has loaded (or gone idle, after a later style switch).
  let live = false
  const go = () => {
    live = true
    map.off('load', go)
    map.off('idle', go)
  }
  map.on('load', go)
  map.on('idle', go)
  const id = flowId(prefix)
  const tick = (now: number) => {
    frame = window.requestAnimationFrame(tick)
    if (!live || now - last < FLOW_FRAME_MS || document.hidden) return
    last = now
    const source = map.getSource(id) as mapboxgl.GeoJSONSource | undefined
    if (!map.getLayer(id) || !source) return
    map.setPaintProperty(id, 'line-gradient', cometGradient((now % FLOW_PERIOD_MS) / FLOW_PERIOD_MS))
  }
  frame = window.requestAnimationFrame(tick)
  map.once('remove', () => window.cancelAnimationFrame(frame))
}

/* —— Towers —— */

/** Per map: the feature each tower lights (its `featureId`, or the building found standing at `at`), and whether it is lit. */
const towerState = new WeakMap<mapboxgl.Map, Map<string, { featureId: number; lit: boolean }>>()

function stateOf(map: mapboxgl.Map) {
  let states = towerState.get(map)
  if (!states) {
    states = new Map()
    towerState.set(map, states)
  }
  return states
}

/** A new style drops the feature states; the towers light again on the next draw. */
export function forgetTowers(map: mapboxgl.Map) {
  towerState.delete(map)
}

function lightTower(map: mapboxgl.Map, tower: TomtomTower, lit: boolean) {
  const states = stateOf(map)
  const current = states.get(tower.id) ?? { featureId: tower.featureId, lit: false }
  if (current.lit === lit && states.has(tower.id)) return
  map.setFeatureState(building(current.featureId), { [tower.state]: lit })
  states.set(tower.id, { ...current, lit })
}

/**
 * Once the towers are on screen, checks each lit building is the one standing at its point; if the
 * basemap's ids have moved, lights the building found there instead. A state set before the building
 * tiles loaded is dropped, so lit towers that lost theirs are lit again.
 */
export function resolveTowers(map: mapboxgl.Map, towers: TomtomTower[]) {
  const states = stateOf(map)
  for (const tower of towers) {
    if (painted(tower)) continue
    const lit = states.get(tower.id)
    if (lit?.lit) {
      const target = building(lit.featureId)
      if (!map.getFeatureState(target)?.[tower.state]) map.setFeatureState(target, { [tower.state]: true })
    }
    const point = map.project(tower.at)
    const { clientWidth: w, clientHeight: h } = map.getCanvas()
    if (point.x < 0 || point.y < 0 || point.x > w || point.y > h) continue
    const found = map
      .queryRenderedFeatures(
        [
          [point.x - 4, point.y - 4],
          [point.x + 4, point.y + 4],
        ],
        { target: BUILDINGS },
      )
      .sort((a, b) => Number(b.properties?.height ?? 0) - Number(a.properties?.height ?? 0))[0]
    const current = states.get(tower.id)
    if (!found || found.id === undefined || !current || found.id === current.featureId) continue
    if (current.lit) {
      map.setFeatureState(building(current.featureId), { [tower.state]: false })
      map.setFeatureState(found, { [tower.state]: true })
    }
    states.set(tower.id, { ...current, featureId: Number(found.id) })
  }
}

/** The tower under `point`, if one of `towers` is. */
export function towerAt(
  map: mapboxgl.Map,
  point: mapboxgl.PointLike,
  towers: TomtomTower[],
  prefix: string,
): TomtomTower | null {
  if (!towers.length) return null
  if (map.getLayer(paintId(prefix))) {
    const hit = map.queryRenderedFeatures(point, { layers: [paintId(prefix)] })[0]?.properties?.tower
    const found = hit ? towers.find((tower) => tower.id === hit) : undefined
    if (found) return found
  }
  const states = stateOf(map)
  const ids = map.queryRenderedFeatures(point, { target: BUILDINGS }).map((feature) => Number(feature.id))
  return towers.find((tower) => ids.includes(states.get(tower.id)?.featureId ?? tower.featureId)) ?? null
}

/* —— Drawing —— */

/** Thin quads along `ring`, each `widthM` thick: the fence's wall, extruded upward. */
function wallSegments(ring: LngLat[], widthM: number): LngLat[][] {
  const quads: LngLat[][] = []
  const kLng = 111320 * Math.cos((24.47 * Math.PI) / 180)
  const kLat = 110800
  for (let index = 1; index < ring.length; index += 1) {
    const [x1, y1] = ring[index - 1]
    const [x2, y2] = ring[index]
    const east = (x2 - x1) * kLng
    const north = (y2 - y1) * kLat
    const norm = Math.hypot(east, north) || 1
    const ox = ((north / norm) * widthM) / 2 / kLng
    const oy = ((-east / norm) * widthM) / 2 / kLat
    quads.push([
      [x1 - ox, y1 - oy],
      [x2 - ox, y2 - oy],
      [x2 + ox, y2 + oy],
      [x1 + ox, y1 + oy],
      [x1 - ox, y1 - oy],
    ])
  }
  return quads
}

const wallCache = new WeakMap<TomtomFence, LngLat[][]>()

function fenceWalls(fence: TomtomFence) {
  let walls = wallCache.get(fence)
  if (!walls) {
    walls = wallSegments(fence.ring, 2.4)
    wallCache.set(fence, walls)
  }
  return walls
}

/**
 * Draws `scene` at `grow` (0 hidden, 1 full): the towers light up, the heat fades in, the fences rise,
 * the disks open and the traffic runs out along its streets. Hidden groups are left out.
 */
export function drawTomtomScene(
  map: mapboxgl.Map,
  prefix: string,
  scene: TomtomMapScene,
  grow: number,
  hidden: ReadonlySet<string> = NO_GROUPS,
) {
  const states = stateOf(map)
  for (const [id, state] of states) {
    if (state.lit && !scene.towers.some((tower) => tower.id === id)) {
      map.setFeatureState(building(state.featureId), { select: false, highlight: false })
      states.set(id, { ...state, lit: false })
    }
  }
  for (const tower of scene.towers) {
    if (!painted(tower)) lightTower(map, tower, grow > 0.3 && !hidden.has(tower.group))
  }
  const shown = scene.towers.filter((tower) => painted(tower) && !hidden.has(tower.group))
  const paintSource = map.getSource(paintId(prefix)) as mapboxgl.GeoJSONSource | undefined
  paintSource?.setData({
    type: 'FeatureCollection',
    features: (grow <= 0 ? [] : shown).map((tower) => ({
      type: 'Feature',
      properties: { tower: tower.id, color: tower.color, height: (tower.heightM + PAINT_TOP_M) * grow },
      geometry: { type: 'Polygon', coordinates: [[...tower.footprint!, tower.footprint![0]]] },
    })),
  })
  drawSites(map, prefix, scene, grow, hidden)
  const source = map.getSource(heatId(prefix)) as mapboxgl.GeoJSONSource | undefined
  if (!source) return
  source.setData({
    type: 'FeatureCollection',
    features: (grow <= 0 ? [] : scene.heat.filter((point) => !hidden.has(point.group))).map((point) => ({
      type: 'Feature',
      properties: { weight: point.weight * grow, radius: scene.heatRadiusM },
      geometry: { type: 'Point', coordinates: point.at },
    })),
  })
  map.setPaintProperty(heatId(prefix), 'heatmap-color', heatColor(scene.heatRamp))
}

function drawSites(map: mapboxgl.Map, prefix: string, scene: TomtomMapScene, grow: number, hidden: ReadonlySet<string>) {
  const visible = <T extends { group: string }>(items: T[] | undefined) =>
    grow <= 0 ? [] : (items ?? []).filter((item) => !hidden.has(item.group))
  /** The fences rise a beat after the floors and disks open. */
  const rise = Math.max(0, Math.min(1, (grow - 0.2) / 0.8))
  const fences = visible(scene.fences)
  ;(map.getSource(fenceId(prefix)) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: fences.flatMap((fence) =>
      fenceWalls(fence).map((quad) => ({
        type: 'Feature' as const,
        properties: { color: fence.color, height: fence.heightM * rise },
        geometry: { type: 'Polygon' as const, coordinates: [quad] },
      })),
    ),
  })
  ;(map.getSource(floorId(prefix)) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: fences.map((fence) => ({
      type: 'Feature',
      properties: { color: fence.color, opacity: 0.14 * grow },
      geometry: { type: 'Polygon', coordinates: [fence.ring] },
    })),
  })
  ;(map.getSource(diskId(prefix)) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: visible(scene.disks).map((disk) => ({
      type: 'Feature',
      properties: { color: disk.color, radius: disk.radiusM * Math.min(1, grow * 1.25) },
      geometry: { type: 'Point', coordinates: disk.at },
    })),
  })
  const flows = visible(scene.flows)
  ;(map.getSource(flowId(prefix)) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: flows.map((flow) => ({
      type: 'Feature',
      properties: { color: flow.color, width: 1.6 + 2.6 * flow.weight },
      geometry: { type: 'LineString', coordinates: flow.path },
    })),
  })
  if (map.getLayer(flowId(prefix))) {
    const trim: [number, number] = [Math.min(1, grow), 1]
    for (const id of [`${flowId(prefix)}-glow`, `${flowId(prefix)}-base`, flowId(prefix)]) map.setPaintProperty(id, 'line-trim-offset', trim)
  }
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

/** A tooltip's markup: the title, then label and value rows. */
export function tomtomTipHtml(tip: TomtomTip) {
  const rows = (tip.rows ?? [])
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join('')
  return `<p class="tomtom-tip-title">${escapeHtml(tip.title)}</p>${rows ? `<dl class="tomtom-tip-rows">${rows}</dl>` : ''}`
}

/** Projects world anchors through the map's matrix to screen pixels, or null behind the camera. */
function project(matrix: number[], [x, y, z]: [number, number, number], width: number, height: number) {
  const cx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]
  const cy = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]
  const cw = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15]
  if (cw <= 0) return null
  return { x: ((cx / cw + 1) / 2) * width, y: ((1 - cy / cw) / 2) * height }
}

type LabelEntry = { el: HTMLButtonElement; tower: TomtomTower; anchor: [number, number, number] }

/**
 * Each tower's name and headline on its roof, with the story tooltips' blurred card. A no-op custom
 * layer reads the map's projection every frame, so the labels ride the roofs as the camera moves.
 */
export class TowerLabels {
  private map: mapboxgl.Map
  private entries: LabelEntry[] = []
  private towers: TomtomTower[] = []
  private onPick?: (id: string) => void
  readonly layer: mapboxgl.CustomLayerInterface

  constructor(map: mapboxgl.Map, prefix: string, onPick?: (id: string) => void) {
    this.map = map
    this.onPick = onPick
    this.layer = {
      id: `${prefix}-tower-labels`,
      type: 'custom',
      renderingMode: '3d',
      render: (_gl, matrix) => this.place(matrix),
    }
  }

  /** Adds the projection layer; call again after a style change drops it. */
  mount() {
    if (!this.map.getLayer(this.layer.id)) this.map.addLayer(this.layer)
  }

  sync(towers: TomtomTower[], grow: number, hidden: ReadonlySet<string> = NO_GROUPS, active: string | null = null) {
    if (towers !== this.towers) {
      this.clear()
      this.towers = towers
      const container = this.map.getContainer()
      this.entries = towers.filter((tower) => tower.label !== false).map((tower) => {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'tomtom-label'
        el.style.setProperty('--tower', tower.color)
        el.tabIndex = this.onPick ? 0 : -1
        el.setAttribute('aria-label', `${tower.title}: open details`)
        el.innerHTML = `<i aria-hidden="true"></i><span><b>${escapeHtml(tower.title)}</b><span>${escapeHtml(tower.text)}</span></span>`
        if (this.onPick) el.addEventListener('click', () => this.onPick?.(tower.id))
        else {
          el.dataset.static = 'true'
          el.setAttribute('aria-hidden', 'true')
        }
        container.appendChild(el)
        const { x, y, z } = mapboxgl.MercatorCoordinate.fromLngLat(tower.at, tower.heightM)
        return { el, tower, anchor: [x, y, z] as [number, number, number] }
      })
    }
    for (const entry of this.entries) {
      const off = hidden.has(entry.tower.group)
      entry.el.style.opacity = off ? '0' : String(Math.min(1, Math.max(0, grow * 1.4 - 0.2)))
      entry.el.inert = off || grow < 0.5
      entry.el.dataset.active = entry.tower.id === active ? 'true' : 'false'
    }
    this.map.triggerRepaint()
  }

  private place(matrix: number[]) {
    const canvas = this.map.getCanvas()
    for (const { el, anchor } of this.entries) {
      const at = project(matrix, anchor, canvas.clientWidth, canvas.clientHeight)
      if (!at) {
        el.style.visibility = 'hidden'
        continue
      }
      el.style.visibility = ''
      el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) translate(-50%, calc(-100% - 12px))`
    }
  }

  clear() {
    for (const entry of this.entries) entry.el.remove()
    this.entries = []
    this.towers = []
  }
}

type PinEntry = { el: HTMLElement; pin: TomtomPin; anchor: [number, number, number]; order: number }

/** How a pin introduces itself to whoever is listening: the pin, and its screen point (null when it leaves). */
export type PinHover = (pin: TomtomPin | null, point?: { x: number; y: number }) => void

/**
 * The scene's pins: candidate sites as numbered map pins, current stations as pins with a fuel mark, and
 * rivals as glowing dots, each popping in one after another as the scene grows. Sites with a details
 * panel open it on click; every pin names itself through `onHover`.
 */
export class TomtomPins {
  private map: mapboxgl.Map
  private entries: PinEntry[] = []
  private pins: TomtomPin[] = []
  private onPick?: (id: string) => void
  private onHover?: PinHover
  private pickable?: (id: string) => boolean
  readonly layer: mapboxgl.CustomLayerInterface

  constructor(
    map: mapboxgl.Map,
    prefix: string,
    options: { onPick?: (id: string) => void; pickable?: (id: string) => boolean; onHover?: PinHover } = {},
  ) {
    this.map = map
    this.onPick = options.onPick
    this.onHover = options.onHover
    this.pickable = options.pickable
    this.layer = {
      id: `${prefix}-pins`,
      type: 'custom',
      renderingMode: '3d',
      render: (_gl, matrix) => this.place(matrix),
    }
  }

  mount() {
    if (!this.map.getLayer(this.layer.id)) this.map.addLayer(this.layer)
  }

  private build(pin: TomtomPin, order: number): PinEntry {
    const pick = this.onPick && (this.pickable?.(pin.id) ?? false)
    const el = document.createElement(pick ? 'button' : 'div')
    if (el instanceof HTMLButtonElement) el.type = 'button'
    el.className = 'tomtom-pin'
    el.dataset.kind = pin.kind
    el.style.setProperty('--pin', pin.color)
    if (pick) {
      el.setAttribute('aria-label', `${pin.title}: open details`)
      el.addEventListener('click', () => this.onPick?.(pin.id))
    } else {
      el.dataset.static = 'true'
      el.setAttribute('aria-hidden', 'true')
    }
    const mark =
      pin.kind === 'rival'
        ? '<i class="tomtom-pin-dot" aria-hidden="true"></i>'
        : `<span class="tomtom-pin-head" aria-hidden="true"><span>${pin.rank ?? ''}</span></span>`
    const card = pin.label
      ? `<span class="tomtom-pin-card"><b>${escapeHtml(pin.title)}</b><span>${escapeHtml(pin.text)}</span></span>`
      : ''
    el.innerHTML = mark + card
    if (this.onHover) {
      el.addEventListener('mouseenter', () => {
        const rect = el.getBoundingClientRect()
        const box = this.map.getContainer().getBoundingClientRect()
        const head = el.querySelector('.tomtom-pin-head, .tomtom-pin-dot')?.getBoundingClientRect() ?? rect
        this.onHover?.(pin, { x: head.left + head.width / 2 - box.left, y: head.top - box.top })
      })
      el.addEventListener('mouseleave', () => this.onHover?.(null))
    }
    this.map.getContainer().appendChild(el)
    const { x, y, z } = mapboxgl.MercatorCoordinate.fromLngLat(pin.at, 0)
    return { el, pin, anchor: [x, y, z], order }
  }

  sync(pins: TomtomPin[], grow: number, hidden: ReadonlySet<string> = NO_GROUPS, active: string | null = null) {
    if (pins !== this.pins) {
      this.clear()
      this.pins = pins
      /** Sites first, best first, then stations, then rivals. */
      const rank = (pin: TomtomPin) => (pin.kind === 'site' ? (pin.rank ?? 50) : pin.kind === 'station' ? 100 : 200)
      const ordered = [...pins].sort((a, b) => rank(a) - rank(b))
      this.entries = ordered.map((pin, index) => this.build(pin, index / Math.max(1, ordered.length - 1)))
    }
    for (const entry of this.entries) {
      const off = hidden.has(entry.pin.group)
      const t = Math.max(0, Math.min(1, (grow - 0.15 - entry.order * 0.45) / 0.4))
      entry.el.style.opacity = off ? '0' : String(t)
      entry.el.style.setProperty('--pop', String(off ? 0 : 0.6 + 0.4 * t))
      entry.el.inert = off || grow < 0.5
      entry.el.dataset.active = entry.pin.id === active ? 'true' : 'false'
    }
    this.map.triggerRepaint()
  }

  private place(matrix: number[]) {
    const canvas = this.map.getCanvas()
    for (const { el, anchor } of this.entries) {
      const at = project(matrix, anchor, canvas.clientWidth, canvas.clientHeight)
      if (!at) {
        el.style.visibility = 'hidden'
        continue
      }
      el.style.visibility = ''
      el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`
    }
  }

  clear() {
    for (const entry of this.entries) entry.el.remove()
    this.entries = []
    this.pins = []
  }
}
