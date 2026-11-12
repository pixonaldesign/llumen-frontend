import type { DataRecord, DataValue } from './nodeCatalog'

export const displayValue = (value: DataValue | undefined) => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

/**
 * A row's field by its own key, else by walking a nested path such as `hair.color` or `items.0.sku`;
 * rows from a fixture or an API can hold objects and lists even though the type says flat.
 */
export function valueAt(row: DataRecord, path: string): unknown {
  if (path in row) return row[path]
  let value: unknown = row
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

/** `valueAt` for text: objects and lists come back as JSON. */
export function fieldAt(row: DataRecord, path: string): DataValue | undefined {
  const value = valueAt(row, path)
  if (value === undefined) return undefined
  return value !== null && typeof value === 'object' ? JSON.stringify(value) : (value as DataValue)
}

/** A fixed label in sentence case: later capitalised words go lower case, acronyms like KPI stay. */
export const sentenceCase = (text: string) =>
  text.replace(/\S+/g, (word, offset: number) =>
    offset === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : /^[A-Z][a-z]+$/.test(word) ? word.toLowerCase() : word,
  )

/** A field name as words, e.g. `recommended_action` reads "Recommended action"; references keep the name itself. */
export const fieldLabel = (name: string) => {
  const words = name.replace(/[_-]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Emails, URLs and hosts read as written, so a badge never capitalises them. */
const LITERAL = /@|:\/\/|^[\w-]+(\.[\w-]+)+(\/|$)/

/** A badge's text with each ` · ` part starting upper case; the rest is the author's or the data's own text. */
export const badgeCase = (text: string) =>
  text
    .split(' · ')
    .map((part) => (LITERAL.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' · ')

/** Rows holding the query in a key or value; every row when the query is empty. */
export function filterRecords(records: readonly DataRecord[], query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return records
  return records.filter((record) =>
    Object.entries(record).some(([key, value]) => key.toLowerCase().includes(needle) || displayValue(value).toLowerCase().includes(needle)),
  )
}

/** Byte size of the rows as JSON, for the output summary line. */
export function formatBytes(records: readonly DataRecord[]) {
  const bytes = new TextEncoder().encode(JSON.stringify(records)).length
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}
