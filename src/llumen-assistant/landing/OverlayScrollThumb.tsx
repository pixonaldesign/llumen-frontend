import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import styles from './OverlayScrollThumb.module.css'

const THUMB_HIDE_MS = 800
const THUMB_MIN = 56

/** Overlay thumb for a landing scrollport. No track. Fades until scroll or edge hover. */
export function OverlayScrollThumb({
  scrollEl,
  label = 'Page position',
}: {
  scrollEl: HTMLElement | null
  label?: string
}) {
  const hovering = useRef(false)
  const dragging = useRef(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const thumbSize = useRef(THUMB_MIN)
  const [geom, setGeom] = useState({ height: THUMB_MIN, offset: 0, canScroll: false })
  const [visible, setVisible] = useState(false)

  const scheduleHide = useCallback(() => {
    if (hideTimer.current != null) clearTimeout(hideTimer.current)
    if (hovering.current || dragging.current) return
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null
      if (!hovering.current && !dragging.current) setVisible(false)
    }, THUMB_HIDE_MS)
  }, [])

  const reveal = useCallback(() => {
    setVisible(true)
    if (hideTimer.current != null) clearTimeout(hideTimer.current)
  }, [])

  useEffect(() => {
    if (!scrollEl) return
    const measure = () => {
      const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight
      const canScroll = maxScroll > 1
      const height = canScroll
        ? Math.max(THUMB_MIN, (scrollEl.clientHeight / scrollEl.scrollHeight) * scrollEl.clientHeight)
        : THUMB_MIN
      const travel = Math.max(0, scrollEl.clientHeight - height)
      const offset = canScroll ? (scrollEl.scrollTop / maxScroll) * travel : 0
      thumbSize.current = height
      setGeom({ height, offset, canScroll })
    }
    const onScroll = () => {
      measure()
      reveal()
      scheduleHide()
    }
    measure()
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(scrollEl)
    if (scrollEl.firstElementChild) observer.observe(scrollEl.firstElementChild)
    return () => {
      scrollEl.removeEventListener('scroll', onScroll)
      observer.disconnect()
      if (hideTimer.current != null) clearTimeout(hideTimer.current)
    }
  }, [reveal, scheduleHide, scrollEl])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrollEl || !geom.canScroll) return
    event.preventDefault()
    event.stopPropagation()
    dragging.current = true
    reveal()
    const startY = event.clientY
    const startTop = scrollEl.scrollTop
    const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight
    const travel = Math.max(1, scrollEl.clientHeight - thumbSize.current)
    event.currentTarget.setPointerCapture(event.pointerId)
    const onMove = (ev: PointerEvent) => {
      scrollEl.scrollTop = startTop + ((ev.clientY - startY) / travel) * maxScroll
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      scheduleHide()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  if (!geom.canScroll) return null

  return (
    <div
      className={styles.edge}
      onPointerEnter={() => {
        hovering.current = true
        reveal()
      }}
      onPointerLeave={() => {
        hovering.current = false
        scheduleHide()
      }}
    >
      <div
        className={`${styles.thumb}${visible ? ` ${styles.thumbOn}` : ''}`}
        style={{ height: geom.height, transform: `translateY(${geom.offset}px)` }}
        role="scrollbar"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={
          scrollEl && scrollEl.scrollHeight > scrollEl.clientHeight
            ? Math.round((scrollEl.scrollTop / (scrollEl.scrollHeight - scrollEl.clientHeight)) * 100)
            : 0
        }
        aria-label={label}
        onPointerDown={onPointerDown}
      />
    </div>
  )
}
