import { useCallback, useRef, useState } from 'react'
import { CircleNotch, DotsThree, GearSix, Play } from '@phosphor-icons/react'
import controls from '../llumen-assistant/FloatingControls.module.css'
import { NodeMenu, type NodeMenuItem, type RunScope } from './nodeParts'
import { useDismiss } from './useDismiss'
import styles from './CanvasItems.module.css'

type NodeActionsBarProps = {
  name: string
  /** Screen position of the toolbar's bottom-centre anchor, or its top-centre when `below`. */
  left: number
  top: number
  /** Under the node, when there's no room above it. */
  below?: boolean
  isTrigger: boolean
  /** A trigger's test button text; defaults to Test run. */
  testLabel?: string
  annotation: boolean
  canDuplicate: boolean
  running: boolean
  onRun: (scope: RunScope) => void
  onConfigure: () => void
  onDuplicate: () => void
  onDelete: () => void
}

/** FigJam-style toolbar floating above the hovered node; screen space, so it keeps its size at any zoom. */
export function NodeActionsBar({
  name,
  left,
  top,
  below = false,
  isTrigger,
  testLabel = 'Test run',
  annotation,
  canDuplicate,
  running,
  onRun,
  onConfigure,
  onDuplicate,
  onDelete,
}: NodeActionsBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  useDismiss(menuOpen, ref, closeMenu)

  const run = () => onRun(isTrigger ? 'downstream' : 'node')
  // The menu repeats the bar's buttons, so every action is in one list.
  const menuItems: NodeMenuItem[] = [
    ...(annotation
      ? []
      : [
          { label: isTrigger ? testLabel : 'Run this node', disabled: running, onSelect: run },
          { label: 'Configure', onSelect: onConfigure },
        ]),
    ...(canDuplicate ? [{ label: 'Duplicate', onSelect: onDuplicate }] : []),
    { label: 'Delete', danger: true, onSelect: onDelete },
  ]

  return (
    <div className={styles.nodeBar} ref={ref} style={{ left, top }} data-node-toolbar data-below={below || undefined}>
      <div className={styles.floatingBar} role="toolbar" aria-label={`${name} actions`}>
        {annotation ? null : (
          <>
            <button
              type="button"
              className={isTrigger ? `${controls.barButton} ${styles.sizeButton}` : controls.barButton}
              aria-label={isTrigger ? testLabel : `Run ${name}`}
              data-tooltip={isTrigger ? undefined : 'Run this node'}
              disabled={running}
              onClick={run}
            >
              {running ? <CircleNotch size={18} weight="bold" className={styles.spin} aria-hidden /> : <Play size={18} weight="fill" aria-hidden />}
              {isTrigger ? testLabel : null}
            </button>
            <button type="button" className={controls.barButton} aria-label={`Configure ${name}`} data-tooltip="Configure" onClick={onConfigure}>
              <GearSix size={18} aria-hidden />
            </button>
            <span className={controls.barDivider} aria-hidden />
          </>
        )}
        <button
          type="button"
          className={`${controls.barButton}${menuOpen ? ` ${controls.barButtonActive}` : ''}`}
          aria-label={`${name} options`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <DotsThree size={20} weight="bold" aria-hidden />
        </button>
      </div>
      {/* Outside the bar: its backdrop-filter would stop the menu's own blur from seeing the canvas. */}
      {menuOpen ? <NodeMenu label={`${name} options`} items={menuItems} onClose={closeMenu} /> : null}
    </div>
  )
}
