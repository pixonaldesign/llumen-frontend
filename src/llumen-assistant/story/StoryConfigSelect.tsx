import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CaretDown } from '@phosphor-icons/react'
import styles from './StoryEditPanel.module.css'

const OPTION_HEIGHT = 40

export function ConfigSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  /** Keeps the label for screen readers only. */
  hideLabel?: boolean
}) {
  const labelId = useId()
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = options.find((option) => option.value === value) ?? options[0]

  const syncPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const height = options.length * OPTION_HEIGHT + 8
    const below = rect.bottom + 8
    setPosition({
      top: below + height > window.innerHeight - 8 ? Math.max(8, rect.top - 8 - height) : below,
      left: rect.left,
      width: rect.width,
    })
  }, [options.length])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    const onLayout = () => syncPosition()
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [open, syncPosition])

  return (
    <div className={styles.field}>
      <span id={labelId} className={hideLabel ? styles.visuallyHidden : styles.label}>
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.logoSelect}${open ? ` ${styles.logoSelectOpen}` : ''}`}
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          if (!open) syncPosition()
          setOpen((isOpen) => !isOpen)
        }}
      >
        <span>{current.label}</span>
        <CaretDown className={styles.logoSelectCaret} size={16} weight="bold" aria-hidden />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              className={styles.logoMenu}
              role="listbox"
              aria-labelledby={labelId}
              style={{ top: position.top, left: position.left, width: position.width }}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={option.value === value ? styles.logoMenuSelected : undefined}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
