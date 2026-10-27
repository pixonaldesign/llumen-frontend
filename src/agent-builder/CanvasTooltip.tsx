import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import styles from './CanvasTooltip.module.css'

/** Anything with `data-tooltip`, or an icon button named only by its `aria-label`. */
const TARGET = '[data-tooltip], button[aria-label]:not([data-no-tooltip])'
const SHOW_DELAY_MS = 400
/** After a tooltip hides, neighbours show instantly for this long (sweeping along a toolbar). */
const WARM_MS = 300
const GAP = 8
const EDGE = 8

type Tip = { label: string; shortcut?: string; x: number; y: number; placement: 'top' | 'bottom' }

/** FigJam-style hover tooltips (name plus shortcut) for every control inside `rootRef`. */
export function CanvasTooltip({ rootRef }: { rootRef: RefObject<HTMLElement | null> }) {
  const [tip, setTip] = useState<Tip | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let timer = 0
    let current: HTMLElement | null = null
    let visible = false
    let warmUntil = 0

    const show = (element: HTMLElement) => {
      const label = element.dataset.tooltip || element.getAttribute('aria-label')
      if (!label || !element.isConnected) return
      const rect = element.getBoundingClientRect()
      const below = rect.top + rect.height / 2 < window.innerHeight / 2
      visible = true
      setTip({
        label,
        shortcut: element.dataset.shortcut,
        x: rect.left + rect.width / 2,
        y: below ? rect.bottom + GAP : rect.top - GAP,
        placement: below ? 'bottom' : 'top',
      })
    }
    const hide = () => {
      window.clearTimeout(timer)
      if (visible) warmUntil = performance.now() + WARM_MS
      visible = false
      setTip(null)
    }
    const targetOf = (event: Event) => (event.target as Element | null)?.closest?.<HTMLElement>(TARGET) ?? null

    const onOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const element = targetOf(event)
      if (element === current) return
      const instant = visible || performance.now() < warmUntil
      hide()
      current = element
      if (!element) return
      if (instant) show(element)
      else timer = window.setTimeout(() => show(element), SHOW_DELAY_MS)
    }
    const onLeave = () => {
      hide()
      current = null
    }
    // A press dismisses the tip and keeps it away until the pointer moves to another control.
    const onDown = () => hide()
    const onFocus = (event: FocusEvent) => {
      const element = targetOf(event)
      if (element?.matches(':focus-visible')) {
        hide()
        current = element
        show(element)
      }
    }

    root.addEventListener('pointerover', onOver)
    root.addEventListener('pointerleave', onLeave)
    root.addEventListener('pointerdown', onDown, true)
    root.addEventListener('wheel', onDown, { passive: true })
    root.addEventListener('focusin', onFocus)
    root.addEventListener('focusout', onLeave)
    window.addEventListener('keydown', onDown)
    return () => {
      window.clearTimeout(timer)
      root.removeEventListener('pointerover', onOver)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('pointerdown', onDown, true)
      root.removeEventListener('wheel', onDown)
      root.removeEventListener('focusin', onFocus)
      root.removeEventListener('focusout', onLeave)
      window.removeEventListener('keydown', onDown)
    }
  }, [rootRef])

  // Keep the tip on screen; needs its rendered width.
  useLayoutEffect(() => {
    const element = tipRef.current
    if (!element || !tip) return
    const half = element.offsetWidth / 2
    const x = Math.min(window.innerWidth - EDGE - half, Math.max(EDGE + half, tip.x))
    element.style.left = `${x}px`
  }, [tip])

  if (!tip) return null
  return (
    <div
      ref={tipRef}
      className={styles.tooltip}
      data-placement={tip.placement}
      style={{ left: tip.x, top: tip.y }}
      role="tooltip"
    >
      {tip.label}
      {tip.shortcut ? <kbd className={styles.shortcut}>{tip.shortcut}</kbd> : null}
    </div>
  )
}
