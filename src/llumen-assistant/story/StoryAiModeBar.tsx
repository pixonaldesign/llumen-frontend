import { ArrowCounterClockwise, ArrowsClockwise, Sparkle, SidebarSimple } from '@phosphor-icons/react'
import styles from './StoryAiModeBar.module.css'

export type StoryAiModeStatus = 'unsaved' | 'updating' | 'saved' | 'original'

export type StoryAiModeBarProps = {
  status: StoryAiModeStatus
  conversationOpen: boolean
  onReset: () => void
  onUpdate: () => void
  onToggleConversation: () => void
}

const HINTS: Record<StoryAiModeStatus, string> = {
  unsaved: 'Unsaved changes from chat',
  updating: 'Updating story…',
  saved: 'Story up to date',
  original: 'Showing the original story',
}

export function StoryAiModeBar({ status, conversationOpen, onReset, onUpdate, onToggleConversation }: StoryAiModeBarProps) {
  const updating = status === 'updating'
  const unsaved = status === 'unsaved'
  return (
    <div className={styles.bar} role="status" aria-busy={updating}>
      <span className={styles.label}>
        <Sparkle size={16} weight="fill" aria-hidden />
        <span>AI mode</span>
        <span key={status} className={styles.hint}>
          {HINTS[status]}
        </span>
      </span>
      <button
        type="button"
        className={styles.action}
        onClick={onReset}
        disabled={status === 'updating' || status === 'original'}
      >
        <ArrowCounterClockwise size={14} weight="bold" aria-hidden />
        Reset
      </button>
      <button
        type="button"
        className={`${styles.action} ${styles.actionPrimary}`}
        onClick={onUpdate}
        disabled={!unsaved}
      >
        <ArrowsClockwise
          size={14}
          weight="bold"
          className={updating ? styles.spin : undefined}
          aria-hidden
        />
        {updating ? 'Updating' : 'Update'}
      </button>
      <span className={styles.divider} aria-hidden />
      <button
        type="button"
        className={`${styles.iconButton}${conversationOpen ? ` ${styles.iconButtonActive}` : ''}`}
        onClick={onToggleConversation}
        aria-pressed={conversationOpen}
        aria-label={conversationOpen ? 'Hide conversation' : 'Show conversation'}
        title={conversationOpen ? 'Hide conversation' : 'Show conversation'}
      >
        <SidebarSimple size={16} weight={conversationOpen ? 'fill' : 'regular'} aria-hidden />
      </button>
    </div>
  )
}
