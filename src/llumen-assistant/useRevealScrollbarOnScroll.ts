import { useCallback, useEffect, useRef, type RefCallback } from 'react'

const DEFAULT_HIDE_MS = 2000

/**
 * Native scrollbars: hide thumb until the user scrolls (wheel, trackpad, touch, etc.),
 * then show for {@link hideAfterMs} after the last scroll event.
 * Requires `data-ll-scrollbar` styles from `src/styles/scrollbar-auto-hide.css`.
 */
export function useRevealScrollbarOnScroll(hideAfterMs: number = DEFAULT_HIDE_MS): RefCallback<HTMLElement> {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elRef = useRef<HTMLElement | null>(null)

  const onScroll = useCallback(() => {
    const el = elRef.current
    if (!el) return
    el.dataset.llScrollbarActive = 'true'
    if (timerRef.current != null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      delete el.dataset.llScrollbarActive
      timerRef.current = null
    }, hideAfterMs)
  }, [hideAfterMs])

  const scrollRef = useCallback(
    (el: HTMLElement | null) => {
      if (elRef.current) {
        elRef.current.removeEventListener('scroll', onScroll)
        delete elRef.current.dataset.llScrollbar
      }
      elRef.current = el
      if (el) {
        el.dataset.llScrollbar = ''
        el.addEventListener('scroll', onScroll, { passive: true })
      }
    },
    [onScroll],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current != null) clearTimeout(timerRef.current)
      const last = elRef.current
      if (last) {
        last.removeEventListener('scroll', onScroll)
        delete last.dataset.llScrollbar
        delete last.dataset.llScrollbarActive
      }
    }
  }, [onScroll])

  return scrollRef
}
