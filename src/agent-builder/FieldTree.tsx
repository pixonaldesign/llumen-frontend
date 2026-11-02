import { useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { BracketsCurly, BracketsSquare, CaretRight, Circle, Hash, TextT, ToggleLeft, type Icon } from '@phosphor-icons/react'
import { fieldKind, fieldToken, fieldTree, filterTree, isObject, plural, sampleText, type FieldKind, type FieldNode } from './fieldPaths'
import type { DataRecord } from './nodeCatalog'
import tones from './nodeTones.module.css'
import styles from './FieldTree.module.css'

/** One top-level entry: an upstream node and what it sent. */
export type TreeSource = {
  id: string
  name: string
  /** Shown on the node row, which a flat tree leaves out. */
  icon?: Icon
  tone?: string
  records: readonly DataRecord[] | null
  /** Prepended to a field's path in its token, `{{prefix.path}}`; null for the rows coming straight in. */
  prefix: string | null
  /** Open when the tree first shows. */
  open: boolean
}

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
  /** What the chip drags; without one it only labels the field. */
  token?: string
  /** The tighter chip for JSON lines and table cells. */
  small?: boolean
  onDragChange?: (dragging: boolean) => void
}

/** A field's name and type that drags its `{{…}}` token as plain text, so any text field takes it at the caret. */
export function FieldChip({ name, kind, token, small = false, onDragChange }: FieldChipProps) {
  const KindIcon = KIND_ICONS[kind]
  const onDragStart = (event: DragEvent<HTMLSpanElement>) => {
    if (!token) return
    event.dataTransfer.setData('text/plain', token)
    event.dataTransfer.effectAllowed = 'copy'
    onDragChange?.(true)
  }
  return (
    <span
      className={small ? `${styles.chip} ${styles.chipSmall}` : styles.chip}
      draggable={Boolean(token)}
      title={token ? `Drag ${token} into a field` : undefined}
      onDragStart={token ? onDragStart : undefined}
      onDragEnd={token ? () => onDragChange?.(false) : undefined}
    >
      <KindIcon className={styles.chipIcon} size={small ? 12 : 13} weight="bold" aria-label={KIND_LABELS[kind]} />
      <span className={styles.chipName}>{name}</span>
    </span>
  )
}

/** A field kind's icon, as its chip shows it. */
export function FieldKindIcon({
  kind,
  size = 13,
  className,
  decorative = false,
}: {
  kind: FieldKind
  size?: number
  className?: string
  decorative?: boolean
}) {
  const KindIcon = KIND_ICONS[kind]
  return (
    <KindIcon className={className} size={size} weight="bold" aria-label={decorative ? undefined : KIND_LABELS[kind]} aria-hidden={decorative || undefined} />
  )
}

const entriesOf = (value: unknown): [string, unknown][] =>
  Array.isArray(value) ? value.map((item, index) => [String(index), item]) : isObject(value) ? Object.entries(value) : []

type ValueTreeProps = {
  /** An object or list from one row. */
  value: unknown
  /** Where the value sits in the row, e.g. `address`; its keys extend it. */
  path: string
  prefix: string | null
  draggable?: boolean
  onDragChange?: (dragging: boolean) => void
}

/** One row's object or list, its keys as chips beside their values; nested ones open in place. */
export function ValueTree({ value, path, prefix, draggable = true, onDragChange }: ValueTreeProps) {
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
            <FieldChip name={key} kind={kind} token={draggable ? fieldToken(prefix, childPath) : undefined} small onDragChange={onDragChange} />
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

type FieldTreeProps = {
  sources: readonly TreeSource[]
  /** One source's fields without the node row above them. */
  flat?: boolean
  query?: string
  /** Off for a node's own output, which nothing on its form can reference. */
  draggable?: boolean
  onDragChange?: (dragging: boolean) => void
}

/**
 * Upstream fields as chips, nested the way the data is. A chip drags its `{{…}}` token as plain text,
 * so any text field takes it at the caret.
 */
export function FieldTree({ sources, flat = false, query = '', draggable = true, onDragChange }: FieldTreeProps) {
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
            <FieldChip name={node.key} kind={node.kind} token={draggable ? fieldToken(source.prefix, node.path) : undefined} onDragChange={onDragChange} />
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
                {SourceIcon ? (
                  <span className={`${styles.sourceIcon} ${tones[`tone_${source.tone}`]}`} aria-hidden>
                    <SourceIcon size={16} weight="duotone" />
                  </span>
                ) : null}
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
