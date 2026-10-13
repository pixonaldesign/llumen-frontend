import { useCallback, useEffect, useLayoutEffect, useRef, type RefCallback } from 'react'

const BOTTOM_THRESHOLD_PX = 64

function isNearBottom(el: HTMLElement, threshold = BOTTOM_THRESHOLD_PX) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
}

/**
 * Keeps a scroll container pinned to the bottom as content grows,
 * unless the user scrolls away. Returning near the bottom re-enables sticking.
 */
export function useStickToBottomScroll(contentKey?: string | number | boolean): {
  ref: RefCallback<HTMLElement>
  /** Call before programmatic scrolls that should leave the bottom (e.g. jump-to). */
  releaseStick: () => void
} {
  const elRef = useRef<HTMLElement | null>(null)
  const stickRef = useRef(true)
  const programmaticRef = useRef(false)
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scrollToBottom = useCallback(() => {
    const el = elRef.current
    if (!el || !stickRef.current) return
    programmaticRef.current = true
    el.scrollTop = el.scrollHeight
    if (releaseTimerRef.current != null) clearTimeout(releaseTimerRef.current)
    releaseTimerRef.current = setTimeout(() => {
      programmaticRef.current = false
      releaseTimerRef.current = null
    }, 50)
  }, [])

  const onScroll = useCallback(() => {
    const el = elRef.current
    if (!el || programmaticRef.current) return
    stickRef.current = isNearBottom(el)
  }, [])

  const releaseStick = useCallback(() => {
    stickRef.current = false
  }, [])

  const ref = useCallback<RefCallback<HTMLElement>>(
    (el) => {
      if (elRef.current) {
        elRef.current.removeEventListener('scroll', onScroll)
      }
      elRef.current = el
      if (el) {
        el.addEventListener('scroll', onScroll, { passive: true })
        if (stickRef.current) {
          programmaticRef.current = true
          el.scrollTop = el.scrollHeight
          requestAnimationFrame(() => {
            programmaticRef.current = false
          })
        }
      }
    },
    [onScroll],
  )

  useLayoutEffect(() => {
    scrollToBottom()
  }, [contentKey, scrollToBottom])

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    const onGrow = () => scrollToBottom()
    const resizeObserver = new ResizeObserver(onGrow)
    resizeObserver.observe(el)

    const mutationObserver = new MutationObserver(onGrow)
    mutationObserver.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    // Child size changes (timeline reveal, visual cards) often don't bubble as Mutations alone.
    for (const child of el.children) {
      resizeObserver.observe(child)
    }
    const childObserver = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) resizeObserver.observe(node)
        })
      }
    })
    childObserver.observe(el, { childList: true, subtree: true })

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      childObserver.disconnect()
    }
  }, [contentKey, scrollToBottom])

  useEffect(() => {
    return () => {
      if (releaseTimerRef.current != null) clearTimeout(releaseTimerRef.current)
      const el = elRef.current
      if (el) el.removeEventListener('scroll', onScroll)
    }
  }, [onScroll])

  return { ref, releaseStick }
}
