import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import styles from './StoryView.module.css'

export const EMISSIONS_LINE =
  'M0.00 9.00 C0.42 7.67 1.67 2.50 2.50 1.00 C3.33 0.00 4.17 0.00 5.00 0.00 C5.83 0.33 6.67 1.50 7.50 3.00 C8.33 4.50 9.17 7.00 10.00 9.00 C10.83 11.00 11.67 13.50 12.50 15.00 C13.33 16.50 14.17 17.00 15.00 18.00 C15.83 19.00 16.67 20.17 17.50 21.00 C18.33 21.83 19.17 22.33 20.00 23.00 C20.83 23.67 21.67 24.50 22.50 25.00 C23.33 25.50 24.17 25.67 25.00 26.00 C25.83 26.33 26.67 26.83 27.50 27.00 C28.33 27.17 29.17 26.83 30.00 27.00 C30.83 27.17 31.67 27.67 32.50 28.00 C33.33 28.33 34.17 28.67 35.00 29.00 C35.83 29.33 36.67 29.50 37.50 30.00 C38.33 30.50 39.17 31.17 40.00 32.00 C40.83 32.83 41.67 34.00 42.50 35.00 C43.33 36.00 44.17 36.83 45.00 38.00 C45.83 39.17 46.67 40.17 47.50 42.00 C48.33 43.83 49.17 46.67 50.00 49.00 C50.83 51.33 51.67 53.83 52.50 56.00 C53.33 58.17 54.17 60.50 55.00 62.00 C55.83 63.50 56.67 64.50 57.50 65.00 C58.33 65.50 59.17 65.00 60.00 65.00 C60.83 65.00 61.67 65.17 62.50 65.00 C63.33 64.83 64.17 64.00 65.00 64.00 C65.83 64.00 66.67 64.50 67.50 65.00 C68.33 65.50 69.17 66.50 70.00 67.00 C70.83 67.50 71.67 67.50 72.50 68.00 C73.33 68.50 74.17 69.50 75.00 70.00 C75.83 70.50 76.67 70.50 77.50 71.00 C78.33 71.50 79.17 72.33 80.00 73.00 C80.83 73.67 81.67 74.33 82.50 75.00 C83.33 75.67 84.17 76.50 85.00 77.00 C85.83 77.50 86.67 77.83 87.50 78.00 C88.33 78.17 89.17 78.00 90.00 78.00 C90.83 78.00 91.67 78.00 92.50 78.00 C93.33 78.00 94.17 77.83 95.00 78.00 C95.83 78.17 96.67 78.17 97.50 79.00 C98.33 79.83 99.58 82.33 100.00 83.00'

export const GROUNDWATER_LINE =
  'M0.00 8.57 C0.34 8.10 1.36 5.95 2.04 5.71 C2.72 5.48 3.40 6.67 4.08 7.14 C4.76 7.62 5.44 7.38 6.12 8.57 C6.80 9.76 7.48 11.67 8.16 14.29 C8.84 16.90 9.52 20.24 10.20 24.29 C10.88 28.33 11.56 35.00 12.24 38.57 C12.93 42.14 13.61 43.57 14.29 45.71 C14.97 47.86 15.65 49.52 16.33 51.43 C17.01 53.33 17.69 55.48 18.37 57.14 C19.05 58.81 19.73 60.48 20.41 61.43 C21.09 62.38 21.77 62.38 22.45 62.86 C23.13 63.33 23.81 64.29 24.49 64.29 C25.17 64.29 25.85 63.57 26.53 62.86 C27.21 62.14 27.89 61.19 28.57 60.00 C29.25 58.81 29.93 57.14 30.61 55.71 C31.29 54.29 31.97 52.86 32.65 51.43 C33.33 50.00 34.01 48.57 34.69 47.14 C35.37 45.71 36.05 44.05 36.73 42.86 C37.41 41.67 38.10 40.71 38.78 40.00 C39.46 39.29 40.14 38.33 40.82 38.57 C41.50 38.81 42.18 40.00 42.86 41.43 C43.54 42.86 44.22 45.71 44.90 47.14 C45.58 48.57 46.26 49.52 46.94 50.00 C47.62 50.48 48.30 50.24 48.98 50.00 C49.66 49.76 50.34 49.05 51.02 48.57 C51.70 48.10 52.38 47.86 53.06 47.14 C53.74 46.43 54.42 45.24 55.10 44.29 C55.78 43.33 56.46 42.14 57.14 41.43 C57.82 40.71 58.50 40.48 59.18 40.00 C59.86 39.52 60.54 38.81 61.22 38.57 C61.90 38.33 62.59 38.33 63.27 38.57 C63.95 38.81 64.63 39.52 65.31 40.00 C65.99 40.48 66.67 40.71 67.35 41.43 C68.03 42.14 68.71 43.57 69.39 44.29 C70.07 45.00 70.75 45.24 71.43 45.71 C72.11 46.19 72.79 46.67 73.47 47.14 C74.15 47.62 74.83 48.10 75.51 48.57 C76.19 49.05 76.87 49.05 77.55 50.00 C78.23 50.95 78.91 52.62 79.59 54.29 C80.27 55.95 80.95 58.33 81.63 60.00 C82.31 61.67 82.99 62.62 83.67 64.29 C84.35 65.95 85.03 68.57 85.71 70.00 C86.39 71.43 87.07 71.67 87.76 72.86 C88.44 74.05 89.12 75.95 89.80 77.14 C90.48 78.33 91.16 79.29 91.84 80.00 C92.52 80.71 93.20 81.19 93.88 81.43 C94.56 81.67 95.24 81.43 95.92 81.43 C96.60 81.43 97.28 81.43 97.96 81.43 C98.64 81.43 99.66 81.43 100.00 81.43'

/** Remaps every y of an absolute M/C path; the command structure stays intact so `d` can morph. */
export function warpPath(path: string, warp: (x: number, y: number) => number) {
  let index = 0
  let x = 0
  return path.replace(/-?\d+(?:\.\d+)?/g, (token) => {
    const value = Number(token)
    const out = index % 2 === 0 ? (x = value) : warp(x, value)
    index += 1
    return out.toFixed(2)
  })
}

export const formatCount = (value: number) => Math.round(value).toLocaleString('en-US')

export function formatSigned(value: number) {
  const rounded = Math.round(value * 100) / 100
  if (rounded === 0) return '0.00'
  return `${rounded > 0 ? '+' : '-'}${Math.abs(rounded).toFixed(2)}`
}

function useTweenedNumber(value: number, durationMs = 900) {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)

  useEffect(() => {
    const from = displayRef.current
    if (from === value) return
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const next = from + (value - from) * (1 - (1 - t) ** 3)
      displayRef.current = next
      setDisplay(next)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, durationMs])

  return display
}

export function AnimatedNumber({ value, format }: { value: number; format: (value: number) => string }) {
  return <>{format(useTweenedNumber(value))}</>
}

export function KpiLine(
  props: { text: string } | { value: number; format: (value: number) => string; suffix: string },
) {
  if ('text' in props) {
    const [, lead = props.text, rest = ''] = /^([^A-Za-z]*\d)\s*(.*)$/.exec(props.text) ?? []
    return (
      <p className={styles.visualValue}>
        <strong>{lead}</strong>
        {rest ? <span>{rest}</span> : null}
      </p>
    )
  }
  return (
    <p className={styles.visualValue}>
      <strong>
        <AnimatedNumber value={props.value} format={props.format} />
      </strong>
      {props.suffix ? <span>{props.suffix}</span> : null}
    </p>
  )
}

export function TrendChart({
  yLabels,
  xLabels,
  line,
  lineColor,
  gradientId,
  dashed = false,
}: {
  yLabels: string[]
  xLabels: string[]
  line: string
  lineColor: string
  gradientId: string
  dashed?: boolean
}) {
  const ticks = yLabels.map((_, index) =>
    yLabels.length === 1 ? 0 : (index / (yLabels.length - 1)) * 100,
  )
  const area = `${line} L100 100 L0 100 Z`

  return (
    <div className={styles.chart}>
      <div className={styles.chartMain}>
        <div className={styles.yAxis}>
          {yLabels.map((label, index) => (
            <span key={label} style={{ top: `${ticks[index]}%` }}>
              {label}
            </span>
          ))}
        </div>
        <svg className={styles.chartSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.42" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            className={styles.chartPath}
            d={area}
            style={{ d: `path('${area}')` } as CSSProperties}
            fill={`url(#${gradientId})`}
          />
          {dashed ? (
            <line
              x1="0"
              y1="0"
              x2="100"
              y2="100"
              stroke="rgba(255,255,255,0.72)"
              strokeWidth="1.25"
              strokeDasharray="3.5 3"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          <path
            className={styles.chartPath}
            d={line}
            style={{ d: `path('${line}')` } as CSSProperties}
            fill="none"
            stroke={lineColor}
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className={styles.chartX}>
        {xLabels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
    </div>
  )
}

const DEMO_EMISSIONS_LABELS = ['7.5k', '5k', '2.5k', '0']
const DEMO_GROUNDWATER = 68
const DEMO_TERRESTRIAL = 443
const DEMO_MARINE = 156
const DEMO_ONLINE = 575
const DEMO_SITES = 599
const DEMO_UPTIME = 96
const DEMO_OFFLINE_BARS = [12, 35]

const EMISSIONS_X = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00']
const GROUNDWATER_X = ['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22']

export function EmissionsChart({
  yLabels,
  line,
  gradientId = 'emissions-area',
  kpi,
  xLabels = EMISSIONS_X,
  legend = ['Observed', 'Typical'],
}: {
  yLabels: string[]
  line: string
  gradientId?: string
  kpi?: ReactNode
  xLabels?: string[]
  legend?: [string, string]
}) {
  return (
    <>
      <p className={styles.visualTitle}>Traffic Volume vs Typical Pattern</p>
      {kpi}
      <div className={styles.chartLegend}>
        <span>
          <i className={styles.swatchProjected} />
          {legend[0]}
        </span>
        <span>
          <i className={styles.swatchPlanned} />
          {legend[1]}
        </span>
      </div>
      <TrendChart
        yLabels={yLabels}
        xLabels={xLabels}
        line={line}
        lineColor="#7dcea0"
        gradientId={gradientId}
        dashed
      />
    </>
  )
}

export function GroundwaterChart({
  value,
  line,
  gradientId = 'groundwater-area',
  kpi,
  xLabels = GROUNDWATER_X,
}: {
  value: number
  line: string
  gradientId?: string
  kpi?: ReactNode
  xLabels?: string[]
}) {
  return (
    <>
      <p className={styles.visualTitle}>Average Junction Load</p>
      {kpi === undefined ? (
        <p className={styles.visualValue}>
          <strong>
            <AnimatedNumber value={value} format={formatCount} />
          </strong>
          <span>%</span>
        </p>
      ) : (
        kpi
      )}
      <TrendChart
        yLabels={['100', '50', '0']}
        xLabels={xLabels}
        line={line}
        lineColor="#ee7b93"
        gradientId={gradientId}
      />
    </>
  )
}

export function BiodiversityChart({
  terrestrial,
  marine,
  kpi,
}: {
  terrestrial: number
  marine: number
  kpi?: ReactNode
}) {
  const total = terrestrial + marine
  const terrestrialPct = Math.round((terrestrial / total) * 100)
  return (
    <>
      <p className={styles.visualTitle}>Junction Traffic Status</p>
      {kpi === undefined ? (
        <p className={styles.visualValue}>
          <strong>
            <AnimatedNumber value={total} format={formatCount} />
          </strong>
          <span>Junctions</span>
        </p>
      ) : (
        kpi
      )}
      <div className={styles.splitBar} aria-hidden>
        <span className={styles.splitTerrestrial} style={{ flexGrow: terrestrial }} />
        <span className={styles.splitMarine} style={{ flexGrow: marine }} />
      </div>
      <div className={styles.seriesRow}>
        <span>
          <i className={styles.swatchTerrestrial} />
          Free-flowing
        </span>
        <b>
          <AnimatedNumber value={terrestrial} format={formatCount} /> (
          <AnimatedNumber value={terrestrialPct} format={formatCount} />
          %)
        </b>
      </div>
      <div className={styles.seriesRow}>
        <span>
          <i className={styles.swatchMarine} />
          Congested
        </span>
        <b>
          <AnimatedNumber value={marine} format={formatCount} /> (
          <AnimatedNumber value={100 - terrestrialPct} format={formatCount} />
          %)
        </b>
      </div>
    </>
  )
}

export function MonitoringSitesChart({
  online,
  sites,
  uptime,
  offlineBars,
  kpi,
}: {
  online: number
  sites: number
  uptime: number
  offlineBars: number[]
  kpi?: ReactNode
}) {
  const offline = new Set(offlineBars)
  return (
    <>
      <p className={styles.visualTitle}>Live Junction Data</p>
      {kpi === undefined ? (
        <p className={styles.visualValue}>
          <strong>
            <AnimatedNumber value={online} format={formatCount} />
          </strong>
          <span>/{sites} Reporting</span>
        </p>
      ) : (
        kpi
      )}
      <span className={styles.uptimeChip}>
        <AnimatedNumber value={uptime} format={formatCount} />% Coverage
      </span>
      <div className={styles.siteBars} aria-hidden>
        {Array.from({ length: 47 }, (_, index) => (
          <span key={index} className={offline.has(index) ? styles.siteOff : styles.siteOn} />
        ))}
      </div>
    </>
  )
}

export const STORY_CHARTS = [
  {
    id: 'chart-emissions',
    title: 'Traffic Volume vs Typical Pattern',
    category: 'Trends',
  },
  {
    id: 'chart-groundwater',
    title: 'Average Junction Load',
    category: 'Trends',
  },
  {
    id: 'chart-biodiversity',
    title: 'Junction Traffic Status',
    category: 'Comparison',
  },
  {
    id: 'chart-sites',
    title: 'Live Junction Data',
    category: 'Distribution',
  },
] as const

export function StoryChartPreview({ id }: { id: string }) {
  if (id === 'chart-emissions') {
    return (
      <EmissionsChart
        yLabels={DEMO_EMISSIONS_LABELS}
        line={EMISSIONS_LINE}
        gradientId="picker-emissions-area"
      />
    )
  }
  if (id === 'chart-groundwater') {
    return (
      <GroundwaterChart
        value={DEMO_GROUNDWATER}
        line={GROUNDWATER_LINE}
        gradientId="picker-groundwater-area"
      />
    )
  }
  if (id === 'chart-biodiversity') {
    return <BiodiversityChart terrestrial={DEMO_TERRESTRIAL} marine={DEMO_MARINE} />
  }
  if (id === 'chart-sites') {
    return (
      <MonitoringSitesChart
        online={DEMO_ONLINE}
        sites={DEMO_SITES}
        uptime={DEMO_UPTIME}
        offlineBars={DEMO_OFFLINE_BARS}
      />
    )
  }
  return null
}
