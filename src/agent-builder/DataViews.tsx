import type { CSSProperties, ReactNode } from 'react'
import { Circle, Hash, TextAa, ToggleLeft } from '@phosphor-icons/react'
import { columnsOf, type ColumnKind } from './createAsset'
import { fieldKind, fieldToken, isObject } from './fieldPaths'
import { FieldChip, ValueTree } from './FieldTree'
import type { DataRecord } from './nodeCatalog'
import { displayValue, filterRecords } from './recordUtils'
import styles from './NodeConfigWindow.module.css'

export type DataView = 'schema' | 'table' | 'json'

const KIND_LABELS: Record<ColumnKind, string> = { string: 'Text', number: 'Number', boolean: 'Boolean', null: 'Empty' }

export function ColumnKindIcon({ kind, size = 14 }: { kind: ColumnKind; size?: number }) {
  const Icon = kind === 'number' ? Hash : kind === 'boolean' ? ToggleLeft : kind === 'null' ? Circle : TextAa
  return <Icon size={size} weight="bold" aria-label={KIND_LABELS[kind]} />
}

/** Field names become chips that drag their `{{prefix.path}}` token into a text field. */
export type DraggableFields = { prefix: string | null; onDragChange?: (dragging: boolean) => void }

type DataViewProps = {
  view: DataView
  records: readonly DataRecord[]
  /** Narrows the schema to matching fields and the table and JSON to matching rows. */
  query?: string
  /** The table without its own sideways scroller, for a container that scrolls both ways and pins the header. */
  bare?: boolean
  fields?: DraggableFields
}

export function DataViewBody({ view, records, query = '', bare = false, fields }: DataViewProps) {
  if (view === 'schema') return <SchemaList records={records} query={query} />
  const rows = filterRecords(records, query)
  if (rows.length === 0) return <p className={styles.noMatch}>Nothing matches “{query.trim()}”.</p>
  if (view === 'table') return <DataTable records={rows} bare={bare} fields={fields} />
  return fields ? <JsonTree rows={rows} fields={fields} /> : <pre className={styles.json}>{JSON.stringify(rows, null, 2)}</pre>
}

function SchemaList({ records, query }: { records: readonly DataRecord[]; query: string }) {
  const needle = query.trim().toLowerCase()
  const columns = columnsOf(records).filter((column) => !needle || column.name.toLowerCase().includes(needle))
  if (columns.length === 0) return <p className={styles.noMatch}>No field matches “{query.trim()}”.</p>
  return (
    <ul className={styles.schema}>
      {columns.map((column) => {
        const sample = records.find((record) => record[column.name] !== null && record[column.name] !== undefined)?.[column.name]
        return (
          <li key={column.name} className={styles.schemaRow}>
            <span className={styles.schemaIcon} data-kind={column.kind}>
              <ColumnKindIcon kind={column.kind} size={12} />
            </span>
            <span className={styles.schemaName}>{column.name}</span>
            <span className={styles.schemaSample} data-kind={column.kind} title={displayValue(sample)}>
              {displayValue(sample)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function DataTable({ records, bare, fields }: { records: readonly DataRecord[]; bare: boolean; fields?: DraggableFields }) {
  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))]
  const header = (column: string) => {
    if (!fields) return column
    const sample = records.find((record) => record[column] !== null && record[column] !== undefined)?.[column]
    return <FieldChip name={column} kind={fieldKind(sample)} token={fieldToken(fields.prefix, column)} small onDragChange={fields.onDragChange} />
  }
  const table = (
    <table className={styles.dataTable}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{header(column)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {records.map((record, index) => (
          <tr key={index}>
            {columns.map((column) => {
              const value: unknown = record[column]
              const nested = fields && (isObject(value) ? Object.keys(value).length > 0 : Array.isArray(value) && value.length > 0)
              return (
                <td key={column} data-type={fieldKind(value)} data-nested={nested || undefined}>
                  {nested ? <ValueTree value={value} path={column} prefix={fields.prefix} onDragChange={fields.onDragChange} /> : displayValue(record[column])}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
  return bare ? (
    table
  ) : (
    <div className={styles.tableScroll} data-native-scroll>
      {table}
    </div>
  )
}

/** The rows as indented JSON, one line per key, with each key a draggable chip; a row's own fields are `{{field}}`. */
function JsonTree({ rows, fields }: { rows: readonly DataRecord[]; fields: DraggableFields }) {
  const lines: ReactNode[] = []
  const line = (id: string, depth: number, content: ReactNode, key?: { name: string; path: string; value: unknown }, comma = false) =>
    lines.push(
      <div key={id} className={styles.jsonLine} style={{ '--depth': depth } as CSSProperties}>
        {key ? (
          <>
            <FieldChip name={key.name} kind={fieldKind(key.value)} token={fieldToken(fields.prefix, key.path)} small onDragChange={fields.onDragChange} />
            <span className={`${styles.jsonPunct} ${styles.jsonColon}`}>:</span>
          </>
        ) : null}
        {content}
        {comma ? <span className={styles.jsonPunct}>,</span> : null}
      </div>,
    )
  const scalar = (value: unknown) => {
    const kind = fieldKind(value)
    return <span className={styles.jsonValue} data-kind={kind}>{kind === 'string' ? JSON.stringify(value) : String(value)}</span>
  }
  const walk = (value: unknown, id: string, depth: number, path: string, name: string | undefined, comma: boolean) => {
    const key = name === undefined ? undefined : { name, path, value }
    const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : isObject(value) ? Object.entries(value) : null
    if (!entries) return line(id, depth, scalar(value), key, comma)
    const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}']
    if (entries.length === 0) return line(id, depth, <span className={styles.jsonPunct}>{open + close}</span>, key, comma)
    line(`${id}(`, depth, <span className={styles.jsonPunct}>{open}</span>, key)
    entries.forEach(([childKey, child], index) => {
      const childPath = path ? `${path}.${childKey}` : childKey
      walk(child, `${id}.${childKey}`, depth + 1, childPath, Array.isArray(value) ? undefined : childKey, index < entries.length - 1)
    })
    line(`${id})`, depth, <span className={styles.jsonPunct}>{close}</span>, undefined, comma)
  }
  line('[', 0, <span className={styles.jsonPunct}>[</span>)
  rows.forEach((row, index) => walk(row, `row${index}`, 1, '', undefined, index < rows.length - 1))
  line(']', 0, <span className={styles.jsonPunct}>]</span>)
  return <div className={styles.jsonTree}>{lines}</div>
}
