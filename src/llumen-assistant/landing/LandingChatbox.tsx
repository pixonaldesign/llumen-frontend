import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from '@phosphor-icons/react'
import { getCategoryIcon, type InlineContextCategoryId } from '../inlineContextData'
import panelStyles from '../compact-assistant.module.css'
import styles from './LandingChatbox.module.css'

export type LandingContextChip = {
  id: string
  label: string
  domain?: string
  /** Same category language as ChatComposer @-mentions */
  categoryId?: InlineContextCategoryId
}

export type LandingChatboxProps = {
  onSubmit: (text: string, chips: LandingContextChip[]) => void
  chips?: LandingContextChip[]
  onRemoveChip?: (id: string) => void
  /** Bump to focus the input (e.g. after Tell Me More). */
  focusToken?: number
  /**
   * When true, play slide-down exit and keep non-interactive.
   * Parent should keep this mounted while exiting (e.g. while assistant is open).
   */
  exiting?: boolean
}

/** Persistent quick-ask composer on landing home (hidden in Story view). */
export function LandingChatbox({
  onSubmit,
  chips = [],
  onRemoveChip,
  focusToken = 0,
  exiting = false,
}: LandingChatboxProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusToken <= 0 || exiting) return
    inputRef.current?.focus()
  }, [focusToken, exiting])

  const send = () => {
    if (exiting) return
    const text = value.trim()
    if (!text && chips.length === 0) return
    onSubmit(text, chips)
    setValue('')
  }

  return (
    <div
      className={`${styles.root}${exiting ? ` ${styles.rootExiting}` : ''}`}
      aria-hidden={exiting}
    >
      <form
        className={styles.box}
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        {chips.map((chip) => {
          const Icon = getCategoryIcon(chip.categoryId ?? 'briefings')
          return (
            <span
              key={chip.id}
              className={panelStyles.inlineMention}
              title={chip.domain}
              contentEditable={false}
            >
              <span className={panelStyles.inlineMentionIcon} aria-hidden>
                <Icon size={12} weight="bold" />
              </span>
              <span className={panelStyles.inlineMentionLabel}>{chip.label}</span>
            </span>
          )
        })}
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Backspace' || exiting || !onRemoveChip || chips.length === 0) return
            const el = e.currentTarget
            // Caret at start (nothing to delete in the text) → remove last chip
            if (el.selectionStart !== 0 || el.selectionEnd !== 0) return
            e.preventDefault()
            onRemoveChip(chips[chips.length - 1]!.id)
          }}
          placeholder={chips.length > 0 ? 'Ask about this…' : 'Ask Llumen anything…'}
          aria-label="Ask Llumen"
          disabled={exiting}
        />
        <button
          type="submit"
          className={styles.send}
          disabled={exiting || (!value.trim() && chips.length === 0)}
          aria-label="Send"
        >
          <ArrowUp size={18} weight="bold" aria-hidden />
        </button>
      </form>
    </div>
  )
}
