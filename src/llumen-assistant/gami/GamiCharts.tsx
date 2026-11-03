/**
 * The GAMI story's insight cards: one renderer per `GamiCard` kind, sized to the story's 184px grid.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Info } from '@phosphor-icons/react'
import storyStyles from '../story/StoryView.module.css'
import { Gami3DModel } from './Gami3DModel'
import { gamiIconSvg } from './gamiMapLayers'
import { GAMI_PARTS } from './gamiScenario'
import { TONE, type GamiCard, type PartId, type Tone } from './gamiTypes'
import css from './GamiCards.module.css'

type CardOf<K extends GamiCard['kind']> = Extract<GamiCard, { kind: K }>

const tone = (name: Tone | undefined, fallback = '#fff') => (name ? TONE[name] : fallback)

/** Titles carry their source as a trailing tag, e.g. "2026 Plan Progress GAMI". */
function splitSource(title: string) {
  const match = /^(.*?)\s+(GAMI)$/.exec(title)
  return match ? { title: match[1], source: match[2] } : { title, source: null }
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

function CardTitle({ title }: { title: string }) {
  const { title: text, source } = splitSource(title)
  return (
    <header className={css.head}>
      <h3 className={css.title}>{text}</h3>
      {source ? <span className={css.source}>{source}</span> : null}
    </header>
  )
}

function Summary({ card }: { card: CardOf<'summary'> }) {
  return (
    <p className={`${storyStyles.summaryBody} ${css.summaryBody}`}>
      {card.parts.map((part, index) =>
        part.tone ? (
          <em key={index} className={storyStyles.summaryEmphasis} style={{ color: TONE[part.tone] }}>
            {part.text}
          </em>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  )
}

function Kpis({ card }: { card: CardOf<'kpis'> }) {
  const count = card.tiles.length
  const size = card.span === 'cell' || count === 1 ? 40 : count === 2 ? 34 : count === 3 ? 28 : 20
  return (
    <div className={css.kpis} style={{ '--kpi-cols': count, '--kpi-size': `${size}px` } as CSSProperties}>
      {card.tiles.map((tile) => (
        <div key={tile.label} className={css.kpi} style={{ '--tone': tone(tile.tone) } as CSSProperties}>
          {tile.icon ? (
            <span className={css.kpiIcon} dangerouslySetInnerHTML={{ __html: gamiIconSvg(tile.icon, 14) }} aria-hidden />
          ) : null}
          <p className={css.kpiValue}>
            {tile.value}
            {tile.unit ? <span className={css.kpiUnit}>{tile.unit}</span> : null}
          </p>
          <p className={css.kpiLabel}>{tile.label}</p>
          {tile.note ? <span className={css.kpiNote}>{tile.note}</span> : null}
        </div>
      ))}
    </div>
  )
}

function Progress({ card }: { card: CardOf<'progress'> }) {
  return (
    <div className={css.progress}>
      {card.rows.map((row) => (
        <div key={row.label} className={css.progressRow} style={{ '--tone': TONE[row.tone] } as CSSProperties}>
          <div className={css.progressText}>
            <span className={css.progressLabel}>{row.label}</span>
            <span className={css.progressValue}>
              {row.value} <span className={css.muted}>{row.target}</span>
            </span>
          </div>
          <div className={css.progressTrack}>
            <span className={css.progressFill} style={{ width: `${Math.min(100, row.pct)}%` }} />
            <span className={css.progressPct}>{row.pct.toFixed(1)}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Legend({ items }: { items: { name: string; color: string; faded?: boolean }[] }) {
  return (
    <div className={css.legend}>
      {items.map((item) => (
        <span key={item.name} className={css.legendItem}>
          <i className={item.faded ? css.legendDash : css.legendDot} style={{ '--tone': item.color } as CSSProperties} />
          {item.name}
        </span>
      ))}
    </div>
  )
}

function LineChart({ card }: { card: CardOf<'line'> }) {
  const [ref, { width, height }] = useSize<HTMLDivElement>()
  const pad = { left: 30, right: 8, top: 8, bottom: 18 }
  const w = Math.max(0, width - pad.left - pad.right)
  const h = Math.max(0, height - pad.top - pad.bottom)
  const x = (i: number) => pad.left + (card.x.length === 1 ? w / 2 : (i / (card.x.length - 1)) * w)
  const y = (v: number) => pad.top + h - (v / card.yMax) * h
  const ticks = [0, card.yMax / 2, card.yMax]
  const path = (points: (number | null)[]) => {
    let d = ''
    let pen = false
    points.forEach((value, i) => {
      if (value === null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(value).toFixed(1)}`
      pen = true
    })
    return d
  }
  const legend = card.series.filter((series) => !series.faded || !card.series.some((s) => !s.faded && s.tone === series.tone))
  return (
    <>
      <Legend items={legend.map((series) => ({ name: series.name, color: TONE[series.tone], faded: series.faded }))} />
      <div ref={ref} className={css.plot}>
        {width > 0 ? (
          <svg width={width} height={height} className={css.svg}>
            <defs>
              {card.series.map((series) => (
                <linearGradient key={series.name} id={`fill-${card.id}-${series.tone}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={TONE[series.tone]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={TONE[series.tone]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className={css.grid} />
                <text x={pad.left - 6} y={y(tick) + 3} className={css.axisY}>
                  {Math.round(tick)}
                  {card.ySuffix ?? ''}
                </text>
              </g>
            ))}
            {card.x.map((label, i) => (
              <text key={label} x={x(i)} y={height - 4} className={css.axisX}>
                {label}
              </text>
            ))}
            {card.goal ? (
              <g>
                <line x1={pad.left} x2={width - pad.right} y1={y(card.goal.value)} y2={y(card.goal.value)} className={css.goal} />
                <text x={width - pad.right} y={y(card.goal.value) - 4} className={css.goalLabel}>
                  {card.goal.label}
                </text>
              </g>
            ) : null}
            {card.series.map((series) => {
              const d = path(series.points)
              const real = series.points.map((value, i) => [value, i] as const).filter(([value]) => value !== null)
              const lastPoint = real[real.length - 1]
              return (
                <g key={series.name}>
                  {!series.faded && real.length > 1 ? (
                    <path
                      d={`${d}L${x(real[real.length - 1][1])},${y(0)}L${x(real[0][1])},${y(0)}Z`}
                      fill={`url(#fill-${card.id}-${series.tone})`}
                      className={css.area}
                    />
                  ) : null}
                  <path
                    d={d}
                    fill="none"
                    stroke={TONE[series.tone]}
                    strokeWidth={series.faded ? 1.5 : 2}
                    strokeDasharray={series.faded ? '4 4' : undefined}
                    strokeOpacity={series.faded ? 0.7 : 1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                    className={series.faded ? css.lineFaded : css.line}
                  />
                  {!series.faded && lastPoint ? (
                    <circle cx={x(lastPoint[1])} cy={y(lastPoint[0] as number)} r={3.5} fill={TONE[series.tone]} className={css.dot} />
                  ) : null}
                </g>
              )
            })}
          </svg>
        ) : null}
      </div>
    </>
  )
}

function VBars({ card }: { card: CardOf<'vbars'> }) {
  const [ref, { width, height }] = useSize<HTMLDivElement>()
  const max = Math.max(...card.bars.map((bar) => bar.value))
  const slot = width / card.bars.length
  const barW = Math.min(30, slot * 0.5)
  const top = 16
  const bottom = 18
  const h = Math.max(0, height - top - bottom)
  return (
    <div ref={ref} className={css.plot}>
      {width > 0 ? (
        <svg width={width} height={height} className={css.svg}>
          <defs>
            {card.bars.map((bar, i) => (
              <linearGradient key={i} id={`vbar-${card.id}-${i}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={TONE[bar.tone]} />
                <stop offset="100%" stopColor={TONE[bar.tone]} stopOpacity={0.35} />
              </linearGradient>
            ))}
          </defs>
          <line x1={0} x2={width} y1={top + h} y2={top + h} className={css.grid} />
          {card.bars.map((bar, i) => {
            const bh = Math.max(2, (bar.value / max) * h)
            const cx = slot * i + slot / 2
            return (
              <g key={bar.label} className={css.vbar} style={{ '--i': i } as CSSProperties}>
                <rect x={cx - barW / 2} y={top + h - bh} width={barW} height={bh} rx={4} fill={`url(#vbar-${card.id}-${i})`} />
                <text x={cx} y={top + h - bh - 4} className={css.barValue}>
                  {bar.display ?? bar.value}
                </text>
                <text x={cx} y={height - 4} className={css.axisX}>
                  {bar.label}
                </text>
              </g>
            )
          })}
        </svg>
      ) : null}
    </div>
  )
}

function HBars({ card }: { card: CardOf<'hbars'> }) {
  const max = Math.max(...card.bars.map((bar) => bar.value))
  return (
    <div className={css.hbars}>
      {card.bars.map((bar, i) => (
        <div key={bar.label} className={css.hbarRow} style={{ '--tone': TONE[bar.tone], '--i': i } as CSSProperties}>
          <span className={css.hbarLabel}>{bar.label}</span>
          <span className={css.hbarTrack}>
            <span className={css.hbarFill} style={{ width: `${(bar.value / max) * 100}%` }} />
          </span>
          <span className={css.hbarValue}>{bar.display}</span>
        </div>
      ))}
    </div>
  )
}

function Stacked({ card }: { card: CardOf<'stacked'> }) {
  return (
    <>
      <Legend items={card.legend.map((item) => ({ name: item.name, color: TONE[item.tone] }))} />
      <div className={css.stacked}>
        {card.bars.map((bar, row) => {
          const total = bar.parts.reduce((sum, part) => sum + part, 0)
          return (
            <div key={bar.label} className={css.stackRow} style={{ '--i': row } as CSSProperties}>
              <span className={css.stackLabel}>{bar.label}</span>
              <span className={css.stackBar}>
                {bar.parts.map((part, i) => (
                  <span
                    key={i}
                    className={css.stackPart}
                    style={{ flexGrow: part / total, background: TONE[card.legend[i].tone] }}
                    title={`${card.legend[i].name}: ${Math.round((part / total) * 100)}%`}
                  />
                ))}
              </span>
            </div>
          )
        })}
      </div>
    </>
  )
}

function Grouped({ card }: { card: CardOf<'grouped'> }) {
  const [ref, { width, height }] = useSize<HTMLDivElement>()
  const max = Math.max(...card.groups.flatMap((group) => group.values))
  const slot = width / card.groups.length
  const count = card.legend.length
  const barW = Math.min(12, (slot * 0.7) / count)
  const top = 6
  const bottom = 18
  const h = Math.max(0, height - top - bottom)
  return (
    <>
      <Legend items={card.legend.map((item) => ({ name: item.name, color: item.color }))} />
      <div ref={ref} className={css.plot}>
        {width > 0 ? (
          <svg width={width} height={height} className={css.svg}>
            <line x1={0} x2={width} y1={top + h} y2={top + h} className={css.grid} />
            {card.groups.map((group, g) => {
              const start = slot * g + slot / 2 - (barW * count + 2 * (count - 1)) / 2
              return (
                <g key={group.label} className={css.vbar} style={{ '--i': g } as CSSProperties}>
                  {group.values.map((value, i) => {
                    const bh = Math.max(2, (value / max) * h)
                    return (
                      <rect
                        key={i}
                        x={start + i * (barW + 2)}
                        y={top + h - bh}
                        width={barW}
                        height={bh}
                        rx={2}
                        fill={card.legend[i].color}
                      >
                        <title>{`${card.legend[i].name}: ${value.toLocaleString()}`}</title>
                      </rect>
                    )
                  })}
                  <text x={slot * g + slot / 2} y={height - 4} className={css.axisX}>
                    {group.label}
                  </text>
                </g>
              )
            })}
          </svg>
        ) : null}
      </div>
    </>
  )
}

function Donut({ card }: { card: CardOf<'donut'> }) {
  const total = card.slices.reduce((sum, slice) => sum + slice.value, 0)
  const r = 44
  const c = 2 * Math.PI * r
  const lengths = card.slices.map((slice) => (slice.value / total) * c)
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((sum, length) => sum + length, 0))
  return (
    <div className={css.donut}>
      <svg width={112} height={112} viewBox="0 0 112 112" className={css.donutSvg}>
        <circle cx={56} cy={56} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={12} />
        {card.slices.map((slice, i) => {
          const dash = `${Math.max(0, lengths[i] - 2)} ${c}`
          return (
            <circle
              key={slice.name}
              cx={56}
              cy={56}
              r={r}
              fill="none"
              stroke={TONE[slice.tone]}
              strokeWidth={12}
              strokeDasharray={dash}
              strokeDashoffset={-offsets[i]}
              transform="rotate(-90 56 56)"
              className={css.donutSlice}
            />
          )
        })}
        <text x={56} y={56} className={css.donutTotal}>
          {card.total}
        </text>
        <text x={56} y={71} className={css.donutLabel}>
          {card.totalLabel}
        </text>
      </svg>
      <ul className={css.donutLegend}>
        {card.slices.map((slice) => (
          <li key={slice.name}>
            <i className={css.legendDot} style={{ '--tone': TONE[slice.tone] } as CSSProperties} />
            <span className={css.donutName}>{slice.name}</span>
            <b>{Math.round((slice.value / total) * 1000) / 10}%</b>
          </li>
        ))}
      </ul>
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
          {card.rows.map((row, r) => (
            <tr
              key={r}
              className={row.highlight ? css.rowHighlight : undefined}
              style={{ '--tone': tone(row.tone, 'rgba(255,255,255,0.6)'), '--i': r } as CSSProperties}
            >
              {row.cells.map((cell, c) => (
                <td key={c}>{c === card.pillColumn ? <span className={css.pill}>{cell}</span> : cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Range({ card }: { card: CardOf<'range'> }) {
  const at = (value: number) => `${((value - card.min) / (card.max - card.min)) * 100}%`
  return (
    <div className={css.range}>
      <div className={css.rangeRows}>
        {card.rows.map((row, i) => (
          <div key={row.label} className={css.rangeRow} style={{ '--tone': TONE[row.tone], '--i': i } as CSSProperties}>
            <span className={css.rangeLabel}>{row.label}</span>
            <span className={css.rangeTrack}>
              <span className={css.rangeBar} style={{ left: at(row.from), width: `calc(${at(row.to)} - ${at(row.from)})` }} />
            </span>
          </div>
        ))}
        <span className={css.rangeToday} style={{ left: `calc(64px + (100% - 64px) * ${(0 - card.min) / (card.max - card.min)})` }}>
          <span>Today</span>
        </span>
      </div>
      <div className={css.rangeAxis}>
        {card.ticks.map((tick) => (
          <span key={tick} style={{ left: at(tick) }}>
            {tick === 0 ? '0' : `${tick > 0 ? '+' : '−'}${Math.abs(tick)}m`}
          </span>
        ))}
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
    ['Min', Math.floor(left / 60_000) % 60],
    ['Sec', Math.floor(left / 1000) % 60],
  ]
  return (
    <div className={css.countdown}>
      {units.map(([label, value]) => (
        <div key={label} className={css.countUnit}>
          <span className={css.countValue}>{String(value).padStart(label === 'Days' ? 3 : 2, '0')}</span>
          <span className={css.countLabel}>{label}</span>
        </div>
      ))}
    </div>
  )
}

function Part({ card, onInfo }: { card: CardOf<'part'>; onInfo?: (part: PartId) => void }) {
  const part = GAMI_PARTS[card.part]
  return (
    <div className={css.part}>
      <button
        type="button"
        className={css.partInfo}
        aria-label={`About the ${part.name}`}
        onClick={() => onInfo?.(part.id)}
      >
        <Info size={16} weight="bold" aria-hidden />
      </button>
      <Gami3DModel model={part.id} accent={TONE[part.tone]} className={css.partModel} />
      <div className={css.partFoot}>
        <span className={css.partDays}>{part.stockDays} days</span>
        <span className={css.muted}>{part.city.split(',')[0]}</span>
      </div>
    </div>
  )
}

function body(card: GamiCard, onPartInfo?: (part: PartId) => void): ReactNode {
  switch (card.kind) {
    case 'summary':
      return <Summary card={card} />
    case 'kpis':
      return <Kpis card={card} />
    case 'progress':
      return <Progress card={card} />
    case 'line':
      return <LineChart card={card} />
    case 'vbars':
      return <VBars card={card} />
    case 'hbars':
      return <HBars card={card} />
    case 'stacked':
      return <Stacked card={card} />
    case 'grouped':
      return <Grouped card={card} />
    case 'donut':
      return <Donut card={card} />
    case 'table':
      return <Table card={card} />
    case 'range':
      return <Range card={card} />
    case 'countdown':
      return <Countdown card={card} />
    case 'part':
      return <Part card={card} onInfo={onPartInfo} />
  }
}

export function GamiCardView({ card, onPartInfo }: { card: GamiCard; onPartInfo?: (part: PartId) => void }) {
  const cell = card.span === 'cell'
  const glow = card.kind === 'kpis' && card.glow
  return (
    <section
      className={[
        card.kind === 'summary' ? storyStyles.summaryCard : storyStyles.visualCard,
        css.card,
        cell ? css.cell : css.full,
        card.height === 2 ? css.tall : '',
        glow ? css.glow : '',
        card.kind === 'part' ? css.partCard : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={splitSource(card.title).title}
    >
      <CardTitle title={card.title} />
      {body(card, onPartInfo)}
      {card.footer ? <p className={css.footer}>{card.footer}</p> : null}
    </section>
  )
}
