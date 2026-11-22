import { useEffect, type RefObject } from 'react'

/** Movement before a press becomes a drag, so clicks on cards and buttons still land. */
const DRAG_THRESHOLD = 5
/** Share of the fling velocity kept each frame once the row is let go. */
const FRICTION = 0.94

/**
 * Lets a mouse drag a sideways row freely, with a fling when it's let go. Touch keeps the browser's own
 * scrolling. A drag swallows the click it ends on, so the card under the pointer doesn't open.
 */
export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const row = ref.current
    if (!row) return
    let press: { x: number; left: number; id: number } | null = null
    let dragging = false
    let samples: { x: number; t: number }[] = []
    let fling = 0

    row.dataset.dragScroll = ''
    const stopFling = () => cancelAnimationFrame(fling)

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      if (innermostScroller(event.target) !== row) return
      stopFling()
      press = { x: event.clientX, left: row.scrollLeft, id: event.pointerId }
      samples = [{ x: event.clientX, t: event.timeStamp }]
    }

    const onMove = (event: PointerEvent) => {
      if (!press || event.pointerId !== press.id) return
      const dx = event.clientX - press.x
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return
        dragging = true
        row.setPointerCapture(press.id)
        row.dataset.dragging = 'true'
        window.getSelection()?.removeAllRanges()
      }
      row.scrollLeft = press.left - dx
      samples = [...samples, { x: event.clientX, t: event.timeStamp }].filter((sample) => event.timeStamp - sample.t < 100)
    }

    const onUp = (event: PointerEvent) => {
      if (!press || event.pointerId !== press.id) return
      press = null
      if (!dragging) return
      dragging = false
      delete row.dataset.dragging
      if (row.hasPointerCapture(event.pointerId)) row.releasePointerCapture(event.pointerId)
      row.addEventListener('click', swallow, { capture: true, once: true })
      window.setTimeout(() => row.removeEventListener('click', swallow, { capture: true }), 0)

      const recent = samples.filter((sample) => event.timeStamp - sample.t < 100)
      const first = recent[0]
      const last = recent[recent.length - 1]
      const elapsed = recent.length > 1 ? last.t - first.t : 0
      let velocity = elapsed > 0 ? ((first.x - last.x) / elapsed) * 16 : 0
      const step = () => {
        if (Math.abs(velocity) < 0.5) return
        const before = row.scrollLeft
        row.scrollLeft += velocity
        if (row.scrollLeft === before) return
        velocity *= FRICTION
        fling = requestAnimationFrame(step)
      }
      fling = requestAnimationFrame(step)
    }

    const swallow = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }
    const noNativeDrag = (event: DragEvent) => event.preventDefault()

    row.addEventListener('pointerdown', onDown)
    row.addEventListener('pointermove', onMove)
    row.addEventListener('pointerup', onUp)
    row.addEventListener('pointercancel', onUp)
    row.addEventListener('wheel', stopFling, { passive: true })
    row.addEventListener('dragstart', noNativeDrag)
    return () => {
      stopFling()
      row.removeEventListener('pointerdown', onDown)
      row.removeEventListener('pointermove', onMove)
      row.removeEventListener('pointerup', onUp)
      row.removeEventListener('pointercancel', onUp)
      row.removeEventListener('wheel', stopFling)
      row.removeEventListener('dragstart', noNativeDrag)
      row.removeEventListener('click', swallow, { capture: true })
      delete row.dataset.dragScroll
    }
  }, [ref])
}

/** Rows nest (a card's tags inside a shelf), so a press drags the innermost row that has anywhere to go. */
function innermostScroller(target: EventTarget | null) {
  let node = target instanceof Element ? target.closest<HTMLElement>('[data-drag-scroll]') : null
  while (node && node.scrollWidth <= node.clientWidth + 1) {
    node = node.parentElement?.closest<HTMLElement>('[data-drag-scroll]') ?? null
  }
  return node
}

/**
 * Marks which ends of a sideways row have more content past them, as `data-fade="start" | "end" | "both"`,
 * so CSS can fade those edges. Nothing is set while everything fits.
 */
export function useEdgeFade(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const row = ref.current
    if (!row) return
    const update = () => {
      const max = row.scrollWidth - row.clientWidth
      const left = Math.abs(row.scrollLeft)
      const start = left > 1
      const end = left < max - 1
      if (start && end) row.dataset.fade = 'both'
      else if (start) row.dataset.fade = 'start'
      else if (end) row.dataset.fade = 'end'
      else delete row.dataset.fade
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(row)
    for (const child of row.children) observer.observe(child)
    row.addEventListener('scroll', update, { passive: true })
    return () => {
      observer.disconnect()
      row.removeEventListener('scroll', update)
    }
  }, [ref])
}

/** Where each row's smooth scroll is headed, until it settles. */
const heading = new WeakMap<HTMLElement, { left: number; timer: number; settle: () => void }>()
/** Settles a heading where `scrollend` isn't supported, a little after a smooth scroll would finish. */
const HEADING_TIMEOUT_MS = 1200

/**
 * Pages a row to its next page stop: every `count`th card's leading edge, as if only the arrows had ever
 * moved it, whatever a free drag left behind. A click during a smooth scroll pages on from where that scroll
 * is headed, not from wherever it has got to, so quick clicks each move a full page.
 */
export function pageRow(row: HTMLElement, direction: 1 | -1, count: number) {
  const cards = [...row.children].filter((child): child is HTMLElement => child instanceof HTMLElement && child.offsetParent !== null)
  if (!cards.length) return
  const max = row.scrollWidth - row.clientWidth
  const stops = [
    ...new Set(
      cards
        .filter((_, index) => index % count === 0)
        .map((card) => Math.round(Math.min(card.offsetLeft - cards[0].offsetLeft, max))),
    ),
  ]
  const pending = heading.get(row)
  const at = pending?.left ?? row.scrollLeft
  const target =
    direction > 0
      ? (stops.find((stop) => stop > at + 1) ?? stops[stops.length - 1])
      : ([...stops].reverse().find((stop) => stop < at - 1) ?? 0)
  if (pending) {
    window.clearTimeout(pending.timer)
    row.removeEventListener('scrollend', pending.settle)
  }
  const settle = () => {
    const current = heading.get(row)
    if (current?.settle !== settle) return
    window.clearTimeout(current.timer)
    heading.delete(row)
    row.removeEventListener('scrollend', settle)
  }
  row.addEventListener('scrollend', settle)
  heading.set(row, { left: target, timer: window.setTimeout(settle, HEADING_TIMEOUT_MS), settle })
  row.scrollTo({ left: target, behavior: 'smooth' })
}
