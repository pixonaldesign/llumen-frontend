/**
 * A lit tower's details, sliding in from the right over the story like the story's edit panels: its
 * value, units, unit mix, completion and reports down the side, and Sales, Utilization, Ownership and
 * Rentals tabs with their figures, unit types, demographics and time series.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Buildings,
  Check,
  DownloadSimple,
  FileText,
  Hourglass,
  Key,
  PresentationChart,
  Scan,
  UserCircle,
  UsersThree,
  X,
  type Icon,
} from '@phosphor-icons/react'
import panelStyles from '../story/StoryEditPanel.module.css'
import cardStyles from '../story/StoryView.module.css'
import { EstateCardBody, Sparkline } from './EstateCharts'
import { ESTATE_BUILDINGS } from './estateBuildings'
import { PALETTE, type BuildingId, type BuildingTabId, type CountRow } from './estateTypes'
import css from './EstateBuildingPanel.module.css'

const TABS: { id: BuildingTabId; label: string; icon: Icon }[] = [
  { id: 'sales', label: 'Sales', icon: PresentationChart },
  { id: 'utilization', label: 'Utilization', icon: Scan },
  { id: 'ownership', label: 'Ownership', icon: UserCircle },
  { id: 'rentals', label: 'Rentals', icon: Key },
]

/** Unit types in the Teal palette's order, so every donut and table reads the same type in the same colour. */
const UNIT_COLORS: Record<string, string> = {
  '2 Bedroom': PALETTE.teal[1],
  Duplex: PALETTE.blue[3],
  Studio: PALETTE.teal[3],
  Penthouse: PALETTE.blue[4],
  '1 Bedroom': PALETTE.teal[0],
  '3 Bedroom': PALETTE.teal[2],
}

/** Each demographic group in its own sequential palette, as the design separates them. */
const GROUP_PALETTES: readonly (readonly string[])[] = [
  [PALETTE.teal[0], PALETTE.teal[1], PALETTE.teal[2], PALETTE.teal[3], PALETTE.teal[4]],
  [PALETTE.purple[2], PALETTE.purple[4]],
  [PALETTE.blue[1], PALETTE.blue[3], PALETTE.blue[4], PALETTE.blue[5]],
  [PALETTE.categorical[7], PALETTE.categorical[5]],
]

/** How long the panel slides before its charts start to fill, and how long the fill takes. */
const FILL_DELAY_MS = 720
const SWEEP_MS = 1200
const COUNT_MS = 1300

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/**
 * A figure such as `25.8B`, `1,653` or `72%`, counting up from zero after `delay` ms: its number climbs
 * with the decimals and thousands separators it is written with, its prefix and suffix stay put.
 */
function Count({ text, delay }: { text: string; delay: number }) {
  const match = /^([^\d]*)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(text)
  const target = match ? Number(match[2].replace(/,/g, '')) : 0
  const decimals = match?.[2].split('.')[1]?.length ?? 0
  const grouped = match?.[2].includes(',') ?? false
  const counts = Boolean(match)
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!counts) return
    let frame = 0
    const begin = performance.now() + delay
    const tick = (now: number) => {
      const t = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : Math.max(0, Math.min(1, (now - begin) / COUNT_MS))
      setValue(target * easeOutCubic(t))
      if (t < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [counts, target, delay])
  if (!match) return <>{text}</>
  const shown = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouped,
  })
  return (
    <>
      {match[1]}
      {shown}
      {match[3]}
    </>
  )
}

const fillStyle = (delay: number, extra?: CSSProperties) => ({ '--fill-delay': `${delay}ms`, ...extra }) as CSSProperties

const unitColor = (name: string, index: number) => UNIT_COLORS[name] ?? PALETTE.categorical[index % PALETTE.categorical.length]

const share = (count: number, total: number) => {
  const pct = (count / total) * 100
  return `${pct < 10 ? pct.toFixed(2) : pct.toFixed(1)}%`
}

/** A ring of unit types; hovering a slice (or its row) names it in the middle. */
function UnitDonut({
  rows,
  size,
  stroke,
  active,
  onActive,
  label = 'units',
  delay,
}: {
  rows: CountRow[]
  size: number
  stroke: number
  active: string | null
  onActive: (name: string | null) => void
  label?: string
  /** When the slices start sweeping round, one after another. */
  delay: number
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  /** The stroke straddles the radius; the viewBox clips whatever passes its 60-unit half-width. */
  const r = Math.min(50, 59 - stroke / 2)
  const c = 2 * Math.PI * r
  const gap = rows.length > 1 ? 2.4 : 0
  const starts = rows.map((_, index) => rows.slice(0, index).reduce((sum, row) => sum + (row.count / total) * c, 0))
  const shown = rows.find((row) => row.name === active)
  return (
    <div className={css.donut} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" aria-hidden>
        {rows.map((row, index) => {
          const length = (row.count / total) * c
          const dash = Math.max(0, length - gap)
          const start = starts[index]
          const dim = active !== null && active !== row.name
          return (
            <circle
              key={row.name}
              cx={60}
              cy={60}
              r={r}
              fill="none"
              stroke={unitColor(row.name, index)}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${c}`}
              strokeDashoffset={-start}
              transform="rotate(-90 60 60)"
              opacity={dim ? 0.32 : 1}
              className={css.donutSlice}
              style={
                {
                  '--c': c,
                  animationDelay: `${delay + (start / c) * SWEEP_MS}ms`,
                  animationDuration: `${Math.max(120, (length / c) * SWEEP_MS)}ms`,
                } as CSSProperties
              }
              onMouseEnter={() => onActive(row.name)}
              onMouseLeave={() => onActive(null)}
            />
          )
        })}
      </svg>
      <div className={css.donutCenter}>
        {shown ? (
          <>
            <span className={css.donutName}>{shown.name}</span>
            <strong>{shown.count.toLocaleString('en-US')}</strong>
            <span className={css.donutShare}>{share(shown.count, total)}</span>
          </>
        ) : (
          <>
            <strong>
              <Count text={total.toLocaleString('en-US')} delay={delay} />
            </strong>
            <span className={css.donutName}>{label}</span>
          </>
        )}
      </div>
    </div>
  )
}

function CompletionRing({ pct, color, handover, delay }: { pct: number; color: string; handover: string; delay: number }) {
  const r = 50
  const c = 2 * Math.PI * r
  return (
    <div className={css.ringWrap}>
      <div className={css.ring}>
        <svg viewBox="0 0 120 120" aria-hidden>
          <circle cx={60} cy={60} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} />
          <circle
            cx={60}
            cy={60}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`}
            transform="rotate(-90 60 60)"
            className={css.ringFill}
            style={{ '--c': c, animationDelay: `${delay}ms` } as CSSProperties}
          />
        </svg>
        <div className={css.donutCenter}>
          <span className={css.donutName}>Completed</span>
          <strong>
            <Count text={`${pct}%`} delay={delay} />
          </strong>
        </div>
      </div>
      <p className={css.railNote}>Handover {handover}</p>
    </div>
  )
}

function ReportButton({ name }: { name: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => setDone(false), 1600)
    return () => window.clearTimeout(timer)
  }, [done])
  return (
    <button type="button" className={css.report} onClick={() => setDone(true)} aria-label={`Download ${name}`}>
      <FileText size={16} weight="regular" aria-hidden />
      <span>{name}</span>
      <span className={css.reportIcon} data-done={done || undefined}>
        {done ? <Check size={14} weight="bold" aria-hidden /> : <DownloadSimple size={14} weight="regular" aria-hidden />}
      </span>
    </button>
  )
}

function SectionBar({ icon: IconCmp, title }: { icon: Icon; title: string }) {
  return (
    <h3 className={css.sectionBar}>
      <IconCmp size={16} weight="regular" aria-hidden />
      {title}
    </h3>
  )
}

export function EstateBuildingPanel({ buildingId, onClose }: { buildingId: BuildingId; onClose: () => void }) {
  const building = ESTATE_BUILDINGS[buildingId]
  const [tab, setTab] = useState<BuildingTabId>('sales')
  /** The first tab fills as the panel lands; a tab picked later fills at once. */
  const [switched, setSwitched] = useState(false)
  const tabDelay = switched ? 80 : FILL_DELAY_MS
  const [railSlice, setRailSlice] = useState<string | null>(null)
  const [mainSlice, setMainSlice] = useState<string | null>(null)
  const data = building.tabs[tab]
  const sorted = useMemo(() => [...data.breakdown.rows].sort((a, b) => b.count - a.count), [data])
  const breakdownTotal = sorted.reduce((sum, row) => sum + row.count, 0)
  const railRows = useMemo(() => [...building.unitTypes].sort((a, b) => b.count - a.count), [building])
  const railDefault = railRows[0]?.name ?? null

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <section
      key={building.id}
      className={`${panelStyles.panel} ${css.panel}`}
      style={{ '--tower': building.color } as CSSProperties}
      role="dialog"
      aria-label={`${building.name} details`}
    >
      <header className={`${panelStyles.header} ${css.header}`}>
        <div className={panelStyles.headerIdentity}>
          <i className={css.towerDot} aria-hidden />
          <h2 className={panelStyles.title}>{building.name}</h2>
          <div className={css.tags}>
            <span className={`${css.tag} ${css.tagId}`}>{building.code}</span>
            <span className={css.tag}>{building.use}</span>
            <span className={css.tag}>{building.stage}</span>
          </div>
        </div>
        <button type="button" className={`${panelStyles.closeBtn} ${css.close}`} aria-label="Close details" onClick={onClose}>
          <X size={18} weight="regular" aria-hidden />
        </button>
      </header>

      <div className={css.body}>
        <aside className={css.rail} aria-label={`${building.name} overview`}>
          <section className={css.railSection}>
            <p className={css.railLabel}>Total value ({building.totalValue.unit})</p>
            <p className={cardStyles.visualValue}>
              <strong>
                <Count text={building.totalValue.value} delay={FILL_DELAY_MS} />
              </strong>
            </p>
            <div className={css.railSpark} style={fillStyle(FILL_DELAY_MS)}>
              <Sparkline points={building.totalValue.spark} color={building.color} className={css.sparkSvg} />
            </div>
            <div className={css.railYears}>
              {building.totalValue.years.map((year) => (
                <span key={year}>{year}</span>
              ))}
            </div>
          </section>
          <section className={css.railSection}>
            <p className={css.railLabel}>Number of units</p>
            <p className={cardStyles.visualValue}>
              <strong>
                <Count text={building.units.toLocaleString('en-US')} delay={FILL_DELAY_MS} />
              </strong>
            </p>
          </section>
          <section className={css.railSection}>
            <p className={css.railLabel}>Breakdown by unit types</p>
            <div className={css.railCenter}>
              <UnitDonut
                rows={building.unitTypes}
                size={148}
                stroke={14}
                active={railSlice ?? railDefault}
                onActive={setRailSlice}
                delay={FILL_DELAY_MS}
              />
            </div>
          </section>
          <section className={css.railSection}>
            <p className={css.railLabel}>Completion rate</p>
            <div className={css.railCenter}>
              <CompletionRing
                pct={building.completion}
                color={building.color}
                handover={building.handover}
                delay={FILL_DELAY_MS + 160}
              />
            </div>
          </section>
          <section className={css.railSection}>
            <p className={css.railLabel}>Progress reports</p>
            <div className={css.reports}>
              {building.reports.map((name) => (
                <ReportButton key={name} name={name} />
              ))}
            </div>
          </section>
        </aside>

        <div className={css.main}>
          <div className={`${panelStyles.locationTabsRow} ${css.tabs}`} role="tablist" aria-label="Details">
            {TABS.map((item) => {
              const selected = item.id === tab
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`estate-tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls="estate-tab-panel"
                  className={`${panelStyles.locationTab} ${css.tab}${selected ? ` ${panelStyles.locationTabActive}` : ''}`}
                  onClick={() => {
                    setTab(item.id)
                    setSwitched(true)
                    setMainSlice(null)
                  }}
                >
                  <item.icon size={16} weight="regular" aria-hidden />
                  {item.label}
                </button>
              )
            })}
          </div>

          <div
            key={tab}
            className={css.scroll}
            id="estate-tab-panel"
            role="tabpanel"
            aria-labelledby={`estate-tab-${tab}`}
          >
            <div className={css.kpis}>
              {data.kpis.map((kpi) => (
                <div key={kpi.label} className={css.kpi}>
                  <p className={css.railLabel}>{kpi.label}</p>
                  <p className={cardStyles.visualValue}>
                    <strong>
                      <Count text={kpi.value} delay={tabDelay} />
                    </strong>
                    {kpi.unit ? <span>{kpi.unit}</span> : null}
                  </p>
                </div>
              ))}
            </div>

            <SectionBar icon={Buildings} title={data.breakdown.title} />
            <div className={css.breakdown}>
              <div className={css.table} role="table" aria-label={data.breakdown.title}>
                {sorted.map((row) => (
                  <div
                    key={row.name}
                    className={css.tableRow}
                    role="row"
                    data-dim={(mainSlice !== null && mainSlice !== row.name) || undefined}
                    onMouseEnter={() => setMainSlice(row.name)}
                    onMouseLeave={() => setMainSlice(null)}
                  >
                    <span role="cell" className={css.tableName}>
                      <i style={{ background: unitColor(row.name, 0) }} aria-hidden />
                      {row.name}
                    </span>
                    <span role="cell" className={css.tableCount}>
                      <Count text={row.count.toLocaleString('en-US')} delay={tabDelay} />
                    </span>
                    <span role="cell" className={css.tableShare}>
                      {share(row.count, breakdownTotal)}
                    </span>
                  </div>
                ))}
              </div>
              <UnitDonut
                rows={sorted}
                size={196}
                stroke={22}
                active={mainSlice}
                onActive={setMainSlice}
                delay={tabDelay}
              />
            </div>

            <SectionBar icon={UsersThree} title={data.demographics.title} />
            <div className={css.demographics}>
              {data.demographics.groups.map((group, g) => {
                const max = Math.max(...group.bars.map((bar) => bar.value))
                const total = group.bars.reduce((sum, bar) => sum + bar.value, 0)
                const colors = GROUP_PALETTES[g % GROUP_PALETTES.length]
                return (
                  <div key={group.title} className={css.group} style={{ flexGrow: group.bars.length }}>
                    <p className={css.groupTitle}>{group.title}</p>
                    <div className={css.bars}>
                      {group.bars.map((bar, i) => (
                        <div key={bar.label} className={css.bar} title={`${bar.label}: ${bar.value.toLocaleString('en-US')}`}>
                          <span className={css.barValue}>{share(bar.value, total)}</span>
                          <span className={css.barTrack}>
                            <span
                              className={css.barFill}
                              style={{
                                height: `${Math.max(4, (bar.value / max) * 100)}%`,
                                background: colors[i % colors.length],
                                animationDelay: `${tabDelay + 200 + g * 140 + i * 60}ms`,
                              }}
                            />
                          </span>
                          <span className={css.barLabel}>{bar.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <SectionBar icon={Hourglass} title="Time series" />
            <div className={css.series} style={fillStyle(tabDelay + 420)}>
              <EstateCardBody
                card={{
                  id: `${tab}-series`,
                  kind: 'line',
                  title: data.series.title,
                  kpi: { value: String(Math.round(data.series.points.at(-1) ?? 0)), unit: data.series.unit },
                  x: data.series.x,
                  yLabels: data.series.yLabels,
                  yMax: data.series.yMax,
                  series: [{ name: building.name, points: data.series.points, color: building.color }],
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
