/**
 * Demo timeline model for the per-slide time series: a date range (funnel menu)
 * split into frames by a granularity selected from a menu, ending at the story's
 * reference timestamp.
 */
type DateUnit = 'minute' | 'hour' | 'day' | 'month' | 'year'

export type TimelineGranularity = {
  id: string
  label: string
  unit: DateUnit
  step: number
}

export type TimelineRange = {
  id: string
  label: string
  unit: DateUnit
  amount: number
}

export type SlideTimeline = {
  rangeId: string
  granularityId: string
  frame: number
}

/** Ordered fine → coarse for the time-step menu. */
export const TIMELINE_GRANULARITIES: TimelineGranularity[] = [
  { id: 'minute', label: 'Minute', unit: 'minute', step: 1 },
  { id: 'minutes-10', label: '10 min', unit: 'minute', step: 10 },
  { id: 'hour', label: 'Hour', unit: 'hour', step: 1 },
  { id: 'day', label: 'Day', unit: 'day', step: 1 },
  { id: 'month', label: 'Month', unit: 'month', step: 1 },
  { id: 'quarter', label: 'Quarter', unit: 'month', step: 3 },
  { id: 'year', label: 'Year', unit: 'year', step: 1 },
]

export const TIMELINE_RANGES: TimelineRange[] = [
  { id: 'hours-1', label: 'Last hour', unit: 'minute', amount: 60 },
  { id: 'hours-24', label: 'Last 24 hours', unit: 'hour', amount: 24 },
  { id: 'days-7', label: 'Last 7 days', unit: 'day', amount: 7 },
  { id: 'days-30', label: 'Last 30 days', unit: 'day', amount: 30 },
  { id: 'months-12', label: 'Last 12 months', unit: 'month', amount: 12 },
  { id: 'years-2', label: 'Last 2 years', unit: 'month', amount: 24 },
  { id: 'years-5', label: 'Last 5 years', unit: 'month', amount: 60 },
]

export const DEFAULT_SLIDE_TIMELINE: SlideTimeline = {
  rangeId: 'hours-24',
  granularityId: 'minutes-10',
  frame: 0,
}

export const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2]

const MIN_FRAMES = 4
const MAX_FRAMES = 400
/** Frame duration at 1× speed stays within these bounds; long runs step faster. */
const MAX_STEP_MS = 1600
const MIN_STEP_MS = 250
const TARGET_LOOP_MS = 20000

const TIMELINE_END = new Date(2023, 11, 23, 12, 59)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const UNIT_MINUTES: Record<DateUnit, number> = {
  minute: 1,
  hour: 60,
  day: 1440,
  month: 43800,
  year: 525600,
}

export function timelineRangeById(id: string) {
  return TIMELINE_RANGES.find((range) => range.id === id) ?? TIMELINE_RANGES[5]
}

export function timelineGranularityById(id: string) {
  return TIMELINE_GRANULARITIES.find((granularity) => granularity.id === id) ?? TIMELINE_GRANULARITIES[5]
}

export function timelineFrameCount(range: TimelineRange, granularity: TimelineGranularity) {
  return Math.round(
    (range.amount * UNIT_MINUTES[range.unit]) / (granularity.step * UNIT_MINUTES[granularity.unit]),
  )
}

export function fitsTimeline(range: TimelineRange, granularity: TimelineGranularity) {
  const count = timelineFrameCount(range, granularity)
  return count >= MIN_FRAMES && count <= MAX_FRAMES
}

function nearestFit<T>(items: T[], from: number, fits: (item: T) => boolean) {
  for (let distance = 0; distance < items.length; distance += 1) {
    const before = items[from - distance]
    if (before && fits(before)) return before
    const after = items[from + distance]
    if (after && fits(after)) return after
  }
  return items[from]
}

function reframe(frame: number, fromCount: number, toCount: number) {
  if (fromCount <= 1) return 0
  return Math.round((frame / (fromCount - 1)) * (toCount - 1))
}

/** Switches granularity, moving to the nearest range it fits and keeping the playhead's place in time. */
export function withGranularity(timeline: SlideTimeline, granularityId: string): SlideTimeline {
  const granularity = timelineGranularityById(granularityId)
  const currentRange = timelineRangeById(timeline.rangeId)
  const range = nearestFit(TIMELINE_RANGES, TIMELINE_RANGES.indexOf(currentRange), (item) =>
    fitsTimeline(item, granularity),
  )
  const fromCount = timelineFrameCount(currentRange, timelineGranularityById(timeline.granularityId))
  return {
    rangeId: range.id,
    granularityId: granularity.id,
    frame: range.id === currentRange.id ? reframe(timeline.frame, fromCount, timelineFrameCount(range, granularity)) : 0,
  }
}

/** Granularity a range plays with: the current one when it fits, otherwise the nearest that does. */
export function granularityForRange(range: TimelineRange, granularityId: string) {
  const current = timelineGranularityById(granularityId)
  return nearestFit(TIMELINE_GRANULARITIES, TIMELINE_GRANULARITIES.indexOf(current), (item) =>
    fitsTimeline(range, item),
  )
}

export function withRange(timeline: SlideTimeline, rangeId: string): SlideTimeline {
  const range = timelineRangeById(rangeId)
  return { rangeId: range.id, granularityId: granularityForRange(range, timeline.granularityId).id, frame: 0 }
}

export function timelineStepMs(frameCount: number, speed: number) {
  const base = Math.max(MIN_STEP_MS, Math.min(MAX_STEP_MS, TARGET_LOOP_MS / frameCount))
  return Math.round(base / speed)
}

function shiftDate(date: Date, unit: DateUnit, steps: number) {
  const next = new Date(date)
  switch (unit) {
    case 'minute':
      next.setMinutes(next.getMinutes() + steps)
      break
    case 'hour':
      next.setHours(next.getHours() + steps)
      break
    case 'day':
      next.setDate(next.getDate() + steps)
      break
    case 'month':
      next.setMonth(next.getMonth() + steps)
      break
    case 'year':
      next.setFullYear(next.getFullYear() + steps)
      break
  }
  return next
}

export function timelineFrameDate(granularity: TimelineGranularity, frameCount: number, frame: number) {
  return shiftDate(TIMELINE_END, granularity.unit, (frame - (frameCount - 1)) * granularity.step)
}

function formatTime(date: Date) {
  const hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`
}

/** "23 Dec 2023, 12:59 PM" */
export function formatFrameDate(date: Date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${formatTime(date)}`
}

function formatDay(date: Date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** "23 Mar 2022 – 23 Dec 2023 · Every quarter" */
export function describeTimelineRange(range: TimelineRange, granularity: TimelineGranularity) {
  const count = timelineFrameCount(range, granularity)
  const first = timelineFrameDate(granularity, count, 0)
  const withTime = range.unit === 'minute' || range.unit === 'hour'
  const from = withTime ? formatTime(first) : formatDay(first)
  const to = withTime ? formatTime(TIMELINE_END) : formatDay(TIMELINE_END)
  return `${from} – ${to} · Every ${granularity.label.toLowerCase()}`
}

export function formatPlaybackSpeed(speed: number) {
  const rounded = Math.round(speed * 100) / 100
  return `${Number.isInteger(rounded) ? rounded.toFixed(1) : rounded}x`
}
