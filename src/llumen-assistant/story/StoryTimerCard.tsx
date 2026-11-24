import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { TIMER_CELLS, type StoryTimer, type StoryTimerSize } from './storyTimer'
import styles from './StoryTimerCard.module.css'

const SIZE_ORDER: StoryTimerSize[] = ['1x1', '2x1', '2x2']
const TICK_MS = 200
const CELL_GAP = 12
const MAX_DURATION_S = 99 * 3600 + 59 * 60 + 59

const pad = (value: number) => String(value).padStart(2, '0')

type Segment = { value: string; unit: 'H' | 'M' | 'S' }

/** Hours, minutes, seconds, each with its letter; hours show whenever the full duration has them, so the width never jumps. */
function segments(seconds: number, withHours: boolean): Segment[] {
  const m: Segment = { value: pad(Math.floor((seconds % 3600) / 60)), unit: 'M' }
  const s: Segment = { value: pad(seconds % 60), unit: 'S' }
  return withHours ? [{ value: String(Math.floor(seconds / 3600)), unit: 'H' }, m, s] : [m, s]
}

const clockText = (seconds: number, withHours: boolean) =>
  segments(seconds, withHours)
    .map((segment) => `${segment.value}${segment.unit}`)
    .join(' ')

function Readout({ seconds, withHours, className }: { seconds: number; withHours: boolean; className: string }) {
  return (
    <p className={className} role="timer" aria-live="off" aria-label={clockText(seconds, withHours)}>
      {segments(seconds, withHours).map((segment) => (
        <span key={segment.unit} className={styles.segment}>
          {segment.value}
          <span className={styles.unit}>{segment.unit}</span>
        </span>
      ))}
    </p>
  )
}

function useRemaining(timer: StoryTimer) {
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

type Tick = { x: number; y: number; nx: number; ny: number }

/**
 * Ticks round a rounded rectangle, clockwise from the top middle. Each eighth of the outline (side middle to
 * corner) gets the same number of ticks, so majors land on the side middles and corners at any aspect ratio.
 */
function rectTicks(halfWidth: number, halfHeight: number, radius: number, perEighth: number): Tick[] {
  const a = halfWidth - radius
  const b = halfHeight - radius
  const corner = (cx: number, cy: number, from: number) => (t: number): Tick => {
    const angle = from + (t * Math.PI) / 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return { x: cx + radius * cos, y: cy + radius * sin, nx: -cos, ny: -sin }
  }
  const line = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => (t: number): Tick => ({
    x: x0 + (x1 - x0) * t,
    y: y0 + (y1 - y0) * t,
    nx,
    ny,
  })
  const arc = (Math.PI * radius) / 4
  /* Each eighth: a straight run then half a corner, or half a corner then a straight run. */
  const eighths: { run: number; straight: (t: number) => Tick; bend: (t: number) => Tick; runFirst: boolean }[] = [
    { run: a, straight: line(0, -halfHeight, a, -halfHeight, 0, 1), bend: corner(a, -b, -Math.PI / 2), runFirst: true },
    { run: b, straight: line(halfWidth, -b, halfWidth, 0, -1, 0), bend: corner(a, -b, -Math.PI / 2), runFirst: false },
    { run: b, straight: line(halfWidth, 0, halfWidth, b, -1, 0), bend: corner(a, b, 0), runFirst: true },
    { run: a, straight: line(a, halfHeight, 0, halfHeight, 0, -1), bend: corner(a, b, 0), runFirst: false },
    { run: a, straight: line(0, halfHeight, -a, halfHeight, 0, -1), bend: corner(-a, b, Math.PI / 2), runFirst: true },
    { run: b, straight: line(-halfWidth, b, -halfWidth, 0, 1, 0), bend: corner(-a, b, Math.PI / 2), runFirst: false },
    { run: b, straight: line(-halfWidth, 0, -halfWidth, -b, 1, 0), bend: corner(-a, -b, Math.PI), runFirst: true },
    { run: a, straight: line(-a, -halfHeight, 0, -halfHeight, 0, 1), bend: corner(-a, -b, Math.PI), runFirst: false },
  ]
  return eighths.flatMap(({ run, straight, bend, runFirst }) =>
    Array.from({ length: perEighth }, (_, index) => {
      const d = (index / perEighth) * (run + arc)
      if (runFirst) return d <= run ? straight(run ? d / run : 0) : bend((d - run) / arc / 2)
      return d < arc ? bend(0.5 + d / arc / 2) : straight((d - arc) / run)
    }),
  )
}

/** Ticks round the card's dial area; the lit run empties clockwise from the top as time runs out. */
function TickGauge({ fraction, large }: { fraction: number; large: boolean }) {
  const ref = useRef<SVGSVGElement>(null)
  const [box, setBox] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => {
    const svg = ref.current
    if (!svg) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBox((previous) => (previous?.width === width && previous.height === height ? previous : { width, height }))
    })
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])
  const perEighth = large ? 12 : 8
  const minor = large ? 8 : 5
  const major = large ? 14 : 9
  const inset = large ? 1.5 : 1
  const ticks = box ? rectTicks(box.width / 2 - inset, box.height / 2 - inset, large ? 18 : 12, perEighth) : []
  const spent = (1 - fraction) * ticks.length
  return (
    <svg
      ref={ref}
      className={styles.gauge}
      viewBox={box ? `${-box.width / 2} ${-box.height / 2} ${box.width} ${box.height}` : undefined}
      aria-hidden
    >
      {ticks.map((tick, index) => {
        const lit = Math.min(1, Math.max(0, index + 1 - spent))
        const length = index % perEighth === 0 ? major : minor
        return (
          <line
            key={index}
            className={styles.tick}
            x1={tick.x}
            y1={tick.y}
            x2={tick.x + tick.nx * length}
            y2={tick.y + tick.ny * length}
            style={{ '--lit': lit } as CSSProperties}
          />
        )
      })}
    </svg>
  )
}

/** Hours, minutes and seconds as three two-digit fields; arrow keys step them. */
function DurationFields({ value, onChange }: { value: number; onChange: (seconds: number) => void }) {
  const parts = [Math.floor(value / 3600), Math.floor((value % 3600) / 60), value % 60]
  const limits = [99, 59, 59]
  const labels = ['Hours', 'Minutes', 'Seconds']
  const set = (index: number, next: number) => {
    const clamped = Math.min(limits[index], Math.max(0, Math.round(next) || 0))
    const updated = parts.map((part, at) => (at === index ? clamped : part))
    onChange(Math.min(MAX_DURATION_S, updated[0] * 3600 + updated[1] * 60 + updated[2]))
  }
  return (
    <div className={styles.fields}>
      {parts.map((part, index) => (
        <label key={labels[index]} className={styles.field}>
          <input
            className={styles.fieldInput}
            size={2}
            inputMode="numeric"
            aria-label={labels[index]}
            value={pad(part)}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => set(index, Number(event.target.value.replace(/\D/g, '').slice(-2)))}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
              event.preventDefault()
              set(index, part + (event.key === 'ArrowUp' ? 1 : -1))
            }}
          />
          <span className={styles.unit}>{labels[index][0]}</span>
        </label>
      ))}
    </div>
  )
}

function ConfigureForm({
  timer,
  onConfirm,
  onCancel,
}: {
  timer: StoryTimer
  onConfirm: (patch: Pick<StoryTimer, 'title' | 'durationS'>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(timer.title)
  const [durationS, setDurationS] = useState(timer.durationS)
  const confirm = () => {
    if (durationS > 0) onConfirm({ title: title.trim() || 'Timer', durationS })
  }
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCancel()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      confirm()
    }
  }
  return (
    <div className={styles.configure} onKeyDown={onKeyDown}>
      <input
        className={styles.titleInput}
        value={title}
        placeholder="Timer title"
        aria-label="Timer title"
        maxLength={60}
        onChange={(event) => setTitle(event.target.value)}
        autoFocus
      />
      <div className={styles.configureBody}>
        <DurationFields value={durationS} onChange={setDurationS} />
      </div>
      <div className={styles.configureActions}>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.primary} disabled={durationS === 0} onClick={confirm}>
          Confirm
        </button>
      </div>
    </div>
  )
}

/** The macOS widget corner: drag it to snap the timer between 1×1, 2×1 and 2×2; Enter steps through them. */
function ResizeHandle({
  size,
  cardRef,
  onResize,
}: {
  size: StoryTimerSize
  cardRef: RefObject<HTMLElement | null>
  onResize: (size: StoryTimerSize) => void
}) {
  const drag = useRef<{ left: number; top: number; cell: number } | null>(null)
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const card = cardRef.current
    if (!card || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const rect = card.getBoundingClientRect()
    const { columns } = TIMER_CELLS[size]
    drag.current = { left: rect.left, top: rect.top, cell: (rect.width - (columns - 1) * CELL_GAP) / columns }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = drag.current
    if (!start) return
    const reach = start.cell * 1.5 + CELL_GAP / 2
    const wide = event.clientX - start.left > reach
    const tall = event.clientY - start.top > reach
    const next: StoryTimerSize = tall ? '2x2' : wide ? '2x1' : '1x1'
    if (next !== size) onResize(next)
  }
  const end = () => {
    drag.current = null
  }
  return (
    <button
      type="button"
      className={styles.resize}
      aria-label={`Resize timer, ${size.replace('x', ' by ')}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onClick={(event) => {
        if (event.detail === 0) onResize(SIZE_ORDER[(SIZE_ORDER.indexOf(size) + 1) % SIZE_ORDER.length])
      }}
    >
      <svg viewBox="0 0 16 16" aria-hidden>
        <path d="M14 5 A9 9 0 0 1 5 14" />
      </svg>
    </button>
  )
}

export function StoryTimerCard({
  timer,
  editing,
  className,
  toolbar,
  onChange,
  onCancelConfigure,
}: {
  timer: StoryTimer
  /** Edit mode: the resize corner shows. */
  editing: boolean
  /** The card shell and its size, from the story's card styles. */
  className: string
  /** The hover toolbar, hidden while configuring. */
  toolbar: ReactNode
  onChange: (patch: Partial<StoryTimer>) => void
  onCancelConfigure: () => void
}) {
  const cardRef = useRef<HTMLElement>(null)
  const { seconds, fraction, done } = useRemaining(timer)
  const withHours = timer.durationS >= 3600
  const parts = withHours ? 3 : 2
  /* The readout's width in mono digits: two per part, its letter, and the gap between parts. */
  const chars = parts * 2.6 + (parts - 1) * 0.4
  const status = done ? 'Time’s up' : timer.startedAt === null ? 'Ready' : 'Remaining'
  return (
    <section
      ref={cardRef}
      className={`${className} ${styles.timer}`}
      data-size={timer.size}
      data-done={done || undefined}
      style={{ '--chars': chars } as CSSProperties}
      aria-label={timer.title}
    >
      {timer.configuring ? (
        <ConfigureForm
          timer={timer}
          onConfirm={(patch) => onChange({ ...patch, configuring: false, startedAt: Date.now() })}
          onCancel={onCancelConfigure}
        />
      ) : (
        <>
          <div className={styles.head}>
            <p className={styles.title}>{timer.title}</p>
            {timer.size === '2x1' ? (
              <span className={styles.total}>{done ? status : clockText(timer.durationS, withHours)}</span>
            ) : null}
          </div>
          {timer.size === '2x1' ? (
            <div className={styles.wide}>
              <Readout seconds={seconds} withHours={withHours} className={styles.wideValue} />
              <div className={styles.bar} aria-hidden>
                <span className={styles.barFill} style={{ transform: `scaleX(${fraction})` }} />
              </div>
            </div>
          ) : (
            <div className={styles.dial}>
              <TickGauge fraction={fraction} large={timer.size === '2x2'} />
              <div className={styles.dialCentre}>
                <Readout seconds={seconds} withHours={withHours} className={styles.dialValue} />
                <p className={styles.dialStatus}>{status}</p>
              </div>
            </div>
          )}
        </>
      )}
      {timer.configuring ? null : toolbar}
      {editing ? <ResizeHandle size={timer.size} cardRef={cardRef} onResize={(size) => onChange({ size })} /> : null}
    </section>
  )
}
