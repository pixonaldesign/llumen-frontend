import { ArrowUp } from '@phosphor-icons/react'
import styles from './compact-assistant.module.css'

/** Maps to HubChatbox send: Inactive | Active | Stop */
export type SendVisualState = 'inactive' | 'active' | 'stop'

export type SendButtonProps = {
  state: SendVisualState
  onClick: () => void
}

export function SendButton({ state, onClick }: SendButtonProps) {
  const isStop = state === 'stop'

  return (
    <div className={styles.sendRotate}>
      <button
        type="button"
        className={`${styles.sendBtn} ${isStop ? styles.sendStop : state === 'active' ? styles.sendActive : styles.sendInactive}`}
        onClick={onClick}
        disabled={state === 'inactive'}
        aria-label={isStop ? 'Stop generating' : 'Send message'}
      >
        {isStop ? (
          <span className={styles.sendStopInner} />
        ) : (
          <ArrowUp className={styles.sendArrow} size={18} weight="regular" aria-hidden />
        )}
      </button>
    </div>
  )
}
