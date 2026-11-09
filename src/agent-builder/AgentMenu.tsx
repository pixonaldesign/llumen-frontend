import { useCallback, useRef, useState } from 'react'
import { DotsThree } from '@phosphor-icons/react'
import { SCOPE_CLASS } from '../asset-builder/host'
import controls from '../llumen-assistant/FloatingControls.module.css'
import { NodeMenu } from './nodeParts'
import { useDismiss } from './useDismiss'
import styles from './AgentMenu.module.css'

type AgentMenuProps = {
  name: string
  onRename: () => void
  onDelete: () => void
}

/** The ··· beside the agent's name: its settings, and deleting it after a confirm. */
export function AgentMenu({ name, onRename, onDelete }: AgentMenuProps) {
  const [open, setOpen] = useState<'menu' | 'delete' | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(null), [])
  useDismiss(open !== null, ref, close)

  return (
    <div ref={ref} className={styles.anchor}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Agent settings"
        aria-expanded={open !== null}
        data-tooltip="Agent settings"
        onClick={() => setOpen(open ? null : 'menu')}
      >
        <DotsThree size={16} weight="bold" aria-hidden />
      </button>
      {open === 'menu' ? (
        <NodeMenu
          label="Agent settings"
          onClose={close}
          items={[
            { label: 'Rename', onSelect: onRename },
            { label: 'Delete', danger: true, onSelect: () => setOpen('delete') },
          ]}
        />
      ) : null}
      {open === 'delete' ? (
        <div className={`${controls.menu} ${styles.confirm}`} role="alertdialog" aria-labelledby="agent-delete-title" aria-describedby="agent-delete-text">
          <h2 id="agent-delete-title" className={styles.confirmTitle}>
            Delete “{name}”?
          </h2>
          <p id="agent-delete-text" className={styles.confirmText}>
            Its flow, executions, and version history go with it. This can’t be undone.
          </p>
          <div className={SCOPE_CLASS} data-theme="dark" style={{ display: 'contents' }}>
            <div className={styles.confirmActions}>
              <button type="button" className="pg-btn pg-btn--secondary pg-btn--sm" onClick={close}>
                Cancel
              </button>
              <button type="button" className="pg-btn pg-btn--negative pg-btn--sm" onClick={onDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
