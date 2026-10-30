import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { AssetPreviewChart } from './AssetPreviewChart'
import type { ContentBlock } from './cardSections'
import { previewOf } from './flowData'
import { NodeAssetPreview } from './NodeAssetPreview'
import type { DataRecord, DataValue } from './nodeCatalog'
import { InlineBadge } from './nodeParts'
import type { AnyParams } from './nodeKinds'
import styles from './NodeCardSections.module.css'

export type ContentContext = {
  selected: boolean
  onParamsChange?: (patch: Partial<AnyParams>) => void
}

type BlockOf<K extends ContentBlock['kind']> = Extract<ContentBlock, { kind: K }>

/** Typed into on the card; grows with its text, so the card never scrolls inside. */
function PromptEditor({ block, onParamsChange }: { block: BlockOf<'prompt'>; onParamsChange?: ContentContext['onParamsChange'] }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const fit = () => {
      element.style.height = 'auto'
      element.style.height = `${element.scrollHeight}px`
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [block.prompt.value])

  return (
    <label className={`${styles.well} ${styles.prompt}`} data-node-interactive>
      <span className={styles.promptLabel}>{block.label}</span>
      <textarea
        ref={ref}
        className={styles.promptInput}
        rows={1}
        value={block.prompt.value}
        placeholder={block.placeholder}
        readOnly={!onParamsChange}
        onChange={(event) => onParamsChange?.({ [block.prompt.param]: event.currentTarget.value } as Partial<AnyParams>)}
      />
    </label>
  )
}

const CONTENT_VIEWS: { [K in ContentBlock['kind']]: (props: { block: BlockOf<K>; context: ContentContext }) => ReactNode } = {
  asset: ({ block, context }) => (
    <div className={`${styles.well} ${styles.asset}`} data-preview={block.preview}>
      {block.preview === 'table' && block.asset ? (
        <PreviewTable records={block.asset.rows} />
      ) : (
        <NodeAssetPreview kind={block.preview} data={block.asset} interactive={context.selected} bare labelledAxis />
      )}
    </div>
  ),
  made: ({ block, context }) => {
    const preview = previewOf(block.settings.chartType)
    return (
      <div className={`${styles.well} ${styles.asset} ${styles.made}`} data-preview={preview}>
        {preview === 'map' ? (
          <NodeAssetPreview kind="map" data={{ view: block.settings, rows: block.rows }} interactive={context.selected} bare />
        ) : preview === 'table' ? (
          <PreviewTable records={block.rows} />
        ) : (
          <div className={styles.madePlot}>
            <AssetPreviewChart settings={block.settings} records={block.rows} flush />
          </div>
        )}
      </div>
    )
  },
  prompt: ({ block, context }) => <PromptEditor block={block} onParamsChange={context.onParamsChange} />,
  summary: ({ block }) => (
    <div className={`${styles.well} ${styles.prompt} ${styles.summary}`}>
      <span className={styles.promptLabel}>{block.label}</span>
      <p className={styles.summaryText}>
        {block.parts.map((part, index) => (typeof part === 'string' ? part : <InlineBadge key={index} text={part.badge} title={part.title} />))}
      </p>
    </div>
  ),
}

export function ContentBlockView({ block, context }: { block: ContentBlock; context: ContentContext }) {
  const View = CONTENT_VIEWS[block.kind] as (props: { block: ContentBlock; context: ContentContext }) => ReactNode
  return <View block={block} context={context} />
}

/** Rows past this stay in the asset itself; the card is a preview. */
const TABLE_ROWS = 50

const valueType = (value: DataValue) => (value === null ? 'null' : typeof value)
const formatValue = (value: DataValue) => (value === null ? '—' : String(value))
const columnsOf = (records: readonly DataRecord[]) => [...new Set(records.flatMap((record) => Object.keys(record)))]

function PreviewTable({ records }: { records: readonly DataRecord[] }) {
  const columns = columnsOf(records)
  return (
    <div className={styles.tableScroll} data-native-scroll data-node-interactive>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.slice(0, TABLE_ROWS).map((record, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column} data-type={valueType(record[column] ?? null)} title={formatValue(record[column] ?? null)}>
                  {formatValue(record[column] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
