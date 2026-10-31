import { useCallback, useRef, useState, type FocusEvent } from 'react'
import { columnsOf, type Column } from './createAsset'
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
