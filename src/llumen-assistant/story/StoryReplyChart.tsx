import { useEffect, useId, useState } from 'react'
import type { StoryReplyChartData } from '../assistantReplyTypes'
import { BiodiversityChart, MonitoringSitesChart, TrendChart } from './StoryCharts'
import storyStyles from './StoryView.module.css'
import styles from './StoryReplyChart.module.css'

function Value({ value, unit }: { value?: string; unit?: string }) {
  if (!value) return null
  return (
    <p className={storyStyles.visualValue}>
      <strong>{value}</strong>
      {unit ? <span>{unit}</span> : null}
    </p>
  )
}

function Legend({ legend }: { legend: [string, string] }) {
  return (
    <div className={storyStyles.chartLegend}>
      <span>
        <i className={styles.swatchBefore} />
        {legend[0]}
      </span>
      <span>
        <i className={styles.swatchAfter} />
        {legend[1]}
      </span>
    </div>
  )
}

const MORPH_DELAY_MS = 650

/** Flips once the chart has been on screen briefly, so `from` values can animate into the final ones. */
function useMorphSettled() {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), MORPH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])
  return settled
}

const SPARK_H = 32

function Spark({ chart, gradientId }: { chart: Extract<StoryReplyChartData, { type: 'spark' }>; gradientId: string }) {
  const ticks = chart.yTicks ?? []
  const max = Math.max(...chart.points, ...ticks.map((tick) => tick.value)) || 1
  const last = chart.points.length - 1
  const y = (v: number) => SPARK_H - 2 - (v / max) * (SPARK_H - 4)
  const coords = chart.points.map((v, i) => `${(i / last) * 100},${y(v)}`)
  return (
    <div className={`${styles.spark} ${ticks.length ? styles.sparkTicked : ''}`}>
      {ticks.length ? (
        <div className={styles.sparkTicks} aria-hidden>
          {ticks.map((tick) => (
            <span key={tick.value} style={{ top: `${(y(tick.value) / SPARK_H) * 100}%` }}>
              {tick.label}
            </span>
          ))}
        </div>
      ) : null}
      <svg viewBox={`0 0 100 ${SPARK_H}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={chart.color} stopOpacity={0.35} />
            <stop offset="1" stopColor={chart.color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <line
            key={tick.value}
            className={styles.sparkGrid}
            x1={0}
            x2={100}
            y1={y(tick.value)}
            y2={y(tick.value)}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polygon points={`0,${SPARK_H} ${coords.join(' ')} 100,${SPARK_H}`} fill={`url(#${gradientId})`} />
        <polyline
          className={styles.sparkLine}
          points={coords.join(' ')}
          stroke={chart.color}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className={styles.sparkAxis}>
        <span>{chart.xLabels[0]}</span>
        <span>{chart.xLabels[1]}</span>
      </div>
    </div>
  )
}

/** Story insight-card style chart for assistant replies. */
export function StoryReplyChart({ chart }: { chart: StoryReplyChartData }) {
  const gradientId = `reply-chart-${useId().replace(/:/g, '')}`
  const settled = useMorphSettled()

  if (chart.type === 'spark') {
    return (
      <div className={`${styles.card} ${styles.sparkCard}`}>
        <p className={`${storyStyles.visualTitle} ${styles.sparkTitle}`}>{chart.title}</p>
        <Value value={chart.value} unit={chart.unit} />
        <Spark chart={chart} gradientId={gradientId} />
      </div>
    )
  }

  if (chart.type === 'status') {
    const values = settled || !chart.from ? chart : chart.from
    return (
      <div className={styles.card}>
        <BiodiversityChart terrestrial={values.terrestrial} marine={values.marine} />
      </div>
    )
  }

  if (chart.type === 'sites') {
    const values = settled || !chart.from ? chart : chart.from
    return (
      <div className={styles.card}>
        <MonitoringSitesChart
          online={values.online}
          sites={chart.sites}
          uptime={values.uptime}
          offlineBars={values.offlineBars}
        />
      </div>
    )
  }

  const line = chart.type !== 'trend' ? '' : settled ? chart.line : (chart.fromLine ?? chart.line)

  return (
    <div className={styles.card}>
      <p className={storyStyles.visualTitle}>{chart.title}</p>
      <Value value={chart.value} unit={chart.unit} />
      {chart.type === 'trend' ? (
        <>
          {chart.legend ? (
            <div className={storyStyles.chartLegend}>
              <span>
                <i className={styles.swatchLine} style={{ background: chart.color }} />
                {chart.legend[0]}
              </span>
              {chart.dashed ? (
                <span>
                  <i className={storyStyles.swatchPlanned} />
                  {chart.legend[1]}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className={styles.trend}>
            <TrendChart
              yLabels={chart.yLabels}
              xLabels={chart.xLabels}
              line={line}
              lineColor={chart.color}
              gradientId={gradientId}
              dashed={chart.dashed}
            />
          </div>
        </>
      ) : null}
      {chart.type === 'bars' ? (
        <div className={styles.bars}>
          {chart.rows.map((row) => (
            <div key={row.label} className={styles.barRow}>
              <span className={styles.barLabel}>{row.label}</span>
              <span className={styles.barTrack}>
                <span
                  className={styles.barFill}
                  style={{ width: `${Math.max(2, Math.min(100, row.value))}%`, background: chart.color }}
                />
              </span>
              <b className={styles.barValue}>{row.display}</b>
            </div>
          ))}
        </div>
      ) : null}
      {chart.type === 'compare' ? (
        <>
          <Legend legend={chart.legend} />
          <div className={styles.bars}>
            {chart.rows.map((row) => {
              const max = Math.max(row.before, row.after, 1)
              return (
                <div key={row.label} className={styles.compareRow}>
                  <div className={styles.compareHead}>
                    <span>{row.label}</span>
                    <b>
                      {row.beforeDisplay} → {row.afterDisplay}
                    </b>
                  </div>
                  <span className={styles.barTrack}>
                    <span className={styles.barBefore} style={{ width: `${(row.before / max) * 100}%` }} />
                  </span>
                  <span className={styles.barTrack}>
                    <span className={styles.barAfter} style={{ width: `${(row.after / max) * 100}%` }} />
                  </span>
                </div>
              )
            })}
          </div>
        </>
      ) : null}
      {chart.type === 'histogram' ? (
        <>
          <Legend legend={chart.legend} />
          <div className={styles.histogram}>
            {chart.bins.map((bin, index) => {
              const max = Math.max(1, ...chart.before, ...chart.after)
              return (
                <div key={bin} className={styles.histogramBin}>
                  <div className={styles.histogramBars}>
                    <span className={styles.barBefore} style={{ height: `${(chart.before[index] / max) * 100}%` }} />
                    <span className={styles.barAfter} style={{ height: `${(chart.after[index] / max) * 100}%` }} />
                  </div>
                  <span className={styles.histogramLabel}>{bin}</span>
                </div>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}
