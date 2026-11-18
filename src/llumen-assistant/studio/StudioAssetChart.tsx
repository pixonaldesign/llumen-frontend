import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
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
        <ChartTitle title={chart.title} />
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
    case 'scatter':
      return <Scatter chart={chart} ctx={ctx} />
    case 'rose':
      return <Rose chart={chart} ctx={ctx} />
    case 'range':
      return <Range chart={chart} ctx={ctx} />
    case 'score':
      return <Score chart={chart} ctx={ctx} />
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

function Scatter({ chart, ctx }: { chart: Of<'scatter'>; ctx: Ctx }) {
  const top = 62
  const left = plotLeft(chart.yTicks)
  const xMax = chart.xTicks[chart.xTicks.length - 1].value
  const yMax = chart.yTicks[chart.yTicks.length - 1].value
  const sx = (v: number) => left + (Math.min(v, xMax) / xMax) * (RIGHT - left)
  const sy = (v: number) => PLOT_BOTTOM - (Math.min(v, yMax) / yMax) * (PLOT_BOTTOM - top)
  const sizes = chart.series.flatMap((series) => series.points.map((point) => point[2]))
  const biggest = Math.max(...sizes)
  const radius = (size: number) => 1.6 + (size / biggest) * 3.6
  const dots = chart.series.flatMap((series, s) =>
    series.points.map((point) => ({ s, point, x: sx(point[0]), y: sy(point[1]) })),
  )
  const hovered = ctx.hover != null ? dots[ctx.hover] : null
  return (
    <>
      <SeriesLegend series={chart.series} />
      <YAxis ticks={chart.yTicks} left={left} y={sy} />
      {chart.xTicks.map((tick) => (
        <text key={tick.label} className={styles.tick} x={sx(tick.value)} y={AXIS_Y} textAnchor="middle">
          {tick.label}
        </text>
      ))}
      <g className={styles.fadeIn}>
        {dots.map((dot, i) => (
          <circle
            key={i}
            className={`${styles.point} ${hovered && hovered.s !== dot.s ? styles.dim : styles.lit}`}
            cx={dot.x}
            cy={dot.y}
            r={radius(dot.point[2])}
            fill={chart.series[dot.s].color}
          />
        ))}
      </g>
      {hovered ? (
        <circle
          className={styles.hoverDot}
          cx={hovered.x}
          cy={hovered.y}
          r={radius(hovered.point[2]) + 2}
          stroke={chart.series[hovered.s].color}
        />
      ) : null}
      <rect
        className={styles.hit}
        x={left - 6}
        y={top - 8}
        width={RIGHT - left + 12}
        height={PLOT_BOTTOM - top + 16}
        onPointerMove={(event) => {
          const { x, y } = ctx.toSvg(event)
          let nearest = 0
          let best = Infinity
          dots.forEach((dot, i) => {
            const distance = (dot.x - x) ** 2 + (dot.y - y) ** 2
            if (distance < best) {
              best = distance
              nearest = i
            }
          })
          const dot = dots[nearest]
          ctx.setHover(nearest)
          ctx.showTip({
            x: dot.x,
            y: dot.y,
            label: chart.series[dot.s].name,
            rows: chart.axes.map((name, axis) => ({ name, value: chart.format(dot.point[axis], axis as 0 | 1 | 2) })),
          })
        }}
      />
    </>
  )
}

const ROSE = { cx: 262, cy: 104, inner: 7, outer: 66 }

function Rose({ chart, ctx }: { chart: Of<'rose'>; ctx: Ctx }) {
  const n = chart.directions.length
  const step = (Math.PI * 2) / n
  const totals = chart.values.map((row) => row.reduce((sum, value) => sum + value, 0))
  const most = Math.max(...totals)
  const r = (value: number) => ROSE.inner + (value / most) * (ROSE.outer - ROSE.inner)
  const show = (i: number) => {
    const mid = i * step
    ctx.setHover(i)
    ctx.showTip({
      x: ROSE.cx + Math.sin(mid) * r(totals[i]),
      y: ROSE.cy - Math.cos(mid) * r(totals[i]),
      label: `Heading ${chart.directions[i]}`,
      rows: chart.bands.map((band, b) => ({ name: band.name, color: band.color, value: chart.format(chart.values[i][b]) })),
    })
  }
  return (
    <>
      {chart.bands.map((band, i) => (
        <g key={band.name} className={styles.fadeIn} style={stagger(i, 70)}>
          <circle cx={PAD + 4} cy={49 + i * 22} r={4} fill={band.color} />
          <text className={styles.legendLabel} x={PAD + 15} y={53.5 + i * 22}>
            {band.name}
          </text>
        </g>
      ))}
      {[0.25, 0.5, 0.75, 1].map((share) => (
        <circle
          key={share}
          className={styles.ring}
          cx={ROSE.cx}
          cy={ROSE.cy}
          r={ROSE.inner + share * (ROSE.outer - ROSE.inner)}
        />
      ))}
      {['N', 'E', 'S', 'W'].map((label, i) => (
        <text
          key={label}
          className={styles.tick}
          x={ROSE.cx + Math.sin(i * (Math.PI / 2)) * (ROSE.outer + 9)}
          y={ROSE.cy - Math.cos(i * (Math.PI / 2)) * (ROSE.outer + 9) + 3.5}
          textAnchor="middle"
        >
          {label}
        </text>
      ))}
      {chart.values.map((row, i) => {
        const from = i * step - step * 0.4
        const to = i * step + step * 0.4
        let base = 0
        return (
          <g
            key={chart.directions[i]}
            className={`${styles.slice} ${dimClass(ctx.hover, i)}`}
            style={{ ...stagger(i, 40), transformOrigin: `${ROSE.cx}px ${ROSE.cy}px` }}
            onPointerEnter={() => show(i)}
          >
            {row.map((value, b) => {
              const inner = r(base)
              base += value
              return <path key={b} d={wedgePath(ROSE.cx, ROSE.cy, inner, r(base), from, to)} fill={chart.bands[b].color} />
            })}
            <path className={styles.hit} d={wedgePath(ROSE.cx, ROSE.cy, ROSE.inner, ROSE.outer, from, to)} />
          </g>
        )
      })}
    </>
  )
}

function Range({ chart, ctx }: { chart: Of<'range'>; ctx: Ctx }) {
  const id = useSvgId()
  const top = 44
  const left = plotLeft(chart.ticks)
  const min = chart.ticks[0].value
  const max = chart.ticks[chart.ticks.length - 1].value
  const n = chart.bars.length
  const slot = (RIGHT - left) / n
  const width = Math.max(1.4, slot * 0.55)
  const cx = (i: number) => left + i * slot + slot / 2
  const sy = (v: number) => PLOT_BOTTOM - ((v - min) / (max - min)) * (PLOT_BOTTOM - top)
  const mean = smoothPath(chart.bars.map((bar, i): [number, number] => [cx(i), sy(bar.mean)]))
  return (
    <>
      <YAxis ticks={chart.ticks} left={left} y={sy} />
      {chart.labels.map((label, i) =>
        i % chart.axisEvery === 0 ? (
          <text key={label} className={styles.tick} x={cx(i)} y={AXIS_Y} textAnchor={i === 0 ? 'start' : 'middle'}>
            {label}
          </text>
        ) : null,
      )}
      <defs>
        <linearGradient id={`${id}span`} gradientUnits="userSpaceOnUse" x1="0" y1={PLOT_BOTTOM} x2="0" y2={top}>
          {chart.stops.map((color, i) => (
            <stop key={color} offset={i / (chart.stops.length - 1)} stopColor={color} />
          ))}
        </linearGradient>
        <clipPath id={`${id}reveal`}>
          <rect className={styles.reveal} x={left - 6} y={0} width={RIGHT - left + 12} height={H} />
        </clipPath>
      </defs>
      {chart.bars.map((bar, i) => (
        <rect
          key={i}
          className={`${styles.growY} ${dimClass(ctx.hover, i)}`}
          style={stagger(i, 6)}
          x={cx(i) - width / 2}
          y={sy(bar.max)}
          width={width}
          height={Math.max(1, sy(bar.min) - sy(bar.max))}
          rx={width / 2}
          fill={`url(#${id}span)`}
        />
      ))}
      <path className={styles.meanLine} d={mean} clipPath={`url(#${id}reveal)`} />
      {ctx.hover != null ? (
        <line className={styles.guide} x1={cx(ctx.hover)} x2={cx(ctx.hover)} y1={top} y2={PLOT_BOTTOM} />
      ) : null}
      <rect
        className={styles.hit}
        x={left}
        y={top - 8}
        width={RIGHT - left}
        height={PLOT_BOTTOM - top + 26}
        onPointerMove={(event) => {
          const { x } = ctx.toSvg(event)
          const index = Math.max(0, Math.min(n - 1, Math.floor((x - left) / slot)))
          const bar = chart.bars[index]
          ctx.setHover(index)
          ctx.showTip({
            x: cx(index),
            y: sy(bar.max),
            label: `${chart.labels[index]}–${chart.labels[index + 1] ?? '24:00'}`,
            rows: [
              { name: 'Fastest', color: chart.stops[chart.stops.length - 1], value: chart.format(bar.max) },
              { name: 'Mean', color: '#ffffff', value: chart.format(bar.mean) },
              { name: 'Slowest', color: chart.stops[0], value: chart.format(bar.min) },
            ],
          })
        }}
      />
    </>
  )
}

const DIAL = { cx: 302, cy: 140, r: 60, width: 12 }

function Score({ chart, ctx }: { chart: Of<'score'>; ctx: Ctx }) {
  const id = useSvgId()
  const angle = (value: number) => Math.PI * (value / 100 - 1)
  const point = (value: number, radius: number) => ({
    x: DIAL.cx + Math.cos(angle(value)) * radius,
    y: DIAL.cy + Math.sin(angle(value)) * radius,
  })
  const arc = (to: number) => {
    const start = point(0, DIAL.r)
    const end = point(to, DIAL.r)
    return `M${start.x},${start.y} A${DIAL.r},${DIAL.r} 0 0 1 ${end.x},${end.y}`
  }
  const length = (Math.PI * DIAL.r * chart.value) / 100
  const targetIn = point(chart.target, DIAL.r - DIAL.width / 2 - 3)
  const targetOut = point(chart.target, DIAL.r + DIAL.width / 2 + 3)
  const show = () => {
    ctx.setHover(0)
    ctx.showTip({
      x: point(chart.value, DIAL.r).x,
      y: point(chart.value, DIAL.r).y,
      label: chart.title,
      rows: [
        { name: 'Score', value: `${chart.value}` },
        { name: 'Target', value: `${chart.target}` },
      ],
    })
  }
  return (
    <>
      <Headline headline={chart.headline} ctx={ctx} />
      <Pill pill={chart.pill} y={80} />
      <text className={`${styles.caption} ${styles.fadeIn}`} x={PAD} y={126}>
        {chart.caption}
      </text>
      <defs>
        <linearGradient id={`${id}dial`} gradientUnits="userSpaceOnUse" x1={DIAL.cx - DIAL.r} y1="0" x2={DIAL.cx + DIAL.r} y2="0">
          {chart.stops.map((color, i) => (
            <stop key={color} offset={i / (chart.stops.length - 1)} stopColor={color} />
          ))}
        </linearGradient>
      </defs>
      <g onPointerEnter={show}>
        <path className={styles.dialTrack} d={arc(100)} strokeWidth={DIAL.width} />
        <path
          className={styles.sweep}
          d={arc(chart.value)}
          stroke={`url(#${id}dial)`}
          strokeWidth={DIAL.width}
          style={{ ['--len' as string]: `${length}` } as CSSProperties}
          strokeDasharray={length}
        />
        <line className={styles.target} x1={targetIn.x} y1={targetIn.y} x2={targetOut.x} y2={targetOut.y} />
        <path className={styles.hit} d={arc(100)} strokeWidth={DIAL.width + 16} stroke="transparent" fill="none" />
      </g>
      <text className={styles.tick} x={DIAL.cx - DIAL.r} y={DIAL.cy + 18} textAnchor="middle">
        0
      </text>
      <text className={styles.tick} x={DIAL.cx + DIAL.r} y={DIAL.cy + 18} textAnchor="middle">
        100
      </text>
    </>
  )
}

/* ── Shared pieces ─────────────────────────────────────────────────────── */

/** SVG text can't ellipsize, so a title wider than the card is trimmed to fit and keeps the full text as a tooltip. */
function ChartTitle({ title }: { title: string }) {
  const shown = useMemo(() => fitTitle(title), [title])
  return (
    <text className={styles.title} x={PAD} y={21}>
      {shown !== title ? <title>{title}</title> : null}
      {shown}
    </text>
  )
}

let titleContext: CanvasRenderingContext2D | null = null

/** Measured in the title's 14px face, which is also its width in chart units. */
function fitTitle(title: string) {
  titleContext ??= document.createElement('canvas').getContext('2d')
  if (!titleContext) return title
  const family = getComputedStyle(document.documentElement).getPropertyValue('--lc-font-sans').trim() || 'sans-serif'
  titleContext.font = `14px ${family}`
  let fitted = title
  while (fitted.length > 1 && titleContext.measureText(fitted).width > RIGHT - PAD * 2) {
    fitted = `${fitted.slice(0, -2).trimEnd()}…`
  }
  return fitted
}

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

function SeriesLegend({ series }: { series: { name: string; color: string; dashed?: boolean }[] }) {
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

/** A ring segment between two radii, for one band of a rose petal. */
function wedgePath(cx: number, cy: number, inner: number, outer: number, from: number, to: number) {
  const point = (r: number, a: number) => `${(cx + Math.sin(a) * r).toFixed(2)},${(cy - Math.cos(a) * r).toFixed(2)}`
  return [
    `M${point(inner, from)}`,
    `L${point(outer, from)}`,
    `A${outer},${outer} 0 0 1 ${point(outer, to)}`,
    `L${point(inner, to)}`,
    `A${inner},${inner} 0 0 0 ${point(inner, from)}`,
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
