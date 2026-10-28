import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { AssetPreviewChart } from './AssetPreviewChart'
import slidesThumbnail from './assets/slides-thumbnail.jpg'
import type { ContentBlock, DataPreview } from './cardSections'
import { isMapLayer } from './createAsset'
import { NodeAssetPreview } from './NodeAssetPreview'
import type { DataRecord, DataValue } from './nodeCatalog'
import type { AnyParams } from './nodeKinds'
import styles from './NodeCardSections.module.css'

export type ContentContext = {
  selected: boolean
  onParamsChange?: (patch: Partial<AnyParams>) => void
}

type BlockOf<K extends ContentBlock['kind']> = Extract<ContentBlock, { kind: K }>
type PreviewOf<K extends DataPreview['kind']> = Extract<DataPreview, { kind: K }>

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
      <NodeAssetPreview kind={block.preview} interactive={context.selected} bare labelledAxis />
    </div>
  ),
  prompt: ({ block, context }) => <PromptEditor block={block} onParamsChange={context.onParamsChange} />,
}

export function ContentBlockView({ block, context }: { block: ContentBlock; context: ContentContext }) {
  const View = CONTENT_VIEWS[block.kind] as (props: { block: ContentBlock; context: ContentContext }) => ReactNode
  return <View block={block} context={context} />
}

/** Rows past this stay in the data card; the footer is a preview. */
const TABLE_ROWS = 50

const valueType = (value: DataValue) => (value === null ? 'null' : typeof value)
const formatValue = (value: DataValue) => (value === null ? '—' : String(value))
const columnsOf = (records: readonly DataRecord[]) => [...new Set(records.flatMap((record) => Object.keys(record)))]

function PreviewTable({ preview }: { preview: PreviewOf<'table'> }) {
  const columns = columnsOf(preview.records)
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
          {preview.records.slice(0, TABLE_ROWS).map((record, index) => (
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

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** The saved asset as the Asset node shows one: its name, then the chart drawn from the rows it holds. A table asset is its rows. */
function SavedAsset({ preview }: { preview: PreviewOf<'asset'> }) {
  const { chartType } = preview.settings
  const name = (
    <p className={styles.madeTitle} title={preview.title}>
      {preview.title}
    </p>
  )
  if (chartType === 'table') {
    return (
      <>
        <div className={styles.footerBody}>{name}</div>
        <PreviewTable preview={{ kind: 'table', records: preview.records }} />
      </>
    )
  }
  return (
    <div className={`${styles.footerBody} ${styles.made}`}>
      {name}
      <div className={styles.savedChart} data-map={isMapLayer(chartType) || undefined}>
        {isMapLayer(chartType) ? <NodeAssetPreview kind="map" interactive={false} bare /> : <AssetPreviewChart settings={preview.settings} records={preview.records} flush />}
      </div>
    </div>
  )
}

const PREVIEW_VIEWS: { [K in DataPreview['kind']]: (props: { preview: PreviewOf<K> }) => ReactNode } = {
  table: ({ preview }) => <PreviewTable preview={preview} />,
  asset: ({ preview }) => <SavedAsset preview={preview} />,
  results: ({ preview }) => (
    <ul className={`${styles.footerBody} ${styles.results}`} aria-label="Results">
      {preview.tiles.map((tile) => (
        <li key={tile.label} className={styles.result} data-tone={tile.tone}>
          <span>{tile.label}</span>
          <span>{tile.detail ? `${tile.value} (${tile.detail})` : tile.value}</span>
        </li>
      ))}
    </ul>
  ),
  text: ({ preview }) => (
    <div className={styles.footerBody}>
      <p className={styles.text}>{preview.text}</p>
    </div>
  ),
  slides: ({ preview }) => (
    <div className={`${styles.footerBody} ${styles.made}`}>
      <img className={styles.deckThumb} src={slidesThumbnail} alt="" />
      <div>
        <p className={styles.madeTitle} title={preview.title}>
          {preview.title}
        </p>
        <p className={styles.madeMeta}>Saved to Slides</p>
      </div>
    </div>
  ),
  document: ({ preview }) => (
    <div className={`${styles.footerBody} ${styles.document}`}>
      <span className={styles.page} aria-hidden>
        <span className={`${styles.line} ${styles.lineStrong}`} />
        <span className={styles.line} />
        <span className={styles.line} />
        <span className={styles.line} />
      </span>
      <div className={styles.documentText}>
        <p className={styles.madeTitle} title={preview.title}>
          {preview.title}
        </p>
        <p className={styles.madeMeta}>
          {plural(preview.sections, 'section')} · {preview.words.toLocaleString()} words
        </p>
      </div>
    </div>
  ),
}

export function DataPreviewView({ preview }: { preview: DataPreview }) {
  const View = PREVIEW_VIEWS[preview.kind] as (props: { preview: DataPreview }) => ReactNode
  return <View preview={preview} />
}
