export type StoryTimerSize = '1x1' | '2x1' | '2x2'

/** A countdown placed from the Tools menu. It starts when confirmed and runs on the wall clock from then on. */
export type StoryTimer = {
  id: string
  title: string
  durationS: number
  size: StoryTimerSize
  configuring: boolean
  /** Null until the first Confirm: a timer still being set up has never run. */
  startedAt: number | null
}

/** Columns and rows of 184px cells each size takes. */
export const TIMER_CELLS: Record<StoryTimerSize, { columns: 1 | 2; rows: 1 | 2 }> = {
  '1x1': { columns: 1, rows: 1 },
  '2x1': { columns: 2, rows: 1 },
  '2x2': { columns: 2, rows: 2 },
}

export const timerFootprint = (size: StoryTimerSize) => TIMER_CELLS[size].columns * TIMER_CELLS[size].rows

export const newStoryTimer = (id: string): StoryTimer => ({
  id,
  title: 'Timer',
  durationS: 5 * 60,
  size: '1x1',
  configuring: true,
  startedAt: null,
})
