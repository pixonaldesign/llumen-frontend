import { useEffect, useRef, useState } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import {
  CHAT_INTERACTION_MODELS,
  type ChatInteractionModel,
} from './interactionModel'
import styles from './InteractionModelSwitcher.module.css'

export type InteractionModelSwitcherProps = {
  value: ChatInteractionModel
  onChange: (next: ChatInteractionModel) => void
}

export function InteractionModelSwitcher({ value, onChange }: InteractionModelSwitcherProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = CHAT_INTERACTION_MODELS.find((item) => item.id === value) ?? CHAT_INTERACTION_MODELS[0]

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
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Chat interaction model"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.kicker}>UX</span>
        <span>{current.label}</span>
        <CaretDown className={styles.caret} size={12} weight="bold" aria-hidden />
      </button>
      {open ? (
        <div className={styles.menu} role="listbox" aria-label="Chat interaction models">
          {CHAT_INTERACTION_MODELS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === value}
              className={`${styles.item}${item.id === value ? ` ${styles.itemActive}` : ''}`}
              onClick={() => {
                onChange(item.id)
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
