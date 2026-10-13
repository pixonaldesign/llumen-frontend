/**
 * Line charts plotted along a time series: each line is one column of a map layer,
 * sampled at every frame of the timeline.
 */
import { DEMO_COLUMNS, DEMO_JUNCTIONS } from './storyDemoMapData'
import { sceneAtPhase, type StoryScene } from './storyDemoScenes'

export type TimelineChartColumn = {
  id: string
  label: string
  value: (scene: StoryScene) => number
  format: (value: number) => string
}

export type TimelineChartLayer = {
  id: string
  label: string
  columns: TimelineChartColumn[]
}

export type TimelineChartSeries = {
  id: string
  layerId: string
  columnId: string
  color: string
  visible: boolean
}

export const TIMELINE_CHART_COLORS = ['#70aeff', '#3fd3c6', '#f5b84a', '#ff7ac8', '#a78bfa', '#7ee081']

const formatCount = (value: number) => Math.round(value).toLocaleString('en-US')
const formatMeters = (value: number) => `${Math.round(value).toLocaleString('en-US')} m`
const formatPercent = (value: number) => `${Math.round(value)}%`

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
}

const columnHeights = (scene: StoryScene) =>
  DEMO_COLUMNS.map(([lng, lat, base], index) => scene.columnHeight(lng, lat, base, index))

const junctionLoads = (scene: StoryScene) =>
  DEMO_JUNCTIONS.map(([lng, lat, base], index) => scene.diskRadius(lng, lat, base, index) / base)

export const TIMELINE_CHART_LAYERS: TimelineChartLayer[] = [
  {
    id: 'junctions',
    label: 'Abu Dhabi Monitored Junctions',
    columns: [
      {
        id: 'count',
        label: 'Number of junctions',
        value: (scene) => scene.legend.junctionCount,
        format: formatCount,
      },
      {
        id: 'load',
        label: 'Average junction load',
        value: (scene) => mean(junctionLoads(scene)) * 100,
        format: formatPercent,
      },
      {
        id: 'busy',
        label: 'Busy junctions',
        value: (scene) => junctionLoads(scene).filter((load) => load > 1).length,
        format: formatCount,
      },
    ],
  },
  {
    id: 'distribution',
    label: 'Abu Dhabi Value Distribution',
    columns: [
      {
        id: 'average',
        label: 'Average value',
        value: (scene) => mean(columnHeights(scene)),
        format: formatMeters,
      },
      {
        id: 'top',
        label: 'Top 10 average',
        value: (scene) => mean([...columnHeights(scene)].sort((a, b) => b - a).slice(0, 10)),
        format: formatMeters,
      },
      {
        id: 'high',
        label: 'Columns above 3,000 m',
        value: (scene) => columnHeights(scene).filter((height) => height > 3000).length,
        format: formatCount,
      },
    ],
  },
]

export function chartLayer(layerId: string) {
  return TIMELINE_CHART_LAYERS.find((layer) => layer.id === layerId) ?? TIMELINE_CHART_LAYERS[0]
}

export function chartColumn(layerId: string, columnId: string) {
  const layer = chartLayer(layerId)
  return layer.columns.find((column) => column.id === columnId) ?? layer.columns[0]
}

const columnKey = (layerId: string, columnId: string) => `${layerId}:${columnId}`

/** Columns of `layerId` that none of `others` plots; two lines on one column would draw on top of each other. */
export function freeChartColumns(layerId: string, others: TimelineChartSeries[]) {
  const used = new Set(others.map((series) => columnKey(series.layerId, series.columnId)))
  return chartLayer(layerId).columns.filter((column) => !used.has(columnKey(layerId, column.id)))
}

export function hasFreeChartColumn(existing: TimelineChartSeries[]) {
  return TIMELINE_CHART_LAYERS.some((layer) => freeChartColumns(layer.id, existing).length > 0)
}

export function newChartSeries(existing: TimelineChartSeries[]): TimelineChartSeries {
  const used = new Set(existing.map((series) => series.color))
  const start = existing.length % TIMELINE_CHART_LAYERS.length
  const layers = [...TIMELINE_CHART_LAYERS.slice(start), ...TIMELINE_CHART_LAYERS.slice(0, start)]
  const layer = layers.find((item) => freeChartColumns(item.id, existing).length > 0) ?? layers[0]
  return {
    id: `chart-${Date.now()}-${existing.length}`,
    layerId: layer.id,
    columnId: (freeChartColumns(layer.id, existing)[0] ?? layer.columns[0]).id,
    color:
      TIMELINE_CHART_COLORS.find((color) => !used.has(color)) ??
      TIMELINE_CHART_COLORS[existing.length % TIMELINE_CHART_COLORS.length],
    visible: true,
  }
}

/** Moves any line that repeats an earlier line's column onto a free column. */
export function distinctChartSeries(series: TimelineChartSeries[]) {
  return series.reduce<TimelineChartSeries[]>((kept, item) => {
    if (freeChartColumns(item.layerId, kept).some((column) => column.id === item.columnId)) return [...kept, item]
    if (!hasFreeChartColumn(kept)) return kept
    const { layerId, columnId } = newChartSeries(kept)
    return [...kept, { ...item, layerId, columnId }]
  }, [])
}

/** One value per frame; frame phases match the map's (`frame / frameCount`, shifted by `phaseOffset`). */
export function chartSeriesValues(
  baseScene: StoryScene,
  frameCount: number,
  phaseOffset: number,
  series: TimelineChartSeries[],
) {
  const columns = series.map((item) => chartColumn(item.layerId, item.columnId))
  const values = series.map(() => [] as number[])
  for (let frame = 0; frame < frameCount; frame += 1) {
    const phase = (((frame / frameCount - phaseOffset) % 1) + 1) % 1
    const scene = sceneAtPhase(baseScene, phase)
    columns.forEach((column, index) => values[index].push(column.value(scene)))
  }
  return values
}
