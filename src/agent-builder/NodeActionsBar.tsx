import { useCallback, useRef, useState } from 'react'
import { CircleNotch, DotsThree, GearSix, Palette, Play } from '@phosphor-icons/react'
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
  appearanceOpen: boolean
  onRun: (scope: RunScope) => void
  onConfigure: () => void
  /** Omitted while the development tools are off, which hides the appearance button. */
  onAppearance?: () => void
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
  appearanceOpen,
  onRun,
  onConfigure,
  onAppearance,
  onDuplicate,
  onDelete,
}: NodeActionsBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  useDismiss(menuOpen, ref, closeMenu)

  const menuItems: NodeMenuItem[] = [
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
              onClick={() => onRun(isTrigger ? 'downstream' : 'node')}
            >
              {running ? <CircleNotch size={18} weight="bold" className={styles.spin} aria-hidden /> : <Play size={18} weight="fill" aria-hidden />}
              {isTrigger ? testLabel : null}
            </button>
            <button type="button" className={controls.barButton} aria-label={`Configure ${name}`} data-tooltip="Configure" onClick={onConfigure}>
              <GearSix size={18} aria-hidden />
            </button>
          </>
        )}
        {onAppearance ? (
          <button
            type="button"
            className={`${controls.barButton}${appearanceOpen ? ` ${controls.barButtonActive}` : ''}`}
            aria-label="Appearance"
            aria-pressed={appearanceOpen}
            data-tooltip="Appearance"
            data-appearance-toggle
            onPointerDown={(event) => {
              if (event.button === 0) onAppearance()
            }}
            onClick={(event) => {
              if (event.detail === 0) onAppearance()
            }}
          >
            <Palette size={18} aria-hidden />
          </button>
        ) : null}
        {annotation && !onAppearance ? null : <span className={controls.barDivider} aria-hidden />}
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
