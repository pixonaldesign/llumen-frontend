/**
 * The real-estate story's insight cards, drawn with the story cards' own type and chart styles: one
 * body per `EstateCard` kind, coloured from the Create Asset palettes. The card shell and its hover
 * actions are the story view's.
 */
import { useId, type CSSProperties, type ReactNode } from 'react'
import styles from '../story/StoryView.module.css'
import { formatCount } from '../story/StoryCharts'
import { StorySummaryText } from '../story/StorySummaryText'
import { SUMMARY_REGENERATE_MS } from '../story/storySummary'
import { HORIZON_COLOR, HORIZON_LABEL } from '../municipality/dmShared'
import { STATUS, TONE_ACCENT, category, type EstateCard, type Status, type Tone } from './estateTypes'
import css from './EstateCards.module.css'

type CardOf<K extends EstateCard['kind']> = Extract<EstateCard, { kind: K }>

const statusColor = (status: Status | undefined, fallback: string) => (status ? STATUS[status] : fallback)

const toneOf = (card: EstateCard): Tone => card.tone ?? 'blue'

function Title({ card }: { card: EstateCard }) {
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
            <span className={css.fill} style={{ width: `${Math.min(100, row.pct)}%`, background: row.color ?? accent }} />
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
      : (series.color ?? (solid.length === 1 ? TONE_ACCENT[tone] : category(solid.indexOf(series), tone)))
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

/** A trend line over a faint fill, filling the room it is given. */
export function Sparkline({ points, color, className = css.spark }: { points: number[]; color: string; className?: string }) {
  const gradientId = useId()
  const run = linePath(points, Math.max(...points, 1) * 1.15)[0]
  if (!run) return null
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${run.d} L${run.last} 100 L${run.first} 100 Z`} fill={`url(#${gradientId})`} />
      <path
        d={run.d}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
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
          <div key={bar.label} className={`${css.vbar}${bar.dim ? ` ${css.dimmed}` : ''}`}>
            <span className={css.vbarValue}>{bar.display ?? formatCount(bar.value)}</span>
            <span className={css.vbarTrack}>
              <span
                className={css.vbarFill}
                style={{ height: `${Math.max(3, (bar.value / max) * 100)}%`, background: bar.color ?? accent }}
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
          <div key={bar.label} className={`${css.hbar}${bar.dim ? ` ${css.dimmed}` : ''}`}>
            <span className={css.hbarLabel}>{bar.label}</span>
            <span className={css.track}>
              <span className={css.fill} style={{ width: `${(bar.value / max) * 100}%`, background: bar.color ?? accent }} />
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

function Grouped({ card }: { card: CardOf<'grouped'> }) {
  const max = Math.max(...card.groups.flatMap((group) => group.values))
  const tone = toneOf(card)
  const colorAt = (index: number) => card.colors?.[index] ?? category(index, tone)
  return (
    <>
      <Legend items={card.legend.map((name, index) => ({ name, color: colorAt(index) }))} />
      <div className={css.vbars}>
        {card.groups.map((group) => (
          <div key={group.label} className={`${css.vbar}${group.dim ? ` ${css.dimmed}` : ''}`}>
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
  const colorAt = (i: number) => card.slices[i].color ?? category(i, tone)
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
              stroke={colorAt(i)}
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
              <i className={styles.swatchTerrestrial} style={{ background: colorAt(i) }} />
              {slice.name}
            </span>
            <b>{(Math.round((slice.value / total) * 1000) / 10).toFixed(1)}%</b>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The column titles stay put and only the rows scroll; both share the table's columns. */
function Table({ card }: { card: CardOf<'table'> }) {
  return (
    <div
      className={css.table}
      role="table"
      aria-label={card.title}
      style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${card.columns.length - 1}, auto) 4px` }}
    >
      <div className={css.tableHead} role="row">
        {card.columns.map((column) => (
          <span key={column} role="columnheader">
            {column}
          </span>
        ))}
      </div>
      <div className={css.tableScroll} role="rowgroup">
        {card.rows.map((row, index) => (
          <div key={`${index}-${row.cells[0]}`} className={css.tableRow} role="row">
            {row.cells.map((cell, c) => (
              <span key={c} role="cell">
                {c === card.dotColumn ? (
                  <span className={css.status}>
                    <i style={{ background: row.color ?? 'rgba(255,255,255,0.48)' }} />
                    {cell}
                  </span>
                ) : (
                  cell
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Intervention({ card }: { card: CardOf<'intervention'> }) {
  const color = HORIZON_COLOR[card.horizon]
  return (
    <div className={css.intervention} style={{ '--horizon': color } as CSSProperties}>
      <p className={css.interventionHead}>
        <span className={css.interventionCode}>{card.code}</span>
        {HORIZON_LABEL[card.horizon]}
      </p>
      <p className={css.interventionTitle}>{card.title}</p>
      <dl className={css.interventionFacts}>
        <div>
          <dt>Asset</dt>
          <dd>{card.asset}</dd>
        </div>
        <div>
          <dt>Benefit</dt>
          <dd>{card.benefit}</dd>
        </div>
      </dl>
    </div>
  )
}

function Scenario({ card, selected, onSelect }: { card: CardOf<'scenario'>; selected?: string; onSelect?: (id: string) => void }) {
  const current = selected ?? card.options[0]?.id
  return (
    <div className={css.scenarios} role="radiogroup" aria-label={card.title}>
      {card.options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === current}
          className={css.scenario}
          data-selected={option.id === current || undefined}
          onClick={() => onSelect?.(option.id)}
        >
          <span className={css.scenarioLabel}>{option.label}</span>
          <span className={css.scenarioDetail}>{option.detail}</span>
        </button>
      ))}
    </div>
  )
}

export function EstateCardBody({
  card,
  summaryStatus,
  summaryTyping = false,
  flat = false,
  scenario,
  onScenario,
}: {
  card: EstateCard
  /** The summary's "Last updated" chip. */
  summaryStatus?: ReactNode
  summaryTyping?: boolean
  /** Area charts fill with one flat tint instead of a gradient. */
  flat?: boolean
  /** The page's selected what-if, and how a scenario card picks another. */
  scenario?: string
  onScenario?: (id: string) => void
}) {
  switch (card.kind) {
    case 'intervention':
      return <Intervention card={card} />
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
          {card.spark ? (
            <Sparkline points={card.spark} color={card.color ?? statusColor(card.status, TONE_ACCENT[toneOf(card)])} />
          ) : null}
        </>
      )
    case 'section':
      return <h3 className={css.sectionTitle}>{card.title}</h3>
  }
  const body: Record<Exclude<EstateCard['kind'], 'summary' | 'cell' | 'section' | 'intervention'>, () => ReactNode> = {
    scenario: () => <Scenario card={card as CardOf<'scenario'>} selected={scenario} onSelect={onScenario} />,
    note: () => <p className={css.note}>{(card as CardOf<'note'>).text}</p>,
    specs: () => (
      <dl className={css.specs}>
        {(card as CardOf<'specs'>).items.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    ),
    kpis: () => <Kpis card={card as CardOf<'kpis'>} />,
    progress: () => <Progress card={card as CardOf<'progress'>} />,
    line: () => <LineChart card={card as CardOf<'line'>} flat={flat} />,
    vbars: () => <VBars card={card as CardOf<'vbars'>} />,
    hbars: () => <HBars card={card as CardOf<'hbars'>} />,
    split: () => <Split card={card as CardOf<'split'>} />,
    grouped: () => <Grouped card={card as CardOf<'grouped'>} />,
    donut: () => <Donut card={card as CardOf<'donut'>} />,
    table: () => <Table card={card as CardOf<'table'>} />,
  }
  return (
    <>
      <Title card={card} />
      {body[card.kind]()}
    </>
  )
}
