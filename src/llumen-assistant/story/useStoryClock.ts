import { useEffect, useState } from 'react'
import { stopwatchElapsed, type StopwatchClock, type TimerClock } from './storyTimer'

const TICK_MS = 200

/** A timer's whole seconds left, the share of its duration left, and whether it has run out. */
export function useRemaining(timer: TimerClock & { configuring?: boolean }) {
  const running = !timer.configuring && timer.startedAt !== null
  const [now, setNow] = useState(() => Date.now())
  const endsAt = timer.startedAt === null ? null : timer.startedAt + timer.durationS * 1000
  const done = running && endsAt !== null && now >= endsAt
  useEffect(() => {
    if (!running || done) return
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(id)
  }, [running, done])
  const remainingMs = !running || endsAt === null ? timer.durationS * 1000 : Math.max(0, endsAt - now)
  return {
    seconds: Math.ceil(remainingMs / 1000),
    fraction: timer.durationS > 0 ? remainingMs / (timer.durationS * 1000) : 0,
    done,
  }
}

/** A stopwatch's elapsed milliseconds, redrawn every frame while it runs. */
export function useElapsed(clock: StopwatchClock) {
  const [now, setNow] = useState(() => Date.now())
  const running = clock.runningSince !== null
  useEffect(() => {
    if (!running) return
    let frame = requestAnimationFrame(function step() {
      setNow(Date.now())
      frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [running])
  return clock.runningSince === null ? clock.elapsedMs : stopwatchElapsed(clock, Math.max(now, clock.runningSince))
}
