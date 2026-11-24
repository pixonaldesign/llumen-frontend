import { useRef, type CSSProperties, type ReactNode } from 'react'
import { ArrowCounterClockwise, Flag, Pause, Play } from '@phosphor-icons/react'
import { segmentsText, stopwatchSegments, stopwatchText } from './storyClockFormat'
import {
  lapStopwatch,
  pauseStopwatch,
  resetStopwatch,
  startStopwatch,
  type StopwatchClock,
  type StoryStopwatch,
} from './storyTimer'
import { Readout, ResizeHandle, TickGauge } from './StoryTimerCard'
import { useElapsed } from './useStoryClock'
import styles from './StoryTimerCard.module.css'

const MINUTE_MS = 60_000

/** Start / pause, and lap while running or reset while paused, as on the iPhone. */
export function StopwatchControls({
  clock,
  className,
  onChange,
}: {
  clock: StopwatchClock
  className: string
  onChange: (clock: StopwatchClock) => void
}) {
  const running = clock.runningSince !== null
  const idle = !running && clock.elapsedMs === 0
  return (
    <div className={className}>
      <button
        type="button"
        className={styles.control}
        aria-label={running ? 'Lap' : 'Reset'}
        title={running ? 'Lap' : 'Reset'}
        disabled={idle}
        onClick={() => onChange(running ? lapStopwatch(clock) : resetStopwatch(clock))}
      >
        {running ? (
          <Flag size={14} weight="fill" aria-hidden />
        ) : (
          <ArrowCounterClockwise size={14} weight="bold" aria-hidden />
        )}
      </button>
      <button
        type="button"
        className={`${styles.control} ${styles.controlPrimary}`}
        data-running={running || undefined}
        aria-label={running ? 'Pause' : idle ? 'Start' : 'Resume'}
        title={running ? 'Pause' : idle ? 'Start' : 'Resume'}
        onClick={() => onChange(running ? pauseStopwatch(clock) : startStopwatch(clock))}
      >
        {running ? <Pause size={14} weight="fill" aria-hidden /> : <Play size={14} weight="fill" aria-hidden />}
      </button>
    </div>
  )
}

/** Newest first, with the lap in progress on top. */
function LapList({ laps, elapsed }: { laps: number[]; elapsed: number }) {
  const rows = [
    { lap: laps.length + 1, split: elapsed - (laps[laps.length - 1] ?? 0) },
    ...laps.map((total, index) => ({ lap: index + 1, split: total - (laps[index - 1] ?? 0) })).reverse(),
  ]
  return (
    <ol className={styles.laps} aria-label="Laps">
      {rows.map((row) => (
        <li key={row.lap} className={styles.lap}>
          <span>Lap {row.lap}</span>
          <span className={styles.lapTime}>{stopwatchText(row.split)}</span>
        </li>
      ))}
    </ol>
  )
}

export function StoryStopwatchCard({
  stopwatch,
  editing,
  className,
  toolbar,
  onChange,
}: {
  stopwatch: StoryStopwatch
  /** Edit mode: the resize corner shows. */
  editing: boolean
  /** The card shell and its size, from the story's card styles. */
  className: string
  toolbar: ReactNode
  onChange: (patch: Partial<StoryStopwatch>) => void
}) {
  const cardRef = useRef<HTMLElement>(null)
  const elapsed = useElapsed(stopwatch)
  const parts = stopwatchSegments(elapsed)
  const showLaps = stopwatch.size !== '1x1' && stopwatch.laps.length > 0
  return (
    <section
      ref={cardRef}
      className={`${className} ${styles.timer}`}
      data-size={stopwatch.size}
      data-laps={showLaps || undefined}
      style={{ '--chars': segmentsText(parts).length } as CSSProperties}
      aria-label={stopwatch.title}
    >
      <div className={styles.head}>
        <p className={styles.title}>{stopwatch.title}</p>
      </div>
      <div className={styles.stopwatchBody}>
        <div className={styles.dial}>
          <TickGauge fraction={(elapsed % MINUTE_MS) / MINUTE_MS} large={stopwatch.size === '2x2'} fill="fill" />
          <div className={styles.dialCentre}>
            <Readout parts={parts} compact={stopwatch.size === '1x1'} className={styles.dialValue} />
            {stopwatch.size === '1x1' && stopwatch.laps.length > 0 ? (
              <p className={styles.dialStatus}>Lap {stopwatch.laps.length + 1}</p>
            ) : null}
          </div>
        </div>
        {showLaps ? <LapList laps={stopwatch.laps} elapsed={elapsed} /> : null}
      </div>
      <StopwatchControls clock={stopwatch} className={styles.controls} onChange={onChange} />
      {toolbar}
      {editing ? (
        <ResizeHandle
          label="stopwatch"
          size={stopwatch.size}
          cardRef={cardRef}
          onResize={(size) => onChange({ size })}
        />
      ) : null}
    </section>
  )
}
