import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import styles from './BriefingTour.module.css'

/** One coach mark: the element it points at (a selector inside the page) and the side its tip opens on. */
export type TourStep = { target: string; title: string; body: string; side: 'bottom' | 'left' }

type Box = { left: number; top: number; width: number; height: number; radius: number; frameWidth: number }

const SPOT_PAD = 6
const TIP_W = 320
const TIP_GAP = 18
const EDGE = 16
/** How far past the page's right edge the spotlight may run, so a target cut by the edge shows no corner there. */
const EDGE_BLEED = 24

function measure(root: HTMLElement, selector: string): Box | null {
  const el = root.querySelector<HTMLElement>(selector)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  const frame = root.getBoundingClientRect()
  const left = Math.round(rect.left - frame.left - SPOT_PAD)
  const right = Math.round(Math.min(rect.right - frame.left, frame.width + EDGE_BLEED) + SPOT_PAD)
  const top = Math.round(rect.top - frame.top - SPOT_PAD)
  const bottom = Math.round(rect.bottom - frame.top + SPOT_PAD)
  const radius = (Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 16) + SPOT_PAD
  return { left, top, width: right - left, height: bottom - top, radius, frameWidth: Math.round(frame.width) }
}

function sameBox(a: Box | null, b: Box | null) {
  if (!a || !b) return a === b
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height &&
    a.radius === b.radius &&
    a.frameWidth === b.frameWidth
  )
}

/**
 * A guided tour over the page: the rest dims around a spotlight on each step's target, with a glass tip
 * beside it to read on, Next to move on and Skip (or Escape) to leave. Steps whose target is missing are passed.
 */
export function BriefingTour({
  rootRef,
  steps,
  onClose,
}: {
  rootRef: RefObject<HTMLElement | null>
  steps: readonly TourStep[]
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const step = steps[index]
  const last = index === steps.length - 1

  /* Followed every frame: the targets glide (the board on hover, the finding as it settles). */
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let frame = 0
    const tick = () => {
      const next = measure(root, step.target)
      setBox((current) => (sameBox(current, next) ? current : next))
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [rootRef, step.target])

  const placed = box !== null
  useEffect(() => {
    if (placed) nextRef.current?.focus({ preventScroll: true })
  }, [index, placed])

  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const advance = () => {
    const root = rootRef.current
    for (let next = index + 1; next < steps.length; next += 1) {
      if (root?.querySelector(steps[next].target)) {
        setIndex(next)
        return
      }
    }
    onClose()
  }

  let tip: CSSProperties | null = null
  if (box) {
    if (step.side === 'left') {
      tip = {
        left: Math.max(EDGE, box.left - TIP_GAP - TIP_W),
        top: box.top + box.height / 2,
        ['--tip-arrow-y' as string]: '50%',
      }
    } else {
      const centre = box.left + box.width / 2
      const left = Math.min(Math.max(EDGE, centre - TIP_W / 2), box.frameWidth - TIP_W - EDGE)
      tip = { left, top: box.top + box.height + TIP_GAP, ['--tip-arrow-x' as string]: `${Math.round(centre - left)}px` }
    }
  }

  return (
    <div className={styles.tour}>
      <div className={styles.catch} aria-hidden />
      {box ? (
        <div
          key={`spot-${index}`}
          className={styles.spot}
          data-first={index === 0}
          style={{ left: box.left, top: box.top, width: box.width, height: box.height, borderRadius: box.radius }}
          aria-hidden
        />
      ) : null}
      {tip ? (
        <div
          key={`tip-${index}`}
          className={styles.tip}
          data-side={step.side}
          style={{ ...tip, width: TIP_W }}
          role="dialog"
          aria-live="polite"
          aria-label={step.title}
        >
          <p className={styles.count}>
            {index + 1} of {steps.length}
          </p>
          <h2 className={styles.title}>{step.title}</h2>
          <p className={styles.body}>{step.body}</p>
          <div className={styles.actions}>
            {last ? null : (
              <button type="button" className={styles.skip} onClick={onClose}>
                Skip
              </button>
            )}
            <button ref={nextRef} type="button" className={styles.next} onClick={advance}>
              {last ? 'Done' : 'Next'}
            </button>
          </div>
          <span className={styles.arrow} aria-hidden />
        </div>
      ) : null}
    </div>
  )
}
