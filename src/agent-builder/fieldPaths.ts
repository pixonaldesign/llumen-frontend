import type { DataRecord } from './nodeCatalog'

/** What a field holds, as its chip shows it. */
export type FieldKind = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array'

export const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

export function fieldKind(value: unknown): FieldKind {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return 'array'
  if (isObject(value)) return 'object'
  return typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string'
}

/** `{{path}}` for the rows coming straight in, `{{prefix.path}}` for a named node's. */
export const fieldToken = (prefix: string | null, path: string) => `{{${prefix ? `${prefix}.` : ''}${path}}}`

export const plural = (count: number, word: string) => `${count.toLocaleString()} ${count === 1 ? word : `${word}s`}`

/** One field of the rows, with the fields inside it. */
export type FieldNode = {
  key: string
  path: string
  kind: FieldKind
  sample?: string
  children: FieldNode[]
}

/** Rows read for the field list; later rows only add fields the first ones lacked. */
const SCAN_ROWS = 50

export function sampleText(value: unknown) {
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

export function fieldTree(records: readonly DataRecord[]): FieldNode[] {
  const nodes: FieldNode[] = []
  for (const record of records.slice(0, SCAN_ROWS)) {
    for (const [key, value] of Object.entries(record)) insert(nodes, key.split('.'), '', value)
  }
  return nodes
}

/** Keeps fields whose name matches, and the parents of any that do. */
export function filterTree(nodes: readonly FieldNode[], needle: string): FieldNode[] {
  if (!needle) return [...nodes]
  return nodes.flatMap((node) => {
    if (node.key.toLowerCase().includes(needle)) return [node]
    const children = filterTree(node.children, needle)
    return children.length ? [{ ...node, children }] : []
  })
}

/** The same tree with every path under `prefix`, e.g. `alias.field`. */
export const prefixTree = (nodes: readonly FieldNode[], prefix: string | null): FieldNode[] =>
  prefix ? nodes.map((node) => ({ ...node, path: `${prefix}.${node.path}`, children: prefixTree(node.children, prefix) })) : [...nodes]

/** Every field in the tree, parents before their children. */
export const flattenTree = (nodes: readonly FieldNode[]): FieldNode[] => nodes.flatMap((node) => [node, ...flattenTree(node.children)])
