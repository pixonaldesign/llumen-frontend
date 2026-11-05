/**
 * The real-estate demo's map layers, shared by the Briefing backdrop, the story and Tell Me More: the
 * night Dubai basemap with towers lit in their own colours, off-plan sales heat under the buildings, and
 * a label on each tower's roof. Two towers can light through the Standard style's building `select` and
 * `highlight` states; any number more are painted as their own extrusions over the basemap's buildings.
 * Every element belongs to a `group`, which the Map Data panel can hide.
 */
import mapboxgl from 'mapbox-gl'
import type { LngLat } from './estateGeo'
import './estateMap.css'

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

export type EstateHeatPoint = { at: LngLat; weight: number; group: string }

export type EstateMapScene = {
  towers: EstateTower[]
  heat: EstateHeatPoint[]
  heatRadiusM: number
  /** Low to high density. */
  heatRamp: string[]
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
const paintId = (prefix: string) => `${prefix}-paint`

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

function heatColor(ramp: string[]): mapboxgl.ExpressionSpecification {
  const stops: (number | string)[] = [0, 'rgba(0,0,0,0)']
  ramp.forEach((color, index) => {
    stops.push(0.12 + (0.88 * index) / Math.max(1, ramp.length - 1), color)
  })
  return ['interpolate', ['linear'], ['heatmap-density'], ...stops] as mapboxgl.ExpressionSpecification
}

/** Paints the basemap's two building states in the towers' colours, and adds the heat under the buildings. */
export function mountEstateLayers(map: mapboxgl.Map, prefix: string, towers: EstateTower[]) {
  for (const tower of towers) {
    if (painted(tower)) continue
    map.setConfigProperty(BASEMAP, tower.state === 'select' ? 'colorBuildingSelect' : 'colorBuildingHighlight', tower.color)
  }
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

type LabelEntry = { el: HTMLButtonElement; tower: EstateTower; anchor: [number, number, number] }

/**
 * Each tower's name and headline on its roof, with the story tooltips' blurred card. A no-op custom
 * layer reads the map's projection every frame, so the labels ride the roofs as the camera moves.
 */
export class TowerLabels {
  private map: mapboxgl.Map
  private entries: LabelEntry[] = []
  private towers: EstateTower[] = []
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

  sync(towers: EstateTower[], grow: number, hidden: ReadonlySet<string> = NO_GROUPS, active: string | null = null) {
    if (towers !== this.towers) {
      this.clear()
      this.towers = towers
      const container = this.map.getContainer()
      this.entries = towers.filter((tower) => tower.label !== false).map((tower) => {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'estate-label'
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
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    for (const { el, anchor } of this.entries) {
      const [x, y, z] = anchor
      const cx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]
      const cy = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]
      const cw = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15]
      if (cw <= 0) {
        el.style.visibility = 'hidden'
        continue
      }
      el.style.visibility = ''
      const sx = ((cx / cw + 1) / 2) * width
      const sy = ((1 - cy / cw) / 2) * height
      el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, calc(-100% - 12px))`
    }
  }

  clear() {
    for (const entry of this.entries) entry.el.remove()
    this.entries = []
    this.towers = []
  }
}
