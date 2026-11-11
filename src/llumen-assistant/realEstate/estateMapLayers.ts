/**
 * The real-estate demo's map layers, shared by the Briefing backdrop, the story and Tell Me More: the
 * night Dubai basemap with towers lit in their own colours, off-plan sales heat under the buildings, and
 * a label on each tower's roof. Two towers can light through the Standard style's building `select` and
 * `highlight` states; any number more are painted as their own extrusions over the basemap's buildings.
 * Every element belongs to a `group`, which the Map Data panel can hide.
 */
import mapboxgl from 'mapbox-gl'
import type { LngLat } from './estateGeo'
import { WindField, type EstateWind } from './windField'
import './estateMap.css'

export type { EstateWind }

export const ESTATE_MAP_STYLE = 'mapbox://styles/pixonal/cmu15yibh003r01r16sdc7t05'

const BASEMAP = 'basemap'
const BUILDINGS = { featuresetId: 'buildings', importId: BASEMAP }

/** A basemap building, as feature state addresses it: the featureset goes in `target`, not beside `id`. */
const building = (id: number) => ({ id, target: BUILDINGS }) as unknown as mapboxgl.TargetFeature

/** What a tower's hover tooltip reads. */
export type EstateTip = { title: string; rows?: [string, string][] }

export type EstateTower = {
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
  /** A ring that keeps swelling out from its foot and fading, to mark it as live. */
  pulse?: boolean
  /** Whether its roof carries a label; its hover tooltip shows either way. */
  label?: boolean
  title: string
  text: string
  tip: EstateTip
  group: string
}

const painted = (tower: EstateTower) => tower.footprint !== undefined
/** Clears the basemap roof the painted extrusion caps. */
const PAINT_TOP_M = 1.5
/** One swell of a pulse ring, and how far out it reaches against the foot's radius. */
const PULSE_MS = 2000
const PULSE_REACH = 5.5

export type EstateHeatPoint = { at: LngLat; weight: number; group: string }

/** A zone or footprint on the ground: a tinted fill with an outline, dashed for modelled or proposed shapes. */
export type EstateArea = {
  id: string
  ring: LngLat[]
  color: string
  /** Fill opacity; 0 leaves only the outline. */
  opacity?: number
  /** Outline width in px; 1.5 by default. */
  outlineWidth?: number
  dashed?: boolean
  group: string
  tip?: EstateTip
}

/** A route along the ground: a pipe, a feeder main, a wind path. */
export type EstateLine = { id: string; path: LngLat[]; color: string; width?: number; dashed?: boolean; group: string; tip?: EstateTip }

/** A site: a complaint, a sampling point, a sensor. */
export type EstatePoint = { id: string; at: LngLat; color: string; radius?: number; group: string; tip?: EstateTip }

/**
 * A roof-style label pinned over a place that is not a tower. With `rows` it is a tooltip that stays
 * open instead: the title, then the rows (`text` is not shown).
 */
export type EstateLabel = {
  id: string
  at: LngLat
  heightM: number
  color: string
  title: string
  text: string
  rows?: [string, string][]
  group: string
}

export type EstateMapScene = {
  towers: EstateTower[]
  heat: EstateHeatPoint[]
  heatRadiusM: number
  /** Low to high density. */
  heatRamp: string[]
  /** Draws the heat under the areas, so their tints and outlines stay readable, instead of over them. */
  heatUnder?: boolean
  areas?: EstateArea[]
  lines?: EstateLine[]
  wind?: EstateWind
  points?: EstatePoint[]
  labels?: EstateLabel[]
}

export const EMPTY_SCENE: EstateMapScene = { towers: [], heat: [], heatRadiusM: 220, heatRamp: ['#5a2fc7', '#f6f2ff'] }

const NO_GROUPS: ReadonlySet<string> = new Set()

/** Web-mercator meters per pixel at zoom 0 for 512px tiles, at Dubai's latitude. */
const METERS_PER_PX_Z0 = (40075016.686 / 512) * Math.cos((25.2 * Math.PI) / 180)

function metersToPixels(meters: mapboxgl.ExpressionSpecification | number): mapboxgl.ExpressionSpecification {
  const base: mapboxgl.ExpressionSpecification = ['/', meters, METERS_PER_PX_Z0]
  return ['interpolate', ['exponential', 2], ['zoom'], 0, base, 22, ['*', base, 2 ** 22]]
}

const heatId = (prefix: string) => `${prefix}-heat`
const heatUnderId = (prefix: string) => `${prefix}-heat-under`
const paintId = (prefix: string) => `${prefix}-paint`
const areaId = (prefix: string) => `${prefix}-area`
const lineId = (prefix: string) => `${prefix}-line`
const pointId = (prefix: string) => `${prefix}-point`
const pulseId = (prefix: string) => `${prefix}-pulse`
const windId = (prefix: string) => `${prefix}-wind`
/** The overlay layers a hover can name, top first. */
const tipLayers = (prefix: string) => [
  pointId(prefix),
  lineId(prefix),
  `${lineId(prefix)}-dashed`,
  `${areaId(prefix)}-fill`,
]

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

function heatColor(ramp: string[]): mapboxgl.ExpressionSpecification {
  const stops: (number | string)[] = [0, 'rgba(0,0,0,0)']
  ramp.forEach((color, index) => {
    stops.push(0.12 + (0.88 * index) / Math.max(1, ramp.length - 1), color)
  })
  return ['interpolate', ['linear'], ['heatmap-density'], ...stops] as mapboxgl.ExpressionSpecification
}

/** Paints the basemap's two building states in the towers' colours, and adds the heat under the buildings. */
const SAND_COVER = 'estate-sand-cover'
/** The night land colour as it renders; sand otherwise stands out pale yellow across the desert edge. */
const SAND_COLOR = '#181d2b'

/**
 * Standard draws sand in a fixed pale yellow no config reaches, so a fill of the same polygons covers it
 * in the bottom slot: over the land and landuse, under roads and buildings. Reads Standard's own tiles.
 */
export function coverSand(map: mapboxgl.Map) {
  if (map.getLayer(SAND_COVER)) return
  if (!map.getSource(SAND_COVER)) {
    map.addSource(SAND_COVER, {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-bathymetry-v2,mapbox.mapbox-streets-v8-lite,mapbox.mapbox-terrain-v3,mapbox.mapbox-models-v1',
    })
  }
  map.addLayer({
    id: SAND_COVER,
    type: 'fill',
    source: SAND_COVER,
    'source-layer': 'landuse',
    slot: 'bottom',
    minzoom: 8,
    filter: ['==', ['get', 'class'], 'sand'],
    paint: { 'fill-color': SAND_COLOR, 'fill-emissive-strength': 1 },
  })
}

export function mountEstateLayers(map: mapboxgl.Map, prefix: string, towers: EstateTower[]) {
  coverSand(map)
  for (const tower of towers) {
    if (painted(tower)) continue
    map.setConfigProperty(BASEMAP, tower.state === 'select' ? 'colorBuildingSelect' : 'colorBuildingHighlight', tower.color)
  }
  mountOverlays(map, prefix)
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
  const heat = (layerId: string, under: boolean): mapboxgl.HeatmapLayerSpecification => ({
    id: layerId,
    type: 'heatmap',
    source: id,
    slot: 'middle',
    filter: under ? ['==', ['get', 'under'], true] : ['!=', ['get', 'under'], true],
    paint: {
      'heatmap-weight': ['get', 'weight'],
      'heatmap-intensity': 1,
      'heatmap-radius': metersToPixels(['get', 'radius']),
      'heatmap-opacity': 0.55,
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 1, '#fff'],
    },
  })
  map.addLayer(heat(id, false))
  map.addLayer(heat(heatUnderId(prefix), true), `${areaId(prefix)}-fill`)
}

/**
 * Zones under the buildings, routes over them, then sites facing the camera on top. Every colour and
 * opacity is a feature property, so one source per kind draws any scene; `o` carries the grow.
 */
function mountOverlays(map: mapboxgl.Map, prefix: string) {
  const area = areaId(prefix)
  if (!map.getSource(area)) {
    map.addSource(area, { type: 'geojson', data: EMPTY })
    map.addLayer({
      id: `${area}-fill`,
      type: 'fill',
      source: area,
      slot: 'middle',
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'o'], 'fill-emissive-strength': 1 },
    })
    map.addLayer({
      id: `${area}-outline`,
      type: 'line',
      source: area,
      slot: 'middle',
      filter: ['!=', ['get', 'dashed'], true],
      paint: { 'line-color': ['get', 'color'], 'line-opacity': ['get', 'lo'], 'line-width': ['get', 'lw'], 'line-emissive-strength': 1 },
    })
    map.addLayer({
      id: `${area}-outline-dashed`,
      type: 'line',
      source: area,
      slot: 'middle',
      filter: ['==', ['get', 'dashed'], true],
      paint: {
        'line-color': ['get', 'color'],
        'line-opacity': ['get', 'lo'],
        'line-width': ['get', 'lw'],
        'line-dasharray': [3, 2],
        'line-emissive-strength': 1,
      },
    })
  }
  const line = lineId(prefix)
  if (!map.getSource(line)) {
    map.addSource(line, { type: 'geojson', data: EMPTY })
    const paint: mapboxgl.LineLayerSpecification['paint'] = {
      'line-color': ['get', 'color'],
      'line-opacity': ['get', 'o'],
      'line-width': ['get', 'width'],
      'line-emissive-strength': 1,
    }
    map.addLayer({
      id: line,
      type: 'line',
      source: line,
      slot: 'middle',
      filter: ['!=', ['get', 'dashed'], true],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint,
    })
    map.addLayer({
      id: `${line}-dashed`,
      type: 'line',
      source: line,
      slot: 'middle',
      filter: ['==', ['get', 'dashed'], true],
      layout: { 'line-join': 'round' },
      paint: { ...paint, 'line-dasharray': [1.6, 1.4] },
    })
  }
  const wind = windOf(map, prefix)
  if (!map.getLayer(wind.id)) map.addLayer(wind)
  const pulse = pulseId(prefix)
  if (!map.getSource(pulse)) {
    map.addSource(pulse, { type: 'geojson', data: EMPTY })
    map.addLayer({
      id: pulse,
      type: 'circle',
      source: pulse,
      slot: 'middle',
      paint: {
        ...pulsePaint(0.5),
        'circle-color': ['get', 'color'],
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 2,
        'circle-pitch-alignment': 'map',
        'circle-pitch-scale': 'map',
        'circle-emissive-strength': 1,
      },
    })
  }
  const point = pointId(prefix)
  if (!map.getSource(point)) {
    map.addSource(point, { type: 'geojson', data: EMPTY })
    map.addLayer({
      id: point,
      type: 'circle',
      source: point,
      slot: 'top',
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': ['get', 'radius'],
        'circle-opacity': ['*', ['get', 'o'], 0.92],
        'circle-stroke-color': 'rgba(10, 12, 18, 0.85)',
        'circle-stroke-width': 1.5,
        'circle-stroke-opacity': ['get', 'o'],
        'circle-emissive-strength': 1,
      },
    })
  }
}

/** Per map: its wind field layer, kept so a style change can add the same one back. */
const windFields = new WeakMap<mapboxgl.Map, WindField>()

function windOf(map: mapboxgl.Map, prefix: string) {
  let field = windFields.get(map)
  if (!field) {
    field = new WindField(windId(prefix))
    windFields.set(map, field)
  }
  return field
}

/** A pulse ring `phase` (0 to 1) of the way through its swell: wider and fainter as it goes. */
function pulsePaint(phase: number) {
  const fade = 1 - phase
  return {
    'circle-radius': metersToPixels(['*', ['get', 'r'], 1 + (PULSE_REACH - 1) * phase]),
    'circle-opacity': ['*', ['get', 'o'], 0.42 * fade] as mapboxgl.ExpressionSpecification,
    'circle-stroke-opacity': ['*', ['get', 'o'], fade] as mapboxgl.ExpressionSpecification,
  }
}

/** Per map: the frame that swells its pulse rings, while a scene has any. */
const pulseFrames = new WeakMap<mapboxgl.Map, number>()

function runPulse(map: mapboxgl.Map, prefix: string, on: boolean) {
  const frame = pulseFrames.get(map)
  if (!on || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (frame !== undefined) window.cancelAnimationFrame(frame)
    pulseFrames.delete(map)
    return
  }
  if (frame !== undefined) return
  const id = pulseId(prefix)
  const tick = (now: number) => {
    if ((map as unknown as { _removed?: boolean })._removed) return void pulseFrames.delete(map)
    if (map.getLayer(id)) {
      for (const [property, value] of Object.entries(pulsePaint((now % PULSE_MS) / PULSE_MS))) {
        map.setPaintProperty(id, property as 'circle-radius', value)
      }
    }
    pulseFrames.set(map, window.requestAnimationFrame(tick))
  }
  pulseFrames.set(map, window.requestAnimationFrame(tick))
}

/** A footprint's radius in meters: from its point to its first corner. */
function radiusM(at: LngLat, ring: LngLat[]) {
  const [lng, lat] = ring[0]
  const dx = (lng - at[0]) * 111320 * Math.cos((at[1] * Math.PI) / 180)
  const dy = (lat - at[1]) * 110540
  return Math.hypot(dx, dy)
}

function setOverlays(map: mapboxgl.Map, prefix: string, scene: EstateMapScene, grow: number, hidden: ReadonlySet<string>) {
  const shown = <T extends { group: string }>(items: T[] | undefined) =>
    grow <= 0 ? [] : (items ?? []).filter((item) => !hidden.has(item.group))
  const tip = (value: EstateTip | undefined) => (value ? JSON.stringify(value) : undefined)
  ;(map.getSource(areaId(prefix)) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: shown(scene.areas).map((area) => ({
      type: 'Feature',
      properties: {
        id: area.id,
        color: area.color,
        o: (area.opacity ?? 0.22) * grow,
        lo: 0.9 * grow,
        lw: area.outlineWidth ?? 1.5,
        dashed: area.dashed === true,
        tip: tip(area.tip),
      },
      geometry: { type: 'Polygon', coordinates: [[...area.ring, area.ring[0]]] },
    })),
  })
  ;(map.getSource(lineId(prefix)) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: shown(scene.lines).map((line) => ({
      type: 'Feature',
      properties: { id: line.id, color: line.color, o: grow, width: line.width ?? 2.5, dashed: line.dashed === true, tip: tip(line.tip) },
      geometry: { type: 'LineString', coordinates: line.path },
    })),
  })
  ;(map.getSource(pointId(prefix)) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: shown(scene.points).map((point) => ({
      type: 'Feature',
      properties: { id: point.id, color: point.color, o: grow, radius: point.radius ?? 5, tip: tip(point.tip) },
      geometry: { type: 'Point', coordinates: point.at },
    })),
  })
  windOf(map, prefix).set(scene.wind && grow > 0 && !hidden.has(scene.wind.group) ? scene.wind : null, grow)
}

/** The overlay under `point` that names itself on hover, with a key that changes when another does. */
export function overlayTipAt(map: mapboxgl.Map, point: mapboxgl.PointLike, prefix: string): { key: string; tip: EstateTip } | null {
  const layers = tipLayers(prefix).filter((id) => map.getLayer(id))
  if (!layers.length) return null
  const hit = map.queryRenderedFeatures(point, { layers }).find((feature) => typeof feature.properties?.tip === 'string')
  if (!hit) return null
  return { key: `${hit.layer?.id}:${hit.properties?.id}`, tip: JSON.parse(hit.properties!.tip as string) as EstateTip }
}

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

function lightTower(map: mapboxgl.Map, tower: EstateTower, lit: boolean) {
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
export function resolveTowers(map: mapboxgl.Map, towers: EstateTower[]) {
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
  towers: EstateTower[],
  prefix: string,
): EstateTower | null {
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

/** Draws `scene` at `grow` (0 hidden, 1 full): the towers light up and the heat fades in. Hidden groups are left out. */
export function drawEstateScene(
  map: mapboxgl.Map,
  prefix: string,
  scene: EstateMapScene,
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
  setOverlays(map, prefix, scene, grow, hidden)
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
  const pulsing = grow <= 0 ? [] : shown.filter((tower) => tower.pulse)
  ;(map.getSource(pulseId(prefix)) as mapboxgl.GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: pulsing.map((tower) => ({
      type: 'Feature',
      properties: { color: tower.color, o: grow, r: radiusM(tower.at, tower.footprint!) },
      geometry: { type: 'Point', coordinates: tower.at },
    })),
  })
  runPulse(map, prefix, pulsing.length > 0)
  const source = map.getSource(heatId(prefix)) as mapboxgl.GeoJSONSource | undefined
  if (!source) return
  source.setData({
    type: 'FeatureCollection',
    features: (grow <= 0 ? [] : scene.heat.filter((point) => !hidden.has(point.group))).map((point) => ({
      type: 'Feature',
      properties: { weight: point.weight * grow, radius: scene.heatRadiusM, under: scene.heatUnder === true },
      geometry: { type: 'Point', coordinates: point.at },
    })),
  })
  const color = heatColor(scene.heatRamp)
  map.setPaintProperty(heatId(prefix), 'heatmap-color', color)
  if (map.getLayer(heatUnderId(prefix))) map.setPaintProperty(heatUnderId(prefix), 'heatmap-color', color)
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

/** A tooltip's markup: the title, then label and value rows. */
export function estateTipHtml(tip: EstateTip) {
  const rows = (tip.rows ?? [])
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join('')
  return `<p class="estate-tip-title">${escapeHtml(tip.title)}</p>${rows ? `<dl class="estate-tip-rows">${rows}</dl>` : ''}`
}

/** What a roof label needs: towers that carry one, and the scene's free labels. */
type Labelled = Pick<EstateTower, 'id' | 'at' | 'heightM' | 'color' | 'title' | 'text' | 'group'> & Pick<EstateLabel, 'rows'>

const labelsOfScene = new WeakMap<EstateMapScene, Labelled[]>()

/** The scene's labels, the same array for the same scene so the label layer only rebuilds on a new one. */
export function sceneLabels(scene: EstateMapScene): Labelled[] {
  let labels = labelsOfScene.get(scene)
  if (!labels) {
    labels = [...scene.towers.filter((tower) => tower.label !== false), ...(scene.labels ?? [])]
    labelsOfScene.set(scene, labels)
  }
  return labels
}

/** Keep in step with `--estate-stem` in estateMap.css. */
const STEM_PX = 22
/** Space kept between open tooltips that would otherwise overlap, and between one and the map's side. */
const TIP_GAP_PX = 8
const TIP_EDGE_PX = 12

/** `size` is an open tooltip's width and height, measured once it is laid out. */
type LabelEntry = { el: HTMLButtonElement; tower: Labelled; anchor: [number, number, number]; size?: [number, number] }

/**
 * Each tower's name and headline on its roof, with the story tooltips' blurred card. A no-op custom
 * layer reads the map's projection every frame, so the labels ride the roofs as the camera moves.
 */
export class TowerLabels {
  private map: mapboxgl.Map
  private entries: LabelEntry[] = []
  private towers: Labelled[] = []
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

  /** `labels` from `sceneLabels`. */
  sync(labels: Labelled[], grow: number, hidden: ReadonlySet<string> = NO_GROUPS, active: string | null = null) {
    if (labels !== this.towers) {
      this.clear()
      this.towers = labels
      const container = this.map.getContainer()
      this.entries = labels.map((tower) => {
        const el = document.createElement('button')
        const pickable = this.onPick && !tower.rows
        el.type = 'button'
        el.className = tower.rows ? 'estate-label estate-label-tip' : 'estate-label'
        el.style.setProperty('--tower', tower.color)
        el.tabIndex = pickable ? 0 : -1
        el.setAttribute('aria-label', `${tower.title}: open details`)
        el.innerHTML = tower.rows
          ? estateTipHtml({ title: tower.title, rows: tower.rows })
          : `<i aria-hidden="true"></i><span><b>${escapeHtml(tower.title)}</b><span>${escapeHtml(tower.text)}</span></span>`
        if (pickable) el.addEventListener('click', () => this.onPick?.(tower.id))
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
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const tips: { entry: LabelEntry; sx: number; sy: number }[] = []
    for (const entry of this.entries) {
      const { el, anchor } = entry
      const [x, y, z] = anchor
      const cx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]
      const cy = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]
      const cw = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15]
      if (cw <= 0) {
        el.style.visibility = 'hidden'
        continue
      }
      const sx = ((cx / cw + 1) / 2) * width
      const sy = ((1 - cy / cw) / 2) * height
      const offMap = sx < 0 || sx > width || sy < 0 || sy > height
      el.style.visibility = entry.tower.rows && offMap ? 'hidden' : ''
      if (!offMap && el.style.opacity !== '0') tips.push({ entry, sx, sy })
      el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(calc(-50% + var(--estate-shift, 0px)), calc(-100% - var(--estate-stem)))`
    }
    this.declutter(tips, width)
  }

  /**
   * Labels and open tooltips stay on the map and clear of each other: each slides in from the map's
   * sides (its stem still on its point), then, nearest the viewer first, one that would cover a placed
   * one rises above it on a longer stem.
   */
  private declutter(tips: { entry: LabelEntry; sx: number; sy: number }[], width: number) {
    const placed: { left: number; right: number; top: number; bottom: number }[] = []
    for (const { entry, sx, sy } of tips.sort((a, b) => b.sy - a.sy)) {
      entry.size ??= entry.el.offsetWidth ? [entry.el.offsetWidth, entry.el.offsetHeight] : undefined
      if (!entry.size) continue
      const [w, h] = entry.size
      const shift = Math.max(TIP_EDGE_PX - (sx - w / 2), Math.min(0, width - TIP_EDGE_PX - (sx + w / 2)))
      const left = sx + shift - w / 2
      const right = sx + shift + w / 2
      entry.el.style.setProperty('--estate-shift', `${Math.round(shift)}px`)
      let bottom = sy - STEM_PX
      for (let moved = true; moved; ) {
        moved = false
        for (const box of placed) {
          const across = left < box.right + TIP_GAP_PX && right > box.left - TIP_GAP_PX
          const over = bottom - h < box.bottom + TIP_GAP_PX && bottom > box.top - TIP_GAP_PX
          if (across && over) {
            bottom = box.top - TIP_GAP_PX
            moved = true
          }
        }
      }
      placed.push({ left, right, top: bottom - h, bottom })
      entry.el.style.setProperty('--estate-stem', `${Math.round(sy - bottom)}px`)
    }
  }

  clear() {
    for (const entry of this.entries) entry.el.remove()
    this.entries = []
    this.towers = []
  }
}
