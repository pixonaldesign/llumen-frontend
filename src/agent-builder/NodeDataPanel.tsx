import { useState } from 'react'
import type { DataRecord, DataValue } from './nodeCatalog'
import styles from './NodeCard.module.css'

type DataFormat = 'table' | 'json' | 'schema'

const FORMATS: readonly { id: DataFormat; label: string }[] = [
  { id: 'table', label: 'Table' },
  { id: 'json', label: 'JSON' },
  { id: 'schema', label: 'Schema' },
]

const valueType = (value: DataValue) => (value === null ? 'null' : typeof value)

function columnsOf(records: readonly DataRecord[]) {
  return [...new Set(records.flatMap((record) => Object.keys(record)))]
}

function formatValue(value: DataValue) {
  if (value === null) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

type NodeDataPanelProps = {
  label: string
  records: readonly DataRecord[] | null
  emptyMessage: string
  error?: string
}

/** Footer drawer: one node's input or output, viewable as a table, raw JSON, or inferred schema. */
export function NodeDataPanel({ label, records, emptyMessage, error }: NodeDataPanelProps) {
  const [format, setFormat] = useState<DataFormat>('table')
  const columns = records ? columnsOf(records) : []

  return (
    <div className={styles.dataPanel} role="tabpanel" aria-label={label}>
      {records && records.length > 0 ? (
        <>
          <div className={styles.dataToolbar}>
            <span className={styles.dataCount}>
              {records.length} {records.length === 1 ? 'item' : 'items'}
            </span>
            <div className={styles.segmented} role="radiogroup" aria-label={`${label} format`}>
              {FORMATS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={format === option.id}
                  className={format === option.id ? `${styles.segment} ${styles.segmentActive}` : styles.segment}
                  onClick={() => setFormat(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.dataScroll} data-native-scroll>
            {format === 'table' ? (
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
                        <td key={column} data-type={valueType(record[column] ?? null)}>
                          {formatValue(record[column] ?? null)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : format === 'json' ? (
              <pre className={styles.dataJson}>{JSON.stringify(records, null, 2)}</pre>
            ) : (
              <ul className={styles.dataSchema}>
                {columns.map((column) => (
                  <li key={column}>
                    <span className={styles.schemaName}>{column}</span>
                    <span className={styles.schemaType}>{valueType(records[0][column] ?? null)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className={error ? `${styles.dataEmpty} ${styles.dataError}` : styles.dataEmpty}>{error ?? emptyMessage}</p>
      )}
    </div>
  )
}
