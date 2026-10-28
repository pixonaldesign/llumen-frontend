import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { nodeDataSides, nodeDataViews, type DataSide } from './cardSections'
import { DataViewBody } from './DataViews'
import { Tabs } from './NodeConfigWindow'
import { nodeName, nodeOutputs, type CanvasNode, type DataRecord, type DataValue, type NodePort, type NodeRun, type NodeType } from './nodeCatalog'
import { branchColumn, INSIGHT_TYPE_LABEL, paramsFor } from './nodeKinds'
import { displayValue, fieldLabel, filterRecords } from './recordUtils'
import styles from './NodeDataDialog.module.css'
import tones from './nodeTones.module.css'

/** The node's box in the canvas root's coordinates. */
export type NodeDataAnchor = { left: number; top: number; right: number; bottom: number }

/** Gap to the node, and the margin kept from the canvas edges. */
const GAP = 12
const EDGE = 16
/** The widest node toolbar; it keeps its size when zoomed out, so it can overhang a small node's sides. */
const TOOLBAR_WIDTH = 240
const SIDE_LABELS: Record<DataSide, string> = { input: 'Input', output: 'Output' }
/** Rows shown before "View all data" hands over to the configuration window. */
const MAX_ROWS = 10

/** A toggle above the rows: a branch with its row count, or an input layer with its step's name. */
type Chip = { id: string | null; label: string; detail: string | number; pressed: boolean; onPick: () => void }

const rowCount = (count: number) => `${count} ${count === 1 ? 'row' : 'rows'}`

/**
 * How a kind's one-row output reads: the field that leads, the order after it, the quiet ones, the ones
 * left out while empty, the one that heads the window as a tag instead, and fields read under another
 * name or as words.
 */
type RecordLayout = {
  lead?: string
  order?: readonly string[]
  muted?: readonly string[]
  optional?: readonly string[]
  header?: string
  labels?: Readonly<Record<string, string>>
  formats?: Readonly<Record<string, (value: DataValue) => string>>
}

const VERDICT = {
  lead: 'answer',
  order: ['answer', 'classification', 'key_metrics', 'reasoning', 'caveats'],
  muted: ['caveats'],
  optional: ['classification'],
  header: 'confidence',
} satisfies RecordLayout

const RECORD_LAYOUTS: Partial<Record<string, RecordLayout>> = {
  insightGenerator: { header: 'insightType' },
  dataAnalyst: VERDICT,
  gisCorrelationAgent: {
    ...VERDICT,
    order: ['answer', 'method', 'classification', 'key_metrics', 'reasoning', 'caveats', 'visual_asset_id', 'visual_warning'],
    muted: ['method', 'caveats', 'visual_warning'],
    labels: { visual_asset_id: 'Map', visual_warning: 'Map' },
    formats: { method: (value) => fieldLabel(displayValue(value)), visual_asset_id: () => 'Saved as an asset' },
  },
}

const CONFIDENCE_TONE: Record<string, string> = { high: 'positive', medium: 'warning', low: 'negative' }

const formatValue = (value: DataValue) => (typeof value === 'number' ? value.toLocaleString() : displayValue(value))

/** A JSON object held as text, e.g. a verdict's key metrics, as its pairs; null for anything else. */
function objectEntries(value: DataValue): [string, DataValue][] | null {
  if (typeof value !== 'string' || !value.trimStart().startsWith('{')) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const entries = Object.entries(parsed)
    return entries.every(([, item]) => item === null || ['string', 'number', 'boolean'].includes(typeof item)) ? (entries as [string, DataValue][]) : null
  } catch {
    return null
  }
}

/** One row read as a document: each field's name, then its whole value, wrapped. */
function RecordFields({ record, query, layout = {} }: { record: DataRecord; query: string; layout?: RecordLayout }) {
  const needle = query.trim().toLowerCase()
  const order = layout.order ?? []
  const keys = [...order.filter((key) => key in record), ...Object.keys(record).filter((key) => !order.includes(key))]
  const fields = keys
    .filter((key) => key !== layout.header && !(layout.optional?.includes(key) && (record[key] === null || record[key] === '')))
    .map((key) => [key, record[key]] as const)
    .filter(([key, value]) => !needle || key.toLowerCase().includes(needle) || displayValue(value).toLowerCase().includes(needle))
  if (!fields.length) return <p className={styles.empty}>Nothing matches “{query.trim()}”.</p>
  return (
    <dl className={styles.record}>
      {fields.map(([key, value]) => {
        const pairs = objectEntries(value)
        return (
          <div key={key} className={styles.recordField}>
            <dt className={styles.recordLabel}>{layout.labels?.[key] ?? fieldLabel(key)}</dt>
            <dd className={styles.recordValue} data-lead={key === layout.lead || undefined} data-muted={layout.muted?.includes(key) || undefined}>
              {pairs ? (
                <dl className={styles.metrics}>
                  {pairs.map(([name, item]) => (
                    <div key={name} className={styles.metric}>
                      <dt>{fieldLabel(name)}</dt>
                      <dd>{typeof item === 'string' ? fieldLabel(item) : formatValue(item)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                (layout.formats?.[key] ?? formatValue)(value)
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/** A step a kind reads, named by its role, e.g. a GIS node's upper and land layers, and its last rows. */
export type InputLayer = { id: string; name: string; role: string; records: readonly DataRecord[] | null }

type NodeDataDialogProps = {
  node: CanvasNode
  type: NodeType
  run: NodeRun
  input: readonly DataRecord[] | null
  output: readonly DataRecord[] | null
  /** For kinds that read more than what's wired in; the Input side switches between them, the first being the wired one. */
  inputLayers?: readonly InputLayer[]
  anchor: NodeDataAnchor
  /** Heights of the top and bottom chrome to stay between. */
  clearTop: number
  clearBottom: number
  onClose: () => void
  /** Opens the node's full input and output, past the rows shown here. */
  onViewAll: () => void
}

/** A node's input or output rows, beside the node; the canvas stays usable while it's open. */
export function NodeDataDialog({
  node,
  type,
  run,
  input,
  output,
  inputLayers,
  anchor,
  clearTop,
  clearBottom,
  onClose,
  onViewAll,
}: NodeDataDialogProps) {
  const windowRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const TypeIcon = type.icon
  const hasInputs = type.inputs.length > 0
  const branches = nodeOutputs(node, type)
  const ports = branches.length > 1 ? run.ports : undefined
  const [branch, setBranch] = useState<string | null>(null)
  const picked = branches.some((port) => port.id === branch) ? branch : null
  /** Each row leads with its branch, so the merged table says where every row went. */
  const column = branchColumn(type.id) ?? 'branch'
  const branchRows = (port: NodePort): DataRecord[] =>
    (ports?.[port.id] ?? []).map((row) => ({ [column]: row[column] ?? port.label ?? port.id, ...row }))
  const outputRows = ports ? branches.filter((port) => !picked || port.id === picked).flatMap(branchRows) : output
  const layers = inputLayers && inputLayers.length > 1 ? inputLayers : undefined
  const [layerId, setLayerId] = useState<string | null>(null)
  const layer = layers?.find((option) => option.id === layerId) ?? layers?.[0]
  const views = nodeDataViews(run, layer ? layer.records : input, outputRows, type.category === 'triggers', hasInputs)
  const available = nodeDataSides(views, hasInputs)
  const sides: readonly DataSide[] = available.length ? available : ['output']
  const [chosen, setChosen] = useState<DataSide>(sides.includes('output') ? 'output' : sides[0])
  const side = sides.includes(chosen) ? chosen : sides[0]
  const [query, setQuery] = useState('')

  const tabbed = sides.length > 1
  const view = views[side]
  const records = view.records ?? []
  const matches = filterRecords(records, query)
  /** Kept while either side has rows, so switching sides doesn't move the tabs. */
  const searchable = sides.some((option) => Boolean(views[option].records?.length))
  const layout = side === 'output' ? RECORD_LAYOUTS[type.id] : undefined
  /** Read from the output whichever side is showing, so switching sides doesn't move the header. */
  const verdict = views.output.records?.length === 1 ? views.output.records[0] : undefined
  const confidence = RECORD_LAYOUTS[type.id]?.header === 'confidence' && typeof verdict?.confidence === 'string' ? verdict.confidence.toLowerCase() : undefined
  const tag =
    type.id === 'insightGenerator'
      ? { label: INSIGHT_TYPE_LABEL[paramsFor('insightGenerator', node.config.params).insightType] }
      : confidence
        ? { label: `${fieldLabel(confidence)} confidence`, tone: CONFIDENCE_TONE[confidence] }
        : undefined

  /**
   * Right of the node, or left when that runs off the canvas; written to the DOM so it tracks pans without a flash.
   * Held between the top and bottom chrome. It only rises above the node's top, where the node toolbar sits,
   * while it's beside the node; when it has to overlap the node it stays below that top.
   */
  useLayoutEffect(() => {
    const element = windowRef.current
    const parent = element?.offsetParent as HTMLElement | null
    if (!element || !parent) return
    const width = element.offsetWidth
    const height = element.offsetHeight
    const gap = Math.max(GAP, (TOOLBAR_WIDTH - (anchor.right - anchor.left)) / 2 + GAP / 2)
    const maxLeft = parent.clientWidth - EDGE - width
    const right = anchor.right + gap
    const leftSide = anchor.left - gap - width
    const beside = right <= maxLeft || leftSide >= EDGE
    const left = right <= maxLeft ? right : leftSide >= EDGE ? leftSide : Math.max(EDGE, Math.min(maxLeft, right))
    const lowest = parent.clientHeight - clearBottom - height
    const top = Math.max(clearTop, beside ? Math.min(anchor.top, lowest) : anchor.top)
    element.style.left = `${left}px`
    element.style.top = `${top}px`
  }, [anchor.left, anchor.top, anchor.right, anchor.bottom, clearTop, clearBottom, side, query, picked, layer?.id])

  useEffect(() => {
    windowRef.current?.focus({ preventScroll: true })
  }, [])

  /** Presses on its own node or toolbar are left to their buttons, which toggle it. */
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element
      if (windowRef.current?.contains(target) || target.closest(`[data-node-id="${node.id}"], [data-node-toolbar]`)) return
      onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose()
    }
    document.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [node.id, onClose])

  const count = (target: DataSide) => (views[target].records ? rowCount(views[target].records.length) : 'Failed')
  const chips: { group: string; items: Chip[] } | null =
    ports && side === 'output' && views.output.records
      ? {
          group: 'Branches',
          items: [
            { id: null, label: 'All', detail: branches.reduce((sum, port) => sum + (ports[port.id]?.length ?? 0), 0) },
            ...branches.map((port) => ({ id: port.id, label: port.label ?? port.id, detail: ports[port.id]?.length ?? 0 })),
          ].map((item) => ({ ...item, pressed: picked === item.id, onPick: () => setBranch(item.id) })),
        }
      : layers && side === 'input'
        ? {
            group: 'Layers',
            items: layers.map((option) => ({
              id: option.id,
              label: option.role,
              detail: option.name,
              pressed: option.id === layer?.id,
              onPick: () => setLayerId(option.id),
            })),
          }
        : null

  return (
    <div
      ref={windowRef}
      className={`${styles.window} ${tones[`tone_${type.tone}`]}`}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-native-scroll
    >
      <header className={styles.head}>
        <span className={styles.headIcon} aria-hidden>
          <TypeIcon size={16} weight="fill" />
        </span>
        <h2 id={titleId} className={styles.headTitle}>
          {nodeName(node, type)}
        </h2>
        {tag ? (
          <span className={styles.headTag} data-tone={tag.tone}>
            {tag.label}
          </span>
        ) : null}
        <button type="button" className={styles.close} aria-label="Close input and output" onClick={onClose}>
          <X size={14} weight="bold" aria-hidden />
        </button>
      </header>

      <div className={styles.controls} data-tabbed={tabbed || undefined}>
        {searchable ? (
          <label className={styles.search}>
            <MagnifyingGlass size={14} aria-hidden />
            <input
              className={styles.searchInput}
              value={query}
              placeholder={records.length === 1 ? 'Search fields…' : 'Search rows…'}
              aria-label={records.length === 1 ? 'Search fields' : 'Search rows'}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        ) : null}
        {tabbed ? (
          <Tabs
            tabs={sides.map((option) => ({ id: option, label: SIDE_LABELS[option] }))}
            value={side}
            label="Data"
            onChange={setChosen}
            trailing={count(side)}
          />
        ) : (
          <p className={styles.sideLabel}>
            {SIDE_LABELS[side]}
            <span className={styles.count}>{count(side)}</span>
          </p>
        )}
      </div>

      {chips ? (
        <div className={styles.branches} role="group" aria-label={chips.group}>
          {chips.items.map((chip) => (
            <button key={chip.id ?? 'all'} type="button" className={styles.branch} aria-pressed={chip.pressed} onClick={chip.onPick}>
              {chip.label}
              <span className={styles.branchCount}>{chip.detail}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div
        className={styles.scroll}
        role={tabbed ? 'tabpanel' : 'region'}
        aria-label={`${SIDE_LABELS[side]} rows`}
      >
        {view.error && !view.records ? (
          <p className={`${styles.empty} ${styles.error}`}>{view.error}</p>
        ) : !records.length ? (
          <p className={styles.empty}>{picked ? 'No rows on this branch.' : 'No rows.'}</p>
        ) : records.length === 1 ? (
          <RecordFields record={records[0]} query={query} layout={layout} />
        ) : (
          <>
            <DataViewBody view="table" records={matches.slice(0, MAX_ROWS)} query={query} bare />
            {matches.length > MAX_ROWS ? (
              <button type="button" className={styles.viewAll} onClick={onViewAll}>
                View all data
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
