/**
 * The three growth areas both Urban Planning stories zoom into: Jumeirah Village Circle, Arjan and Motor
 * City, side by side in Dubai's south-west. Their outlines, headline figures, the cameras that frame them,
 * and the shape a solution takes in Simulate recommended actions. Every value is an illustrative example.
 */
import type { ReplySolution } from '../assistantReplyTypes'
import { hash, offsetKm, type LngLat } from '../realEstate/estateGeo'
import type { EstateArea, EstateLabel, EstateMapScene, EstatePoint } from '../realEstate/estateMapLayers'
import { HORIZON_COLOR, HORIZON_LABEL } from './dmShared'
import { PALETTE, type EstateCamera, type Horizon } from '../realEstate/estateTypes'
import { metresFromRing } from './dmGeo'
import { COMMUNITY_BOUNDS } from './dubaiCommunities'

export type AreaId = 'jvc' | 'arjan' | 'motor-city'

export type GrowthArea = {
  id: AreaId
  name: string
  short: string
  /** Residents in 2021 and 2026, and homes committed in the pipeline. */
  population2021: number
  population: number
  pipeline: number
  /** Residents in thousands, 2021–2026. */
  byYear: number[]
}

export const AREAS: Record<AreaId, GrowthArea> = {
  jvc: { id: 'jvc', name: 'Jumeirah Village Circle', short: 'JVC', population2021: 78000, population: 132000, pipeline: 18400, byYear: [78, 86, 96, 107, 119, 132] },
  arjan: { id: 'arjan', name: 'Arjan', short: 'Arjan', population2021: 36000, population: 58000, pipeline: 11200, byYear: [36, 40, 44, 49, 53, 58] },
  'motor-city': {
    id: 'motor-city',
    name: 'Motor City',
    short: 'Motor City',
    population2021: 34000,
    population: 46000,
    pipeline: 7800,
    byYear: [34, 36, 38, 40, 43, 46],
  },
}

export const AREA_LIST = Object.values(AREAS)

/** Residents a new home brings, on the areas' household size. */
const PER_HOME = 2.3

const sum = (of: (area: GrowthArea) => number) => AREA_LIST.reduce((total, area) => total + of(area), 0)

/** Residents a pipeline of `homes` will add, to the nearest thousand. */
export const newResidentsFor = (homes: number) => Math.round((homes * PER_HOME) / 1000) * 1000

export const TOTALS = {
  population2021: sum((area) => area.population2021),
  population: sum((area) => area.population),
  pipeline: sum((area) => area.pipeline),
  newResidents: newResidentsFor(sum((area) => area.pipeline)),
}

export const growthPct = (area: Pick<GrowthArea, 'population' | 'population2021'>) =>
  Math.round(((area.population - area.population2021) / area.population2021) * 100)

export const TOTAL_GROWTH = growthPct(TOTALS)

export const fmt = (value: number) => value.toLocaleString('en-US')
export const thousands = (value: number) => `${Math.round(value / 100) / 10}k`

export const labelAt = (id: AreaId): LngLat => COMMUNITY_BOUNDS[id].label

/** How far a spread point keeps inside its outline, so its heat stays within the area. */
const SPREAD_INSET_KM = 0.12

/**
 * Points across an area's whole outline on a jittered grid `spacingKm` apart, each with a 0–1 `density`
 * that drifts smoothly over a kilometre or so, so the heat covers the area without reading as a flat fill.
 */
export function spreadIn(id: AreaId, spacingKm: number, seed: number): { at: LngLat; density: number }[] {
  const rings = COMMUNITY_BOUNDS[id].rings
  const inside = (point: LngLat) => rings.some((ring) => metresFromRing(ring, point) === 0)
  const kept = (point: LngLat) =>
    inside(point) &&
    [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([east, north]) => inside(offsetKm(point, east * SPREAD_INSET_KM, north * SPREAD_INSET_KM)))
  const corners = rings.flat()
  const west = Math.min(...corners.map(([lng]) => lng))
  const south = Math.min(...corners.map(([, lat]) => lat))
  const east = Math.max(...corners.map(([lng]) => lng))
  const north = Math.max(...corners.map(([, lat]) => lat))
  const step = offsetKm([west, south], spacingKm, spacingKm)
  const [dLng, dLat] = [step[0] - west, step[1] - south]
  const points: { at: LngLat; density: number }[] = []
  let index = 0
  for (let lat = south; lat <= north; lat += dLat) {
    for (let lng = west; lng <= east; lng += dLng, index += 1) {
      const at: LngLat = [lng + (hash(index, seed) - 0.5) * dLng, lat + (hash(index, seed + 1) - 0.5) * dLat]
      if (!kept(at)) continue
      const wave =
        Math.sin(at[0] * 610 + seed) * Math.cos(at[1] * 540 - seed * 0.7) * 0.6 + Math.sin((at[0] + at[1]) * 380 + seed * 1.3) * 0.4
      points.push({ at, density: Math.min(1, Math.max(0, 0.5 + 0.5 * wave + (hash(index, seed + 2) - 0.5) * 0.3)) })
    }
  }
  return points
}

/** All three side by side, in the story's map beside its insight column. */
export const AREAS_CAMERA: EstateCamera = { center: [55.2125, 25.0532], zoom: 13.45, pitch: 54, bearing: -12 }

/** The same three in the Simulate stage's map, a third of the screen narrower. */
export const AREAS_ASK_CAMERA: EstateCamera = { center: [55.2085, 25.0525], zoom: 13.2, pitch: 54, bearing: -12 }

export const HEAT_RAMP = [PALETTE.purple[0], PALETTE.purple[2], PALETTE.purple[4], PALETTE.purple[6]]
export const GAP_RAMP = [PALETTE.diverging[2], PALETTE.categorical[5], PALETTE.diverging[1], PALETTE.diverging[0]]

export const scene = (parts: Partial<EstateMapScene>): EstateMapScene => ({
  towers: [],
  heat: [],
  heatRadiusM: 320,
  heatRamp: HEAT_RAMP,
  heatUnder: true,
  ...parts,
})

/** How a page reads an area: its colour, how strongly it fills (0–1), its label and hover rows. */
export type AreaShade = {
  color: string
  level: number
  text: string
  rows: [string, string][]
  label?: boolean
  /** A fixed fill opacity instead of one read from `level`. */
  fill?: number
}

/** Each area's outline in the page's colour; labelled ones carry their name and headline on the map. */
export function areaOutlines(
  read: (area: GrowthArea) => AreaShade,
  group = 'communities',
  only: GrowthArea[] = AREA_LIST,
): { areas: EstateArea[]; labels: EstateLabel[] } {
  const shaded = only.map((area) => ({ area, shade: read(area) }))
  return {
    areas: shaded.flatMap(({ area, shade }) =>
      COMMUNITY_BOUNDS[area.id].rings.map((ring, index) => ({
        id: `area-${area.id}-${index}`,
        ring,
        color: shade.color,
        opacity: shade.fill ?? 0.1 + 0.3 * Math.min(1, Math.max(0, shade.level)),
        outlineWidth: 2.5,
        group,
        tip: { title: area.name, rows: shade.rows },
      })),
    ),
    labels: shaded
      .filter(({ shade }) => shade.label !== false)
      .map(({ area, shade }) => ({
        id: `area-${area.id}`,
        at: labelAt(area.id),
        heightM: 0,
        color: shade.color,
        title: area.name,
        text: shade.text,
        group,
      })),
  }
}

/* —— Simulate recommended actions: a solution's actions on its map, and its detail in the panel —— */

/** One action in a horizon: where it lands, what it acts on, what it buys and what it costs. */
export type PlanningAction = {
  code: string
  horizon: Horizon
  action: string
  asset: string
  benefit: string
  at: LngLat
  /** Share of the problem it removes, %, for the solution's chart. */
  impact: number
  /** The headline gain, e.g. "+2,400 seats". */
  gain: string
  cost: string
  sustainability: 'Low' | 'Medium' | 'High'
}

/**
 * What a solution's detail reads, beside the tab and map the reply builds for it. `span` replaces the
 * horizon's default delivery window, and `meta` the map card's action count.
 */
export type PlanningSolution = Pick<ReplySolution, 'title' | 'summary' | 'mapNote' | 'stats' | 'chart' | 'actions' | 'actionsHeading'> & {
  span?: string
  meta?: string
}

export function planningSolution(
  horizon: Horizon,
  items: PlanningAction[],
  text: Pick<ReplySolution, 'title' | 'summary' | 'mapNote' | 'stats'> & { chartTitle: string; chartUnit: string },
): PlanningSolution {
  const mine = items.filter((item) => item.horizon === horizon)
  const best = Math.max(...mine.map((item) => item.impact))
  return {
    title: text.title,
    summary: text.summary,
    mapNote: text.mapNote,
    stats: text.stats,
    chart: {
      type: 'bars',
      title: text.chartTitle,
      value: `${best}%`,
      unit: text.chartUnit,
      color: HORIZON_COLOR[horizon],
      rows: mine.map((item) => ({ label: `${item.code} ${item.action}`, value: (item.impact / best) * 100, display: `${item.impact}%` })),
    },
    actions: mine.map((item) => ({
      code: item.code,
      title: item.action,
      subtitle: item.asset,
      detail: item.benefit,
      metrics: [item.gain, item.cost, `${item.sustainability} sustainability`],
    })),
  }
}

const actionRows = (item: PlanningAction): [string, string][] => [
  ['Acts on', item.asset],
  ['Gain', item.gain],
  ['Horizon', HORIZON_LABEL[item.horizon]],
]

/** A horizon's actions: a point each, its tooltip held open over it. */
export function actionMarks(items: PlanningAction[], horizon: Horizon): { points: EstatePoint[]; labels: EstateLabel[] } {
  const mine = items.filter((item) => item.horizon === horizon)
  return {
    points: mine.map((item) => ({ id: `action-${item.code}`, at: item.at, color: HORIZON_COLOR[horizon], radius: 7, group: 'actions' })),
    labels: mine.map((item) => ({
      id: `action-tip-${item.code}`,
      at: item.at,
      heightM: 0,
      color: HORIZON_COLOR[horizon],
      title: `${item.code} · ${item.action}`,
      text: '',
      rows: actionRows(item),
      group: 'actions',
    })),
  }
}

/** The communities a horizon acts in, outlined in its colour. */
export const horizonOutlines = (horizon: Horizon, note: (area: GrowthArea) => string) =>
  areaOutlines((area) => ({
    color: HORIZON_COLOR[horizon],
    level: 0.35,
    text: note(area),
    label: false,
    rows: [
      ['Horizon', HORIZON_LABEL[horizon]],
      ['Here', note(area)],
    ],
  }))
