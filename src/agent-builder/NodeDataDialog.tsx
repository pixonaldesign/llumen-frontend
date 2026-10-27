import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { nodeDataSides, nodeDataViews, type DataSide } from './cardSections'
import { nodeName, type CanvasNode, type DataRecord, type DataValue, type NodeRun, type NodeType } from './nodeCatalog'
import controls from '../llumen-assistant/FloatingControls.module.css'
import styles from './NodeDataDialog.module.css'
import tones from './nodeTones.module.css'

/** The node's box in the canvas root's coordinates. */
export type NodeDataAnchor = { left: number; top: number; right: number; bottom: number }

/** Gap to the node, and the margin kept from the canvas edges. */
const GAP = 12
const EDGE = 16
/** The widest node toolbar; it keeps its size when zoomed out, so it can overhang a small node's sides. */
const TOOLBAR_WIDTH = 240
const SIDE_LABELS: Record<DataSide, string> = { input: 'Input', output: 'Output' }

const rowCount = (count: number) => `${count} ${count === 1 ? 'row' : 'rows'}`

const valueType = (value: DataValue) => (value === null ? 'null' : typeof value)

/** Every field across the rows, typed by all the values it holds, e.g. `number | null`. */
function schemaOf(records: readonly DataRecord[]) {
  const fields = new Map<string, Set<string>>()
  for (const record of records) {
    for (const [name, value] of Object.entries(record)) {
      const types = fields.get(name) ?? new Set<string>()
      types.add(valueType(value))
      fields.set(name, types)
    }
  }
  return [...fields].map(([name, types]) => ({ name, type: [...types].join(' | ') }))
}

type NodeDataDialogProps = {
  node: CanvasNode
  type: NodeType
  run: NodeRun
  input: readonly DataRecord[] | null
  output: readonly DataRecord[] | null
  anchor: NodeDataAnchor
  /** Heights of the top and bottom chrome to stay between. */
  clearTop: number
  clearBottom: number
  onClose: () => void
}

/** A node's input or output schema, beside the node; the canvas stays usable while it's open. */
export function NodeDataDialog({ node, type, run, input, output, anchor, clearTop, clearBottom, onClose }: NodeDataDialogProps) {
  const windowRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const TypeIcon = type.icon
  const hasInputs = type.inputs.length > 0
  const views = nodeDataViews(run, input, output, type.category === 'triggers', hasInputs)
  const available = nodeDataSides(views, hasInputs)
  const sides: readonly DataSide[] = available.length ? available : ['output']
  const [chosen, setChosen] = useState<DataSide>(sides.includes('output') ? 'output' : sides[0])
  const side = sides.includes(chosen) ? chosen : sides[0]
  const [query, setQuery] = useState('')

  const view = views[side]
  const records = view.records ?? []
  const fields = schemaOf(records)
  const needle = query.trim().toLowerCase()
  const shown = needle ? fields.filter((field) => `${field.name} ${field.type}`.toLowerCase().includes(needle)) : fields
  /** Kept while either side has fields, so switching sides doesn't move the tabs. */
  const searchable = sides.some((option) => schemaOf(views[option].records ?? []).length > 0)

  /**
   * Right of the node, or left when that runs off the canvas; written to the DOM so it tracks pans without a flash.
   * Held between the top and bottom chrome. It only rises above the node's top, where the node toolbar sits,
   * while it's beside the node; when it has to overlap the node it stays below that top.
   */
  useLayoutEffect(() => {
    const element = windowRef.current
    const parent = element?.offsetParent as HTMLElement | null
    if (!element || !parent) return
    const width = element.offsetWidth
    const height = element.offsetHeight
    const gap = Math.max(GAP, (TOOLBAR_WIDTH - (anchor.right - anchor.left)) / 2 + GAP / 2)
    const maxLeft = parent.clientWidth - EDGE - width
    const right = anchor.right + gap
    const leftSide = anchor.left - gap - width
    const beside = right <= maxLeft || leftSide >= EDGE
    const left = right <= maxLeft ? right : leftSide >= EDGE ? leftSide : Math.max(EDGE, Math.min(maxLeft, right))
    const lowest = parent.clientHeight - clearBottom - height
    const top = Math.max(clearTop, beside ? Math.min(anchor.top, lowest) : anchor.top)
    element.style.left = `${left}px`
    element.style.top = `${top}px`
  }, [anchor.left, anchor.top, anchor.right, anchor.bottom, clearTop, clearBottom])

  useEffect(() => {
    windowRef.current?.focus({ preventScroll: true })
  }, [])

  /** Presses on its own node or toolbar are left to their buttons, which toggle it. */
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element
      if (windowRef.current?.contains(target) || target.closest(`[data-node-id="${node.id}"], [data-node-toolbar]`)) return
      onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose()
    }
    document.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [node.id, onClose])

  const count = (target: DataSide) => (views[target].records ? rowCount(views[target].records.length) : 'Failed')

  return (
    <div
      ref={windowRef}
      className={`${styles.window} ${tones[`tone_${type.tone}`]}`}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-native-scroll
    >
      <header className={styles.head}>
        <span className={styles.headIcon} aria-hidden>
          <TypeIcon size={16} weight="fill" />
        </span>
        <h2 id={titleId} className={styles.headTitle}>
          {nodeName(node, type)}
        </h2>
        <button type="button" className={styles.close} aria-label="Close input and output" onClick={onClose}>
          <X size={14} weight="bold" aria-hidden />
        </button>
      </header>

      <div className={styles.controls}>
        {searchable ? (
          <label className={styles.search}>
            <MagnifyingGlass size={14} aria-hidden />
            <input
              className={styles.searchInput}
              value={query}
              placeholder="Search fields…"
              aria-label="Search fields"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        ) : null}
        {sides.length > 1 ? (
          <>
            <div className={controls.segmented} role="tablist" aria-label="Data">
              {sides.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  id={`${titleId}-${option}`}
                  aria-selected={option === side}
                  aria-controls={`${titleId}-panel`}
                  className={`${controls.segment}${option === side ? ` ${controls.segmentActive}` : ''}`}
                  onClick={() => setChosen(option)}
                >
                  {SIDE_LABELS[option]}
                </button>
              ))}
            </div>
            <p className={styles.count}>{count(side)}</p>
          </>
        ) : (
          <p className={styles.sideLabel}>
            {SIDE_LABELS[side]}
            <span className={styles.count}>{count(side)}</span>
          </p>
        )}
      </div>

      <div
        id={`${titleId}-panel`}
        className={styles.scroll}
        role={sides.length > 1 ? 'tabpanel' : 'region'}
        aria-labelledby={sides.length > 1 ? `${titleId}-${side}` : undefined}
        aria-label={sides.length > 1 ? undefined : `${SIDE_LABELS[side]} schema`}
      >
        {view.error && !view.records ? (
          <p className={`${styles.empty} ${styles.error}`}>{view.error}</p>
        ) : !fields.length ? (
          <p className={styles.empty}>{records.length ? 'These rows have no fields.' : 'No rows.'}</p>
        ) : !shown.length ? (
          <p className={styles.empty}>No fields match “{query.trim()}”.</p>
        ) : (
          <ul className={styles.schema}>
            {shown.map((field) => (
              <li key={field.name} className={styles.field}>
                <span className={styles.fieldName}>{field.name}</span>
                <span className={styles.fieldType}>{field.type}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
