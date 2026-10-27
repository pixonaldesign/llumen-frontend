import { useLayoutEffect, useRef, useState } from 'react'
import { chartChoice, type CreateAssetSettings } from './createAsset'
import type { DataRecord, DataValue } from './nodeCatalog'
import styles from './NodeConfigWindow.module.css'

type Pad = { top: number; right: number; bottom: number; left: number }

const PAD: Pad = { top: 12, right: 12, bottom: 24, left: 36 }
const TABLE_ROWS = 6
/** Roughly one axis digit at the axis font size, and the space between a value label and the plot. */
const AXIS_CHAR = 6
const AXIS_GAP = 6
const GRID_STEPS: readonly number[] = [0, 0.5, 1]

const numberOf = (value: DataValue | undefined) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}
const textOf = (value: DataValue | undefined) => (value === null || value === undefined ? '—' : String(value))
const compact = (value: number) =>
  Math.abs(value) >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : String(Number(value.toFixed(2)))

/** A round upper bound for an axis, so ticks land on readable numbers. */
function niceMax(value: number) {
  if (value <= 0) return 1
  if (value <= 1) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((multiple) => multiple * magnitude >= value) ?? 10
  return step * magnitude
}

function useSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setSize({ w: element.clientWidth, h: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

type AssetPreviewChartProps = {
  settings: CreateAssetSettings
  records: readonly DataRecord[]
  /** The plot runs to its box's edges: value labels start at the left, gridlines end at the right. */
  flush?: boolean
}

/** The asset a run would produce, drawn from this run's rows with the node's chart type and mapping. */
export function AssetPreviewChart({ settings, records, flush }: AssetPreviewChartProps) {
  const { chartType, mapping } = settings
  if (chartType === 'table') return <PreviewTable records={records} />
  if (chartType === 'kpi_card' || chartType === 'gauge') {
    const values = records.map((record) => numberOf(record[mapping.value]))
    return chartType === 'kpi_card' ? (
      <div className={styles.kpi}>
        <strong>{compact(values.reduce((sum, value) => sum + value, 0))}</strong>
        <span>
          {settings.title?.trim() || mapping.value} · sum of {values.length} {values.length === 1 ? 'row' : 'rows'}
        </span>
      </div>
    ) : (
      <Gauge value={values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0} label={mapping.value} />
    )
  }
  return <PlotChart settings={settings} records={records} flush={flush} />
}

function PreviewTable({ records }: { records: readonly DataRecord[] }) {
  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))]
  return (
    <div className={styles.previewTable} data-native-scroll>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.slice(0, TABLE_ROWS).map((record, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column} data-type={record[column] === null ? 'null' : typeof record[column]}>
                  {textOf(record[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Gauge({ value, label }: { value: number; label: string }) {
  const max = niceMax(value * 1.25)
  const ratio = Math.min(1, Math.max(0, value / max))
  const arc = (to: number) => {
    const angle = Math.PI * (1 - to)
    return `M 10 60 A 50 50 0 0 1 ${60 + 50 * Math.cos(angle)} ${60 - 50 * Math.sin(angle)}`
  }
  return (
    <div className={styles.gauge}>
      <svg viewBox="0 0 120 68" role="img" aria-label={`${label}: ${compact(value)} of ${compact(max)}`}>
        <path className={styles.gaugeTrack} d={arc(0.9999)} />
        {ratio > 0 ? <path className={styles.gaugeValue} d={arc(ratio)} /> : null}
      </svg>
      <p className={styles.gaugeText}>
        <strong>{compact(value)}</strong> of {compact(max)}
      </p>
    </div>
  )
}

/** Charts on a plot area: bars, lines, ranges, scatter, pie and polar. */
function PlotChart({ settings, records, flush }: AssetPreviewChartProps) {
  const [ref, size] = useSize()
  const { chartType, mapping } = settings
  const w = size.w
  const h = size.h
  const valueKeys = chartType === 'range' ? [mapping.low, mapping.high] : [mapping.y]
  const max = niceMax(Math.max(0, ...records.flatMap((record) => valueKeys.map((key) => numberOf(record[key])))))
  const labelW = Math.max(...GRID_STEPS.map((fraction) => compact(max * fraction).length)) * AXIS_CHAR
  const pad: Pad = flush ? { ...PAD, left: labelW + AXIS_GAP, right: 0 } : PAD
  const innerW = Math.max(0, w - pad.left - pad.right)
  const innerH = Math.max(0, h - pad.top - pad.bottom)
  const label = `${chartChoice(chartType).label} preview`

  const body = () => {
    if (chartType === 'pie') return <Pie records={records} category={mapping.category} value={mapping.value} w={w} h={h} />
    if (chartType === 'polar') return <Polar records={records} direction={mapping.direction} speed={mapping.speed} w={w} h={h} />

    if (chartType === 'horizontal_bar' || chartType === 'progress_bar') {
      const values = records.map((record) => numberOf(record[mapping.x]))
      const max = niceMax(Math.max(...values, 0))
      const rowH = Math.min(28, h / Math.max(1, records.length))
      const left = 96
      const barW = Math.max(0, w - left - pad.right - 28)
      return records.map((record, index) => {
        const y = (h - rowH * records.length) / 2 + index * rowH
        const length = (barW * values[index]) / max
        return (
          <g key={index}>
            <text className={styles.axis} x={left - 8} y={y + rowH / 2} textAnchor="end" dominantBaseline="middle">
              {truncate(textOf(record[mapping.y]), 14)}
            </text>
            {chartType === 'progress_bar' ? <rect className={styles.track} x={left} y={y + rowH * 0.25} width={barW} height={rowH * 0.5} rx={rowH * 0.25} /> : null}
            <rect className={styles.bar} x={left} y={y + rowH * 0.25} width={length} height={rowH * 0.5} rx={chartType === 'progress_bar' ? rowH * 0.25 : 3} />
            <text className={styles.axis} x={left + (chartType === 'progress_bar' ? barW : length) + 6} y={y + rowH / 2} dominantBaseline="middle">
              {compact(values[index])}
            </text>
          </g>
        )
      })
    }

    if (chartType === 'scatter') {
      const xs = records.map((record) => numberOf(record[mapping.x]))
      const ys = records.map((record) => numberOf(record[mapping.y]))
      const xMax = niceMax(Math.max(...xs, 0))
      return (
        <>
          <Grid max={max} innerH={innerH} w={w} pad={pad} />
          {records.map((_, index) => (
            <circle
              key={index}
              className={styles.dot}
              cx={pad.left + (innerW * xs[index]) / xMax}
              cy={pad.top + innerH * (1 - ys[index] / max)}
              r={4}
            />
          ))}
        </>
      )
    }

    const step = innerW / Math.max(1, records.length)
    const xAt = (index: number) => pad.left + step * index + step / 2
    const yAt = (value: number) => pad.top + innerH * (1 - value / max)
    const labels = records.map((record, index) => (
      <text key={index} className={styles.axis} x={xAt(index)} y={h - 6} textAnchor="middle">
        {truncate(textOf(record[mapping.x]), Math.max(3, Math.floor(step / 7)))}
      </text>
    ))

    if (chartType === 'bar') {
      const barW = Math.min(36, step * 0.6)
      return (
        <>
          <Grid max={max} innerH={innerH} w={w} pad={pad} />
          {records.map((record, index) => {
            const y = yAt(numberOf(record[mapping.y]))
            return <rect key={index} className={styles.bar} x={xAt(index) - barW / 2} y={y} width={barW} height={pad.top + innerH - y} rx={3} />
          })}
          {labels}
        </>
      )
    }

    if (chartType === 'range') {
      const high = records.map((record, index) => `${index ? 'L' : 'M'} ${xAt(index)} ${yAt(numberOf(record[mapping.high]))}`)
      const low = records.map((record, index) => `L ${xAt(index)} ${yAt(numberOf(record[mapping.low]))}`).reverse()
      return (
        <>
          <Grid max={max} innerH={innerH} w={w} pad={pad} />
          <path className={styles.band} d={`${high.join(' ')} ${low.join(' ')} Z`} />
          {labels}
        </>
      )
    }

    const points = records.map((record, index) => ({ x: xAt(index), y: yAt(numberOf(record[mapping.y])) }))
    const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
    const baseline = pad.top + innerH
    return (
      <>
        <Grid max={max} innerH={innerH} w={w} pad={pad} />
        {chartType === 'area' && points.length ? (
          <path className={styles.area} d={`${line} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`} />
        ) : null}
        <path className={styles.line} d={line} />
        {points.map((point, index) => (
          <circle key={index} className={styles.dot} cx={point.x} cy={point.y} r={3} />
        ))}
        {labels}
      </>
    )
  }

  return (
    <div ref={ref} className={styles.plot}>
      {w > 0 && h > 0 ? (
        <svg width={w} height={h} role="img" aria-label={label}>
          {body()}
        </svg>
      ) : null}
    </div>
  )
}

function Grid({ max, innerH, w, pad }: { max: number; innerH: number; w: number; pad: Pad }) {
  return (
    <>
      {GRID_STEPS.map((fraction) => {
        const y = pad.top + innerH * (1 - fraction)
        return (
          <g key={fraction}>
            <line className={styles.grid} x1={pad.left} x2={w - pad.right} y1={y} y2={y} />
            <text className={styles.axis} x={pad.left - AXIS_GAP} y={y} textAnchor="end" dominantBaseline="middle">
              {compact(max * fraction)}
            </text>
          </g>
        )
      })}
    </>
  )
}

const PIE_SHADES = [1, 0.78, 0.6, 0.45, 0.32, 0.22]

function Pie({ records, category, value, w, h }: { records: readonly DataRecord[]; category: string; value: string; w: number; h: number }) {
  const values = records.map((record) => Math.max(0, numberOf(record[value])))
  const total = values.reduce((sum, item) => sum + item, 0) || 1
  const radius = Math.min(h / 2 - 8, w / 4)
  const cx = radius + 16
  const cy = h / 2
  const sweeps = values.map((item) => (item / total) * Math.PI * 2)
  const starts = sweeps.map((_, index) => -Math.PI / 2 + sweeps.slice(0, index).reduce((sum, sweep) => sum + sweep, 0))
  const point = (at: number, r: number) => `${cx + r * Math.cos(at)} ${cy + r * Math.sin(at)}`
  return (
    <>
      {values.map((_, index) => {
        const start = starts[index]
        const end = start + sweeps[index]
        const large = sweeps[index] > Math.PI ? 1 : 0
        const inner = radius * 0.58
        const d = `M ${point(start, radius)} A ${radius} ${radius} 0 ${large} 1 ${point(end, radius)} L ${point(end, inner)} A ${inner} ${inner} 0 ${large} 0 ${point(start, inner)} Z`
        return <path key={index} className={styles.slice} d={d} style={{ opacity: PIE_SHADES[index % PIE_SHADES.length] }} />
      })}
      {records.slice(0, 6).map((record, index) => (
        <g key={index} transform={`translate(${cx + radius + 24} ${cy - (Math.min(6, records.length) * 18) / 2 + index * 18 + 9})`}>
          <rect className={styles.slice} x={0} y={-5} width={10} height={10} rx={2} style={{ opacity: PIE_SHADES[index % PIE_SHADES.length] }} />
          <text className={styles.legend} x={16} y={0} dominantBaseline="middle">
            {truncate(textOf(record[category]), 18)} · {Math.round((values[index] / total) * 100)}%
          </text>
        </g>
      ))}
    </>
  )
}

function Polar({ records, direction, speed, w, h }: { records: readonly DataRecord[]; direction: string; speed: string; w: number; h: number }) {
  const speeds = records.map((record) => numberOf(record[speed]))
  const max = niceMax(Math.max(...speeds, 0))
  const radius = Math.min(w, h) / 2 - 12
  const cx = w / 2
  const cy = h / 2
  return (
    <>
      {[0.5, 1].map((fraction) => (
        <circle key={fraction} className={styles.grid} cx={cx} cy={cy} r={radius * fraction} fill="none" />
      ))}
      {records.map((record, index) => {
        const at = ((numberOf(record[direction]) - 90) * Math.PI) / 180
        const r = (radius * speeds[index]) / max
        return <line key={index} className={styles.spoke} x1={cx} y1={cy} x2={cx + r * Math.cos(at)} y2={cy + r * Math.sin(at)} />
      })}
    </>
  )
}

const truncate = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1)}…` : text)
