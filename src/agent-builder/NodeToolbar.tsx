import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Brain, Database, Lightning, PaperPlaneTilt, type Icon } from '@phosphor-icons/react'
import controls from '../llumen-assistant/FloatingControls.module.css'
import { NODE_DRAG_MIME, NODE_TYPES, type NodeCategoryId, type NodeTone } from './nodeCatalog'
import tones from './nodeTones.module.css'
import styles from './NodeToolbar.module.css'

type NodeGroupId = 'triggers' | 'dataFlow' | 'agents' | 'actions'

type NodeGroup = {
  id: NodeGroupId
  title: string
  description: string
  icon: Icon
  tone: NodeTone
  /** Catalog categories listed in this group's panel, in order. Annotations live on the sticky note tool. */
  categories: readonly NodeCategoryId[]
}

const NODE_GROUPS: readonly NodeGroup[] = [
  {
    id: 'triggers',
    title: 'Triggers',
    description: 'Initiate the workflow from defined start points',
    icon: Lightning,
    tone: 'trigger',
    categories: ['triggers'],
  },
  {
    id: 'dataFlow',
    title: 'Data & Flow',
    description: 'Fetch data and control execution paths',
    icon: Database,
    tone: 'data',
    categories: ['dataFlow'],
  },
  {
    id: 'agents',
    title: 'Agents',
    description: 'Perform general and specialized AI tasks',
    icon: Brain,
    tone: 'analysis',
    categories: ['analysisAgents'],
  },
  {
    id: 'actions',
    title: 'Actions',
    description: 'Generate output content and execute external operations',
    icon: PaperPlaneTilt,
    tone: 'action',
    categories: ['outputAgents', 'actions'],
  },
]

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
 * Click a card to add it, or drag it onto the canvas.
 */
export function NodeToolbar({ className, usedTypes, panelContainer, onAdd }: NodeToolbarProps) {
  const [groupId, setGroupId] = useState<NodeGroupId | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const group = NODE_GROUPS.find((item) => item.id === groupId)
  const types = group ? group.categories.flatMap((id) => NODE_TYPES.filter((type) => type.category === id)) : []
  const close = () => setGroupId(null)

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
        Insert:
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
            onClick={() => setGroupId((current) => (current === item.id ? null : item.id))}
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
              <h3 className={styles.panelTitle}>{group.title}</h3>
              <p className={styles.panelDescription}>{group.description}</p>
            </header>
            <div className={styles.scroll} data-native-scroll>
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
                      onClick={() => {
                        onAdd(type.id)
                        close()
                      }}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(NODE_DRAG_MIME, type.id)
                        event.dataTransfer.effectAllowed = 'copy'
                      }}
                      onDragEnd={close}
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
