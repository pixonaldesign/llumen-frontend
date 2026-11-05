import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { ChartHeadline, ChartPill, ChartTick, StudioChart } from './studioAssetCharts'
import styles from './StudioAssetChart.module.css'

/** Drawn in the original asset artwork's own coordinates, so it scales with the card exactly as the image did. */
const W = 380
const H = 184
const PAD = 12
const RIGHT = W - PAD
const PLOT_BOTTOM = 150
const AXIS_Y = 168
const COUNT_MS = 1100

type TipRow = { name?: string; color?: string; value: string }
type Tip = { x: number; y: number; label: string; rows: TipRow[] }
type Ctx = {
  play: boolean
  delay: number
  hover: number | null
  setHover: (index: number | null) => void
  showTip: (tip: Tip | null) => void
  toSvg: (event: ReactPointerEvent) => { x: number; y: number }
}

export function StudioAssetChart({ chart, delay = 0 }: { chart: StudioChart; delay?: number }) {
  const [play, setPlay] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPlay(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const ctx: Ctx = {
    play,
    delay,
    hover,
    setHover,
    showTip: setTip,
    toSvg: (event) => {
      const rect = svgRef.current!.getBoundingClientRect()
      return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H }
    },
  }

  return (
    <div
      className={styles.chart}
      data-play={play}
      style={{ ['--d' as string]: `${delay}ms` } as CSSProperties}
      onPointerLeave={() => {
        setHover(null)
        setTip(null)
      }}
    >
      <svg ref={svgRef} className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={chart.title}>
        <text className={styles.title} x={PAD} y={21}>
          {chart.title}
        </text>
        <ChartBody chart={chart} ctx={ctx} />
      </svg>
      {tip ? <ChartTip tip={tip} /> : null}
    </div>
  )
}

function ChartBody({ chart, ctx }: { chart: StudioChart; ctx: Ctx }) {
  switch (chart.kind) {
    case 'trend':
      return <Trend chart={chart} ctx={ctx} />
    case 'columns':
      return <Columns chart={chart} ctx={ctx} />
    case 'donut':
      return <Donut chart={chart} ctx={ctx} />
    case 'split':
      return <Split chart={chart} ctx={ctx} />
    case 'meter':
      return <Meter chart={chart} ctx={ctx} />
    case 'uptime':
      return <Uptime chart={chart} ctx={ctx} />
    case 'rows':
      return <Rows chart={chart} ctx={ctx} />
  }
}

function ChartTip({ tip }: { tip: Tip }) {
  const below = tip.y < 80
  const x = tip.x < 80 ? '-16px' : tip.x > W - 80 ? 'calc(-100% + 16px)' : '-50%'
  const y = below ? '14px' : 'calc(-100% - 12px)'
  return (
    <div
      className={styles.tip}
      role="tooltip"
      style={{ left: `${(tip.x / W) * 100}%`, top: `${(tip.y / H) * 100}%`, transform: `translate(${x}, ${y})` }}
    >
      <span className={styles.tipLabel}>{tip.label}</span>
      {tip.rows.map((row, i) => (
        <span key={i} className={styles.tipRow}>
          {row.color ? <span className={styles.tipDot} style={{ background: row.color }} /> : null}
          {row.name ? <span className={styles.tipName}>{row.name}</span> : null}
          <span className={styles.tipValue}>{row.value}</span>
        </span>
      ))}
    </div>
  )
}

/* ── Kinds ─────────────────────────────────────────────────────────────── */

type Of<K extends StudioChart['kind']> = Extract<StudioChart, { kind: K }>

function Trend({ chart, ctx }: { chart: Of<'trend'>; ctx: Ctx }) {
  const id = useSvgId()
  const top = chart.headline ? 84 : 68
  const left = plotLeft(chart.ticks)
  const n = chart.labels.length
  const min = chart.ticks[0].value
  const max = chart.ticks[chart.ticks.length - 1].value
  const sx = (i: number) => left + (i / (n - 1)) * (RIGHT - left)
  const sy = (v: number) => PLOT_BOTTOM - ((v - min) / (max - min)) * (PLOT_BOTTOM - top)
  const every = chart.axisEvery ?? 1
  const labelX = (i: number) => left + 10 + (i / (n - 1)) * (RIGHT - left - 20)
  const plotted = chart.series.map((series) => ({
    ...series,
    coords: series.points.map((v, i): [number, number] => [sx(i), sy(v)]),
  }))
  const hover = ctx.hover

  return (
    <>
      {chart.headline ? <Headline headline={chart.headline} ctx={ctx} /> : null}
      {chart.legend ? <SeriesLegend series={chart.series} /> : null}
      <YAxis ticks={chart.ticks} left={left} y={sy} />
      {chart.labels.map((label, i) =>
        i % every === 0 || i === n - 1 ? (
          <text key={label} className={styles.tick} x={labelX(i)} y={AXIS_Y} textAnchor="middle">
            {label}
          </text>
        ) : null,
      )}
      <defs>
        <clipPath id={`${id}reveal`}>
          <rect className={styles.reveal} x={left - 6} y={0} width={RIGHT - left + 12} height={H} />
        </clipPath>
        {plotted.map((series, i) => (
          <linearGradient key={series.name} id={`${id}fill${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={series.fill === 'muted' ? '#ffffff' : series.color} stopOpacity={series.fill === 'muted' ? 0.12 : 0.38} />
            <stop offset="1" stopColor={series.fill === 'muted' ? '#ffffff' : series.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      <g clipPath={`url(#${id}reveal)`}>
        {plotted.map((series, i) => {
          const line = smoothPath(series.coords)
          return (
            <g key={series.name}>
              {series.fill ? (
                <path d={`${line} L${RIGHT},${PLOT_BOTTOM} L${left},${PLOT_BOTTOM} Z`} fill={`url(#${id}fill${i})`} />
              ) : null}
              <path
                className={styles.line}
                d={line}
                stroke={series.color}
                strokeDasharray={series.dashed ? '4 3' : undefined}
                strokeWidth={series.dashed ? 1.2 : 1.5}
              />
            </g>
          )
        })}
      </g>
      {hover != null ? (
        <g className={styles.marks}>
          <line className={styles.guide} x1={sx(hover)} x2={sx(hover)} y1={top} y2={PLOT_BOTTOM} />
          {plotted.map((series) => (
            <circle
              key={series.name}
              className={styles.hoverDot}
              cx={series.coords[hover][0]}
              cy={series.coords[hover][1]}
              r={3.5}
              stroke={series.color}
            />
          ))}
        </g>
      ) : null}
      <rect
        className={styles.hit}
        x={left}
        y={top - 8}
        width={RIGHT - left}
        height={PLOT_BOTTOM - top + 26}
        onPointerMove={(event) => {
          const { x } = ctx.toSvg(event)
          const index = Math.max(0, Math.min(n - 1, Math.round(((x - left) / (RIGHT - left)) * (n - 1))))
          ctx.setHover(index)
          ctx.showTip({
            x: sx(index),
            y: Math.min(...plotted.map((series) => series.coords[index][1])),
            label: chart.labels[index],
            rows: chart.series.map((series) => ({
              name: chart.series.length > 1 ? series.name : undefined,
              color: chart.series.length > 1 ? series.color : undefined,
              value: chart.format(series.points[index]),
            })),
          })
        }}
      />
    </>
  )
}

function Columns({ chart, ctx }: { chart: Of<'columns'>; ctx: Ctx }) {
  const top = 84
  const left = plotLeft(chart.ticks)
  const max = chart.ticks[chart.ticks.length - 1].value
  const sy = (v: number) => PLOT_BOTTOM - (v / max) * (PLOT_BOTTOM - top)
  const slot = (RIGHT - left) / chart.bars.length
  const width = slot * 0.7
  return (
    <>
      <Headline headline={chart.headline} ctx={ctx} />
      <YAxis ticks={chart.ticks} left={left} y={sy} />
      {chart.bars.map((bar, i) => {
        const x = left + i * slot + (slot - width) / 2
        const y = sy(bar.value)
        return (
          <g
            key={bar.label}
            className={dimClass(ctx.hover, i)}
            onPointerEnter={() => {
              ctx.setHover(i)
              ctx.showTip({ x: x + width / 2, y, label: bar.label, rows: [{ value: chart.format(bar.value) }] })
            }}
          >
            <rect className={styles.hit} x={left + i * slot} y={top - 8} width={slot} height={AXIS_Y - top + 8} />
            <rect
              className={styles.growY}
              style={stagger(i, 45)}
              x={x}
              y={y}
              width={width}
              height={PLOT_BOTTOM - y}
              rx={4}
              fill={chart.color}
            />
            <text className={styles.tick} x={x + width / 2} y={AXIS_Y} textAnchor="middle">
              {bar.label}
            </text>
          </g>
        )
      })}
    </>
  )
}

const RING = { cx: 294, cy: 106, outer: 66, inner: 47, gap: 3, corner: 4 }

function Donut({ chart, ctx }: { chart: Of<'donut'>; ctx: Ctx }) {
  const total = chart.parts.reduce((sum, part) => sum + part.share, 0)
  const angle = (share: number) => (share / total) * Math.PI * 2
  const sectors = chart.parts.map((part, i) => {
    const before = chart.parts.slice(0, i).reduce((sum, prior) => sum + prior.share, 0)
    return { part, from: angle(before), to: angle(before + part.share) }
  })
  const show = (i: number) => {
    const { part, from, to } = sectors[i]
    const mid = (from + to) / 2
    ctx.setHover(i)
    ctx.showTip({
      x: RING.cx + Math.sin(mid) * RING.outer,
      y: RING.cy - Math.cos(mid) * RING.outer,
      label: part.name,
      rows: [{ color: part.color, name: 'Incidents', value: part.display }],
    })
  }
  return (
    <>
      {chart.parts.map((part, i) => {
        const x = i % 2 === 0 ? PAD : 102
        const y = 45 + Math.floor(i / 2) * 49
        return (
          <g key={part.name} className={`${styles.fadeIn} ${dimClass(ctx.hover, i)}`} style={stagger(i, 70)} onPointerEnter={() => show(i)}>
            <rect className={styles.hit} x={x - 2} y={y - 12} width={88} height={40} />
            <circle cx={x + 4} cy={y} r={4} fill={part.color} />
            <text className={styles.legendLabel} x={x + 14} y={y + 4.5}>
              {part.name}
            </text>
            <text className={styles.figure} x={x} y={y + 25}>
              {part.display}
            </text>
          </g>
        )
      })}
      {sectors.map(({ part, from, to }, i) => (
        <path
          key={part.name}
          className={`${styles.slice} ${dimClass(ctx.hover, i)}`}
          data-active={ctx.hover === i}
          style={{ ...stagger(i, 110), transformOrigin: `${RING.cx}px ${RING.cy}px` }}
          d={sectorPath(from, to)}
          fill={part.color}
          stroke={part.color}
          strokeWidth={RING.corner * 2}
          strokeLinejoin="round"
          onPointerEnter={() => show(i)}
        />
      ))}
    </>
  )
}

function Split({ chart, ctx }: { chart: Of<'split'>; ctx: Ctx }) {
  const barTop = chart.pill ? 107 : 77
  const barH = 20
  const gap = 4
  const span = RIGHT - PAD - gap * (chart.parts.length - 1)
  const widths = chart.parts.map((part) => Math.max(10, (part.share / 100) * span))
  const excess = widths.reduce((sum, w) => sum + w, 0) - span
  widths[widths.indexOf(Math.max(...widths))] -= excess
  const xs = widths.map((_, i) => PAD + widths.slice(0, i).reduce((sum, w) => sum + w + gap, 0))
  const legendTop = barTop + barH + 16.5
  const show = (i: number) => {
    const part = chart.parts[i]
    ctx.setHover(i)
    ctx.showTip({
      x: xs[i] + widths[i] / 2,
      y: barTop,
      label: part.name,
      rows: [{ color: part.color, value: part.display }],
    })
  }
  return (
    <>
      <Headline headline={chart.headline} ctx={ctx} />
      {chart.pill ? <Pill pill={chart.pill} y={78} /> : null}
      {chart.parts.map((part, i) => (
        <g key={part.name} className={dimClass(ctx.hover, i)} onPointerEnter={() => show(i)}>
          <rect
            className={styles.growX}
            style={stagger(i, 120)}
            x={xs[i]}
            y={barTop}
            width={widths[i]}
            height={barH}
            rx={Math.min(barH, widths[i]) / 2}
            fill={part.color}
          />
          <g className={styles.fadeIn} style={stagger(i + 2, 90)}>
            <rect className={styles.hit} x={PAD} y={legendTop + i * 24 - 12} width={RIGHT - PAD} height={24} />
            <circle cx={PAD + 5} cy={legendTop + i * 24} r={5} fill={part.color} />
            <text className={styles.legendLabel} x={PAD + 16} y={legendTop + i * 24 + 4.5}>
              {part.name}
            </text>
            <text className={styles.figure} x={RIGHT} y={legendTop + i * 24 + 4} textAnchor="end">
              {part.display}
            </text>
          </g>
        </g>
      ))}
    </>
  )
}

function Meter({ chart, ctx }: { chart: Of<'meter'>; ctx: Ctx }) {
  const id = useSvgId()
  const top = 77
  const height = 19
  const span = RIGHT - PAD
  const at = PAD + (chart.value / 100) * span
  const handleX = chart.mode === 'progress' ? at - 5.5 : at
  const show = () => {
    ctx.setHover(0)
    ctx.showTip({ x: handleX, y: top - 4, label: chart.title.replace(/ \(%\)$/, ''), rows: chart.rows })
  }
  return (
    <>
      <Headline headline={chart.headline} ctx={ctx} />
      <defs>
        <linearGradient id={`${id}grad`} x1="0" y1="0" x2="1" y2="0">
          {chart.stops.map((color, i) => (
            <stop key={color} offset={i / (chart.stops.length - 1)} stopColor={color} />
          ))}
        </linearGradient>
      </defs>
      <g onPointerEnter={show}>
        <rect className={styles.hit} x={PAD} y={top - 8} width={span} height={height + 16} />
        {chart.mode === 'scale' ? (
          <rect x={PAD} y={top} width={span} height={height} rx={height / 2} fill={`url(#${id}grad)`} />
        ) : (
          <rect className={styles.track} x={PAD} y={top} width={span} height={height} rx={height / 2} />
        )}
        {chart.mode === 'progress' ? (
          <rect
            className={styles.growX}
            x={PAD}
            y={top}
            width={at - PAD}
            height={height}
            rx={height / 2}
            fill={`url(#${id}grad)`}
          />
        ) : null}
        <rect
          className={styles.handle}
          data-active={ctx.hover === 0}
          style={{ ['--from' as string]: `${PAD + 6 - handleX}px` } as CSSProperties}
          x={handleX - 5.5}
          y={top + height / 2 - 13}
          width={11}
          height={26}
          rx={5.5}
          fill={chart.handle}
        />
      </g>
      {chart.caption ? (
        <text className={`${styles.caption} ${styles.fadeIn}`} x={PAD} y={117}>
          {chart.caption}
        </text>
      ) : null}
      {chart.pill ? <Pill pill={chart.pill} y={110} /> : null}
    </>
  )
}

function Uptime({ chart, ctx }: { chart: Of<'uptime'>; ctx: Ctx }) {
  const top = 106
  const bottom = 170
  const width = 5.4
  const n = chart.days.length
  const step = (RIGHT - PAD - width) / (n - 1)
  return (
    <>
      <Headline headline={chart.headline} ctx={ctx} />
      <Pill pill={chart.pill} y={78} />
      {chart.days.map((day, i) => {
        const x = PAD + i * step
        const down = day.uptime < chart.alertBelow
        return (
          <g
            key={day.label}
            className={dimClass(ctx.hover, i)}
            onPointerEnter={() => {
              ctx.setHover(i)
              ctx.showTip({
                x: x + width / 2,
                y: top,
                label: day.label,
                rows: [
                  {
                    color: down ? '#fd7b76' : chart.pill.color,
                    name: down ? 'Outage' : 'Uptime',
                    value: `${day.uptime.toFixed(1)}%`,
                  },
                ],
              })
            }}
          >
            <rect className={styles.hit} x={x - (step - width) / 2} y={top - 4} width={step} height={bottom - top + 8} />
            <rect
              className={styles.growY}
              style={stagger(i, 14)}
              x={x}
              y={top}
              width={width}
              height={bottom - top}
              rx={width / 2}
              fill={down ? '#fd7b76' : chart.pill.color}
            />
          </g>
        )
      })}
    </>
  )
}

function Rows({ chart, ctx }: { chart: Of<'rows'>; ctx: Ctx }) {
  const max = Math.max(...chart.parts.map((part) => part.value))
  const full = 306
  return (
    <>
      {chart.parts.map((part, i) => {
        const y = 69 + i * 47
        const width = Math.max(12, (part.value / max) * full)
        return (
          <g
            key={part.name}
            className={dimClass(ctx.hover, i)}
            onPointerEnter={() => {
              ctx.setHover(i)
              ctx.showTip({ x: PAD + width / 2, y: y - 6, label: part.name, rows: [{ color: part.color, value: part.display }] })
            }}
          >
            <rect className={styles.hit} x={PAD} y={y - 30} width={RIGHT - PAD} height={44} />
            <text className={`${styles.rowLabel} ${styles.fadeIn}`} style={stagger(i, 90)} x={PAD} y={y - 13}>
              {part.name}
            </text>
            <rect className={styles.growX} style={stagger(i, 120)} x={PAD} y={y - 6} width={width} height={12} rx={6} fill={part.color} />
            <text className={`${styles.rowFigure} ${styles.fadeIn}`} style={stagger(i, 90)} x={RIGHT} y={y + 5} textAnchor="end">
              {part.display}
            </text>
          </g>
        )
      })}
    </>
  )
}

/* ── Shared pieces ─────────────────────────────────────────────────────── */

function Headline({ headline, ctx }: { headline: ChartHeadline; ctx: Ctx }) {
  return (
    <text x={PAD} y={67}>
      <tspan className={`${styles.value}${headline.sans ? ` ${styles.valueSans}` : ''}`}>
        {headline.prefix}
        <CountUp value={headline.value} decimals={headline.decimals ?? 0} play={ctx.play} delay={ctx.delay} />
        {headline.suffix}
      </tspan>
      {headline.unit ? (
        <tspan className={styles.unit} dx={headline.tight ? 1 : 6}>
          {headline.unit}
        </tspan>
      ) : null}
    </text>
  )
}

function SeriesLegend({ series }: { series: Of<'trend'>['series'] }) {
  const itemWidth = (name: string) => 15 + name.length * 6.5 + 14
  return (
    <>
      {series.map((item, i) => {
        const at = PAD + series.slice(0, i).reduce((sum, prior) => sum + itemWidth(prior.name), 0)
        return (
          <g key={item.name}>
            {item.dashed ? (
              <circle className={styles.legendRing} cx={at + 4} cy={45} r={3.6} stroke={item.color} />
            ) : (
              <circle cx={at + 4} cy={45} r={4} fill={item.color} />
            )}
            <text className={styles.legendLabel} x={at + 15} y={49.5}>
              {item.name}
            </text>
          </g>
        )
      })}
    </>
  )
}

function YAxis({ ticks, left, y }: { ticks: ChartTick[]; left: number; y: (value: number) => number }) {
  return (
    <>
      {ticks.map((tick) => (
        <g key={tick.label}>
          <line className={styles.grid} x1={left} x2={RIGHT} y1={y(tick.value)} y2={y(tick.value)} />
          <text className={styles.tick} x={left - 9} y={y(tick.value) + 3.5} textAnchor="end">
            {tick.label}
          </text>
        </g>
      ))}
    </>
  )
}

function Pill({ pill, y }: { pill: ChartPill; y: number }) {
  const textRef = useRef<SVGTextElement>(null)
  const [width, setWidth] = useState(pill.label.length * 7 + 20)
  useLayoutEffect(() => {
    const text = textRef.current
    if (text) setWidth(Math.ceil(text.getComputedTextLength()) + 22)
  }, [pill.label])
  return (
    <g className={styles.fadeIn}>
      <rect
        x={PAD + 0.75}
        y={y + 0.75}
        width={width - 1.5}
        height={18.5}
        rx={9.25}
        fill={pill.color}
        fillOpacity={0.14}
        stroke={pill.color}
        strokeWidth={1.5}
      />
      <text ref={textRef} className={styles.pillLabel} x={PAD + 11} y={y + 14}>
        {pill.label}
      </text>
    </g>
  )
}

function CountUp({ value, decimals, play, delay }: { value: number; decimals: number; play: boolean; delay: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!play) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const frame = window.requestAnimationFrame(() => setShown(value))
      return () => window.cancelAnimationFrame(frame)
    }
    const start = performance.now() + delay
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / COUNT_MS))
      setShown(value * (1 - (1 - t) ** 3))
      if (t < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [play, delay, value])
  return (
    <>
      {(play ? shown : 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </>
  )
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function useSvgId() {
  return `sa${useId().replace(/[^a-zA-Z0-9]/g, '')}`
}

/** Y labels are right-aligned against the plot, which starts after the widest of them. */
function plotLeft(ticks: ChartTick[]) {
  return PAD + Math.max(...ticks.map((tick) => tick.label.length)) * 5.5 + 12
}

function dimClass(hover: number | null, index: number) {
  return hover != null && hover !== index ? styles.dim : styles.lit
}

function stagger(index: number, step: number): CSSProperties {
  return { ['--i' as string]: `${index * step}ms` } as CSSProperties
}

/** An annular sector inset by the corner radius; its same-colour round-joined stroke grows it back with rounded corners. */
function sectorPath(from: number, to: number) {
  const { cx, cy, outer, inner, gap, corner } = RING
  const ro = outer - corner
  const ri = inner + corner
  const pad = gap / 2 + corner
  const a0o = from + pad / ro
  const a1o = to - pad / ro
  const a0i = from + pad / ri
  const a1i = to - pad / ri
  const point = (r: number, a: number) => `${(cx + Math.sin(a) * r).toFixed(2)},${(cy - Math.cos(a) * r).toFixed(2)}`
  const large = to - from > Math.PI ? 1 : 0
  return [
    `M${point(ro, a0o)}`,
    `A${ro},${ro} 0 ${large} 1 ${point(ro, a1o)}`,
    `L${point(ri, a1i)}`,
    `A${ri},${ri} 0 ${large} 0 ${point(ri, a0i)}`,
    'Z',
  ].join(' ')
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
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`
  }
  return d
}
