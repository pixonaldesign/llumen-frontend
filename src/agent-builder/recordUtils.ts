import type { DataRecord, DataValue } from './nodeCatalog'

export const displayValue = (value: DataValue | undefined) => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

/** A fixed label in sentence case: later capitalised words go lower case, acronyms like KPI stay. */
export const sentenceCase = (text: string) =>
  text.replace(/\S+/g, (word, offset: number) =>
    offset === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : /^[A-Z][a-z]+$/.test(word) ? word.toLowerCase() : word,
  )

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
