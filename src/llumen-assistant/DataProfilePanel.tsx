import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { ArrowsOut, CaretDown, MagnifyingGlass, X } from '@phosphor-icons/react'
import type { CreatedComponent } from './assistantReplyTypes'
import {
  TEMPORAL_GRANULARITIES,
  TEMPORAL_GRANULARITY_LABELS,
  dataProfileForComponent,
  formatTemporalBoundLabel,
  gapsForGranularity,
  resolveTemporalRangeMs,
  type ColumnDataType,
  type ColumnProfile,
  type SpatialAvailabilitySeries,
  type TemporalAvailabilitySeries,
  type TemporalGranularity,
} from './componentDataProfiles'
import { useRevealScrollbarOnScroll } from './useRevealScrollbarOnScroll'
import styles from './DataProfilePanel.module.css'

const TOOLTIP_OFFSET = 14

const TYPE_LABELS: Record<ColumnDataType, string> = {
  string: 'String',
  number: 'Number',
  boolean: 'Boolean',
  date: 'Date',
  location: 'Location',
}

function Metric({ label, value }: { label: string; value: string }) {
  const isEmpty = value === '—' || value === '-'
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={`${styles.metricValue}${isEmpty ? ` ${styles.metricValueEmpty}` : ''}`}>
        {value}
      </span>
    </div>
  )
}

function formatUtcMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** Interpolate a missing-data range from the series bounds and gap fractions. */
function formatTemporalGapRange(
  rangeStartMs: number,
  rangeEndMs: number,
  start: number,
  width: number,
  granularity: TemporalGranularity,
): string {
  const total = rangeEndMs - rangeStartMs
  if (total > 0) {
    const gapStart = new Date(rangeStartMs + start * total)
    const gapEnd = new Date(rangeStartMs + (start + width) * total)
    if (granularity === 'years' || granularity === 'weeks' || granularity === 'days') {
      return `${formatUtcMonthYear(gapStart)} – ${formatUtcMonthYear(gapEnd)}`
    }
    return `${formatTemporalBoundLabel(gapStart.getTime(), granularity)} – ${formatTemporalBoundLabel(gapEnd.getTime(), granularity)}`
  }

  const fromPct = Math.round(start * 100)
  const toPct = Math.round((start + width) * 100)
  return `${fromPct}%–${toPct}%`
}

function TimelineGap({
  rangeStartMs,
  rangeEndMs,
  start,
  width,
  granularity,
}: {
  rangeStartMs: number
  rangeEndMs: number
  start: number
  width: number
  granularity: TemporalGranularity
}) {
  const tooltipId = useId()
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const rangeLabel = formatTemporalGapRange(
    rangeStartMs,
    rangeEndMs,
    start,
    width,
    granularity,
  )
  const tooltipText = `Missing data · ${rangeLabel}`

  const placeTooltip = (clientX: number, clientY: number) => {
    const pad = 12
    const approxWidth = 240
    const approxHeight = 40
    const x = Math.min(clientX + TOOLTIP_OFFSET, window.innerWidth - approxWidth - pad)
    const y = Math.min(clientY + TOOLTIP_OFFSET, window.innerHeight - approxHeight - pad)
    setTooltipPos({
      x: Math.max(pad, x),
      y: Math.max(pad, y),
    })
  }

  const onMove = (event: MouseEvent<HTMLButtonElement>) => {
    placeTooltip(event.clientX, event.clientY)
  }

  const onFocus = (event: FocusEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    placeTooltip(rect.left + rect.width / 2, rect.top)
  }

  return (
    <>
      <button
        type="button"
        className={styles.timelineGap}
        style={{ left: `${start * 100}%`, width: `${width * 100}%` }}
        aria-label={tooltipText}
        aria-describedby={tooltipPos ? tooltipId : undefined}
        onMouseEnter={onMove}
        onMouseMove={onMove}
        onMouseLeave={() => setTooltipPos(null)}
        onFocus={onFocus}
        onBlur={() => setTooltipPos(null)}
      />
      {tooltipPos
        ? createPortal(
            <div
              id={tooltipId}
              className={styles.tooltip}
              role="tooltip"
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
            >
              <p className={styles.tooltipText}>{tooltipText}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function ChartBar({
  label,
  count,
  height,
  index,
}: {
  label: string
  count: number
  height: number
  index: number
}) {
  const tooltipId = useId()
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const tooltipText = `${label || `Bin ${index + 1}`} · ${count.toLocaleString('en-US')}`

  const placeTooltip = (clientX: number, clientY: number) => {
    const pad = 12
    const approxWidth = 220
    const approxHeight = 40
    const x = Math.min(clientX + TOOLTIP_OFFSET, window.innerWidth - approxWidth - pad)
    const y = Math.min(clientY + TOOLTIP_OFFSET, window.innerHeight - approxHeight - pad)
    setTooltipPos({
      x: Math.max(pad, x),
      y: Math.max(pad, y),
    })
  }

  return (
    <>
      <button
        type="button"
        className={styles.chartBarTrack}
        aria-label={tooltipText}
        aria-describedby={tooltipPos ? tooltipId : undefined}
        onMouseEnter={(event) => placeTooltip(event.clientX, event.clientY)}
        onMouseMove={(event) => placeTooltip(event.clientX, event.clientY)}
        onMouseLeave={() => setTooltipPos(null)}
        onFocus={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          placeTooltip(rect.left + rect.width / 2, rect.top)
        }}
        onBlur={() => setTooltipPos(null)}
      >
        <span className={styles.chartBar} style={{ height: `${Math.round(height * 100)}%` }} />
      </button>
      {tooltipPos
        ? createPortal(
            <div
              id={tooltipId}
              className={styles.tooltip}
              role="tooltip"
              style={{ left: tooltipPos.x, top: tooltipPos.y }}
            >
              <p className={styles.tooltipText}>{tooltipText}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function DistributionChart({ column }: { column: ColumnProfile }) {
  const distribution = column.distribution
  if (!distribution || distribution.bars.length === 0) return null

  const binCount = Math.max(distribution.bars.length, distribution.xLabels.length)
  const sparseLabels = binCount > 7
  const midIndex = Math.floor((binCount - 1) / 2)
  const binStyle = {
    '--chart-bins': binCount,
    '--chart-bar-radius': sparseLabels ? '2px' : 'var(--radius-xs)',
  } as CSSProperties

  return (
    <div className={styles.chart}>
      <div className={styles.chartPlot}>
        <span className={styles.chartYLabel} aria-hidden>
          {distribution.yMaxLabel}
        </span>
        <div className={styles.chartBars} style={binStyle}>
          {distribution.bars.map((height, index) => (
            <ChartBar
              key={`${column.name}-bar-${index}`}
              label={distribution.xLabels[index] ?? ''}
              count={distribution.counts[index] ?? 0}
              height={height}
              index={index}
            />
          ))}
        </div>
        <div className={styles.chartAxisY} aria-hidden />
        <div className={styles.chartAxisX} aria-hidden />
      </div>
      <div className={styles.chartXLabels} style={binStyle} aria-hidden>
        {Array.from({ length: binCount }, (_, index) => {
          const label = distribution.xLabels[index] ?? ''
          const show =
            !sparseLabels || index === 0 || index === midIndex || index === binCount - 1
          return (
            <span key={`${column.name}-x-${index}`} className={show ? undefined : styles.chartXLabelHidden}>
              {show ? label : ''}
            </span>
          )
        })}
      </div>
    </div>
  )
}

type DistributionSort = 'as_profiled' | 'asc' | 'desc'

const SORT_OPTIONS = [
  { id: 'as_profiled', label: 'Default' },
  { id: 'asc', label: 'Ascending' },
  { id: 'desc', label: 'Descending' },
] as const

function sortLabel(sort: DistributionSort) {
  return SORT_OPTIONS.find((option) => option.id === sort)?.label ?? 'Default'
}

type DistributionRow = {
  key: string
  label: string
  count: number
  index: number
}

function buildDistributionRows(column: ColumnProfile): DistributionRow[] {
  const distribution = column.distribution
  if (!distribution) return []
  return distribution.xLabels.map((label, index) => ({
    key: `${column.name}-h-${index}`,
    label: label || `Bin ${index + 1}`,
    count: distribution.counts[index] ?? 0,
    index,
  }))
}

function sortDistributionRows(rows: DistributionRow[], sort: DistributionSort): DistributionRow[] {
  if (sort === 'as_profiled') return rows
  const sorted = [...rows]
  sorted.sort((a, b) => {
    const byCount = sort === 'asc' ? a.count - b.count : b.count - a.count
    if (byCount !== 0) return byCount
    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })
  })
  return sorted
}

function HorizontalDistributionChart({
  column,
  sort,
  query,
}: {
  column: ColumnProfile
  sort: DistributionSort
  query: string
}) {
  const scrollRef = useRevealScrollbarOnScroll()
  const distribution = column.distribution
  const allRows = useMemo(() => {
    const built = buildDistributionRows(column)
    return sortDistributionRows(built, sort)
  }, [column, sort])
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return allRows
    return allRows.filter((row) => row.label.toLowerCase().includes(needle))
  }, [allRows, query])

  if (!distribution || allRows.length === 0) return null
  const maxCount = Math.max(...allRows.map((row) => row.count), 1)

  return (
    <div
      ref={scrollRef}
      className={styles.hChart}
      role="list"
      aria-label={`${column.name} distribution`}
    >
      {rows.length === 0 ? (
        <p className={styles.hEmpty}>No matching values</p>
      ) : (
        rows.map((row) => {
          const width = Math.max(0.04, row.count / maxCount)
          return (
            <div key={row.key} className={styles.hRow} role="listitem">
              <span className={styles.hLabel} title={row.label}>
                {row.label}
              </span>
              <div className={styles.hTrack}>
                <span className={styles.hBar} style={{ width: `${Math.round(width * 100)}%` }} />
              </div>
              <span className={styles.hCount}>{row.count.toLocaleString('en-US')}</span>
            </div>
          )
        })
      )}
    </div>
  )
}

function SortMenu({
  value,
  onChange,
  open,
  onOpenChange,
}: {
  value: DistributionSort
  onChange: (next: DistributionSort) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      onOpenChange(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open, onOpenChange])

  return (
    <div className={styles.sortMenu} ref={rootRef}>
      <button
        type="button"
        className={`${styles.sortTrigger}${open ? ` ${styles.sortTriggerOpen}` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => onOpenChange(!open)}
      >
        <span className={styles.sortTriggerLabel}>{sortLabel(value)}</span>
        <CaretDown className={styles.sortCaret} size={16} weight="regular" aria-hidden />
      </button>
      {open ? (
        <div
          className={styles.sortPopover}
          id={listId}
          role="dialog"
          aria-modal="true"
          aria-label="Sort distribution"
        >
          {SORT_OPTIONS.map((option) => {
            const active = option.id === value
            return (
              <button
                key={option.id}
                type="button"
                className={`${styles.sortOption}${active ? ` ${styles.sortOptionActive}` : ''}`}
                aria-pressed={active}
                onClick={() => {
                  onChange(option.id)
                  onOpenChange(false)
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function ColumnExpandModal({
  column,
  onClose,
}: {
  column: ColumnProfile
  onClose: () => void
}) {
  const [sort, setSort] = useState<DistributionSort>('as_profiled')
  const [sortOpen, setSortOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (sortOpen) {
        setSortOpen(false)
        return
      }
      onClose()
    }
    // Capture so Escape closes this modal without dismissing the assistant.
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose, sortOpen])

  return createPortal(
    <div className={styles.modalRoot} role="presentation" data-lc-data-card-modal>
      <button type="button" className={styles.modalBackdrop} aria-label="Close" onClick={onClose} />
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`${column.name} distribution`}
      >
        <header className={styles.modalHeader}>
          <div className={styles.headingWithType}>
            <h3 className={styles.modalTitle}>{column.name}</h3>
            <span className={styles.typeBadge}>{TYPE_LABELS[column.dataType]}</span>
          </div>
          <button type="button" className={styles.modalClose} aria-label="Close" onClick={onClose}>
            <X size={16} weight="regular" aria-hidden />
          </button>
        </header>
        <div className={styles.modalHeaderToolbar}>
          <SortMenu value={sort} onChange={setSort} open={sortOpen} onOpenChange={setSortOpen} />
          <label className={styles.modalSearch}>
            <MagnifyingGlass size={20} weight="regular" aria-hidden />
            <input
              type="search"
              placeholder="Search..."
              value={query}
              aria-label={`Search ${column.name}`}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className={styles.modalBody}>
          <HorizontalDistributionChart column={column} sort={sort} query={query} />
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ColumnProfileCard({ column }: { column: ColumnProfile }) {
  const [expanded, setExpanded] = useState(false)
  const emptyOrZeroesLabel = column.dataType === 'number' ? 'Zeroes' : 'Empty'
  const canExpand = Boolean(column.distribution && column.distribution.bars.length > 0)

  return (
    <article className={styles.columnCard}>
      <header className={styles.columnHeader}>
        <div className={styles.headingWithType}>
          <h4 className={styles.columnName}>{column.name}</h4>
          <span className={styles.typeBadge}>{TYPE_LABELS[column.dataType]}</span>
        </div>
        {canExpand ? (
          <button
            type="button"
            className={styles.expandBtn}
            aria-label={`Expand ${column.name} chart`}
            onClick={() => setExpanded(true)}
          >
            <ArrowsOut size={16} weight="regular" aria-hidden />
          </button>
        ) : null}
      </header>

      <div className={styles.metricRow}>
        <Metric label="Count" value={column.count} />
        <Metric label="Nulls" value={column.missing} />
        <Metric label={emptyOrZeroesLabel} value={column.zeroes} />
      </div>

      <div className={styles.metricRow}>
        <Metric label="Min" value={column.min} />
        <Metric label="Max" value={column.max} />
        <Metric label="Median" value={column.median} />
      </div>

      <DistributionChart column={column} />

      {expanded ? <ColumnExpandModal column={column} onClose={() => setExpanded(false)} /> : null}
    </article>
  )
}

function SeriesTabs({
  label,
  series,
  activeId,
  onChange,
}: {
  label: string
  series: { id: string; label: string }[]
  activeId: string
  onChange: (id: string) => void
}) {
  if (series.length <= 1) return null

  return (
    <div className={styles.seriesTabs} role="tablist" aria-label={label}>
      {series.map((item) => {
        const active = item.id === activeId
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${styles.seriesTab}${active ? ` ${styles.seriesTabActive}` : ''}`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function GranularitySelect({
  value,
  onChange,
}: {
  value: TemporalGranularity
  onChange: (next: TemporalGranularity) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={styles.granularity} ref={rootRef}>
      <span className={styles.granularityLabel} id={labelId}>
        Granularity
      </span>
      <button
        type="button"
        className={`${styles.granularityTrigger}${open ? ` ${styles.granularityTriggerOpen}` : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Granularity: ${TEMPORAL_GRANULARITY_LABELS[value]}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{TEMPORAL_GRANULARITY_LABELS[value]}</span>
        <CaretDown className={styles.granularityCaret} size={12} weight="bold" aria-hidden />
      </button>
      {open ? (
        <div className={styles.granularityMenu} id={listId} role="listbox" aria-labelledby={labelId}>
          {TEMPORAL_GRANULARITIES.map((item) => (
            <button
              key={item}
              type="button"
              role="option"
              aria-selected={item === value}
              className={`${styles.granularityOption}${item === value ? ` ${styles.granularityOptionActive}` : ''}`}
              onClick={() => {
                onChange(item)
                setOpen(false)
              }}
            >
              {TEMPORAL_GRANULARITY_LABELS[item]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TemporalAvailability({ series }: { series: TemporalAvailabilitySeries[] }) {
  const seriesKey = series.map((item) => item.id).join('|')
  const firstId = series[0]?.id ?? ''
  const [activeId, setActiveId] = useState(firstId)
  const [granularity, setGranularity] = useState<TemporalGranularity>('years')
  const active = series.find((item) => item.id === activeId) ?? series[0]

  useEffect(() => {
    setActiveId(firstId)
  }, [seriesKey, firstId])

  const view = useMemo(() => {
    if (!active) return null
    const range = resolveTemporalRangeMs(active)
    return {
      gaps: gapsForGranularity(active, granularity),
      range,
      startLabel: formatTemporalBoundLabel(range.startMs, granularity),
      endLabel: formatTemporalBoundLabel(range.endMs, granularity),
    }
  }, [active, granularity])

  if (!active || !view) return null

  return (
    <section className={styles.availabilitySection}>
      <div className={styles.availabilityHeader}>
        <h3 className={styles.sectionTitle}>Temporal availability</h3>
        <div className={styles.availabilityControls}>
          <SeriesTabs
            label="Temporal columns"
            series={series}
            activeId={active.id}
            onChange={setActiveId}
          />
          <GranularitySelect value={granularity} onChange={setGranularity} />
        </div>
      </div>
      <div className={styles.timelineTrack}>
        <div className={styles.timelineFill} aria-hidden />
        {view.gaps.map((gap, index) => (
          <TimelineGap
            key={`${active.id}-${granularity}-gap-${index}`}
            rangeStartMs={view.range.startMs}
            rangeEndMs={view.range.endMs}
            start={gap.start}
            width={gap.width}
            granularity={granularity}
          />
        ))}
      </div>
      <div className={styles.timelineLabels}>
        <span>{view.startLabel}</span>
        <span>{view.endLabel}</span>
      </div>
    </section>
  )
}

function SpatialAvailability({ series }: { series: SpatialAvailabilitySeries[] }) {
  const seriesKey = series.map((item) => item.id).join('|')
  const firstId = series[0]?.id ?? ''
  const [activeId, setActiveId] = useState(firstId)
  const active = series.find((item) => item.id === activeId) ?? series[0]

  useEffect(() => {
    setActiveId(firstId)
  }, [seriesKey, firstId])

  if (!active) return null

  return (
    <section className={styles.availabilitySection}>
      <div className={styles.availabilityHeader}>
        <h3 className={styles.sectionTitle}>Spatial Availability</h3>
        <SeriesTabs
          label="Spatial columns"
          series={series}
          activeId={active.id}
          onChange={setActiveId}
        />
      </div>
      <div className={styles.spatialMap}>
        <img src={active.mapSrc} alt={active.mapAlt} />
      </div>
    </section>
  )
}

export function DataProfilePanel({ component }: { component: CreatedComponent }) {
  const profile = dataProfileForComponent(component)
  const scrollRef = useRevealScrollbarOnScroll()

  return (
    <div className={styles.root}>
      <div ref={scrollRef} className={styles.scroll}>
        <section className={styles.overviewSection} aria-label="Dataset overview">
          <h3 className={styles.sectionTitle}>Overview</h3>
          <div className={styles.overview}>
            <Metric label="Rows" value={profile.overview.rows} />
            <Metric label="Columns" value={profile.overview.columns} />
            <Metric label="Numeric" value={profile.overview.numericColumns} />
          </div>
        </section>

        <section className={styles.columnsSection} aria-label="Column profiles">
          <h3 className={styles.sectionTitle}>Data Columns</h3>
          <div className={styles.columnGrid}>
            {profile.columns.map((column) => (
              <ColumnProfileCard key={column.name} column={column} />
            ))}
          </div>
        </section>

        <TemporalAvailability series={profile.temporal} />
        <SpatialAvailability series={profile.spatial} />
      </div>
    </div>
  )
}
