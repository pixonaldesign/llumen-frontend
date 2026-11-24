export type StoryTimerSize = '1x1' | '2x1' | '2x2'

/** A countdown's timing: it starts when confirmed and runs on the wall clock from then on. */
export type TimerClock = {
  kind: 'timer'
  durationS: number
  /** Null until the first Confirm: a timer still being set up has never run. */
  startedAt: number | null
}

/** A stopwatch's timing: time banked from earlier runs, plus the current run if it's going. */
export type StopwatchClock = {
  kind: 'stopwatch'
  elapsedMs: number
  /** When the current run started; null while paused. */
  runningSince: number | null
  /** Total elapsed time at each lap, oldest first. */
  laps: number[]
}

export type StoryClock = TimerClock | StopwatchClock

/** A countdown placed from the Tools menu. */
export type StoryTimer = TimerClock & {
  id: string
  title: string
  size: StoryTimerSize
  configuring: boolean
}

/** A stopwatch placed from the Tools menu; it waits at zero until started. */
export type StoryStopwatch = StopwatchClock & {
  id: string
  title: string
  size: StoryTimerSize
}

export type StoryClockAsset = StoryTimer | StoryStopwatch

/** Columns and rows of 184px cells each size takes. */
export const TIMER_CELLS: Record<StoryTimerSize, { columns: 1 | 2; rows: 1 | 2 }> = {
  '1x1': { columns: 1, rows: 1 },
  '2x1': { columns: 2, rows: 1 },
  '2x2': { columns: 2, rows: 2 },
}

export const timerFootprint = (size: StoryTimerSize) => TIMER_CELLS[size].columns * TIMER_CELLS[size].rows

export const newStoryTimer = (id: string): StoryTimer => ({
  id,
  kind: 'timer',
  title: 'Timer',
  durationS: 5 * 60,
  size: '1x1',
  configuring: true,
  startedAt: null,
})

export const newStoryStopwatch = (id: string): StoryStopwatch => ({
  id,
  kind: 'stopwatch',
  title: 'Stopwatch',
  size: '1x1',
  elapsedMs: 0,
  runningSince: null,
  laps: [],
})

export const stopwatchElapsed = (clock: StopwatchClock, now: number) =>
  clock.elapsedMs + (clock.runningSince === null ? 0 : now - clock.runningSince)

export const startStopwatch = (clock: StopwatchClock): StopwatchClock =>
  clock.runningSince === null ? { ...clock, runningSince: Date.now() } : clock

export const pauseStopwatch = (clock: StopwatchClock): StopwatchClock =>
  clock.runningSince === null ? clock : { ...clock, elapsedMs: stopwatchElapsed(clock, Date.now()), runningSince: null }

export const lapStopwatch = (clock: StopwatchClock): StopwatchClock =>
  clock.runningSince === null ? clock : { ...clock, laps: [...clock.laps, stopwatchElapsed(clock, Date.now())] }

export const resetStopwatch = (clock: StopwatchClock): StopwatchClock => ({
  ...clock,
  elapsedMs: 0,
  runningSince: null,
  laps: [],
})

/**
 * What a mirrored pin's clock change does to its slide clock: timing carries over, and "Set duration" on a timer
 * pin opens the slide timer's own configure form.
 */
export function clockPatch(clock: StoryClock & { configuring?: boolean }): Partial<StoryClockAsset> {
  if (clock.kind === 'stopwatch')
    return { elapsedMs: clock.elapsedMs, runningSince: clock.runningSince, laps: clock.laps }
  return clock.configuring ? { configuring: true } : { durationS: clock.durationS, startedAt: clock.startedAt }
}

/** Just the timing, for a map pin copied from a slide clock: it keeps running in step with the original. */
export function clockTiming(clock: StoryClock): (TimerClock & { configuring: false }) | StopwatchClock {
  return clock.kind === 'timer'
    ? { kind: 'timer', durationS: clock.durationS, startedAt: clock.startedAt, configuring: false }
    : { kind: 'stopwatch', elapsedMs: clock.elapsedMs, runningSince: clock.runningSince, laps: [...clock.laps] }
}
