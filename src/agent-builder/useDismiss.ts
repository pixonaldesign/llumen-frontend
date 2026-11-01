import { useEffect, type RefObject } from 'react'

/**
 * Closes a popover on outside pointerdown (capture phase, since canvas nodes stop propagation) or Escape.
 * A press on `anchor`, the button that toggles the popover, is left to that button.
 */
export function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void, anchor?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!ref.current?.contains(target) && !anchor?.current?.contains(target)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [anchor, close, open, ref])
}
