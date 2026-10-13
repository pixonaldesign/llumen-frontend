import { DEMO_SESSIONS } from '../SessionsPanel'
import styles from './ConversationGrid.module.css'

export type ConversationGridProps = {
  onOpen?: (id: string) => void
}

/**
 * Conversation tiles under the landing carousel.
 * Dark card surface from Figma Card / story, without a thumbnail:
 * timestamp and title sit at the top, summary at the bottom.
 */
export function ConversationGrid({ onOpen }: ConversationGridProps) {
  return (
    <div className={styles.section}>
      <h2 id="conversations-heading" className={styles.eyebrow}>
        Conversations
      </h2>
      <div className={styles.grid}>
        {DEMO_SESSIONS.map((session) => (
          <button
            key={session.id}
            type="button"
            className={styles.card}
            aria-label={`Open conversation: ${session.title}`}
            onClick={() => onOpen?.(session.id)}
          >
            <span className={styles.copy}>
              <span className={styles.time}>{session.updatedLabel}</span>
              <span className={styles.title}>{session.title}</span>
            </span>
            <span className={styles.summary}>{session.preview}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
