import { createContext } from 'react'
import styles from './ConfigControls.module.css'

/** The window's popover layer; popovers render into it so column scrollports don't clip them. */
export const PopoverLayer = createContext<HTMLElement | null>(null)

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
