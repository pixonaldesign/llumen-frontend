import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { BRIEFING_ASSETS, type AssetSlice, type BriefingAsset } from './briefingAssetData'
import styles from './BriefingAssets.module.css'

/** Charts play card by card, each starting a beat after the previous one. */
const CARD_STAGGER_MS = 70
/** The first row peeks under the findings, so its charts load with the page and stay loaded. */
const PEEK_COUNT = 4
const CHART_LAG_MS = 280
const COUNT_MS = 1200
/** Half a typical tooltip's width: keeps it inside the card, which clips its overflow. */
const TIP_EDGE = 64

const SIZE_CLASS = { small: styles.small, medium: styles.medium, large: styles.large, wide: styles.wide } as const

type Play = { play: boolean; delay: number }
type TipRow = { name: string; color: string; value: string }
/**
 * Viewport coordinates of the data point, with what to show for it. Tips with `rows` sit beside the point
 * rather than above it, since they are too tall to fit over the plot.
 */
type Tip = { x: number; y: number; label: string; value?: string; rows?: TipRow[] }
type PlacedTip = Tip & { side?: 'left' | 'right' }
type ShowTip = (tip: Tip | null) => void

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function BriefingAssetGrid({
  play,
}: {
  /** Plays the entrance; turning it off resets so the next entrance replays. */
  play: boolean
}) {
  const [reduce] = useState(prefersReducedMotion)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])
  const playing = play || reduce
  return (
    <div className={styles.grid}>
      {BRIEFING_ASSETS.map((asset, index) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          play={playing || (mounted && index < PEEK_COUNT)}
          delay={reduce ? 0 : index * CARD_STAGGER_MS}
        />
      ))}
    </div>
  )
}

export function AssetCard({ asset, play, delay }: Play & { asset: BriefingAsset }) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<PlacedTip | null>(null)
  const showTip = useCallback<ShowTip>((next) => {
    const body = bodyRef.current
    if (!next || !body) {
      setTip(null)
      return
    }
    const rect = body.getBoundingClientRect()
    const x = next.x - rect.left
    setTip(
      next.rows
        ? { ...next, x, y: next.y - rect.top, side: x > rect.width / 2 ? 'left' : 'right' }
        : { ...next, x: Math.min(Math.max(x, TIP_EDGE), rect.width - TIP_EDGE), y: next.y - rect.top },
    )
  }, [])
  return (
    <article
      className={`${styles.card} ${SIZE_CLASS[asset.size]}`}
      data-play={play}
      style={{ ['--accent' as string]: asset.accent, ['--d' as string]: `${delay}ms` } as CSSProperties}
    >
      <header className={styles.cardHead}>
        <span className={styles.category}>{asset.category}</span>
        <h3 className={styles.cardTitle}>{asset.title}</h3>
      </header>
      <div ref={bodyRef} className={styles.body} onPointerLeave={() => setTip(null)}>
        <AssetVisual asset={asset} play={play} delay={delay + CHART_LAG_MS} showTip={showTip} />
        {tip ? (
          <div
            className={`${styles.tip}${tip.side ? ` ${tip.side === 'left' ? styles.tipLeft : styles.tipRight}` : ''}`}
            style={{ left: tip.x, top: tip.y }}
            role="status"
          >
            <span>{tip.label}</span>
            {tip.value ? <strong>{tip.value}</strong> : null}
            {tip.rows?.map((row) => (
              <span key={row.name} className={styles.tipRow}>
                <span className={styles.legendDot} style={{ background: row.color }} />
                <span>{row.name}</span>
                <strong>{row.value}</strong>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function AssetVisual({ asset, play, delay, showTip }: Play & { asset: BriefingAsset; showTip: ShowTip }) {
  switch (asset.kind) {
    case 'area':
      return <AreaVisual asset={asset} play={play} delay={delay} showTip={showTip} />
    case 'hbar':
      return (
        <ul className={styles.hbars}>
          {asset.bars.map((bar, i) => (
            <li
              key={bar.label}
              className={styles.hbar}
              style={{ ['--i' as string]: i }}
              onPointerMove={(event) =>
                showTip({ x: event.clientX, y: event.clientY, label: bar.label, value: `+${bar.value} ${asset.unit}` })
              }
            >
              <span className={styles.hbarLabel}>{bar.label}</span>
              <span className={styles.track}>
                <span className={styles.fill} style={{ width: `${(bar.value / asset.bars[0].value) * 100}%` }} />
              </span>
              <span className={styles.hbarValue}>
                +{bar.value} {asset.unit}
              </span>
            </li>
          ))}
        </ul>
      )
    case 'vbar': {
      const max = Math.max(...asset.bars.map((bar) => bar.value))
      return (
        <>
          <ValueRow value={asset.value} unit={asset.unit} delta={asset.delta} play={play} delay={delay} />
          <div className={styles.vbars}>
            {asset.bars.map((bar, i) => (
              <div
                key={bar.label}
                className={styles.vcol}
                style={{ ['--i' as string]: i }}
                onPointerEnter={(event) => {
                  const fill = event.currentTarget.querySelector('[data-tip-anchor]')!.getBoundingClientRect()
                  showTip({
                    x: fill.left + fill.width / 2,
                    y: fill.top,
                    label: bar.label,
                    value: `${bar.value.toLocaleString('en-US')} ${asset.tipUnit}`,
                  })
                }}
              >
                <span className={styles.vtrack}>
                  <span
                    data-tip-anchor
                    className={`${styles.vfill}${bar.value === max ? ` ${styles.vfillPeak}` : ''}`}
                    style={{ height: `${(bar.value / max) * 100}%` }}
                  />
                </span>
                <span className={styles.vlabel}>{bar.label}</span>
              </div>
            ))}
          </div>
        </>
      )
    }
    case 'donut':
      return (
        <Ring slices={asset.slices} pie={false} showTip={showTip}>
          <strong>{asset.centre}</strong>
          <span>{asset.centreLabel}</span>
        </Ring>
      )
    case 'pie':
      return <Ring slices={asset.slices} pie showTip={showTip} />
    case 'kpi': {
      const last = asset.spark.length - 1
      return (
        <>
          <p className={`${styles.value} ${styles.kpiValue}`}>
            {asset.prefix}
            <CountUp value={asset.value} play={play} delay={delay} />
            {asset.suffix}
          </p>
          <p className={styles.caption}>{asset.caption}</p>
          <Sparkline
            points={asset.spark}
            showTip={showTip}
            describe={(i) => ({
              label: i === last ? 'This week' : `${last - i} wk ago`,
              value: `${asset.prefix ?? ''}${asset.spark[i]}${asset.suffix ?? ''}`,
            })}
          />
        </>
      )
    }
    case 'kpiGrid':
      return (
        <div className={styles.metrics}>
          {asset.metrics.map((metric, i) => (
            <div key={metric.label} className={styles.metric} style={{ ['--i' as string]: i }}>
              <span className={styles.metricLabel}>{metric.label}</span>
              <span className={styles.metricValue}>
                <CountUp value={metric.value} play={play} delay={delay + i * 120} />
                {metric.suffix ? <small>{metric.suffix}</small> : null}
              </span>
              <span className={`${styles.metricDelta}${metric.good ? '' : ` ${styles.metricDeltaBad}`}`}>
                {metric.delta}
              </span>
            </div>
          ))}
        </div>
      )
    case 'gauge':
      return (
        <>
          <div className={styles.gauge}>
            <svg viewBox="0 0 120 72" aria-hidden>
              <path
                className={styles.gaugeTrack}
                d="M 12 64 A 48 48 0 0 1 108 64"
                onPointerMove={(event) =>
                  showTip({
                    x: event.clientX,
                    y: event.clientY,
                    label: 'Gap to target',
                    value: `${100 - asset.value}%`,
                  })
                }
              />
              <path
                className={styles.gaugeFill}
                d="M 12 64 A 48 48 0 0 1 108 64"
                pathLength={100}
                style={{ ['--len' as string]: asset.value }}
                onPointerMove={(event) =>
                  showTip({ x: event.clientX, y: event.clientY, label: 'Pressure', value: `${asset.value}% of target` })
                }
              />
              <text className={styles.gaugeText} x="60" y="60" textAnchor="middle">
                <CountUp value={asset.value} play={play} delay={delay} />%
              </text>
            </svg>
          </div>
          <p className={styles.caption}>{asset.caption}</p>
        </>
      )
    case 'multiArea':
      return <MultiAreaVisual asset={asset} showTip={showTip} />
  }
}

/** Index of the point nearest the pointer, across a plot that spans the points evenly. */
function nearestIndex(event: ReactPointerEvent<HTMLElement>, count: number) {
  const rect = event.currentTarget.getBoundingClientRect()
  const t = (event.clientX - rect.left) / Math.max(1, rect.width)
  return { index: Math.min(count - 1, Math.max(0, Math.round(t * (count - 1)))), rect }
}

function AreaVisual({
  asset,
  play,
  delay,
  showTip,
}: Play & { asset: Extract<BriefingAsset, { kind: 'area' }>; showTip: ShowTip }) {
  const gradientId = `aq${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...asset.points, asset.threshold.value) * 1.12
  const coords = asset.points.map((v, i): [number, number] => [
    (i / (asset.points.length - 1)) * 100,
    40 - (v / max) * 40,
  ])
  const line = smoothPath(coords)
  const last = coords[coords.length - 1]
  const lastIndex = asset.points.length - 1
  return (
    <>
      <ValueRow value={asset.value} unit={asset.unit} delta={asset.delta} play={play} delay={delay} large />
      <div
        className={styles.plot}
        onPointerMove={(event) => {
          const { index, rect } = nearestIndex(event, asset.points.length)
          setHover(index)
          const hours = Math.round((index / lastIndex) * 24)
          showTip({
            x: rect.left + (coords[index][0] / 100) * rect.width,
            y: rect.top + (coords[index][1] / 40) * rect.height,
            label: index === lastIndex ? 'Now' : `${String(hours).padStart(2, '0')}:00`,
            value: `${asset.points[index]} ${asset.tipUnit}`,
          })
        }}
        onPointerLeave={() => setHover(null)}
      >
        <div className={styles.threshold} style={{ top: `${(1 - asset.threshold.value / max) * 100}%` }}>
          <span>
            {asset.threshold.label} · {asset.threshold.value}
          </span>
        </div>
        <svg className={styles.plotSvg} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={asset.accent} stopOpacity="0.5" />
              <stop offset="1" stopColor={asset.accent} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L100,40 L0,40 Z`} fill={`url(#${gradientId})`} />
          <path className={styles.plotLine} d={line} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className={styles.plotDot} style={{ left: `${last[0]}%`, top: `${(last[1] / 40) * 100}%` }} />
        {hover != null ? <HoverMark x={coords[hover][0]} y={(coords[hover][1] / 40) * 100} /> : null}
      </div>
      <div className={styles.axis}>
        {asset.axis.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </>
  )
}

/** Series are drawn in order, so list the highest first to keep lower areas visible on top. */
function MultiAreaVisual({
  asset,
  showTip,
}: {
  asset: Extract<BriefingAsset, { kind: 'multiArea' }>
  showTip: ShowTip
}) {
  const gradientId = `ma${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [hover, setHover] = useState<number | null>(null)
  const count = asset.labels.length
  const plotted = asset.series.map((series) => ({
    ...series,
    coords: series.points.map((v, i): [number, number] => [
      (i / (count - 1)) * 100,
      40 - ((v - asset.floor) / (100 - asset.floor)) * 40,
    ]),
  }))
  return (
    <>
      <ul className={`${styles.legend} ${styles.seriesLegend}`}>
        {asset.series.map((series) => (
          <li key={series.name}>
            <span className={styles.legendDot} style={{ background: series.color }} />
            <span className={styles.legendName}>{series.name}</span>
            <span className={styles.legendPct}>
              {series.points[count - 1]}
              {asset.suffix}
            </span>
          </li>
        ))}
      </ul>
      <div
        className={styles.plot}
        onPointerMove={(event) => {
          const { index, rect } = nearestIndex(event, count)
          setHover(index)
          showTip({
            x: rect.left + (index / (count - 1)) * rect.width,
            y: rect.top + rect.height / 2,
            label: asset.labels[index],
            rows: asset.series.map((series) => ({
              name: series.name,
              color: series.color,
              value: `${series.points[index]}${asset.suffix}`,
            })),
          })
        }}
        onPointerLeave={() => setHover(null)}
      >
        <svg className={styles.plotSvg} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
          <defs>
            {plotted.map((series, i) => (
              <linearGradient key={series.name} id={`${gradientId}${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={series.color} stopOpacity="0.32" />
                <stop offset="1" stopColor={series.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {plotted.map((series, i) => {
            const line = smoothPath(series.coords)
            return (
              <g key={series.name}>
                <path d={`${line} L100,40 L0,40 Z`} fill={`url(#${gradientId}${i})`} />
                <path
                  className={styles.plotLine}
                  d={line}
                  style={{ stroke: series.color }}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )
          })}
        </svg>
        {hover != null ? (
          <>
            <span className={styles.guide} style={{ left: `${plotted[0].coords[hover][0]}%` }} />
            {plotted.map((series) => (
              <span
                key={series.name}
                className={styles.hoverDot}
                style={{
                  left: `${series.coords[hover][0]}%`,
                  top: `${(series.coords[hover][1] / 40) * 100}%`,
                  borderColor: series.color,
                }}
              />
            ))}
          </>
        ) : null}
      </div>
      <div className={styles.axis}>
        {asset.axis.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </>
  )
}

/** Guide line and ring on the hovered point; x and y are percentages of the plot. */
function HoverMark({ x, y }: { x: number; y: number }) {
  return (
    <>
      <span className={styles.guide} style={{ left: `${x}%` }} />
      <span className={styles.hoverDot} style={{ left: `${x}%`, top: `${y}%` }} />
    </>
  )
}

function ValueRow({
  value,
  unit,
  delta,
  play,
  delay,
  large = false,
}: Play & { value: number; unit: string; delta: string; large?: boolean }) {
  return (
    <div className={styles.valueRow}>
      <span className={`${styles.value}${large ? ` ${styles.valueLarge}` : ''}`}>
        <CountUp value={value} play={play} delay={delay} />
      </span>
      <span className={styles.unit}>{unit}</span>
      <span className={styles.delta}>{delta}</span>
    </div>
  )
}

function Ring({
  slices,
  pie,
  showTip,
  children,
}: {
  slices: AssetSlice[]
  pie: boolean
  showTip: ShowTip
  children?: ReactNode
}) {
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((sum, slice) => sum + slice.pct, 0))
  const r = pie ? 25 : 46
  const box = pie ? 100 : 120
  const c = box / 2
  return (
    <div className={styles.ring}>
      <div className={styles.ringChart}>
        <svg viewBox={`0 0 ${box} ${box}`} aria-hidden>
          {pie ? null : <circle className={styles.ringTrack} cx={c} cy={c} r={r} />}
          {slices.map((slice, i) => (
            <circle
              key={slice.name}
              className={`${styles.ringSeg}${pie ? ` ${styles.pieSeg}` : ''}`}
              cx={c}
              cy={c}
              r={r}
              pathLength={100}
              transform={`rotate(-90 ${c} ${c})`}
              style={
                {
                  stroke: slice.color,
                  strokeDashoffset: -starts[i],
                  ['--len' as string]: Math.max(0, slice.pct - (pie ? 0 : 1.2)),
                  ['--i' as string]: i,
                } as CSSProperties
              }
              onPointerMove={(event) =>
                showTip({ x: event.clientX, y: event.clientY, label: slice.name, value: `${slice.pct}%` })
              }
            />
          ))}
        </svg>
        {children ? <div className={styles.ringCentre}>{children}</div> : null}
      </div>
      <ul className={styles.legend}>
        {slices.map((slice) => (
          <li key={slice.name}>
            <span className={styles.legendDot} style={{ background: slice.color }} />
            <span className={styles.legendName}>{slice.name}</span>
            <span className={styles.legendPct}>{slice.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Sparkline({
  points,
  showTip,
  describe,
}: {
  points: number[]
  showTip: ShowTip
  describe: (index: number) => { label: string; value: string }
}) {
  const [hover, setHover] = useState<number | null>(null)
  const min = Math.min(...points)
  const span = Math.max(1, Math.max(...points) - min)
  const coords = points.map((v, i): [number, number] => [(i / (points.length - 1)) * 100, 22 - ((v - min) / span) * 18])
  return (
    <div
      className={styles.spark}
      onPointerMove={(event) => {
        const { index, rect } = nearestIndex(event, points.length)
        setHover(index)
        showTip({
          x: rect.left + (coords[index][0] / 100) * rect.width,
          y: rect.top + (coords[index][1] / 24) * rect.height,
          ...describe(index),
        })
      }}
      onPointerLeave={() => setHover(null)}
    >
      <svg className={styles.plotSvg} viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden>
        <path className={styles.plotLine} d={smoothPath(coords)} vectorEffect="non-scaling-stroke" />
      </svg>
      {hover != null ? <HoverMark x={coords[hover][0]} y={(coords[hover][1] / 24) * 100} /> : null}
    </div>
  )
}

function CountUp({ value, play, delay }: Play & { value: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!play) return
    if (prefersReducedMotion()) {
      const frame = window.requestAnimationFrame(() => setShown(value))
      return () => window.cancelAnimationFrame(frame)
    }
    const start = performance.now() + delay
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / COUNT_MS))
      setShown(Math.round(value * (1 - (1 - t) ** 3)))
      if (t < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [play, delay, value])
  return <>{(play ? shown : 0).toLocaleString('en-US')}</>
}

/** Catmull-Rom through the points, as cubic Béziers. */
function smoothPath(points: [number, number][]) {
  const f = (n: number) => n.toFixed(2)
  let d = `M${f(points[0][0])},${f(points[0][1])}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(p2[0])},${f(p2[1])}`
  }
  return d
}
