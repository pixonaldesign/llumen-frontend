import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { AssetPreviewChart } from './AssetPreviewChart'
import { SECTION_SWATCHES } from './canvasItems'
import { columnsOf, detectGeometry } from './createAsset'
import { SITES as SITE_ROWS, type AssetView } from './flowData'
import type { AssetPreview, DataRecord, DataValue } from './nodeCatalog'
import styles from './NodeCard.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const MAPBOX_STYLE = 'mapbox://styles/pixonal/cmqzd3vp2003g01s7f4oy3af9'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ANOMALIES = [26, 28, 20, 25, 30, 30, 25, 30, 29, 31, 44, 47]
const CHART_PAD = { top: 8, right: 14, bottom: 22, left: 28 }
/** Past this many points the x axis labels every few points. */
const MAX_X_LABELS = 7

const SITES: readonly [number, number][] = [
  [54.488, 24.352], [54.501, 24.366], [54.472, 24.344], [54.515, 24.338], [54.532, 24.318],
  [54.548, 24.329], [54.461, 24.371], [54.437, 24.389], [54.412, 24.402], [54.526, 24.297],
  [54.566, 24.311], [54.494, 24.329], [54.452, 24.356], [54.579, 24.342],
]

/** What an asset draws from: its chart type and mapping, and the rows behind it. */
export type AssetData = { view: AssetView; rows: readonly DataRecord[] }

/** Element size in layout pixels; unaffected by the canvas zoom transform. */
function useLayoutSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setSize({ w: element.offsetWidth, h: element.offsetHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

/** Catmull-Rom through the points, as cubic Béziers. */
function smoothPath(points: readonly { x: number; y: number }[]) {
  return points.reduce((d, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`
    const p0 = points[index - 2] ?? points[index - 1]
    const p1 = points[index - 1]
    const p3 = points[index + 1] ?? point
    const c1 = { x: p1.x + (point.x - p0.x) / 6, y: p1.y + (point.y - p0.y) / 6 }
    const c2 = { x: point.x - (p3.x - p1.x) / 6, y: point.y - (p3.y - p1.y) / 6 }
    return `${d} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${point.x} ${point.y}`
  }, '')
}

const numberOf = (value: DataValue | undefined) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const figure = (value: number) => String(Number(value.toFixed(1)))

/** The smallest of 1, 2, 2.5, 5 and 10 times a power of ten that reaches the value. */
function niceStep(value: number) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return ([1, 2, 2.5, 5, 10].find((multiple) => multiple * magnitude >= value) ?? 10) * magnitude
}

/** "2026-10-02" reads "Oct 2" and "2026-05" reads "May"; anything else stays as it is. */
function axisLabel(value: string) {
  const date = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value)
  if (!date) return value.length > 8 ? `${value.slice(0, 7)}…` : value
  const month = MONTHS[Number(date[2]) - 1] ?? value
  return date[3] ? `${month} ${Number(date[3])}` : month
}

type Series = { label: string; points: readonly { x: string; value: number }[] }

const DEFAULT_SERIES: Series = { label: 'Active Anomalies', points: ANOMALIES.map((value, index) => ({ x: MONTHS[index], value })) }

/** One point per x value, summing the rows that share it, in first-seen order. */
function seriesOf({ view, rows }: AssetData): Series {
  const x = view.mapping?.x ?? ''
  const y = view.mapping?.y ?? ''
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(String(row[x] ?? '—'), (totals.get(String(row[x] ?? '—')) ?? 0) + numberOf(row[y]))
  return { label: view.label ?? y, points: [...totals].map(([key, value]) => ({ x: axisLabel(key), value })) }
}

function AssetChart({ series, bare, labelledAxis }: { series: Series; bare: boolean; labelledAxis: boolean }) {
  const peak = Math.max(0, ...series.points.map((point) => point.value))
  const step = niceStep(peak / 3)
  const ticks = labelledAxis ? [step * 3, step * 2, step, 0] : [niceStep(peak), 0]
  const max = ticks[0]
  const [plotRef, size] = useLayoutSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const count = series.points.length
  const innerW = Math.max(0, size.w - CHART_PAD.left - CHART_PAD.right)
  const innerH = Math.max(0, size.h - CHART_PAD.top - CHART_PAD.bottom)
  const points = series.points.map((point, index) => ({
    x: CHART_PAD.left + (innerW * index) / Math.max(1, count - 1),
    y: CHART_PAD.top + innerH * (1 - point.value / max),
  }))
  const line = smoothPath(points)
  const baseline = CHART_PAD.top + innerH
  const area = points.length ? `${line} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z` : ''
  const current = hover ?? count - 1
  const every = Math.ceil(count / MAX_X_LABELS)

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = event.currentTarget.offsetWidth / rect.width
    const x = (event.clientX - rect.left) * scale - CHART_PAD.left
    const index = Math.round((x / innerW) * (count - 1))
    setHover(Math.min(count - 1, Math.max(0, index)))
  }

  return (
    <div className={bare ? `${styles.chart} ${styles.chartBare}` : styles.chart} data-labelled={labelledAxis || undefined}>
      <p className={styles.chartKpi}>
        <strong>{series.points[current] ? figure(series.points[current].value) : '—'}</strong>
        <span className={styles.chartKpiLabel}>{series.label}</span>
        {hover !== null ? <span className={styles.chartKpiPeriod}>{series.points[hover].x}</span> : null}
      </p>
      <div className={styles.chartPlot} ref={plotRef} onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}>
        {size.w > 0 ? (
          <svg width={size.w} height={size.h} aria-label={series.label} role="img">
            <defs>
              <linearGradient id="asset-chart-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#e2365b" stopOpacity="0.45" />
                <stop offset="1" stopColor="#e2365b" stopOpacity="0.04" />
              </linearGradient>
            </defs>
            {ticks.map((tick) => {
              const y = CHART_PAD.top + innerH * (1 - tick / max)
              return (
                <g key={tick}>
                  <line className={styles.chartGrid} x1={CHART_PAD.left} x2={size.w - CHART_PAD.right} y1={y} y2={y} />
                  <text className={styles.chartAxis} x={CHART_PAD.left - 8} y={y} textAnchor="end" dominantBaseline="middle">
                    {figure(tick)}
                  </text>
                </g>
              )
            })}
            <path d={area} fill="url(#asset-chart-fill)" />
            <path className={styles.chartLine} d={line} />
            {points.map((point, index) =>
              (count - 1 - index) % every === 0 ? (
                <text key={index} className={styles.chartAxis} x={point.x} y={size.h - 4} textAnchor="middle">
                  {series.points[index].x}
                </text>
              ) : null,
            )}
            {hover !== null ? (
              <>
                <line className={styles.chartGuide} x1={points[hover].x} x2={points[hover].x} y1={CHART_PAD.top} y2={baseline} />
                <circle className={styles.chartDot} cx={points[hover].x} cy={points[hover].y} r={4} />
              </>
            ) : null}
          </svg>
        ) : null}
      </div>
    </div>
  )
}

/** Bars, pies, and the rest of the Create Asset charts, under the asset's total. */
function AssetPlot({ data, bare }: { data: AssetData; bare: boolean }) {
  const { view, rows } = data
  const measure = view.mapping?.y ?? view.mapping?.value ?? ''
  const total = rows.reduce((sum, row) => sum + numberOf(row[measure]), 0)
  return (
    <div className={bare ? `${styles.chart} ${styles.chartBare}` : styles.chart} data-labelled>
      <p className={styles.chartKpi}>
        <strong>{figure(total)}</strong>
        <span className={styles.chartKpiLabel}>{view.label ?? measure}</span>
      </p>
      <div className={styles.assetPlot}>
        <AssetPreviewChart settings={{ chartType: view.chartType, mapping: view.mapping ?? {}, refresh: 'update' }} records={rows} flush />
      </div>
    </div>
  )
}

function AssetTable({ rows, bare }: { rows: readonly DataRecord[]; bare: boolean }) {
  return (
    <div className={bare ? `${styles.assetTable} ${styles.assetTableBare}` : styles.assetTable}>
      <AssetPreviewChart settings={{ chartType: 'table', mapping: {}, refresh: 'update' }} records={rows} />
    </div>
  )
}

/* ---------- Map ---------- */

type LayerKind = 'points' | 'area' | 'heatmap' | 'wind'
type Feature = { type: 'Feature'; properties: Record<string, string | number>; geometry: { type: 'Point' | 'LineString'; coordinates: number[] | number[][] } }
type MapLayer = { kind: LayerKind; features: Feature[]; colors: readonly [string, string][]; bounds: [[number, number], [number, number]] | null }

const SITE_RED = '#ff5a6e'
const SITE_HALO = '#e2365b'
const WIND_DOT = '#73adf5'
const ZONE_COLORS = ['Orange', 'Blue', 'Green', 'Purple', 'Teal', 'Yellow'].map((name) => SECTION_SWATCHES.find((swatch) => swatch.name === name)?.color ?? SITE_HALO)
/** Degrees of latitude a wind arrow runs at the slowest and fastest speed in the layer. */
const WIND_LENGTH = [0.012, 0.026] as const

const DEFAULT_LAYER: MapLayer = {
  kind: 'points',
  features: SITES.map((coordinates, index) => ({
    type: 'Feature',
    properties: { weight: ((index * 37) % 60) / 60 },
    geometry: { type: 'Point', coordinates: [...coordinates] },
  })),
  colors: [],
  bounds: null,
}

const layerKind = (chartType: string): LayerKind =>
  chartType === 'map:area' || chartType === 'map:fences' ? 'area' : chartType === 'map:heatmap' ? 'heatmap' : chartType === 'map:wind' ? 'wind' : 'points'

/** Each row as a feature at its latitude and longitude, weighted 0–1 by its measure; wind rows become arrows downwind. */
function mapLayerOf(rows: readonly DataRecord[], chartType: string, mapping: Readonly<Record<string, string>>): MapLayer {
  const columns = columnsOf(rows)
  const geometry = detectGeometry(columns)
  if (geometry?.kind !== 'latLng') return DEFAULT_LAYER
  const kind = layerKind(chartType)
  const coordinates = new Set([geometry.latitude, geometry.longitude])
  const measure = mapping.speed ?? mapping.value ?? columns.find((column) => column.kind === 'number' && !coordinates.has(column.name))?.name
  const values = rows.map((row) => (measure ? numberOf(row[measure]) : 0))
  const low = Math.min(...values)
  const range = Math.max(...values) - low
  const weight = (index: number) => (range ? (values[index] - low) / range : 0.6)
  const categories = mapping.category ? [...new Set(rows.map((row) => String(row[mapping.category] ?? '')))] : []
  const colors = categories.map((category, index) => [category, ZONE_COLORS[index % ZONE_COLORS.length]] as [string, string])

  const features = rows.flatMap((row, index): Feature[] => {
    const lat = numberOf(row[geometry.latitude])
    const lng = numberOf(row[geometry.longitude])
    const properties = { weight: weight(index), category: mapping.category ? String(row[mapping.category] ?? '') : '' }
    const point: Feature = { type: 'Feature', properties, geometry: { type: 'Point', coordinates: [lng, lat] } }
    if (kind !== 'wind' || !mapping.direction) return [point]
    const toward = ((numberOf(row[mapping.direction]) + 180) * Math.PI) / 180
    const length = WIND_LENGTH[0] + (WIND_LENGTH[1] - WIND_LENGTH[0]) * weight(index)
    const end = [lng + (length * Math.sin(toward)) / Math.cos((lat * Math.PI) / 180), lat + length * Math.cos(toward)]
    return [{ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: [[lng, lat], end] } }, point]
  })

  const corners = features.flatMap((feature) => (feature.geometry.type === 'Point' ? [feature.geometry.coordinates as number[]] : (feature.geometry.coordinates as number[][])))
  const lngs = corners.map((corner) => corner[0])
  const lats = corners.map((corner) => corner[1])
  return {
    kind,
    features,
    colors,
    bounds: corners.length ? [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]] : null,
  }
}

function addLayers(map: mapboxgl.Map, layer: MapLayer) {
  map.addSource('asset', { type: 'geojson', data: { type: 'FeatureCollection', features: layer.features } as GeoJSON.FeatureCollection })
  const points: mapboxgl.FilterSpecification = ['==', ['geometry-type'], 'Point']
  if (layer.kind === 'heatmap') {
    map.addLayer({
      id: 'asset-heat',
      type: 'heatmap',
      source: 'asset',
      paint: {
        'heatmap-weight': ['+', 0.35, ['*', 0.65, ['get', 'weight']]],
        'heatmap-radius': 36,
        'heatmap-intensity': 1.2,
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(226, 54, 91, 0)', 0.4, 'rgba(226, 54, 91, 0.5)', 0.8, SITE_RED, 1, '#ffffff'],
      },
    })
    return
  }
  if (layer.kind === 'area') {
    const color: mapboxgl.ExpressionSpecification | string = layer.colors.length
      ? ['match', ['get', 'category'], ...layer.colors.flat(), SITE_HALO]
      : SITE_HALO
    map.addLayer({
      id: 'asset-zones',
      type: 'circle',
      source: 'asset',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'weight'], 0, 14, 1, 40],
        'circle-color': color,
        'circle-opacity': 0.3,
        'circle-stroke-color': color,
        'circle-stroke-width': 1,
        'circle-pitch-alignment': 'map',
      },
    })
    return
  }
  if (layer.kind === 'wind') {
    map.addLayer({
      id: 'asset-wind',
      type: 'line',
      source: 'asset',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': '#ffffff', 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['get', 'weight'], 0, 1.5, 1, 3] },
    })
    map.addLayer({
      id: 'asset-stations',
      type: 'circle',
      source: 'asset',
      filter: points,
      paint: { 'circle-radius': 4, 'circle-color': WIND_DOT, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 },
    })
    return
  }
  map.addLayer({
    id: 'asset-halo',
    type: 'circle',
    source: 'asset',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'weight'], 0, 10, 1, 22],
      'circle-color': SITE_HALO,
      'circle-opacity': 0.28,
      'circle-pitch-alignment': 'map',
    },
  })
  map.addLayer({
    id: 'asset-points',
    type: 'circle',
    source: 'asset',
    paint: { 'circle-radius': 4, 'circle-color': SITE_RED, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 },
  })
}

function AssetMap({ data, interactive, bare, hint }: { data?: AssetData; interactive: boolean; bare: boolean; hint: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rows = data?.rows
  const chartType = data?.view.chartType ?? 'map:points'
  const mappingKey = JSON.stringify(data?.view.mapping ?? {})
  const layer = useMemo(() => (rows ? mapLayerOf(rows, chartType, JSON.parse(mappingKey) as Record<string, string>) : DEFAULT_LAYER), [rows, chartType, mappingKey])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container,
      style: MAPBOX_STYLE,
      ...(layer.bounds ? { bounds: layer.bounds, fitBoundsOptions: { padding: 40, maxZoom: 11.5 } } : { center: [54.5, 24.345] as [number, number], zoom: 10.6 }),
      pitch: 50,
      bearing: -18,
      attributionControl: false,
    })
    map.on('load', () => addLayers(map, layer))
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container)
    return () => {
      observer.disconnect()
      map.remove()
    }
  }, [layer])

  return (
    <div
      className={[styles.map, interactive ? styles.mapInteractive : null, bare ? styles.mapBare : null].filter(Boolean).join(' ')}
      data-node-interactive={interactive || undefined}
      data-native-scroll={interactive || undefined}
    >
      <div ref={containerRef} className={styles.mapCanvas} />
      {interactive || !hint ? null : <span className={styles.mapHint}>Select to explore</span>}
    </div>
  )
}

type NodeAssetPreviewProps = {
  kind: AssetPreview
  /** The asset to draw; without one, a sample of its kind. */
  data?: AssetData
  interactive: boolean
  /** Drops the preview's own frame, for node styles where the card itself is the frame. */
  bare?: boolean
  /** Charts: four labelled gridlines and a mono figure, as in the design system. */
  labelledAxis?: boolean
  /** A static map's "Select to explore" hint; off where selecting doesn't make it interactive. */
  hint?: boolean
}

export function NodeAssetPreview({ kind, data, interactive, bare = false, labelledAxis = false, hint = true }: NodeAssetPreviewProps) {
  if (kind === 'map') return <AssetMap data={data} interactive={interactive} bare={bare} hint={hint} />
  if (kind === 'table') return <AssetTable rows={data?.rows ?? SITE_ROWS} bare={bare} />
  const chartType = data?.view.chartType
  if (data && chartType !== 'line' && chartType !== 'area') return <AssetPlot data={data} bare={bare} />
  return <AssetChart series={data ? seriesOf(data) : DEFAULT_SERIES} bare={bare} labelledAxis={labelledAxis} />
}
