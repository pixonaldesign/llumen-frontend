/**
 * The GAMI story's insight cards, drawn with the story cards' own type and chart styles: one body per
 * `GamiCard` kind, coloured from the Create Asset palettes. The card shell and its hover actions are
 * the story view's.
 */
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { Info } from '@phosphor-icons/react'
import styles from '../story/StoryView.module.css'
import { formatCount } from '../story/StoryCharts'
import { StorySummaryText } from '../story/StorySummaryText'
import { SUMMARY_REGENERATE_MS } from '../story/storySummary'
import { Gami3DModel } from './Gami3DModel'
import { GAMI_PARTS } from './gamiScenario'
import { PALETTE, STATUS, TONE_ACCENT, category, type GamiCard, type PartId, type Status, type Tone } from './gamiTypes'
import css from './GamiCards.module.css'

type CardOf<K extends GamiCard['kind']> = Extract<GamiCard, { kind: K }>

const statusColor = (status: Status | undefined, fallback: string) => (status ? STATUS[status] : fallback)

const toneOf = (card: GamiCard): Tone => card.tone ?? 'blue'

/** The trim on the 3D parts: the palette's light blue, not a status colour. */
const PART_TRIM = PALETTE.blue[4]

function Title({ card }: { card: GamiCard }) {
  return <p className={styles.visualTitle}>{card.title}</p>
}

function Kpi({ value, unit }: { value: string; unit?: string }) {
  return (
    <p className={styles.visualValue}>
      <strong>{value}</strong>
      {unit ? <span>{unit}</span> : null}
    </p>
  )
}

function Legend({ items }: { items: { name: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className={`${styles.chartLegend} ${css.legend}`}>
      {items.map((item) => (
        <span key={item.name}>
          <i
            className={item.dashed ? styles.swatchPlanned : styles.swatchProjected}
            style={item.dashed ? undefined : { background: item.color }}
          />
          {item.name}
        </span>
      ))}
    </div>
  )
}

function Kpis({ card }: { card: CardOf<'kpis'> }) {
  return (
    <div
      className={css.kpis}
      style={{ '--kpi-cols': card.tiles.length } as CSSProperties}
      data-dense={card.tiles.length > 2 || undefined}
    >
      {card.tiles.map((tile) => (
        <div key={tile.label} className={css.kpi}>
          <Kpi value={tile.value} unit={tile.unit} />
          <p className={css.kpiLabel}>{tile.label}</p>
          {tile.note ? <p className={css.kpiNote}>{tile.note}</p> : null}
        </div>
      ))}
    </div>
  )
}

function Progress({ card }: { card: CardOf<'progress'> }) {
  const accent = TONE_ACCENT[toneOf(card)]
  return (
    <div className={css.rows}>
      {card.rows.map((row) => (
        <div key={row.label} className={css.progressRow}>
          <div className={styles.seriesRow}>
            <span>{row.label}</span>
            <b>
              {row.value} <span className={css.muted}>{row.target}</span>
            </b>
          </div>
          <div className={css.track}>
            <span className={css.fill} style={{ width: `${Math.min(100, row.pct)}%`, background: accent }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** A smooth path through `points` in the chart's 0–100 box, broken where a point is null. */
function linePath(points: (number | null)[], yMax: number) {
  const x = (i: number) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100)
  const y = (v: number) => 100 - (v / yMax) * 100
  const runs: [number, number][][] = []
  let run: [number, number][] = []
  points.forEach((value, i) => {
    if (value === null) {
      if (run.length) runs.push(run)
      run = []
      return
    }
    run.push([x(i), y(value)])
  })
  if (run.length) runs.push(run)
  return runs.map((pts) => {
    let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`
    for (let i = 1; i < pts.length; i += 1) {
      const [x0, y0] = pts[i - 1]
      const [x1, y1] = pts[i]
      const dx = (x1 - x0) / 3
      d += ` C${(x0 + dx).toFixed(2)} ${y0.toFixed(2)} ${(x1 - dx).toFixed(2)} ${y1.toFixed(2)} ${x1.toFixed(2)} ${y1.toFixed(2)}`
    }
    return { d, first: pts[0][0], last: pts[pts.length - 1][0] }
  })
}

function LineChart({ card, flat = false }: { card: CardOf<'line'>; flat?: boolean }) {
  const gradientId = useId()
  const tone = toneOf(card)
  const solid = card.series.filter((series) => !series.dashed)
  const colorOf = (series: CardOf<'line'>['series'][number]) =>
    series.dashed
      ? 'rgba(255,255,255,0.72)'
      : statusColor(series.status, solid.length === 1 ? TONE_ACCENT[tone] : category(solid.indexOf(series), tone))
  const areaColor = solid[0] ? colorOf(solid[0]) : TONE_ACCENT[tone]
  const ticks = card.yLabels.map((_, index) => (card.yLabels.length === 1 ? 0 : (index / (card.yLabels.length - 1)) * 100))
  const area = solid[0] ? linePath(solid[0].points, card.yMax)[0] : null
  return (
    <>
      {card.kpi ? <Kpi {...card.kpi} /> : null}
      <Legend items={card.series.map((series) => ({ name: series.name, color: colorOf(series), dashed: series.dashed }))} />
      <div className={styles.chart}>
        <div className={styles.chartMain}>
          <div className={styles.yAxis}>
            {card.yLabels.map((label, index) => (
              <span key={label} style={{ top: `${ticks[index]}%` }}>
                {label}
              </span>
            ))}
          </div>
          <svg className={styles.chartSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={areaColor} stopOpacity="0.42" />
                <stop offset="100%" stopColor={areaColor} stopOpacity="0.02" />
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
            {area ? (
              <path
                d={`${area.d} L${area.last} 100 L${area.first} 100 Z`}
                fill={flat ? areaColor : `url(#${gradientId})`}
                fillOpacity={flat ? 0.14 : undefined}
              />
            ) : null}
            {card.series.map((series) =>
              linePath(series.points, card.yMax).map((run, index) => (
                <path
                  key={`${series.name}-${index}`}
                  d={run.d}
                  fill="none"
                  stroke={colorOf(series)}
                  strokeWidth={series.dashed ? 1.25 : 1.75}
                  strokeDasharray={series.dashed ? '3.5 3' : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )),
            )}
          </svg>
        </div>
        <div className={styles.chartX}>
          {card.x.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
    </>
  )
}

function VBars({ card }: { card: CardOf<'vbars'> }) {
  const accent = TONE_ACCENT[toneOf(card)]
  const max = Math.max(...card.bars.map((bar) => bar.value))
  return (
    <>
      {card.kpi ? <Kpi {...card.kpi} /> : null}
      <div className={css.vbars}>
        {card.bars.map((bar) => (
          <div key={bar.label} className={css.vbar}>
            <span className={css.vbarValue}>{bar.display ?? formatCount(bar.value)}</span>
            <span className={css.vbarTrack}>
              <span
                className={css.vbarFill}
                style={{ height: `${Math.max(3, (bar.value / max) * 100)}%`, background: statusColor(bar.status, accent) }}
              />
            </span>
            <span className={css.vbarLabel}>{bar.label}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function HBars({ card }: { card: CardOf<'hbars'> }) {
  const accent = TONE_ACCENT[toneOf(card)]
  const max = Math.max(...card.bars.map((bar) => bar.value))
  return (
    <>
      {card.kpi ? <Kpi {...card.kpi} /> : null}
      <div className={css.rows}>
        {card.bars.map((bar) => (
          <div key={bar.label} className={css.hbar}>
            <span className={css.hbarLabel}>{bar.label}</span>
            <span className={css.track}>
              <span className={css.fill} style={{ width: `${(bar.value / max) * 100}%`, background: statusColor(bar.status, accent) }} />
            </span>
            <b className={css.hbarValue}>{bar.display}</b>
          </div>
        ))}
      </div>
    </>
  )
}

function Split({ card }: { card: CardOf<'split'> }) {
  const tone = toneOf(card)
  const total = card.parts.reduce((sum, part) => sum + part.value, 0)
  return (
    <>
      <Kpi value={card.total} unit={card.unit} />
      <div className={styles.splitBar} aria-hidden>
        {card.parts.map((part, index) => (
          <span key={part.name} className={css.splitPart} style={{ flexGrow: part.value, background: category(index, tone) }} />
        ))}
      </div>
      {card.parts.map((part, index) => (
        <div key={part.name} className={styles.seriesRow}>
          <span>
            <i className={styles.swatchTerrestrial} style={{ background: category(index, tone) }} />
            {part.name}
          </span>
          <b>
            {part.display} ({Math.round((part.value / total) * 100)}%)
          </b>
        </div>
      ))}
    </>
  )
}

function Stacked({ card }: { card: CardOf<'stacked'> }) {
  const tone = toneOf(card)
  return (
    <>
      <Legend items={card.legend.map((name, index) => ({ name, color: category(index, tone) }))} />
      <div className={css.stacked}>
        {card.bars.map((bar) => {
          const total = bar.parts.reduce((sum, part) => sum + part, 0)
          return (
            <div key={bar.label} className={css.stackRow}>
              <span className={css.hbarLabel}>{bar.label}</span>
              <span className={css.stackBar}>
                {bar.parts.map((part, i) => (
                  <span
                    key={card.legend[i]}
                    className={css.stackPart}
                    style={{ flexGrow: part / total, background: category(i, tone) }}
                    title={`${card.legend[i]}: ${Math.round((part / total) * 100)}%`}
                  />
                ))}
              </span>
              <b className={css.hbarValue}>{Math.round((bar.parts[0] / total) * 100)}%</b>
            </div>
          )
        })}
      </div>
    </>
  )
}

function Grouped({ card }: { card: CardOf<'grouped'> }) {
  const max = Math.max(...card.groups.flatMap((group) => group.values))
  const tone = toneOf(card)
  const colorAt = (index: number) =>
    card.ordered ? PALETTE[tone][Math.max(0, 4 - Math.round((index / Math.max(1, card.legend.length - 1)) * 4))] : category(index, tone)
  return (
    <>
      <Legend items={card.legend.map((name, index) => ({ name, color: colorAt(index) }))} />
      <div className={css.vbars}>
        {card.groups.map((group) => (
          <div key={group.label} className={css.vbar}>
            <span className={css.groupBars}>
              {group.values.map((value, i) => (
                <span
                  key={card.legend[i]}
                  className={css.groupFill}
                  style={{ height: `${Math.max(3, (value / max) * 100)}%`, background: colorAt(i) }}
                  title={`${card.legend[i]}: ${value.toLocaleString('en-US')}`}
                />
              ))}
            </span>
            <span className={css.vbarLabel}>{group.label}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function Donut({ card }: { card: CardOf<'donut'> }) {
  const tone = toneOf(card)
  const total = card.slices.reduce((sum, slice) => sum + slice.value, 0)
  const r = 50
  const c = 2 * Math.PI * r
  const lengths = card.slices.map((slice) => (slice.value / total) * c)
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((sum, length) => sum + length, 0))
  return (
    <div className={css.donut}>
      <div className={css.donutRing}>
        <svg viewBox="0 0 120 120" aria-hidden>
          {card.slices.map((slice, i) => (
            <circle
              key={slice.name}
              cx={60}
              cy={60}
              r={r}
              fill="none"
              stroke={statusColor(slice.status, category(i, tone))}
              strokeWidth={12}
              strokeDasharray={`${Math.max(0, lengths[i] - 2)} ${c}`}
              strokeDashoffset={-offsets[i]}
              transform="rotate(-90 60 60)"
            />
          ))}
        </svg>
        <div className={css.donutCenter}>
          <strong>{card.total}</strong>
          <span>{card.totalLabel}</span>
        </div>
      </div>
      <div className={css.donutLegend}>
        {card.slices.map((slice, i) => (
          <div key={slice.name} className={styles.seriesRow}>
            <span>
              <i className={styles.swatchTerrestrial} style={{ background: statusColor(slice.status, category(i, tone)) }} />
              {slice.name}
            </span>
            <b>{(Math.round((slice.value / total) * 1000) / 10).toFixed(1)}%</b>
          </div>
        ))}
      </div>
    </div>
  )
}

function Table({ card }: { card: CardOf<'table'> }) {
  return (
    <div className={css.tableScroll}>
      <table className={css.table}>
        <thead>
          <tr>
            {card.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {card.rows.map((row) => (
            <tr key={row.cells[0]}>
              {row.cells.map((cell, c) => (
                <td key={c}>
                  {c === card.statusColumn ? (
                    <span className={css.status}>
                      <i style={{ background: statusColor(row.status, 'rgba(255,255,255,0.48)') }} />
                      {cell}
                    </span>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Range({ card }: { card: CardOf<'range'> }) {
  const tone = toneOf(card)
  const at = (value: number) => ((value - card.min) / (card.max - card.min)) * 100
  return (
    <div className={css.range}>
      {card.rows.map((row, index) => (
        <div key={row.label} className={css.rangeRow}>
          <span className={css.hbarLabel}>{row.label}</span>
          <span className={css.rangeTrack}>
            <span
              className={css.rangeBar}
              style={{ left: `${at(row.from)}%`, width: `${at(row.to) - at(row.from)}%`, background: statusColor(row.status, category(index, tone)) }}
            />
            <span className={css.rangeToday} style={{ left: `${at(0)}%` }} aria-hidden />
          </span>
        </div>
      ))}
      <div className={css.rangeAxis}>
        <span className={css.hbarLabel} aria-hidden />
        <span className={css.rangeTicks}>
          {card.ticks.map((tick) => (
            <span key={tick} style={{ left: `${at(tick)}%` }}>
              {tick === 0 ? 'Today' : `${tick > 0 ? '+' : '−'}${Math.abs(tick)}m`}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}

function Countdown({ card }: { card: CardOf<'countdown'> }) {
  const target = new Date(card.target).getTime()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const left = Math.max(0, target - now)
  const units: [string, number][] = [
    ['Days', Math.floor(left / 86_400_000)],
    ['Hours', Math.floor(left / 3_600_000) % 24],
    ['Minutes', Math.floor(left / 60_000) % 60],
    ['Seconds', Math.floor(left / 1000) % 60],
  ]
  return (
    <div className={css.kpis} style={{ '--kpi-cols': 4 } as CSSProperties} data-dense>
      {units.map(([label, value]) => (
        <div key={label} className={css.kpi}>
          <Kpi value={String(value).padStart(2, '0')} />
          <p className={css.kpiLabel}>{label}</p>
        </div>
      ))}
    </div>
  )
}

function Part({ card, onInfo }: { card: CardOf<'part'>; onInfo?: (part: PartId) => void }) {
  const part = GAMI_PARTS[card.part]
  const large = card.size === 'large'
  return (
    <>
      <Gami3DModel model={part.id} accent={PART_TRIM} className={css.partModel} spin={large ? 0.4 : 0.5} />
      <div className={css.partFoot}>
        <div className={css.partRow}>
          <Kpi value={String(part.stockDays)} unit={large ? 'days of stock' : 'days'} />
          <button type="button" className={css.partInfo} aria-label={`About the ${part.name}`} onClick={() => onInfo?.(part.id)}>
            <Info size={16} weight="regular" aria-hidden />
            {large ? 'Details' : null}
          </button>
        </div>
        {large ? (
          <dl className={css.partStats}>
            <div>
              <dt>Monthly need</dt>
              <dd>{part.monthlyNeed}</dd>
            </div>
            <div>
              <dt>Supplier</dt>
              <dd>{part.city}</dd>
            </div>
            <div>
              <dt>Programmes</dt>
              <dd>{part.programmes.join(' · ')}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </>
  )
}

export function GamiCardBody({
  card,
  onPartInfo,
  summaryStatus,
  summaryTyping = false,
  flat = false,
}: {
  card: GamiCard
  onPartInfo?: (part: PartId) => void
  /** The summary's "Last updated" chip. */
  summaryStatus?: ReactNode
  summaryTyping?: boolean
  /** Area charts fill with one flat tint instead of a gradient. */
  flat?: boolean
}) {
  switch (card.kind) {
    case 'summary':
      return (
        <>
          <h2 className={styles.summaryTitle}>{card.title}</h2>
          {summaryStatus}
          <StorySummaryText
            parts={card.parts}
            typing={summaryTyping}
            durationMs={SUMMARY_REGENERATE_MS}
            format={formatCount}
            className={styles.summaryBody}
            emphasisClassName={styles.summaryEmphasis}
            typingClassName={styles.summaryTyping}
          />
        </>
      )
    case 'cell':
      return (
        <>
          <p className={styles.kpiCellLabel}>{card.title}</p>
          <p className={styles.kpiCellValue}>{card.value}</p>
          <p className={styles.kpiCellNote}>{card.note}</p>
        </>
      )
    case 'part':
      return (
        <>
          <Title card={card} />
          <Part card={card} onInfo={onPartInfo} />
        </>
      )
  }
  const body: Record<Exclude<GamiCard['kind'], 'summary' | 'cell' | 'part'>, () => ReactNode> = {
    kpis: () => <Kpis card={card as CardOf<'kpis'>} />,
    progress: () => <Progress card={card as CardOf<'progress'>} />,
    line: () => <LineChart card={card as CardOf<'line'>} flat={flat} />,
    vbars: () => <VBars card={card as CardOf<'vbars'>} />,
    hbars: () => <HBars card={card as CardOf<'hbars'>} />,
    split: () => <Split card={card as CardOf<'split'>} />,
    stacked: () => <Stacked card={card as CardOf<'stacked'>} />,
    grouped: () => <Grouped card={card as CardOf<'grouped'>} />,
    donut: () => <Donut card={card as CardOf<'donut'>} />,
    table: () => <Table card={card as CardOf<'table'>} />,
    range: () => <Range card={card as CardOf<'range'>} />,
    countdown: () => <Countdown card={card as CardOf<'countdown'>} />,
  }
  return (
    <>
      <Title card={card} />
      {body[card.kind]()}
    </>
  )
}
