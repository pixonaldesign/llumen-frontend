/** Readout text for the timer and stopwatch: colon-separated parts, each with the unit it's labelled with. */

const HOUR_MS = 3_600_000

export const pad = (value: number) => String(value).padStart(2, '0')

export type Unit = 'H' | 'M' | 'S'
export type Segment = { value: string; unit: Unit }

/** Shared by the readout and the configure fields; 1×1 uses the short form. */
export const UNIT_LABELS: Record<Unit, { full: string; short: string }> = {
  H: { full: 'Hours', short: 'Hrs' },
  M: { full: 'Minutes', short: 'Min' },
  S: { full: 'Seconds', short: 'Sec' },
}

export const unitLabel = (unit: Unit, compact: boolean) => UNIT_LABELS[unit][compact ? 'short' : 'full']

/** Hours, minutes, seconds, each with its letter; hours show whenever the full duration has them, so the width never jumps. */
export function segments(seconds: number, withHours: boolean): Segment[] {
  const m: Segment = {
    value: pad(Math.floor((seconds % 3600) / 60)),
    unit: 'M',
  }
  const s: Segment = { value: pad(seconds % 60), unit: 'S' }
  return withHours ? [{ value: pad(Math.floor(seconds / 3600)), unit: 'H' }, m, s] : [m, s]
}

/** Minutes and seconds with hundredths, as "00:07.42"; hours join once an hour has passed. */
export function stopwatchSegments(ms: number): Segment[] {
  const hundredths = Math.floor(ms / 10) % 100
  const seconds = Math.floor(ms / 1000)
  const m: Segment = { value: pad(Math.floor((seconds % 3600) / 60)), unit: 'M' }
  const s: Segment = { value: `${pad(seconds % 60)}.${pad(hundredths)}`, unit: 'S' }
  return ms >= HOUR_MS ? [{ value: pad(Math.floor(seconds / 3600)), unit: 'H' }, m, s] : [m, s]
}

export const segmentsText = (parts: Segment[]) => parts.map((segment) => segment.value).join(':')

export const clockText = (seconds: number, withHours: boolean) => segmentsText(segments(seconds, withHours))

export const stopwatchText = (ms: number) => segmentsText(stopwatchSegments(ms))

export const spokenText = (parts: Segment[]) =>
  parts
    .map((segment) => {
      const value = Number(segment.value)
      const unit = UNIT_LABELS[segment.unit].full.toLowerCase()
      return `${value} ${value === 1 ? unit.slice(0, -1) : unit}`
    })
    .join(' ')
