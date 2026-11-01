import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MagnifyingGlass } from '@phosphor-icons/react'
import controls from '../llumen-assistant/FloatingControls.module.css'
import { NODE_DRAG_MIME } from './nodeCatalog'
import { groupTypes, matchesQuery, NODE_GROUPS, type NodeGroupId } from './nodeGroups'
import tones from './nodeTones.module.css'
import styles from './NodeToolbar.module.css'

type NodeToolbarProps = {
  className?: string
  /** Singleton node types that are already on the canvas. */
  usedTypes: ReadonlySet<string>
  /**
   * Where the panel renders: outside the toolbar, whose backdrop-filter would stop the panel's
   * own blur from seeing the canvas. Must be positioned; the panel centres on it, just above.
   */
  panelContainer: HTMLElement | null
  onAdd: (typeId: string) => void
}

/**
 * One button per node group. Clicking a button opens that group's nodes in a card grid above the
 * toolbar; clicking another swaps the panel, and clicking it again or anywhere outside closes it.
 * Click a card to add it, or drag it onto the canvas; the panel stays open for adding more.
 */
export function NodeToolbar({ className, usedTypes, panelContainer, onAdd }: NodeToolbarProps) {
  const [groupId, setGroupId] = useState<NodeGroupId | null>(null)
  const [query, setQuery] = useState('')
  const toolbarRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const group = NODE_GROUPS.find((item) => item.id === groupId)
  const search = query.trim().toLowerCase()
  const types = group ? groupTypes(group).filter((type) => matchesQuery(type, search)) : []
  const toggleGroup = (id: NodeGroupId) => {
    setGroupId((current) => (current === id ? null : id))
    setQuery('')
  }

  useEffect(() => {
    if (!groupId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGroupId(null)
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!toolbarRef.current?.contains(target) && !panelRef.current?.contains(target)) setGroupId(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [groupId])

  return (
    <div ref={toolbarRef} className={`${controls.bar} ${styles.toolbar}${className ? ` ${className}` : ''}`} role="toolbar" aria-label="Add nodes">
      <span className={styles.label} aria-hidden>
        Add
      </span>
      {NODE_GROUPS.map((item) => {
        const GroupIcon = item.icon
        const active = item.id === groupId
        return (
          <button
            key={item.id}
            type="button"
            className={`${styles.group}${active ? ` ${styles.groupActive}` : ''}`}
            aria-haspopup="true"
            aria-expanded={active}
            onClick={() => toggleGroup(item.id)}
          >
            <span className={`${styles.groupIcon} ${tones[`tone_${item.tone}`]}`} aria-hidden>
              <GroupIcon size={16} weight="bold" />
            </span>
            {item.title}
          </button>
        )
      })}

      {group && panelContainer ? createPortal(
        <div ref={panelRef} className={styles.flyout}>
          <section className={styles.panel} aria-label={`${group.title} nodes`}>
            <header className={styles.panelHead}>
              <div className={styles.panelCopy}>
                <h3 className={styles.panelTitle}>{group.title}</h3>
                <p className={styles.panelDescription}>{group.description}</p>
              </div>
              <label className={styles.search}>
                <MagnifyingGlass size={14} aria-hidden />
                <input
                  // Remount per group so focus lands in the field each time a panel opens.
                  key={group.id}
                  autoFocus
                  className={styles.searchInput}
                  value={query}
                  placeholder={`Search ${group.title}…`}
                  aria-label={`Search ${group.title} nodes`}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </header>
            <div className={styles.scroll} data-native-scroll>
              {types.length === 0 ? <p className={styles.empty}>No nodes match “{query.trim()}”</p> : null}
              <div className={styles.grid}>
                {types.map((type) => {
                  const TypeIcon = type.icon
                  const used = Boolean(type.singleton && usedTypes.has(type.id))
                  return (
                    <button
                      key={type.id}
                      type="button"
                      className={styles.card}
                      disabled={used}
                      draggable={!used}
                      onClick={() => onAdd(type.id)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(NODE_DRAG_MIME, type.id)
                        event.dataTransfer.effectAllowed = 'copy'
                      }}
                    >
                      <span className={`${styles.cardIcon} ${tones[`tone_${type.tone}`]}`} aria-hidden>
                        <TypeIcon size={20} weight="regular" />
                      </span>
                      <span className={styles.cardTitle}>{type.title}</span>
                      <span className={styles.cardDescription}>{used ? 'Already on the canvas' : type.description}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>
        </div>,
        panelContainer,
      ) : null}
    </div>
  )
}
