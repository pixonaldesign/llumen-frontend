import { useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import { ArrowLeft, MagnifyingGlass, Warning, X } from '@phosphor-icons/react'
import { NODE_DRAG_MIME, type NodeType, type PortSide } from './nodeCatalog'
import { groupTypes, matchesQuery, NODE_GROUPS, quickTypes, type NodeGroupId } from './nodeGroups'
import { useDismiss } from './useDismiss'
import tones from './nodeTones.module.css'
import styles from './InsertNodePanel.module.css'

const EDGE = 12

/** Beside a dropped line, where the new node will sit, or docked to a toolbar that places it. */
type InsertNodePlacement =
  | {
      /** The edge nearest the line, in the canvas's screen space: the panel opens away from it; its middle for `both`. */
      x: number
      top: number
      /** The side the new node is wired on: `in` when the line comes from an output, `both` when it goes into a line. */
      connectsOn: PortSide | 'both'
    }
  | { x?: undefined; top?: undefined; connectsOn?: undefined }

type InsertNodePanelProps = InsertNodePlacement & {
  /** Singleton node types that are already on the canvas. */
  usedTypes: ReadonlySet<string>
  /** The button that toggles a docked panel; pressing it isn't a click outside. */
  anchorRef?: RefObject<HTMLElement | null>
  onPick: (typeId: string) => void
  onClose: () => void
  /** Asked on press, before a drag can start, to render the card a row's node will be; `null` once it's done. */
  onDragPrepare?: (typeId: string | null) => void
  /** That card, used as the drag image. */
  dragImage?: () => HTMLElement | null
}

/** Picks a node to add: search, the four groups, then every node grouped by them. */
export function InsertNodePanel({ x, top, connectsOn, usedTypes, anchorRef, onPick, onClose, onDragPrepare, dragImage }: InsertNodePanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [groupId, setGroupId] = useState<NodeGroupId | null>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const docked = x === undefined
  useDismiss(true, ref, onClose, anchorRef)

  /** Why a node can't be added here, or null when it can. */
  const unavailable = (type: NodeType) => {
    if (type.singleton && usedTypes.has(type.id)) return 'Already on the canvas'
    if ((connectsOn === 'in' || connectsOn === 'both') && type.inputs.length === 0) return 'Starts a flow, so nothing can lead into it'
    if ((connectsOn === 'out' || connectsOn === 'both') && type.outputs.length === 0) return 'Ends a flow, so it can’t lead into another node'
    return null
  }
  const groups = NODE_GROUPS.map((group) => ({ group, types: groupTypes(group) }))
  const picked = groups.find((entry) => entry.group.id === groupId)
  const search = query.trim().toLowerCase()
  const quick = picked || search ? [] : [{ id: 'quick', title: 'Quick actions', types: quickTypes() }]
  const sections = [
    ...quick,
    ...(picked ? [picked] : groups)
      .map(({ group, types }) => ({ id: group.id, title: group.title, types: types.filter((type) => matchesQuery(type, search)) }))
      .filter((entry) => entry.types.length > 0),
  ]
  // A node can be listed twice (in quick actions and in its group), so a row is its section and its type.
  const rowKey = (sectionId: string, type: NodeType) => `${sectionId}:${type.id}`
  const flat = sections.flatMap((section) => section.types.filter((type) => !unavailable(type)).map((type) => ({ key: rowKey(section.id, type), type })))
  const current = Math.min(active, flat.length - 1)

  // Stays inside the canvas: shifted in from its edges once its size is known.
  useLayoutEffect(() => {
    const element = ref.current
    const parent = element?.offsetParent as HTMLElement | null
    if (!element || !parent || x === undefined) return
    const left = connectsOn === 'in' ? x : connectsOn === 'both' ? x - element.offsetWidth / 2 : x - element.offsetWidth
    element.style.left = `${Math.max(EDGE, Math.min(left, parent.clientWidth - element.offsetWidth - EDGE))}px`
    element.style.top = `${Math.max(EDGE, Math.min(top, parent.clientHeight - element.offsetHeight - EDGE))}px`
  }, [x, top, connectsOn])

  // Follows the arrow keys only, so the list opens at the top even when the first rows are unavailable.
  const keyedRef = useRef(false)
  useLayoutEffect(() => {
    if (!keyedRef.current) return
    keyedRef.current = false
    ref.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      keyedRef.current = true
      setActive((current + step + flat.length) % Math.max(flat.length, 1))
    } else if (event.key === 'Enter' && flat[current]) {
      event.preventDefault()
      onPick(flat[current].type.id)
    } else if (event.key === 'Backspace' && !query && picked) {
      setGroupId(null)
    }
  }

  const choose = (id: NodeGroupId | null) => {
    setGroupId(id)
    setActive(0)
  }

  return (
    <div
      ref={ref}
      className={docked ? `${styles.panel} ${styles.docked}` : styles.panel}
      style={docked ? undefined : { left: x, top }}
      role="dialog"
      aria-label="Add node"
      data-covers-canvas="picker"
    >
      <header className={styles.head}>
        <h3 className={styles.title}>Add node</h3>
        <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
          <X size={18} aria-hidden />
        </button>
      </header>

      <label className={styles.search}>
        <MagnifyingGlass size={18} aria-hidden />
        <input
          autoFocus
          className={styles.searchInput}
          value={query}
          placeholder="Search for nodes"
          aria-label="Search for nodes"
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
      </label>

      {picked ? (
        <button type="button" className={styles.back} onClick={() => choose(null)}>
          <ArrowLeft size={16} aria-hidden />
          {picked.group.title}
        </button>
      ) : (
        <div className={styles.tabs} role="group" aria-label="Categories">
          {groups.map(({ group }) => {
            const GroupIcon = group.icon
            return (
              <button key={group.id} type="button" className={`${styles.tab} ${tones[`tone_${group.tone}`]}`} onClick={() => choose(group.id)}>
                <GroupIcon size={16} className={styles.tabIcon} aria-hidden />
                {group.title}
              </button>
            )
          })}
        </div>
      )}

      <div className={styles.scroll} data-native-scroll role="listbox" aria-label="Nodes">
        {sections.length === 0 ? <p className={styles.empty}>No nodes match “{query.trim()}”</p> : null}
        {sections.map((section) => (
          <section key={section.id} className={styles.section} aria-label={section.title}>
            {picked ? null : <p className={styles.sectionLabel}>{section.title}</p>}
            {section.types.map((type) => {
              const TypeIcon = type.icon
              const key = rowKey(section.id, type)
              const isActive = flat[current]?.key === key
              const reason = unavailable(type)
              return (
                <button
                  key={type.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  aria-disabled={Boolean(reason)}
                  disabled={Boolean(reason)}
                  className={styles.row}
                  data-active={isActive || undefined}
                  draggable={docked && !reason}
                  onPointerMove={reason ? undefined : () => setActive(flat.findIndex((row) => row.key === key))}
                  onPointerDown={docked && !reason ? () => onDragPrepare?.(type.id) : undefined}
                  onClick={() => {
                    onDragPrepare?.(null)
                    onPick(type.id)
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(NODE_DRAG_MIME, type.id)
                    event.dataTransfer.effectAllowed = 'copy'
                    const card = dragImage?.()
                    if (!card) return
                    const rect = card.getBoundingClientRect()
                    event.dataTransfer.setDragImage(card, rect.width / 2, rect.height / 2)
                  }}
                  onDragEnd={() => onDragPrepare?.(null)}
                >
                  <span className={`${styles.rowIcon} ${tones[`tone_${type.tone}`]}`} aria-hidden>
                    <TypeIcon size={18} />
                  </span>
                  <span className={styles.rowCopy}>
                    <span className={styles.rowTitle}>{type.title}</span>
                    <span className={styles.rowDescription}>{type.description}</span>
                    {reason ? (
                      <span className={styles.rowWarning}>
                        <Warning size={12} weight="fill" aria-hidden />
                        {reason}
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}
