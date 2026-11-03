import { createContext, useContext } from 'react'
import styles from './ConfigControls.module.css'

/** The window's popover layer; popovers render into it so column scrollports don't clip them. */
export const PopoverLayer = createContext<HTMLElement | null>(null)

/** Whether the node's last run failed, so its empty required fields show as errors. */
export const ShowMissing = createContext(false)

/** A wrong entry shows as soon as it's typed; an empty field only once a run has asked for it. */
export function useInvalid(invalid: boolean | undefined, empty: boolean) {
  const showMissing = useContext(ShowMissing)
  return Boolean(invalid) && (showMissing || !empty)
}

export function useShownError(error: string | undefined, empty: boolean) {
  return useInvalid(Boolean(error), empty) ? error : undefined
}

export const inputClass = styles.input
export const layerClass = styles.layer
export const switchClass = styles.switch

export const buttonClass = (variant?: 'primary' | 'active', size?: 'small') =>
  [
    styles.button,
    variant === 'primary' ? styles.buttonPrimary : variant === 'active' ? styles.buttonActive : null,
    size === 'small' ? styles.buttonSmall : null,
  ]
    .filter(Boolean)
    .join(' ')
