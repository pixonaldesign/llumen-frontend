import type { CSSProperties } from 'react'
import { clockTitle, type AnnotationClock, type MapAnnotationItem } from './storyMapAnnotations'
import type { StopwatchClock, TimerClock } from './storyTimer'
import { segments, segmentsText, stopwatchSegments } from './storyClockFormat'
import { StopwatchControls } from './StoryStopwatchCard'
import { ConfigureForm, Readout, TickGauge } from './StoryTimerCard'
import { useElapsed, useRemaining } from './useStoryClock'
import timerStyles from './StoryTimerCard.module.css'
import styles from './StoryClockPin.module.css'

const MINUTE_MS = 60_000

export type ClockPinChange = { clock: AnnotationClock; text?: string }

type PinProps = {
  item: MapAnnotationItem
  /** Edit mode: a timer that hasn't been set up shows its configure form. */
  editable: boolean
  onChange: (change: ClockPinChange) => void
  /** Cancel on a timer that never ran: the pin goes. */
  onDiscard: () => void
}

function TimerPin({ item, clock, editable, onChange, onDiscard }: PinProps & { clock: AnnotationClock & TimerClock }) {
  const { seconds, fraction, done } = useRemaining(clock)
  const title = clockTitle(item)
  if (clock.configuring && editable) {
    return (
      <ConfigureForm
        timer={{ title, durationS: clock.durationS }}
        compact={false}
        className={`${timerStyles.configure} ${styles.configure}`}
        onConfirm={({ title: text, durationS }) =>
          onChange({ clock: { ...clock, durationS, startedAt: Date.now(), configuring: false }, text })
        }
        onCancel={() =>
          clock.startedAt === null ? onDiscard() : onChange({ clock: { ...clock, configuring: false } })
        }
      />
    )
  }
  const parts = segments(seconds, clock.durationS >= 3600)
  return (
    <div className={styles.pin} data-done={done || undefined}>
      <p className={styles.title}>{done ? `${title} · Time’s up` : title}</p>
      <div className={styles.dial} style={{ '--chars': segmentsText(parts).length } as CSSProperties}>
        <TickGauge fraction={fraction} large={false} />
        <Readout parts={parts} compact className={styles.value} />
      </div>
    </div>
  )
}

function StopwatchPin({ item, clock, onChange }: PinProps & { clock: StopwatchClock }) {
  const elapsed = useElapsed(clock)
  const parts = stopwatchSegments(elapsed)
  const lap = clock.laps.length > 0 ? ` · Lap ${clock.laps.length + 1}` : ''
  return (
    <div className={styles.pin}>
      <p className={styles.title}>
        {clockTitle(item)}
        {lap}
      </p>
      <div className={styles.dial} style={{ '--chars': segmentsText(parts).length } as CSSProperties}>
        <TickGauge fraction={(elapsed % MINUTE_MS) / MINUTE_MS} large={false} fill="fill" />
        <Readout parts={parts} compact className={styles.value} />
      </div>
      <StopwatchControls
        clock={clock}
        className={timerStyles.controls}
        onChange={(next) => onChange({ clock: next })}
      />
    </div>
  )
}

/** The live card above a timer or stopwatch pin on the map. */
export function StoryClockPin(props: PinProps) {
  const { clock } = props.item
  if (!clock) return null
  return clock.kind === 'timer' ? <TimerPin {...props} clock={clock} /> : <StopwatchPin {...props} clock={clock} />
}
