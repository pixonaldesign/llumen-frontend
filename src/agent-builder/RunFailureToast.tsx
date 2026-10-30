import { X, XCircle } from '@phosphor-icons/react'
import { SCOPE_CLASS } from '../asset-builder/host'
import { plural } from './kindEditor'
import styles from './RunFailureToast.module.css'

export type FailedStep = { id: string; name: string; message: string }

/** What broke on the last flow run, as the design system's small outlined negative alert. */
export function RunFailureToast({ steps, onShow, onClose }: { steps: readonly FailedStep[]; onShow: (id: string) => void; onClose: () => void }) {
  const [first] = steps
  if (!first) return null
  const others = steps.length - 1
  const title = `Run failed at ${first.name}${others ? ` and ${plural(others, 'other step')}` : ''}`
  return (
    <div className={SCOPE_CLASS} data-theme="dark" style={{ display: 'contents' }}>
      <div className={styles.toast} role="alert">
        <XCircle size={16} className={styles.icon} aria-hidden />
        <div className={styles.body}>
          <div className={styles.text}>
            <p className={styles.title} title={title}>
              {title}
            </p>
            <p className={styles.message}>{first.message}</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.action} onClick={() => onShow(first.id)}>
              Show step
            </button>
          </div>
        </div>
        <button type="button" className={styles.close} aria-label="Dismiss" onClick={onClose}>
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}
