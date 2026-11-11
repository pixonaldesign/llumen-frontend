/**
 * Hero-and-peeks carousel motion shared by the Stories landing and the Briefing Apps section.
 * The hero sits at the left with up to two peeks beside it; advancing slides the hero out to the
 * left, going back parks the incoming cards off the left edge first so they slide in, and a card
 * that wraps from the left edge round to the right jumps there hidden instead of crossing the track.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export const AUTOPLAY_MS = 7000
export const CAROUSEL_MS = 560
const CAROUSEL_GAP = 16
const PEEK_COUNT = 2
const PEEK_ONE_BELOW_VW = 1600
const PEEK_NONE_BELOW_VW = 1150
const HERO_SHARE = 1023 / 1857
const HERO_SHARE_ONE_PEEK = 0.65
const TICKER_MAX = 5

export type CardLayout = { left: number; width: number }

type CardMetrics = {
  heroWidth: number
  peekWidth: number
  trackWidth: number
}

function peekCountForViewport(width: number) {
  if (width < PEEK_NONE_BELOW_VW) return 0
  if (width < PEEK_ONE_BELOW_VW) return 1
  return PEEK_COUNT
}

export function wrap(index: number, length: number) {
  return ((index % length) + length) % length
}

/** Progress dots: up to five, with shrunken edge dots when there are more on that side. */
export function tickerSlots(active: number, count: number, max = TICKER_MAX) {
  if (count <= 0) return []
  if (count <= max) {
    return Array.from({ length: count }, (_, index) => ({ index, edge: false }))
  }
  const start = Math.max(0, Math.min(active - Math.floor(max / 2), count - max))
  const moreLeft = start > 0
  const moreRight = start + max < count
  return Array.from({ length: max }, (_, offset) => {
    const index = start + offset
    const edge = (offset === 0 && moreLeft && index !== active) || (offset === max - 1 && moreRight && index !== active)
    return { index, edge }
  })
}

function cardMetrics(trackWidth: number, peekCount: number): CardMetrics {
  if (trackWidth <= 0) return { heroWidth: 0, peekWidth: 0, trackWidth: 0 }
  if (peekCount === 0) {
    return { heroWidth: trackWidth, peekWidth: trackWidth, trackWidth }
  }
  if (peekCount === 1) {
    const heroWidth = trackWidth * HERO_SHARE_ONE_PEEK
    const peekWidth = Math.max(0, trackWidth * (1 - HERO_SHARE_ONE_PEEK) - CAROUSEL_GAP)
    return { heroWidth, peekWidth, trackWidth }
  }
  const designAvailable = Math.max(0, trackWidth - CAROUSEL_GAP * PEEK_COUNT)
  const peekWidth = (designAvailable * (1 - HERO_SHARE)) / PEEK_COUNT
  const gaps = CAROUSEL_GAP * peekCount
  const heroWidth = Math.max(0, trackWidth - gaps - peekWidth * peekCount)
  return { heroWidth, peekWidth, trackWidth }
}

function carouselLayout(rel: number, metrics: CardMetrics, exiting: boolean, peekCount: number): CardLayout {
  const { heroWidth, peekWidth, trackWidth } = metrics
  if (trackWidth <= 0) return { left: 0, width: 0 }
  if (exiting) return { left: -(heroWidth + CAROUSEL_GAP), width: heroWidth }
  if (rel === 0) return { left: 0, width: heroWidth }
  if (peekCount > 0 && rel <= peekCount) {
    return {
      left: heroWidth + CAROUSEL_GAP + (rel - 1) * (peekWidth + CAROUSEL_GAP),
      width: peekWidth,
    }
  }
  return { left: trackWidth + CAROUSEL_GAP, width: peekWidth }
}

function parkedLayout(metrics: CardMetrics, slot: number): CardLayout {
  const width = metrics.peekWidth || metrics.heroWidth
  const step = width + CAROUSEL_GAP
  return { left: -(step * (slot + 1)), width }
}

function isOffstage(layout: CardLayout, trackWidth: number) {
  return layout.width <= 0 || layout.left + layout.width <= 0 || layout.left >= trackWidth
}

/** Peeks shown beside the hero: two on wide screens, one below 1600px, none below 1150px. */
export function usePeekCount() {
  const [peekCount, setPeekCount] = useState(() =>
    typeof window === 'undefined' ? PEEK_COUNT : peekCountForViewport(window.innerWidth),
  )

  useLayoutEffect(() => {
    const one = window.matchMedia(`(max-width: ${PEEK_ONE_BELOW_VW - 1}px)`)
    const none = window.matchMedia(`(max-width: ${PEEK_NONE_BELOW_VW - 1}px)`)
    const apply = () => setPeekCount(none.matches ? 0 : one.matches ? 1 : PEEK_COUNT)
    apply()
    one.addEventListener('change', apply)
    none.addEventListener('change', apply)
    return () => {
      one.removeEventListener('change', apply)
      none.removeEventListener('change', apply)
    }
  }, [])

  return peekCount
}

export type CarouselSlot = {
  layout: CardLayout
  /** The hero, or the old hero while it slides out. */
  expanded: boolean
  /** Waiting off the left edge before it slides in. */
  park: boolean
  offstage: boolean
  /** Wrapping between edges this frame: render hidden without a transition. */
  snap: boolean
}

export function useCarousel(count: number) {
  const [active, setActive] = useState(0)
  const [trackWidth, setTrackWidth] = useState(0)
  const [trackReady, setTrackReady] = useState(false)
  const [exiting, setExiting] = useState<number[]>([])
  const [incoming, setIncoming] = useState<number[]>([])
  const [wrapping, setWrapping] = useState<number[]>([])
  const peekCount = usePeekCount()
  const trackRef = useRef<HTMLDivElement>(null)
  const exitTimersRef = useRef<Record<number, number>>({})
  const activeRef = useRef(0)
  const peekCountRef = useRef(0)

  useLayoutEffect(() => {
    activeRef.current = active
    peekCountRef.current = peekCount
  }, [active, peekCount])

  const goTo = useCallback(
    (index: number) => {
      const current = activeRef.current
      const next = wrap(index, count)
      if (next === current) return
      const forward = wrap(next - current, count)
      const backward = wrap(current - next, count)
      const peeks = peekCountRef.current
      if (forward > 0 && forward <= backward) {
        setIncoming([])
        const leaving = Array.from({ length: forward }, (_, step) => wrap(current + step, count))
        setExiting((prev) => [...new Set([...prev, ...leaving])])
        for (const itemIndex of leaving) {
          window.clearTimeout(exitTimersRef.current[itemIndex])
          exitTimersRef.current[itemIndex] = window.setTimeout(() => {
            setExiting((prev) => prev.filter((value) => value !== itemIndex))
            setWrapping((prev) => [...prev, itemIndex])
            delete exitTimersRef.current[itemIndex]
          }, CAROUSEL_MS)
        }
      } else {
        const wasExiting = Object.keys(exitTimersRef.current).map(Number)
        for (const timer of Object.values(exitTimersRef.current)) window.clearTimeout(timer)
        exitTimersRef.current = {}
        setExiting([])
        const visible = new Set([
          current,
          ...Array.from({ length: peeks }, (_, step) => wrap(current + 1 + step, count)),
        ])
        const entering = Array.from({ length: peeks + 1 }, (_, step) => wrap(next + step, count)).filter(
          (itemIndex) => !visible.has(itemIndex),
        )
        setIncoming(entering)
        setWrapping(wasExiting.filter((itemIndex) => !entering.includes(itemIndex)))
      }
      setActive(next)
    },
    [count],
  )

  useEffect(() => {
    const timers = exitTimersRef.current
    return () => {
      Object.values(timers).forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  const metrics = cardMetrics(trackWidth, peekCount)

  useEffect(() => clearAfterTwoFrames(incoming, setIncoming), [incoming])
  useEffect(() => clearAfterTwoFrames(wrapping, setWrapping), [wrapping])

  useLayoutEffect(() => {
    const node = trackRef.current
    if (!node) return
    const apply = () => {
      setTrackWidth(node.clientWidth)
      setTrackReady(true)
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const slot = (index: number): CarouselSlot => {
    const rel = wrap(index - active, count)
    const leaving = exiting.includes(index)
    const park = incoming.includes(index)
    const layout = park ? parkedLayout(metrics, rel) : carouselLayout(rel, metrics, leaving, peekCount)
    const offstage = isOffstage(layout, trackWidth)
    return {
      layout,
      expanded: !park && (rel === 0 || leaving),
      park,
      offstage,
      snap: !park && offstage && layout.left > 0 && wrapping.includes(index),
    }
  }

  return { active, goTo, peekCount, trackRef, trackReady, slot }
}

/** Cards parked or wrapping hold their transition-free pose for two frames, then animate again. */
function clearAfterTwoFrames(list: number[], set: (next: number[]) => void) {
  if (list.length === 0) return
  let inner = 0
  const outer = requestAnimationFrame(() => {
    inner = requestAnimationFrame(() => set([]))
  })
  return () => {
    cancelAnimationFrame(outer)
    cancelAnimationFrame(inner)
  }
}
