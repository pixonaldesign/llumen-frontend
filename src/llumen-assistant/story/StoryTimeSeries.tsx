/**
 * Per-slide time series (Figma 5334:9193): granularity menu, speed +
 * play controls, scrubber, frame timestamp, the date-range menu, and optional line
 * charts of map layer columns drawn along the scrubber.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChartLine,
  Check,
  Eye,
  EyeSlash,
  Pause,
  Play,
  Plus,
  Trash,
} from '@phosphor-icons/react'
import { ConfigSelect } from './StoryConfigSelect'
import type { StoryScene } from './storyDemoScenes'
import {
  TIMELINE_CHART_LAYERS,
  chartColumn,
  chartLayer,
  chartSeriesValues,
  distinctChartSeries,
  freeChartColumns,
  hasFreeChartColumn,
  newChartSeries,
  type TimelineChartSeries,
} from './storyTimelineCharts'
import {
  PLAYBACK_SPEEDS,
  TIMELINE_GRANULARITIES,
  TIMELINE_RANGES,
  describeTimelineRange,
  formatFrameDate,
  formatPlaybackSpeed,
  granularityForRange,
  timelineFrameDate,
  type TimelineGranularity,
  type TimelineRange,
} from './storyTimeline'
import styles from './StoryTimeSeries.module.css'

const THUMB_WIDTH = 31
const CHART_HEIGHT = 56
const CHART_INSET_Y = 4
const CHART_VIEW_WIDTH = 1000

type Menu = 'speed' | 'dates' | 'granularity' | 'charts'
type ThumbMotion = 'play' | 'jump' | 'none'

export type StoryTimeSeriesProps = {
  range: TimelineRange
  granularity: TimelineGranularity
  frameCount: number
  frame: number
  playing: boolean
  speed: number
  stepMs: number
  onFrameChange: (frame: number) => void
  onPlayingChange: (playing: boolean) => void
  onSpeedChange: (speed: number) => void
  onGranularityChange: (granularityId: string) => void
  onRangeChange: (rangeId: string) => void
  /** Map scene the line charts sample; the chart button shows when this and `onChartsChange` are set. */
  chartScene?: StoryScene
  /** Shifts chart samples the same way the map's frame phase is shifted. */
  chartPhaseOffset?: number
  charts?: TimelineChartSeries[]
  onChartsChange?: (charts: TimelineChartSeries[]) => void
  editable: boolean
}

const NO_CHARTS: TimelineChartSeries[] = []

export function StoryTimeSeries({
  range,
  granularity,
  frameCount,
  frame,
  playing,
  speed,
  stepMs,
  onFrameChange,
  onPlayingChange,
  onSpeedChange,
  onGranularityChange,
  onRangeChange,
  chartScene,
  chartPhaseOffset = 0,
  charts = NO_CHARTS,
  onChartsChange,
  editable,
}: StoryTimeSeriesProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<HTMLDivElement>(null)
  const granularityBtnRef = useRef<HTMLButtonElement>(null)
  const speedBtnRef = useRef<HTMLButtonElement>(null)
  const datesBtnRef = useRef<HTMLButtonElement>(null)
  const chartsBtnRef = useRef<HTMLButtonElement>(null)
  const [chartDraft, setChartDraft] = useState<TimelineChartSeries[]>([])
  const [hoverFrame, setHoverFrame] = useState<number | null>(null)
  const chartsEnabled = Boolean(chartScene && onChartsChange)
  const visibleCharts = useMemo(
    () => (chartsEnabled ? charts.filter((series) => series.visible) : NO_CHARTS),
    [charts, chartsEnabled],
  )
  const chartValues = useMemo(
    () =>
      chartScene && visibleCharts.length > 0
        ? chartSeriesValues(chartScene, frameCount, chartPhaseOffset, visibleCharts)
        : [],
    [chartScene, frameCount, chartPhaseOffset, visibleCharts],
  )
  const menuRef = useRef<HTMLDivElement>(null)
  const resumeAfterScrubRef = useRef(false)
  const scrubPointerRef = useRef<number | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [menuPos, setMenuPos] = useState<{ bottom: number; left?: number; right?: number; width?: number }>({
    bottom: 0,
  })
  const [scrubbing, setScrubbing] = useState(false)
  const [shownFrame, setShownFrame] = useState(frame)
  const [thumbMotion, setThumbMotion] = useState<ThumbMotion>('jump')

  if (shownFrame !== frame) {
    setShownFrame(frame)
    setThumbMotion(scrubbing ? 'none' : playing ? (frame === shownFrame + 1 ? 'play' : 'none') : 'jump')
  }

  const lastFrame = frameCount - 1
  const progress = lastFrame > 0 ? frame / lastFrame : 0
  const dateText = formatFrameDate(timelineFrameDate(granularity, frameCount, frame))
  const [dateLabel, timeLabel] = dateText.split(', ')

  useEffect(() => {
    if (!menu) return
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[role="listbox"]')) return
      const triggers = [speedBtnRef, datesBtnRef, granularityBtnRef, chartsBtnRef]
      if (triggers.some((ref) => ref.current?.contains(target))) return
      setMenu(null)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menu])

  const openMenu = (next: Menu) => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    const bottom = window.innerHeight - rect.top + 8
    setMenuPos(
      next === 'granularity'
        ? { bottom, left: rect.left }
        : {
            bottom,
            right: window.innerWidth - rect.right,
            width: next === 'charts' ? rect.width : undefined,
          },
    )
    setMenu(next)
  }

  const toggleMenu = (next: Menu) => {
    if (menu === next) setMenu(null)
    else openMenu(next)
  }

  const toggleChartsMenu = () => {
    if (menu !== 'charts') {
      setChartDraft(
        editable
          ? charts.length > 0
            ? distinctChartSeries(charts)
            : [newChartSeries([])]
          : charts,
      )
    }
    toggleMenu('charts')
  }

  const patchDraft = (id: string, patch: Partial<TimelineChartSeries>) =>
    setChartDraft((current) => current.map((series) => (series.id === id ? { ...series, ...patch } : series)))

  const toggleChartVisibility = (id: string) => {
    if (editable) {
      patchDraft(id, { visible: !chartDraft.find((series) => series.id === id)?.visible })
      return
    }
    const next = chartDraft.map((series) =>
      series.id === id ? { ...series, visible: !series.visible } : series,
    )
    setChartDraft(next)
    onChartsChange?.(next)
  }

  const chartY = (value: number, min: number, max: number) =>
    max === min
      ? CHART_HEIGHT / 2
      : CHART_INSET_Y + (1 - (value - min) / (max - min)) * (CHART_HEIGHT - 2 * CHART_INSET_Y)

  const chartLines = chartValues.map((values, index) => {
    const min = Math.min(...values)
    const max = Math.max(...values)
    const series = visibleCharts[index]
    const column = chartColumn(series.layerId, series.columnId)
    const xAt = (frameIndex: number) => (lastFrame > 0 ? (frameIndex / lastFrame) * CHART_VIEW_WIDTH : 0)
    return {
      series,
      column,
      points: values.map((value, frameIndex) => `${xAt(frameIndex)},${chartY(value, min, max)}`).join(' '),
      yAt: (frameIndex: number) => chartY(values[frameIndex] ?? values[0], min, max),
      valueAt: (frameIndex: number) => column.format(values[frameIndex] ?? values[0]),
    }
  })

  const plotFrameAt = (clientX: number) => {
    const rect = plotRef.current?.getBoundingClientRect()
    if (!rect || lastFrame === 0) return 0
    return Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * lastFrame)
  }

  const frameAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || lastFrame === 0) return 0
    // With a chart the handle is a centred circle, so the whole track maps to frames.
    // Without one the handle is the 31px pill, which stays inside the track.
    const inset = chartLines.length > 0 ? 0 : THUMB_WIDTH / 2
    const ratio = (clientX - rect.left - inset) / (rect.width - inset * 2)
    return Math.round(Math.max(0, Math.min(1, ratio)) * lastFrame)
  }

  const onScrubStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    scrubPointerRef.current = event.pointerId
    resumeAfterScrubRef.current = playing
    if (playing) onPlayingChange(false)
    setScrubbing(true)
    onFrameChange(frameAt(event.clientX))
  }

  const onScrubMove = (event: PointerEvent<HTMLDivElement>) => {
    if (scrubPointerRef.current !== event.pointerId) return
    const next = frameAt(event.clientX)
    if (next !== frame) onFrameChange(next)
  }

  const onScrubEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (scrubPointerRef.current !== event.pointerId) return
    scrubPointerRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setScrubbing(false)
    if (resumeAfterScrubRef.current) onPlayingChange(true)
  }

  const onScrubKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const next =
      event.key === 'ArrowLeft' || event.key === 'ArrowDown'
        ? Math.max(0, frame - 1)
        : event.key === 'ArrowRight' || event.key === 'ArrowUp'
          ? Math.min(lastFrame, frame + 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? lastFrame
              : null
    if (next === null) return
    event.preventDefault()
    onFrameChange(next)
  }

  const thumbTransition =
    thumbMotion === 'play' ? `${stepMs}ms linear` : thumbMotion === 'jump' ? '220ms ease' : '0ms'

  return (
    <div ref={cardRef} className={styles.card} aria-label="Slide time series">
      <div className={styles.topRow}>
        <button
          ref={granularityBtnRef}
          type="button"
          className={`${styles.granularityBtn}${menu === 'granularity' ? ` ${styles.controlOpen}` : ''}`}
          aria-label={`Time step: ${granularity.label}`}
          aria-haspopup="listbox"
          aria-expanded={menu === 'granularity'}
          onClick={() => toggleMenu('granularity')}
        >
          <span>{granularity.label}</span>
          <CaretDown size={14} weight="bold" aria-hidden />
        </button>
        <div className={styles.controls}>
          {chartsEnabled ? (
            <button
              ref={chartsBtnRef}
              type="button"
              className={`${styles.playBtn}${menu === 'charts' ? ` ${styles.controlOpen}` : ''}`}
              aria-label="Line charts"
              aria-haspopup="dialog"
              aria-expanded={menu === 'charts'}
              onClick={toggleChartsMenu}
            >
              <ChartLine size={16} weight="regular" aria-hidden />
            </button>
          ) : null}
          <button
            ref={speedBtnRef}
            type="button"
            className={`${styles.speedBtn}${menu === 'speed' ? ` ${styles.controlOpen}` : ''}`}
            aria-label={`Playback speed ${formatPlaybackSpeed(speed)}`}
            aria-haspopup="dialog"
            aria-expanded={menu === 'speed'}
            onClick={() => toggleMenu('speed')}
          >
            {formatPlaybackSpeed(speed)}
          </button>
          <button
            type="button"
            className={styles.playBtn}
            aria-label={playing ? 'Pause time series' : 'Play time series'}
            aria-pressed={playing}
            onClick={() => onPlayingChange(!playing)}
          >
            {playing ? (
              <Pause size={16} weight="regular" aria-hidden />
            ) : (
              <Play size={16} weight="regular" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <div
        className={styles.series}
        style={{ '--progress': progress, '--thumb-transition': thumbTransition } as CSSProperties}
      >
      {chartLines.length > 0 ? (
        <div className={styles.chart}>
          <div
            ref={plotRef}
            className={styles.chartPlot}
            onPointerMove={(event) => setHoverFrame(plotFrameAt(event.clientX))}
            onPointerLeave={() => setHoverFrame(null)}
            onClick={(event) => onFrameChange(plotFrameAt(event.clientX))}
          >
            <svg
              className={styles.chartSvg}
              viewBox={`0 0 ${CHART_VIEW_WIDTH} ${CHART_HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`Line chart: ${chartLines.map((line) => line.column.label).join(', ')}`}
            >
              {chartLines.map((line) => (
                <polyline
                  key={line.series.id}
                  points={line.points}
                  fill="none"
                  stroke={line.series.color}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            {hoverFrame !== null && hoverFrame <= lastFrame ? (
              <>
                {chartLines.map((line) => (
                  <span
                    key={line.series.id}
                    className={styles.chartHoverDot}
                    style={{
                      left: `${(lastFrame > 0 ? hoverFrame / lastFrame : 0) * 100}%`,
                      top: line.yAt(hoverFrame),
                      background: line.series.color,
                    }}
                    aria-hidden
                  />
                ))}
                <div
                  className={`${styles.chartTooltip}${
                    hoverFrame / Math.max(1, lastFrame) < 0.3
                      ? ` ${styles.chartTooltipStart}`
                      : hoverFrame / Math.max(1, lastFrame) > 0.7
                        ? ` ${styles.chartTooltipEnd}`
                        : ''
                  }`}
                  style={{ left: `${(lastFrame > 0 ? hoverFrame / lastFrame : 0) * 100}%` }}
                  role="status"
                >
                  <span className={styles.chartTooltipDate}>
                    {formatFrameDate(timelineFrameDate(granularity, frameCount, hoverFrame))}
                  </span>
                  {chartLines.map((line) => (
                    <span key={line.series.id} className={styles.chartTooltipRow}>
                      <i style={{ background: line.series.color }} aria-hidden />
                      <span className={styles.chartTooltipLabel}>{line.column.label}</span>
                      <b>{line.valueAt(hoverFrame)}</b>
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        ref={trackRef}
        className={`${styles.scrubber}${chartLines.length > 0 ? ` ${styles.withChart}` : ''}${
          scrubbing ? ` ${styles.scrubbing}` : ''
        }`}
        role="slider"
        tabIndex={0}
        aria-label="Time series frame"
        aria-valuemin={0}
        aria-valuemax={lastFrame}
        aria-valuenow={frame}
        aria-valuetext={dateText}
        style={{ '--progress': progress, '--thumb-transition': thumbTransition } as CSSProperties}
        onPointerDown={onScrubStart}
        onPointerMove={onScrubMove}
        onPointerUp={onScrubEnd}
        onPointerCancel={onScrubEnd}
        onKeyDown={onScrubKey}
      >
        <span className={styles.track} aria-hidden>
          <span className={styles.trackFill} />
        </span>
        <span className={styles.thumb} aria-hidden>
          <CaretLeft size={12} weight="bold" />
          <CaretRight size={12} weight="bold" />
        </span>
      </div>
      {hoverFrame !== null && hoverFrame <= lastFrame ? (
        <span
          className={styles.chartHoverLine}
          style={{ left: `${(lastFrame > 0 ? hoverFrame / lastFrame : 0) * 100}%` }}
          aria-hidden
        />
      ) : null}
      {chartLines.length > 0 ? <span className={styles.chartCursor} aria-hidden /> : null}
      </div>

      <div className={styles.dateRow}>
        <span className={styles.date}>
          {dateLabel}, <strong>{timeLabel}</strong>
        </span>
        <button
          ref={datesBtnRef}
          type="button"
          className={`${styles.funnelBtn}${menu === 'dates' ? ` ${styles.controlOpen}` : ''}`}
          aria-label="Date range"
          aria-haspopup="dialog"
          aria-expanded={menu === 'dates'}
          onClick={() => toggleMenu('dates')}
        >
          <CalendarBlank size={16} weight="regular" aria-hidden />
        </button>
      </div>

      {menu
        ? createPortal(
            <div
              ref={menuRef}
              role={menu === 'granularity' ? 'listbox' : 'dialog'}
              aria-label={
                menu === 'speed'
                  ? 'Playback speed'
                  : menu === 'dates'
                    ? 'Date range'
                    : menu === 'charts'
                      ? 'Line charts'
                      : 'Time step granularity'
              }
              className={`${styles.menu} ${
                menu === 'speed'
                  ? styles.speedMenu
                  : menu === 'dates'
                    ? styles.datesMenu
                    : menu === 'charts'
                      ? styles.chartsMenu
                      : styles.granularityMenu
              }`}
              style={{ bottom: menuPos.bottom, left: menuPos.left, right: menuPos.right, width: menuPos.width }}
            >
              {menu === 'charts' ? (
                <>
                  <p className={styles.menuTitle}>Line charts</p>
                  {chartDraft.length === 0 ? (
                    <p className={styles.chartsEmpty}>
                      {editable
                        ? 'Add a line chart to plot a map layer column along the timeline.'
                        : 'No line charts have been added to this slide.'}
                    </p>
                  ) : (
                    <div className={styles.chartList}>
                      {chartDraft.map((series, index) => {
                        const name = `Line ${index + 1}`
                        const otherLines = chartDraft.filter((item) => item.id !== series.id)
                        return (
                          <div key={series.id} className={styles.chartItem}>
                            <div className={styles.chartItemHead}>
                              <span className={styles.chartSwatch} style={{ background: series.color }} aria-hidden />
                              <span className={styles.chartItemTitle}>{name}</span>
                              <button
                                type="button"
                                className={styles.chartIconBtn}
                                aria-label={series.visible ? `Hide ${name}` : `Show ${name}`}
                                aria-pressed={series.visible}
                                onClick={() => toggleChartVisibility(series.id)}
                              >
                                {series.visible ? (
                                  <Eye size={16} weight="regular" aria-hidden />
                                ) : (
                                  <EyeSlash size={16} weight="regular" aria-hidden />
                                )}
                              </button>
                              {editable ? (
                                <button
                                  type="button"
                                  className={styles.chartIconBtn}
                                  aria-label={`Remove ${name}`}
                                  onClick={() =>
                                    setChartDraft((current) => current.filter((item) => item.id !== series.id))
                                  }
                                >
                                  <Trash size={16} weight="regular" aria-hidden />
                                </button>
                              ) : null}
                            </div>
                            {editable ? (
                              <>
                                <ConfigSelect
                                  label="Map layer"
                                  value={series.layerId}
                                  options={TIMELINE_CHART_LAYERS.filter(
                                    (layer) =>
                                      layer.id === series.layerId || freeChartColumns(layer.id, otherLines).length > 0,
                                  ).map((layer) => ({ value: layer.id, label: layer.label }))}
                                  onChange={(layerId) =>
                                    patchDraft(series.id, {
                                      layerId,
                                      columnId: (
                                        freeChartColumns(layerId, otherLines)[0] ?? chartLayer(layerId).columns[0]
                                      ).id,
                                    })
                                  }
                                />
                                <ConfigSelect
                                  label="Column"
                                  value={series.columnId}
                                  options={freeChartColumns(series.layerId, otherLines).map((column) => ({
                                    value: column.id,
                                    label: column.label,
                                  }))}
                                  onChange={(columnId) => patchDraft(series.id, { columnId })}
                                />
                              </>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {editable && hasFreeChartColumn(chartDraft) ? (
                    <button
                      type="button"
                      className={styles.chartAddBtn}
                      onClick={() => setChartDraft((current) => [...current, newChartSeries(current)])}
                    >
                      <Plus size={14} weight="bold" aria-hidden />
                      Add line chart
                    </button>
                  ) : null}
                  {editable ? (
                    <div className={styles.chartsFooter}>
                      <button type="button" className={styles.chartsCancel} onClick={() => setMenu(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={styles.chartsSave}
                        onClick={() => {
                          onChartsChange?.(chartDraft)
                          setMenu(null)
                        }}
                      >
                        Save
                      </button>
                    </div>
                  ) : null}
                </>
              ) : menu === 'granularity' ? (
                TIMELINE_GRANULARITIES.map((option) => {
                  const selected = option.id === granularity.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`${styles.granularityItem}${selected ? ` ${styles.granularityItemActive}` : ''}`}
                      onClick={() => {
                        if (!selected) onGranularityChange(option.id)
                        setMenu(null)
                      }}
                    >
                      <span className={styles.granularityCheck} aria-hidden>
                        {selected ? <Check size={14} weight="bold" /> : null}
                      </span>
                      {option.label}
                    </button>
                  )
                })
              ) : menu === 'speed' ? (
                <>
                  <p className={styles.menuTitle}>Playback speed</p>
                  <div className={styles.speedChips}>
                    {PLAYBACK_SPEEDS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`${styles.speedChip}${option === speed ? ` ${styles.speedChipActive}` : ''}`}
                        aria-pressed={option === speed}
                        onClick={() => onSpeedChange(option)}
                      >
                        {Number.isInteger(option) ? option.toFixed(1) : option}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className={styles.menuTitle}>Date range</p>
                  <div className={styles.setupList}>
                    {TIMELINE_RANGES.map((option) => {
                      const selected = option.id === range.id
                      const stepFor = selected ? granularity : granularityForRange(option, granularity.id)
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={`${styles.setupItem}${selected ? ` ${styles.setupItemActive}` : ''}`}
                          aria-pressed={selected}
                          onClick={() => {
                            onRangeChange(option.id)
                            setMenu(null)
                          }}
                        >
                          <span className={styles.setupText}>
                            <span className={styles.setupLabel}>{option.label}</span>
                            <span className={styles.setupDetail}>{describeTimelineRange(option, stepFor)}</span>
                          </span>
                          {selected ? <Check size={16} weight="bold" aria-hidden /> : null}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
