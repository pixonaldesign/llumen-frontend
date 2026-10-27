import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { AssetPreview } from './nodeCatalog'
import styles from './NodeCard.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const MAPBOX_STYLE = 'mapbox://styles/pixonal/cmqzd3vp2003g01s7f4oy3af9'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ANOMALIES = [26, 28, 20, 25, 30, 30, 25, 30, 29, 31, 44, 47]
const CHART_TICKS: readonly number[] = [50, 0]
/** Four gridlines, each labelled, as in the design system's chart. */
const LABELLED_TICKS: readonly number[] = [60, 40, 20, 0]
const CHART_PAD = { top: 8, right: 14, bottom: 22, left: 28 }

const SITES: readonly [number, number][] = [
  [54.488, 24.352], [54.501, 24.366], [54.472, 24.344], [54.515, 24.338], [54.532, 24.318],
  [54.548, 24.329], [54.461, 24.371], [54.437, 24.389], [54.412, 24.402], [54.526, 24.297],
  [54.566, 24.311], [54.494, 24.329], [54.452, 24.356], [54.579, 24.342],
]

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

function AssetChart({ bare, labelledAxis }: { bare: boolean; labelledAxis: boolean }) {
  const ticks = labelledAxis ? LABELLED_TICKS : CHART_TICKS
  const max = ticks[0]
  const [plotRef, size] = useLayoutSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const innerW = Math.max(0, size.w - CHART_PAD.left - CHART_PAD.right)
  const innerH = Math.max(0, size.h - CHART_PAD.top - CHART_PAD.bottom)
  const points = ANOMALIES.map((value, index) => ({
    x: CHART_PAD.left + (innerW * index) / (ANOMALIES.length - 1),
    y: CHART_PAD.top + innerH * (1 - value / max),
  }))
  const line = smoothPath(points)
  const baseline = CHART_PAD.top + innerH
  const area = points.length ? `${line} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z` : ''
  const current = hover ?? ANOMALIES.length - 1

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = event.currentTarget.offsetWidth / rect.width
    const x = (event.clientX - rect.left) * scale - CHART_PAD.left
    const index = Math.round((x / innerW) * (ANOMALIES.length - 1))
    setHover(Math.min(ANOMALIES.length - 1, Math.max(0, index)))
  }

  return (
    <div className={bare ? `${styles.chart} ${styles.chartBare}` : styles.chart} data-labelled={labelledAxis || undefined}>
      <p className={styles.chartKpi}>
        <strong>{ANOMALIES[current]}</strong>
        <span className={styles.chartKpiLabel}>Active Anomalies</span>
        {hover !== null ? <span className={styles.chartKpiPeriod}>{MONTHS[hover]}</span> : null}
      </p>
      <div className={styles.chartPlot} ref={plotRef} onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}>
        {size.w > 0 ? (
          <svg width={size.w} height={size.h} aria-label="Active anomalies per month" role="img">
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
                    {tick}
                  </text>
                </g>
              )
            })}
            <path d={area} fill="url(#asset-chart-fill)" />
            <path className={styles.chartLine} d={line} />
            {points.map((point, index) => (
              <text key={MONTHS[index]} className={styles.chartAxis} x={point.x} y={size.h - 4} textAnchor="middle">
                {MONTHS[index]}
              </text>
            ))}
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

function siteCollection() {
  return {
    type: 'FeatureCollection' as const,
    features: SITES.map((coordinates, index) => ({
      type: 'Feature' as const,
      properties: { risk: 0.4 + ((index * 37) % 60) / 100 },
      geometry: { type: 'Point' as const, coordinates },
    })),
  }
}

function AssetMap({ interactive, bare }: { interactive: boolean; bare: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container,
      style: MAPBOX_STYLE,
      center: [54.5, 24.345],
      zoom: 10.6,
      pitch: 50,
      bearing: -18,
      attributionControl: false,
    })
    map.on('load', () => {
      map.addSource('sites', { type: 'geojson', data: siteCollection() })
      map.addLayer({
        id: 'sites-halo',
        type: 'circle',
        source: 'sites',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'risk'], 0.4, 10, 1, 22],
          'circle-color': '#e2365b',
          'circle-opacity': 0.28,
          'circle-pitch-alignment': 'map',
        },
      })
      map.addLayer({
        id: 'sites',
        type: 'circle',
        source: 'sites',
        paint: {
          'circle-radius': 4,
          'circle-color': '#ff5a6e',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      })
    })
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container)
    return () => {
      observer.disconnect()
      map.remove()
    }
  }, [])

  return (
    <div
      className={[styles.map, interactive ? styles.mapInteractive : null, bare ? styles.mapBare : null].filter(Boolean).join(' ')}
      data-node-interactive={interactive || undefined}
      data-native-scroll={interactive || undefined}
    >
      <div ref={containerRef} className={styles.mapCanvas} />
      {interactive ? null : <span className={styles.mapHint}>Select to explore</span>}
    </div>
  )
}

type NodeAssetPreviewProps = {
  kind: AssetPreview
  interactive: boolean
  /** Drops the preview's own frame, for node styles where the card itself is the frame. */
  bare?: boolean
  /** Charts: four labelled gridlines and a mono figure, as in the design system. */
  labelledAxis?: boolean
}

export function NodeAssetPreview({ kind, interactive, bare = false, labelledAxis = false }: NodeAssetPreviewProps) {
  return kind === 'map' ? <AssetMap interactive={interactive} bare={bare} /> : <AssetChart bare={bare} labelledAxis={labelledAxis} />
}
