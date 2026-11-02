import { useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { BracketsCurly, BracketsSquare, CaretRight, Circle, Hash, TextT, ToggleLeft, type Icon } from '@phosphor-icons/react'
import { fieldKind, fieldToken, isObject, type FieldKind } from './fieldPaths'
import type { DataRecord } from './nodeCatalog'
import tones from './nodeTones.module.css'
import styles from './FieldTree.module.css'

type FieldNode = {
  key: string
  path: string
  kind: FieldKind
  sample?: string
  children: FieldNode[]
}

/** One top-level entry: an upstream node and what it sent. */
export type TreeSource = {
  id: string
  name: string
  icon: Icon
  tone: string
  records: readonly DataRecord[] | null
  /** Prepended to a field's path in its token, `{{prefix.path}}`; null for the rows coming straight in. */
  prefix: string | null
  /** Open when the tree first shows. */
  open: boolean
}

/** Rows read for the field list; later rows only add fields the first ones lacked. */
const SCAN_ROWS = 50

const KIND_ICONS: Record<FieldKind, Icon> = {
  string: TextT,
  number: Hash,
  boolean: ToggleLeft,
  null: Circle,
  object: BracketsCurly,
  array: BracketsSquare,
}
const KIND_LABELS: Record<FieldKind, string> = {
  string: 'Text',
  number: 'Number',
  boolean: 'Boolean',
  null: 'Empty',
  object: 'Object',
  array: 'List',
}

type FieldChipProps = {
  name: string
  kind: FieldKind
  token: string
  /** The tighter chip for JSON lines and table headers. */
  small?: boolean
  onDragChange?: (dragging: boolean) => void
}

/** A field's name and type that drags its `{{…}}` token as plain text, so any text field takes it at the caret. */
export function FieldChip({ name, kind, token, small = false, onDragChange }: FieldChipProps) {
  const KindIcon = KIND_ICONS[kind]
  const onDragStart = (event: DragEvent<HTMLSpanElement>) => {
    event.dataTransfer.setData('text/plain', token)
    event.dataTransfer.effectAllowed = 'copy'
    onDragChange?.(true)
  }
  return (
    <span
      className={small ? `${styles.chip} ${styles.chipSmall}` : styles.chip}
      draggable
      title={`Drag ${token} into a field`}
      onDragStart={onDragStart}
      onDragEnd={() => onDragChange?.(false)}
    >
      <KindIcon className={styles.chipIcon} size={small ? 12 : 13} weight="bold" aria-label={KIND_LABELS[kind]} />
      <span className={styles.chipName}>{name}</span>
    </span>
  )
}
const plural = (count: number, word: string) => `${count.toLocaleString()} ${count === 1 ? word : `${word}s`}`

const entriesOf = (value: unknown): [string, unknown][] =>
  Array.isArray(value) ? value.map((item, index) => [String(index), item]) : isObject(value) ? Object.entries(value) : []

type ValueTreeProps = {
  /** An object or list from one row. */
  value: unknown
  /** Where the value sits in the row, e.g. `address`; its keys extend it. */
  path: string
  prefix: string | null
  onDragChange?: (dragging: boolean) => void
}

/** One row's object or list, its keys as chips beside their values; nested ones open in place. */
export function ValueTree({ value, path, prefix, onDragChange }: ValueTreeProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const rows = (parent: unknown, parentPath: string, depth: number): ReactNode =>
    entriesOf(parent).map(([key, child]) => {
      const childPath = `${parentPath}.${key}`
      const kind = fieldKind(child)
      const size = entriesOf(child).length
      const expanded = open.has(childPath)
      return (
        <li key={childPath} className={styles.item} aria-expanded={size ? expanded : undefined}>
          <div className={`${styles.fieldRow} ${styles.valueRow}`} style={{ '--depth': depth } as CSSProperties}>
            {size ? (
              <button type="button" className={styles.caret} aria-label={expanded ? `Collapse ${key}` : `Expand ${key}`} onClick={() => toggle(childPath)}>
                <CaretRight size={12} weight="bold" aria-hidden />
              </button>
            ) : null}
            <FieldChip name={key} kind={kind} token={fieldToken(prefix, childPath)} small onDragChange={onDragChange} />
            {kind === 'array' && size ? (
              <span className={styles.value}>{plural(size, 'item')}</span>
            ) : size ? null : (
              <span className={styles.value}>{sampleText(child) ?? (kind === 'array' ? 'Empty list' : '—')}</span>
            )}
          </div>
          {size && expanded ? <ul className={styles.list}>{rows(child, childPath, depth + 1)}</ul> : null}
        </li>
      )
    })

  return <ul className={`${styles.list} ${styles.valueTree}`}>{rows(value, path, 0)}</ul>
}

function sampleText(value: unknown) {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return undefined
}

/** Adds a value under `segments`; a dotted key like `workflow.name` nests the same way an object does. */
function insert(nodes: FieldNode[], segments: readonly string[], parent: string, value: unknown) {
  const [key, ...rest] = segments
  const path = parent ? `${parent}.${key}` : key
  let node = nodes.find((item) => item.key === key)
  if (!node) {
    node = { key, path, kind: 'null', children: [] }
    nodes.push(node)
  }
  if (rest.length > 0) {
    node.kind = 'object'
    insert(node.children, rest, path, value)
  } else absorb(node, value)
}

function absorb(node: FieldNode, value: unknown) {
  if (isObject(value)) {
    node.kind = 'object'
    for (const [key, child] of Object.entries(value)) insert(node.children, key.split('.'), node.path, child)
  } else if (Array.isArray(value)) {
    node.kind = 'array'
    node.sample ??= value.length ? plural(value.length, 'item') : undefined
    // A list of objects opens onto the first one's fields, addressed as `list.0.field`.
    const first = value.find(isObject)
    if (first) for (const [key, child] of Object.entries(first)) insert(node.children, key.split('.'), `${node.path}.0`, child)
  } else if (value !== null && value !== undefined) {
    if (node.kind === 'null') node.kind = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string'
    node.sample ??= sampleText(value)
  }
}

function fieldTree(records: readonly DataRecord[]): FieldNode[] {
  const nodes: FieldNode[] = []
  for (const record of records.slice(0, SCAN_ROWS)) {
    for (const [key, value] of Object.entries(record)) insert(nodes, key.split('.'), '', value)
  }
  return nodes
}

/** Keeps fields whose name matches, and the parents of any that do. */
function filterTree(nodes: readonly FieldNode[], needle: string): FieldNode[] {
  if (!needle) return [...nodes]
  return nodes.flatMap((node) => {
    if (node.key.toLowerCase().includes(needle)) return [node]
    const children = filterTree(node.children, needle)
    return children.length ? [{ ...node, children }] : []
  })
}

type FieldTreeProps = {
  sources: readonly TreeSource[]
  /** One source's fields without the node row above them. */
  flat?: boolean
  query?: string
  onDragChange?: (dragging: boolean) => void
}

/**
 * Upstream fields as chips, nested the way the data is. A chip drags its `{{…}}` token as plain text,
 * so any text field takes it at the caret.
 */
export function FieldTree({ sources, flat = false, query = '', onDragChange }: FieldTreeProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(sources.filter((source) => source.open).map((source) => source.id)))
  const needle = query.trim().toLowerCase()
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const isOpen = (key: string) => Boolean(needle) || open.has(key)

  /** `spaced` keeps a caret's width before chips that don't open, so they line up with ones that do. */
  const fieldRows = (source: TreeSource, nodes: readonly FieldNode[], depth: number, spaced: boolean): ReactNode =>
    nodes.map((node) => {
      const key = `${source.id}:${node.path}`
      const expandable = node.children.length > 0
      return (
        <li key={key} className={styles.item} role="treeitem" aria-expanded={expandable ? isOpen(key) : undefined}>
          <div className={styles.fieldRow} style={{ '--depth': depth } as CSSProperties}>
            {expandable ? (
              <button
                type="button"
                className={styles.caret}
                aria-label={isOpen(key) ? `Collapse ${node.key}` : `Expand ${node.key}`}
                onClick={() => toggle(key)}
              >
                <CaretRight size={12} weight="bold" aria-hidden />
              </button>
            ) : spaced ? (
              <span className={styles.caretSpace} aria-hidden />
            ) : null}
            <FieldChip name={node.key} kind={node.kind} token={fieldToken(source.prefix, node.path)} onDragChange={onDragChange} />
            {node.sample !== undefined ? (
              <span className={styles.sample} title={node.sample}>
                {node.sample}
              </span>
            ) : null}
          </div>
          {expandable && isOpen(key) ? (
            <ul className={styles.list} role="group">
              {fieldRows(source, node.children, depth + 1, true)}
            </ul>
          ) : null}
        </li>
      )
    })

  /** Under a node row the fields line up with its name; on their own they start at the column's edge. */
  const fieldsOf = (source: TreeSource, nested: boolean) => {
    const note = nested ? `${styles.note} ${styles.noteNested}` : styles.note
    if (!source.records) return <p className={note}>Not run yet. Execute the previous nodes to see its fields.</p>
    const nodes = filterTree(fieldTree(source.records), needle)
    if (nodes.length === 0) return <p className={note}>{needle ? `No field matches “${query.trim()}”.` : 'It sent no fields.'}</p>
    return (
      <ul
        className={nested ? `${styles.list} ${styles.sourceFields}` : styles.list}
        role={nested ? 'group' : 'tree'}
        aria-label={nested ? undefined : `${source.name} fields`}
      >
        {fieldRows(source, nodes, 0, nested || nodes.some((node) => node.children.length > 0))}
      </ul>
    )
  }

  if (flat && sources[0]) return <div className={styles.tree}>{fieldsOf(sources[0], false)}</div>

  const shown = needle ? sources.filter((source) => source.records && filterTree(fieldTree(source.records), needle).length > 0) : sources
  if (shown.length === 0) {
    return (
      <div className={styles.tree}>
        <p className={styles.note}>No field matches “{query.trim()}”.</p>
      </div>
    )
  }
  return (
    <div className={styles.tree}>
      <ul className={styles.list} role="tree" aria-label="Upstream nodes">
        {shown.map((source) => {
          const SourceIcon = source.icon
          const expanded = isOpen(source.id)
          return (
            <li key={source.id} className={styles.item} role="treeitem" aria-expanded={expanded}>
              <button type="button" className={styles.sourceRow} onClick={() => toggle(source.id)}>
                <CaretRight className={styles.sourceCaret} size={12} weight="bold" aria-hidden />
                <span className={`${styles.sourceIcon} ${tones[`tone_${source.tone}`]}`} aria-hidden>
                  <SourceIcon size={16} weight="duotone" />
                </span>
                <span className={styles.sourceName}>{source.name}</span>
                <span className={styles.sourceMeta}>{source.records ? plural(source.records.length, 'item') : 'Not run'}</span>
              </button>
              {expanded ? fieldsOf(source, true) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
