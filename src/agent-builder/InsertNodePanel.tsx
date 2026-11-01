import { useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ArrowLeft, MagnifyingGlass, X } from '@phosphor-icons/react'
import type { NodeType, PortSide } from './nodeCatalog'
import { groupTypes, matchesQuery, NODE_GROUPS, type NodeGroupId } from './nodeGroups'
import { useDismiss } from './useDismiss'
import tones from './nodeTones.module.css'
import styles from './InsertNodePanel.module.css'

const EDGE = 12

type InsertNodePanelProps = {
  /** The edge nearest the line, in the canvas's screen space: the panel opens away from it, where the new node will sit. */
  x: number
  top: number
  /** The side the new node is wired on: `in` when the line comes from an output. */
  connectsOn: PortSide
  /** Singleton node types that are already on the canvas. */
  usedTypes: ReadonlySet<string>
  onPick: (typeId: string) => void
  onClose: () => void
}

/** Picks the node a dropped line connects to: search, the four groups, then every node grouped by them. */
export function InsertNodePanel({ x, top, connectsOn, usedTypes, onPick, onClose }: InsertNodePanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [groupId, setGroupId] = useState<NodeGroupId | null>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  useDismiss(true, ref, onClose)

  /** Why a node can't take this line, or null when it can. */
  const unavailable = (type: NodeType) => {
    if (type.singleton && usedTypes.has(type.id)) return 'Already on the canvas'
    if (connectsOn === 'in' && type.inputs.length === 0) return 'Starts a flow, so nothing can lead into it'
    if (connectsOn === 'out' && type.outputs.length === 0) return 'Ends a flow, so it can’t lead into another node'
    return null
  }
  const groups = NODE_GROUPS.map((group) => ({ group, types: groupTypes(group) }))
  const picked = groups.find((entry) => entry.group.id === groupId)
  const search = query.trim().toLowerCase()
  const sections = (picked ? [picked] : groups)
    .map((entry) => ({ ...entry, types: entry.types.filter((type) => matchesQuery(type, search)) }))
    .filter((entry) => entry.types.length > 0)
  const flat = sections.flatMap((entry) => entry.types).filter((type) => !unavailable(type))
  const current = Math.min(active, flat.length - 1)

  // Stays inside the canvas: shifted in from its edges once its size is known.
  useLayoutEffect(() => {
    const element = ref.current
    const parent = element?.offsetParent as HTMLElement | null
    if (!element || !parent) return
    const left = connectsOn === 'in' ? x : x - element.offsetWidth
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
      onPick(flat[current].id)
    } else if (event.key === 'Backspace' && !query && picked) {
      setGroupId(null)
    }
  }

  const choose = (id: NodeGroupId | null) => {
    setGroupId(id)
    setActive(0)
  }

  return (
    <div ref={ref} className={styles.panel} style={{ left: x, top }} role="dialog" aria-label="Add node">
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
        {sections.map(({ group, types }) => (
          <section key={group.id} className={styles.section} aria-label={group.title}>
            {picked ? null : <p className={styles.sectionLabel}>{group.title}</p>}
            {types.map((type) => {
              const TypeIcon = type.icon
              const isActive = flat[current] === type
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
                  onPointerMove={reason ? undefined : () => setActive(flat.indexOf(type))}
                  onClick={() => onPick(type.id)}
                >
                  <span className={`${styles.rowIcon} ${tones[`tone_${type.tone}`]}`} aria-hidden>
                    <TypeIcon size={18} />
                  </span>
                  <span className={styles.rowCopy}>
                    <span className={styles.rowTitle}>{type.title}</span>
                    <span className={styles.rowDescription}>{reason ?? type.description}</span>
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
