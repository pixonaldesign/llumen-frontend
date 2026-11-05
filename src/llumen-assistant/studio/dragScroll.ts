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

    const stopFling = () => cancelAnimationFrame(fling)

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return
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
    }
  }, [ref])
}

/**
 * Pages a row to its next page stop: every `count`th card's leading edge, as if only the arrows had ever
 * moved it, whatever a free drag left behind.
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
  const at = row.scrollLeft
  const target =
    direction > 0
      ? (stops.find((stop) => stop > at + 1) ?? stops[stops.length - 1])
      : ([...stops].reverse().find((stop) => stop < at - 1) ?? 0)
  row.scrollTo({ left: target, behavior: 'smooth' })
}
