import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './LandingHome.module.css'

/** A label above the hovered or focused element, portalled to the body so no ancestor clips it. */
export function useAnchoredTooltip(enabled = true) {
  const tooltipId = useId()
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [wasEnabled, setWasEnabled] = useState(enabled)
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled)
    if (!enabled) setPos(null)
  }

  const show = (event: { currentTarget: HTMLElement }) => {
    if (!enabled) return
    const rect = event.currentTarget.getBoundingClientRect()
    setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
  }
  const hide = () => setPos(null)

  return {
    describedBy: enabled && pos ? tooltipId : undefined,
    show,
    hide,
    node: (label: string) =>
      enabled && pos
        ? createPortal(
            <div id={tooltipId} className={styles.tooltip} role="tooltip" style={{ left: pos.x, top: pos.y }}>
              {label}
            </div>,
            document.body,
          )
        : null,
  }
}
