import { useId } from 'react'
import { AiGeneratedBadge } from './AiGeneratedBadge'
import type { CreatedComponent, WidgetVariant } from './assistantReplyTypes'
import { SparkAxes } from './SparkAxes'
import { sparkPath, sparkScale, sparkX } from './sparkScale'
import styles from './KpiWidgets.module.css'

function StatusBadge({
  label,
  tone = 'normal',
}: {
  label: string
  tone?: 'critical' | 'normal' | 'warning'
}) {
  const toneClass =
    tone === 'critical' ? styles.badgeCritical : tone === 'warning' ? styles.badgeWarning : styles.badgeNormal
  return <span className={`${styles.badge} ${toneClass}`}>{label}</span>
}

function WidgetTitle({
  children,
  aiGenerated = false,
  muted = false,
}: {
  children: string
  aiGenerated?: boolean
  muted?: boolean
}) {
  return (
    <div className={styles.widgetTitleRow}>
      <p className={muted ? styles.widgetTitleMuted : styles.widgetTitle}>{children}</p>
      {aiGenerated ? <AiGeneratedBadge /> : null}
    </div>
  )
}

function AqiWidget({ aiGenerated }: { aiGenerated?: boolean }) {
  return (
    <div className={styles.widgetInner}>
      <WidgetTitle aiGenerated={aiGenerated}>Air Quality Index</WidgetTitle>
      <p className={styles.widgetValue}>121</p>
      <div className={styles.gaugeTrack} aria-hidden>
        <span className={styles.gaugeThumb} style={{ left: '72%' }} />
      </div>
      <StatusBadge label="Unhealthy for Sensitive Groups" tone="warning" />
    </div>
  )
}

function PollutantsWidget() {
  const items: { name: string; value: string; unit: string; tone: 'critical' | 'normal' }[] = [
    { name: 'O₃', value: '48', unit: 'µg', tone: 'normal' },
    { name: 'NO₂', value: '430', unit: 'µg', tone: 'critical' },
    { name: 'SO₂', value: '12', unit: 'µg', tone: 'normal' },
    { name: 'CO', value: '0.4', unit: 'mg', tone: 'normal' },
    { name: 'PM₁₀', value: '38', unit: 'µg', tone: 'normal' },
    { name: 'PM₂.₅', value: '70', unit: 'µg', tone: 'critical' },
    { name: 'NH₃', value: '9', unit: 'µg', tone: 'normal' },
    { name: 'VOC', value: '22', unit: 'µg', tone: 'normal' },
    { name: 'H₂S', value: '3', unit: 'µg', tone: 'critical' },
  ]

  return (
    <div className={styles.widgetInner}>
      <p className={styles.widgetTitle}>Pollutant Readings</p>
      <div className={styles.pollutantGrid}>
        {items.map((item) => (
          <div key={item.name} className={styles.pollutantCell}>
            <span className={styles.pollutantName}>{item.name}</span>
            <span className={styles.pollutantValue}>
              {item.value}
              <span className={styles.pollutantUnit}>{item.unit}</span>
            </span>
            <StatusBadge label={item.tone === 'critical' ? 'Critical' : 'Normal'} tone={item.tone} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PopulationWidget() {
  return (
    <div className={styles.widgetInner}>
      <p className={styles.widgetTitle}>Population</p>
      <p className={styles.widgetValueSm}>2.5 million</p>
      <div className={styles.stackedBar} aria-hidden>
        <span className={styles.stackAdults} style={{ width: '68%' }} />
        <span className={styles.stackYouth} style={{ width: '22%' }} />
        <span className={styles.stackSeniors} style={{ width: '10%' }} />
      </div>
      <ul className={styles.legendList}>
        <li>
          <span className={`${styles.legendDot} ${styles.dotAdults}`} />
          Adults (20–59)
          <span className={styles.legendValue}>1.7M · 68%</span>
        </li>
        <li>
          <span className={`${styles.legendDot} ${styles.dotYouth}`} />
          Youth (0–19)
          <span className={styles.legendValue}>675K · 27%</span>
        </li>
        <li>
          <span className={`${styles.legendDot} ${styles.dotSeniors}`} />
          Seniors (60+)
          <span className={styles.legendValue}>125K · 5%</span>
        </li>
      </ul>
    </div>
  )
}

function LandUseWidget() {
  const rows = [
    { label: 'Industrial', pct: 42 },
    { label: 'Transport', pct: 28 },
    { label: 'Residential', pct: 18 },
    { label: 'Other', pct: 12 },
  ]
  return (
    <div className={styles.widgetInner}>
      <p className={styles.widgetTitle}>Land-use Distribution</p>
      <div className={styles.barList}>
        {rows.map((row) => (
          <div key={row.label} className={styles.barRow}>
            <div className={styles.barLabelRow}>
              <span>{row.label}</span>
              <span>{row.pct}%</span>
            </div>
            <div className={styles.barTrack}>
              <span className={styles.barFill} style={{ width: `${row.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function WindWidget() {
  const gradId = useId().replace(/:/g, '')
  const directions = [-45, -20, 10, -60, 90, 180, 45, -30, 15, -50] as const
  const chartPoints = [
    { x: 0, y: 18 },
    { x: 14, y: 14 },
    { x: 28, y: 22 },
    { x: 42, y: 16 },
    { x: 56, y: 24 },
    { x: 70, y: 19 },
    { x: 84, y: 27 },
    { x: 100, y: 17 },
  ] as const
  const toY = (speed: number) => 100 - (speed / 30) * 100
  const lineD = chartPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${toY(p.y)}`)
    .join(' ')
  const areaD = `${lineD} L 100 100 L 0 100 Z`

  return (
    <div className={`${styles.widgetInner} ${styles.windInner}`}>
      <p className={styles.widgetTitleMuted}>Wind Speed/Direction</p>
      <div className={styles.windHeaderRow}>
        <p className={styles.widgetValueSm}>
          17<span className={styles.windUnit}>km/h</span>
        </p>
        <span className={styles.windDir}>WNW</span>
      </div>
      <div className={styles.windArrowRow} aria-hidden>
        {directions.map((deg, i) => (
          <span key={i} className={styles.windArrow} style={{ transform: `rotate(${deg}deg)` }}>
            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" aria-hidden>
              <path
                d="M6 1.5 L6 9.5 M6 1.5 L3.2 4.3 M6 1.5 L8.8 4.3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ))}
      </div>
      <div className={styles.windChart}>
        <svg className={styles.windChartSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--lc-chart-teal)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--lc-chart-teal)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <line
              key={i}
              className={styles.windGridLine}
              x1="0"
              x2="100"
              y1={(i / 6) * 100}
              y2={(i / 6) * 100}
            />
          ))}
          <path d={areaD} fill={`url(#${gradId})`} />
          <path
            d={lineD}
            fill="none"
            stroke="var(--lc-chart-teal)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className={styles.windYAxis} aria-hidden>
          {[30, 25, 20, 15, 10, 5, 0].map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
        <div className={styles.windXAxis} aria-hidden>
          {['SUN', 'MON', 'TUE', 'WED'].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

const HUMIDITY = [58, 60, 66, 63, 55, 61, 68, 67, 64]
const HUMIDITY_X = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', 'Now']
const FALLBACK = [14, 22, 18, 42, 34, 52, 46]

/** A widget's trend line on small axes, filling the room under its figures. */
function Sparkline({ points, x, suffix, stroke }: { points: number[]; x?: string[]; suffix?: string; stroke?: [string, string] }) {
  const gradientId = useId().replace(/:/g, '')
  const scale = sparkScale(points, { suffix })
  return (
    <SparkAxes y={scale.labels} x={sparkX(points.length, x)} className={styles.sparkline}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.sparkSvg} aria-hidden>
        {stroke ? (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={stroke[0]} />
              <stop offset="100%" stopColor={stroke[1]} />
            </linearGradient>
          </defs>
        ) : null}
        <path
          d={sparkPath(points, scale)}
          fill="none"
          stroke={stroke ? `url(#${gradientId})` : 'rgba(115,173,245,0.95)'}
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </SparkAxes>
  )
}

function HumidityWidget() {
  return (
    <div className={styles.widgetInner}>
      <p className={styles.widgetTitle}>Avg. Humidity</p>
      <p className={styles.widgetValue}>64%</p>
      <Sparkline points={HUMIDITY} x={HUMIDITY_X} suffix="%" stroke={['#e0c27a', '#5ec4b0']} />
    </div>
  )
}

function OdorWidget() {
  return (
    <div className={styles.widgetInner}>
      <p className={styles.widgetTitle}>Odor Intensity</p>
      <p className={styles.widgetValue}>
        4.1<span className={styles.valueSuffix}>/5</span>
      </p>
      <div className={styles.gaugeTrack} aria-hidden>
        <span className={styles.gaugeThumb} style={{ left: '82%' }} />
      </div>
      <StatusBadge label="Critical" tone="critical" />
    </div>
  )
}

function ChartFallback({ title }: { title: string }) {
  return (
    <div className={styles.widgetInner}>
      <p className={styles.widgetTitle}>{title}</p>
      <Sparkline points={FALLBACK} />
    </div>
  )
}

function renderVariant(variant: WidgetVariant, title: string, aiGenerated?: boolean) {
  switch (variant) {
    case 'aqi':
      return <AqiWidget aiGenerated={aiGenerated} />
    case 'pollutants':
      return <PollutantsWidget />
    case 'population':
      return <PopulationWidget />
    case 'land-use':
      return <LandUseWidget />
    case 'wind':
      return <WindWidget />
    case 'humidity':
      return <HumidityWidget />
    case 'odor':
      return <OdorWidget />
    case 'chart':
    case 'map':
    default:
      return <ChartFallback title={title} />
  }
}

export function KpiWidget({ component, compact = false }: { component: CreatedComponent; compact?: boolean }) {
  const preview = component.preview
  if (preview?.kind !== 'widget') {
    return (
      <div className={`${styles.root} ${compact ? styles.rootCompact : styles.rootFull}`}>
        <ChartFallback title={component.title} />
      </div>
    )
  }

  return (
    <div
      className={`${styles.root} ${compact || component.inlineSize === 'square' ? styles.rootCompact : styles.rootFull}`}
    >
      {renderVariant(preview.variant, component.title, component.aiGenerated)}
    </div>
  )
}
