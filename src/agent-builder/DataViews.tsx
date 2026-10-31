import { Circle, Hash, TextAa, ToggleLeft } from '@phosphor-icons/react'
import { columnsOf, type ColumnKind } from './createAsset'
import type { DataRecord, DataValue } from './nodeCatalog'
import { displayValue, filterRecords } from './recordUtils'
import styles from './NodeConfigWindow.module.css'

export type DataView = 'schema' | 'table' | 'json'

const KIND_LABELS: Record<ColumnKind, string> = { string: 'Text', number: 'Number', boolean: 'Boolean', null: 'Empty' }

export function ColumnKindIcon({ kind, size = 14 }: { kind: ColumnKind; size?: number }) {
  const Icon = kind === 'number' ? Hash : kind === 'boolean' ? ToggleLeft : kind === 'null' ? Circle : TextAa
  return <Icon size={size} weight="bold" aria-label={KIND_LABELS[kind]} />
}

const valueKind = (value: DataValue | undefined) => (value === null || value === undefined ? 'null' : typeof value)

type DataViewProps = {
  view: DataView
  records: readonly DataRecord[]
  /** Narrows the schema to matching fields and the table and JSON to matching rows. */
  query?: string
  /** The table without its own sideways scroller, for a container that scrolls both ways and pins the header. */
  bare?: boolean
}

export function DataViewBody({ view, records, query = '', bare = false }: DataViewProps) {
  if (view === 'schema') return <SchemaList records={records} query={query} />
  const rows = filterRecords(records, query)
  if (rows.length === 0) return <p className={styles.noMatch}>Nothing matches “{query.trim()}”.</p>
  return view === 'table' ? <DataTable records={rows} bare={bare} /> : <pre className={styles.json}>{JSON.stringify(rows, null, 2)}</pre>
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

function DataTable({ records, bare }: { records: readonly DataRecord[]; bare: boolean }) {
  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))]
  const table = (
    <table className={styles.dataTable}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {records.map((record, index) => (
          <tr key={index}>
            {columns.map((column) => (
              <td key={column} data-type={valueKind(record[column])}>
                {displayValue(record[column])}
              </td>
            ))}
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