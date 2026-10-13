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

/** Story insight-card style chart for assistant replies. */
export function StoryReplyChart({ chart }: { chart: StoryReplyChartData }) {
  const gradientId = `reply-chart-${useId().replace(/:/g, '')}`
  const settled = useMorphSettled()

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
