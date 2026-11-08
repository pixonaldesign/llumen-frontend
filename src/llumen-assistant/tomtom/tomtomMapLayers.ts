/**
 * The TomTom demo's map layers, shared by the Briefing backdrop, the story and the ask stage: the night
 * Abu Dhabi basemap with 3D fences standing on the arterials, as tall and as red as their traffic is
 * dense, disks under each site's trade area, and pins for candidate sites, current stations and rivals. Towers
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

/**
 * A fence standing on a street's centreline, its height and colour following the traffic: `load` (0–1)
 * is the density at each point of `path`, `heightM` the fence's height at full load, and `ramp` runs
 * from light to heavy traffic. `vph` is the vehicles an hour at no load and at full load, which the
 * tooltip reads.
 */
export type TomtomFence = {
  id: string
  path: LngLat[]
  load: number[]
  heightM: number
  ramp: string[]
  vph: [number, number]
  /** What the tooltip counts, e.g. "vehicles an hour". */
  unit: string
  title: string
  group: string
}

/** A disk on the ground: a site's trade area. */
export type TomtomDisk = { id: string; at: LngLat; radiusM: number; color: string; group: string }

/**
 * A place on the map, a dot in its colour: a candidate `site`, named in a pill outlined in that colour
 * and stacked by `rank`, or a current `station`, named only in its hover `tip`.
 */
export type TomtomPin = {
  id: string
  at: LngLat
  color: string
  kind: 'site' | 'station'
  rank?: number
  title: string
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
const diskId = (prefix: string) => `${prefix}-disk`

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

function heatColor(ramp: string[]): mapboxgl.ExpressionSpecification {
  const stops: (number | string)[] = [0, 'rgba(0,0,0,0)']
  ramp.forEach((color, index) => {
    stops.push(0.12 + (0.88 * index) / Math.max(1, ramp.length - 1), color)
  })
  return ['interpolate', ['linear'], ['heatmap-density'], ...stops] as mapboxgl.ExpressionSpecification
}

function addSource(map: mapboxgl.Map, id: string) {
  if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY })
}

/** The site layers under the towers: the disks on the ground, then the traffic fences standing over them. */
function mountSiteLayers(map: mapboxgl.Map, prefix: string) {
  const disk = diskId(prefix)
  if (map.getLayer(disk)) return
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
      'fill-extrusion-opacity': 0.92,
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

/** Thin quads along `path`, one per stretch between its points, each `widthM` thick: a fence, extruded upward. */
function wallSegments(path: LngLat[], widthM: number): LngLat[][] {
  const quads: LngLat[][] = []
  const kLng = 111320 * Math.cos((24.47 * Math.PI) / 180)
  const kLat = 110800
  for (let index = 1; index < path.length; index += 1) {
    const [x1, y1] = path[index - 1]
    const [x2, y2] = path[index]
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

const FENCE_WIDTH_M = 7

/** `ramp`'s colour at `t` (0–1), blended between its stops. */
function rampColor(ramp: string[], t: number) {
  const x = Math.max(0, Math.min(1, t)) * (ramp.length - 1)
  const index = Math.min(ramp.length - 2, Math.floor(x))
  const f = x - index
  const a = parseInt(ramp[index].slice(1), 16)
  const b = parseInt(ramp[index + 1].slice(1), 16)
  const channel = (bits: number) => Math.round(((a >> bits) & 255) * (1 - f) + ((b >> bits) & 255) * f)
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`
}

/** A fence's stretch: its quad, where it sits along the street (0–1), its load and the colour for it. */
type FenceSegment = { quad: LngLat[]; t: number; load: number; color: string }

const segmentCache = new WeakMap<TomtomFence, FenceSegment[]>()

function fenceSegments(fence: TomtomFence) {
  let segments = segmentCache.get(fence)
  if (!segments) {
    const quads = wallSegments(fence.path, FENCE_WIDTH_M)
    segments = quads.map((quad, index) => {
      const load = (fence.load[index] + fence.load[index + 1]) / 2
      return { quad, t: index / Math.max(1, quads.length - 1), load, color: rampColor(fence.ramp, load) }
    })
    segmentCache.set(fence, segments)
  }
  return segments
}

/** The traffic fence under `point`: which one, and the load of the stretch there. */
export function fenceAt(map: mapboxgl.Map, point: mapboxgl.PointLike, prefix: string) {
  if (!map.getLayer(fenceId(prefix))) return null
  const hit = map.queryRenderedFeatures(point, { layers: [fenceId(prefix)] })[0]?.properties
  return hit ? { id: String(hit.fence), load: Number(hit.load) } : null
}

/**
 * Draws `scene` at `grow` (0 hidden, 1 full): the towers light up, the heat fades in, the disks open
 * and the traffic fences rise, running out along their streets. Hidden groups are left out.
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
  /** Each stretch rises a beat after the one before it, so the fences run out along their streets. */
  const rise = (t: number) => Math.max(0, Math.min(1, (grow - 0.15 - 0.3 * t) / 0.55))
  ;(map.getSource(fenceId(prefix)) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: visible(scene.fences).flatMap((fence) =>
      fenceSegments(fence).map((segment) => ({
        type: 'Feature' as const,
        properties: {
          fence: fence.id,
          load: segment.load,
          color: segment.color,
          height: fence.heightM * (0.14 + 0.86 * segment.load) * rise(segment.t) ** 0.7,
        },
        geometry: { type: 'Polygon' as const, coordinates: [segment.quad] },
      })),
    ),
  })
  ;(map.getSource(diskId(prefix)) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: visible(scene.disks).map((disk) => ({
      type: 'Feature',
      properties: { color: disk.color, radius: disk.radiusM * Math.min(1, grow * 1.25) },
      geometry: { type: 'Point', coordinates: disk.at },
    })),
  })
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
 * The scene's pins, as dots on their places: candidate sites in teal under a pill with their name,
 * current stations in blue, each popping in one after another as the scene grows. Sites with a details
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
    el.style.setProperty('--z', String(10 + Math.round((1 - order) * 40)))
    if (pick) {
      el.setAttribute('aria-label', `${pin.title}: open details`)
      el.addEventListener('click', () => this.onPick?.(pin.id))
    } else {
      el.dataset.static = 'true'
      el.setAttribute('aria-hidden', 'true')
    }
    if (!pick && !this.onHover) el.dataset.passive = 'true'
    const card = pin.kind === 'site' ? `<span class="tomtom-pin-card">${escapeHtml(pin.title)}</span>` : ''
    el.innerHTML = `<span class="tomtom-pin-dot"></span>${card}`
    if (this.onHover) {
      const top = el.lastElementChild as HTMLElement
      for (const target of el.children) {
        target.addEventListener('mouseenter', () => {
          const rect = top.getBoundingClientRect()
          const box = this.map.getContainer().getBoundingClientRect()
          this.onHover?.(pin, { x: rect.left + rect.width / 2 - box.left, y: rect.top - box.top })
        })
        target.addEventListener('mouseleave', () => this.onHover?.(null))
      }
    }
    this.map.getContainer().appendChild(el)
    const { x, y, z } = mapboxgl.MercatorCoordinate.fromLngLat(pin.at, 0)
    return { el, pin, anchor: [x, y, z], order }
  }

  sync(pins: TomtomPin[], grow: number, hidden: ReadonlySet<string> = NO_GROUPS, active: string | null = null) {
    if (pins !== this.pins) {
      this.clear()
      this.pins = pins
      /** Sites first, best first, then stations. */
      const rank = (pin: TomtomPin) => (pin.kind === 'site' ? (pin.rank ?? 50) : 100)
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
