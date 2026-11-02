import { useCallback, useRef, useState, type FocusEvent } from 'react'
import { BracketsCurly, Rows, type Icon } from '@phosphor-icons/react'
import type { ConditionScope } from './conditions'
import { columnsOf, type Column } from './createAsset'
import { globalVars } from './globalVars'
import type { CanvasNode, DataRecord, NodeRun, NodeType } from './nodeCatalog'
import type { UpstreamNode } from './NodeConfigWindow'

/** What every kind's editor can read besides its own parameters. */
export type EditorContext = {
  node: CanvasNode
  type: NodeType
  run: NodeRun
  /** Rows on the wired input, or the fixture; null until the step before has run. */
  records: readonly DataRecord[] | null
  columns: readonly Column[]
  upstream: readonly UpstreamNode[]
  references: References
  hasChatTrigger: boolean
  onExecutePrevious: () => void
  /** A branch to open on, e.g. the case edited from the card. */
  focus?: string
  workflowName: string
}

/**
 * Props for a list item that the window can open on: it scrolls into view with its name selected, and stays
 * highlighted until focus leaves it. Deferred so it lands after the window takes focus on open.
 */
export function useFocusItem(focus: string | undefined) {
  const [highlighted, setHighlighted] = useState(focus)
  const done = useRef(false)
  const ref = useCallback((element: HTMLDivElement | null) => {
    if (!element || done.current) return
    done.current = true
    window.setTimeout(() => {
      element.scrollIntoView({ block: 'center' })
      const input = element.querySelector('input')
      input?.focus({ preventScroll: true })
      input?.select()
    })
  }, [])
  return (id: string) =>
    id === highlighted
      ? {
          ref,
          'data-highlighted': true,
          onBlur: (event: FocusEvent<HTMLDivElement>) => {
            if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setHighlighted(undefined)
          },
        }
      : {}
}

export type EditorProps<P> = {
  params: P
  set: (patch: Partial<P>, key: string) => void
  ctx: EditorContext
}

/** Tokens a template field can insert, in the order the menu lists them. */
export type Reference = { token: string; label: string; meta: string }
export type References = readonly Reference[]

const MAX_STEP_FIELDS = 8

export function referencesFor(records: readonly DataRecord[] | null, upstream: readonly UpstreamNode[]): References {
  const refs: Reference[] = [{ token: '{{rows.count}}', label: 'rows.count', meta: 'Rows in' }]
  for (const column of records ? columnsOf(records) : []) refs.push({ token: `{{${column.name}}}`, label: column.name, meta: 'First row' })
  for (const step of upstream) {
    if (!step.records?.length) continue
    for (const column of columnsOf(step.records).slice(0, MAX_STEP_FIELDS)) {
      refs.push({ token: `{{${step.alias}.${column.name}}}`, label: `${step.alias}.${column.name}`, meta: step.name })
    }
  }
  return refs
}

export const plural = (count: number, word: string, many = `${word}s`) => `${count.toLocaleString()} ${count === 1 ? word : many}`

/** Columns of an earlier step's last run. */
export const stepColumns = (upstream: readonly UpstreamNode[], id: string | undefined) => {
  const records = upstream.find((step) => step.id === id)?.records
  return records ? columnsOf(records) : []
}

/** A group the field picker lists: a node's rows, or a global such as `$llumen`. */
export type FieldSource = {
  id: string
  name: string
  icon: Icon
  tone?: string
  /** Put before its fields' paths, e.g. `alias.field`; null for the rows coming straight in. */
  prefix: string | null
  records: readonly DataRecord[] | null
  open: boolean
  /** Beside the name, e.g. how many items the node sent. */
  meta?: string
  /** Shown when it has no fields. */
  empty?: string
}

/** What a condition can read: the rows coming in, the nodes before, and the globals. */
export type ConditionFields = { records: readonly DataRecord[] | null; sources: readonly FieldSource[]; scope: ConditionScope }

export function conditionFields(ctx: EditorContext): ConditionFields {
  const direct = ctx.upstream.filter((step) => step.direct)
  const single = direct.length === 1
  const globals = globalVars(ctx.workflowName)
  const nodes: FieldSource[] = [...direct, ...ctx.upstream.filter((step) => !step.direct)].map((step) => ({
    id: step.id,
    name: step.name,
    icon: step.icon,
    tone: step.tone,
    prefix: step.direct && single ? null : step.alias,
    // A fixture stands in for what the connected node sent.
    records: step.direct && single ? ctx.records : step.records,
    open: step.direct,
    meta: step.records ? plural(step.records.length, 'item') : 'Not run',
  }))
  const input: FieldSource[] = direct.length === 0 && ctx.records ? [{ id: 'input', name: 'Input', icon: Rows, prefix: null, records: ctx.records, open: true, meta: plural(ctx.records.length, 'item') }] : []
  const vars: FieldSource[] = Object.entries(globals).map(([name, record]) => ({
    id: name,
    name,
    icon: BracketsCurly,
    prefix: name,
    records: [record],
    open: false,
    empty: 'No workflow variables yet.',
  }))
  return { records: ctx.records, scope: { steps: ctx.upstream.map((step) => ({ alias: step.alias, rows: step.records })), globals }, sources: [...input, ...nodes, ...vars] }
}
