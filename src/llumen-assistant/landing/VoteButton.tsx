import type { ReactNode } from 'react'
import { useAnchoredTooltip } from './useAnchoredTooltip'
import styles from './LandingHome.module.css'

/** A thumbs vote whose label shows as a tooltip on hover and focus. */
export function VoteButton({
  label,
  pressed,
  pressedClassName = styles.voteBtnActive,
  onClick,
  children,
}: {
  label: string
  pressed: boolean
  pressedClassName?: string
  onClick: () => void
  children: ReactNode
}) {
  const tooltip = useAnchoredTooltip()

  return (
    <>
      <button
        type="button"
        className={`${styles.voteBtn}${pressed ? ` ${pressedClassName}` : ''}`}
        aria-pressed={pressed}
        aria-label={label}
        aria-describedby={tooltip.describedBy}
        onClick={onClick}
        onMouseEnter={tooltip.show}
        onMouseMove={tooltip.show}
        onMouseLeave={tooltip.hide}
        onFocus={tooltip.show}
        onBlur={tooltip.hide}
      >
        {children}
      </button>
      {tooltip.node(label)}
    </>
  )
}
