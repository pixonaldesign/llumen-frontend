import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import styles from './InteractionModelSwitcher.module.css'

export type HeaderOption<T extends string> = { id: T; label: string; description: string }

export type HeaderOptionSwitcherProps<T extends string> = {
  /** Leading tag on the trigger: short text (accent pill) or an icon (story filter pill). */
  kicker: ReactNode
  label: string
  options: HeaderOption<T>[]
  value: T
  onChange: (next: T) => void
  /** `filter` matches the story header's filter pills. */
  variant?: 'accent' | 'filter'
}

/** Pill dropdown for comparing parallel prototypes (UX model, AI approach). */
export function HeaderOptionSwitcher<T extends string>({
  kicker,
  label,
  options,
  value,
  onChange,
  variant = 'accent',
}: HeaderOptionSwitcherProps<T>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = options.find((item) => item.id === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger}${variant === 'filter' ? ` ${styles.triggerFilter}` : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.kicker}>{kicker}</span>
        <span>{current.label}</span>
        <CaretDown className={styles.caret} size={12} weight="bold" aria-hidden />
      </button>
      {open ? (
        <div className={styles.menu} role="listbox" aria-label={label}>
          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === value}
              className={`${styles.item}${item.id === value ? ` ${styles.itemActive}` : ''}`}
              onClick={() => {
                if (item.id !== value) onChange(item.id)
                setOpen(false)
              }}
            >
              <span className={styles.itemLabel}>{item.label}</span>
              <span className={styles.itemDescription}>{item.description}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
