import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { CaretRight, MagnifyingGlass, Warning, X } from '@phosphor-icons/react'
import { nodeDataSides, nodeDataViews, type DataSide } from './cardSections'
import { APP_THUMBNAIL } from './appThumbnail'
import { ChatPreview } from './ChatPreview'
import { ApiPreview } from './ApiPreview'
import { statusLine } from './apiExchange'
import { EmailPreview } from './EmailPreview'
import type { ChatReply } from './chatMessage'
import { AssetPreviewChart } from './AssetPreviewChart'
import { chartName, type CreateAssetSettings } from './createAsset'
import { DataViewBody } from './DataViews'
import { previewOf } from './flowData'
import { NodeAssetPreview } from './NodeAssetPreview'
import { FindingReport } from './FindingReport'
import { Tabs } from './NodeConfigWindow'
import { nodeName, nodeOutputs, type CanvasNode, type DataRecord, type DataValue, type NodeRun, type NodeType } from './nodeCatalog'
import { APP_NAVIGATION_LABEL, INSIGHT_TYPE_LABEL, isFallbackBranch, paramsFor } from './nodeKinds'
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
/** A single record with more fields than this gets a search; a shorter one reads at a glance. */
const SEARCH_FIELDS = 8

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

/** Branches the Output side leaves out: a filter shows only the rows that passed. */
const HIDDEN_OUTPUTS: Partial<Record<string, readonly string[]>> = { filter: ['discarded'] }

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

/**
 * Rows from one place: a step a node reads, with its role or port, e.g. a GIS node's land layer, or one of the
 * node's own branches; `muted` for the catch-all branch. `typeId` is the kind that produced the rows.
 */
export type DataGroup = { id: string; name: string; typeId: string; role?: string; muted?: boolean; records: readonly DataRecord[] | null }

type RowsProps = { records: readonly DataRecord[]; query: string; layout?: RecordLayout; onViewAll: () => void }

/** A kind's one-row output, e.g. a verdict, reads as a document; any other rows as a table. */
const readsAsRecord = (records: readonly DataRecord[], layout: RecordLayout | undefined) => records.length === 1 && Boolean(layout)

/** Rows as a table, cut off where "View all data" takes over; a kind's one-row output as a document. */
function Rows({ records, query, layout, onViewAll }: RowsProps) {
  if (readsAsRecord(records, layout)) return <RecordFields record={records[0]} query={query} layout={layout} />
  const matches = filterRecords(records, query)
  return (
    <>
      <DataViewBody view="table" records={matches.slice(0, MAX_ROWS)} query={query} bare />
      {matches.length > MAX_ROWS ? (
        <button type="button" className={styles.viewAll} onClick={onViewAll}>
          View all data
        </button>
      ) : null}
    </>
  )
}

type GroupListProps = {
  groups: readonly DataGroup[]
  label: string
  open: readonly string[]
  onToggle: (id: string) => void
  query: string
  onViewAll: () => void
}

/**
 * A node's inputs or branches, one per row, opened to show their rows; kept apart because a node's inputs rarely
 * share columns, and a branch's rows read best on their own. A record reads as its kind's output would, its tag
 * left out.
 */
function GroupList({ groups, label, open, onToggle, query, onViewAll }: GroupListProps) {
  return (
    <ul className={styles.inputs} aria-label={label}>
      {groups.map((group) => {
        const expanded = open.includes(group.id)
        const rows = group.records ?? []
        const layout = RECORD_LAYOUTS[group.typeId]
        const shown = query.trim() && !readsAsRecord(rows, layout) ? filterRecords(rows, query).length : rows.length
        return (
          <li key={group.id} className={styles.inputItem}>
            <button type="button" className={styles.inputHead} aria-expanded={expanded} title={group.name} onClick={() => onToggle(group.id)}>
              <CaretRight className={styles.inputCaret} size={12} weight="bold" aria-hidden />
              <span className={styles.inputName} data-muted={group.muted || undefined}>
                {group.name}
              </span>
              {group.role ? <span className={styles.inputRole}>{group.role}</span> : null}
              <span className={styles.inputCount}>
                {!group.records ? 'Not run' : shown === rows.length ? rowCount(rows.length) : `${shown} of ${rows.length}`}
              </span>
            </button>
            {expanded ? (
              <div className={styles.inputBody}>
                {rows.length ? (
                  <Rows records={rows} query={query} layout={layout && { ...layout, header: undefined }} onViewAll={onViewAll} />
                ) : (
                  <p className={styles.empty}>{group.records ? 'No rows.' : 'No rows yet: run this step first.'}</p>
                )}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** A saved app: its thumbnail and title, then the agent's summary and any warning; the id stays out of sight. */
function SavedApp({ record }: { record: DataRecord }) {
  const navigation = record.navigation === 'sequential' ? 'sequential' : 'tabs'
  const pages = Number(record.pages) || 0
  return (
    <div className={styles.made}>
      <figure className={styles.app}>
        <img className={styles.appThumb} src={APP_THUMBNAIL[navigation]} alt="" />
        <figcaption className={styles.appCaption}>
          <span className={styles.appText}>
            <span className={styles.appTitle} title={displayValue(record.created_entity_title)}>
              {displayValue(record.created_entity_title)}
            </span>
            <span className={styles.appMeta}>
              {pages} {APP_NAVIGATION_LABEL[navigation].toLowerCase()} {pages === 1 ? 'page' : 'pages'} · Saved to Apps
            </span>
          </span>
          <button type="button" className={styles.appOpen}>
            Open app
          </button>
        </figcaption>
      </figure>
      {record.text ? <p className={styles.recordValue}>{displayValue(record.text)}</p> : null}
      {record.warning ? (
        <p className={styles.madeWarning}>
          <Warning size={14} weight="fill" aria-hidden />
          {displayValue(record.warning)}
        </p>
      ) : null}
    </div>
  )
}

/** The asset a run saved, drawn as it will look, then its title and type; a test run draws the same rows without saving them. */
function SavedAsset({ settings, rows, saved }: { settings: CreateAssetSettings; rows: readonly DataRecord[]; saved: boolean }) {
  const { chartType } = settings
  const preview = previewOf(chartType)
  const title = settings.title?.trim() || 'Workflow Asset'
  return (
    <div className={styles.made}>
      <figure className={styles.app}>
        <div className={styles.assetVisual} data-preview={preview}>
          {preview === 'map' ? (
            <NodeAssetPreview kind="map" data={{ view: settings, rows }} interactive bare hint={false} />
          ) : preview === 'table' ? (
            <DataViewBody view="table" records={rows.slice(0, MAX_ROWS)} query="" bare />
          ) : (
            <AssetPreviewChart settings={settings} records={rows} flush />
          )}
        </div>
        <figcaption className={styles.appCaption}>
          <span className={styles.appText}>
            <span className={styles.appTitle} title={title}>
              {title}
            </span>
            <span className={styles.appMeta}>
              {chartName(chartType)} · {rowCount(rows.length)} · {saved ? 'Saved to Assets' : 'Not saved on a test run'}
            </span>
          </span>
          {saved ? (
            <button type="button" className={styles.appOpen}>
              Open asset
            </button>
          ) : null}
        </figcaption>
      </figure>
    </div>
  )
}

type NodeDataDialogProps = {
  node: CanvasNode
  type: NodeType
  run: NodeRun
  input: readonly DataRecord[] | null
  output: readonly DataRecord[] | null
  /** Each step the node reads, wired in or referenced; with more than one, the Input side lists them apart. */
  inputGroups?: readonly DataGroup[]
  anchor: NodeDataAnchor
  /** Heights of the top and bottom chrome to stay between. */
  clearTop: number
  clearBottom: number
  onClose: () => void
  /** Opens the node's full input and output, past the rows shown here. */
  onViewAll: () => void
  /** Answers a Send and wait step parked on the chat. */
  onReply?: (reply: ChatReply) => void
}

/** A node's input or output rows, beside the node; the canvas stays usable while it's open. */
export function NodeDataDialog({
  node,
  type,
  run,
  input,
  output,
  inputGroups,
  anchor,
  clearTop,
  clearBottom,
  onClose,
  onViewAll,
  onReply,
}: NodeDataDialogProps) {
  const windowRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const TypeIcon = type.icon
  const hasInputs = type.inputs.length > 0
  const hidden = HIDDEN_OUTPUTS[type.id] ?? []
  const branches = nodeOutputs(node, type).filter((port) => !hidden.includes(port.id))
  const ports = run.ports && (branches.length > 1 || hidden.length) ? run.ports : undefined
  const outputGroups: DataGroup[] | undefined =
    ports && branches.length > 1
      ? branches.map((port) => ({ id: port.id, name: port.label ?? port.id, typeId: type.id, muted: isFallbackBranch(port.id), records: ports[port.id] ?? [] }))
      : undefined
  const inputs = inputGroups && inputGroups.length > 1 ? inputGroups : undefined
  const merged = (groups: readonly DataGroup[]) => (groups.some((group) => group.records) ? groups.flatMap((group) => group.records ?? []) : null)
  const shownOutput = outputGroups ? merged(outputGroups) : ports && branches[0] ? (ports[branches[0].id] ?? []) : output
  const views = nodeDataViews(run, inputs ? merged(inputs) : input, shownOutput, type.category === 'triggers', hasInputs)
  const available = nodeDataSides(views, hasInputs)
  const sides: readonly DataSide[] = available.length ? available : ['output']
  const [chosen, setChosen] = useState<DataSide>(sides.includes('output') ? 'output' : sides[0])
  const side = sides.includes(chosen) ? chosen : sides[0]
  const [typed, setQuery] = useState('')
  const groups = side === 'input' ? inputs : outputGroups
  /** Open rows per side; all start closed. */
  const [openBySide, setOpenBySide] = useState<Partial<Record<DataSide, readonly string[]>>>({})
  const open = openBySide[side] ?? []
  const openKey = open.join()
  const toggleGroup = (id: string) => setOpenBySide({ ...openBySide, [side]: open.includes(id) ? open.filter((item) => item !== id) : [...open, id] })

  const tabbed = sides.length > 1
  const view = views[side]
  const records = view.records ?? []
  const savedApp = side === 'output' && records.length === 1 && records[0].created_entity_kind === 'app'
  const assetRows = side === 'output' && type.id === 'createAsset' && view.records ? (run.assetRows ?? view.records) : undefined
  const layout = side === 'output' ? RECORD_LAYOUTS[type.id] : undefined
  const asRecord = !groups && readsAsRecord(records, layout)
  /** Only where there's something to sift: several rows, or one long record. */
  const finding = side === 'output' ? view.finding : undefined
  const chat = side === 'output' ? view.chat : undefined
  const email = side === 'output' ? view.email : undefined
  const api = side === 'output' ? view.api : undefined
  const searchable = finding === undefined && !chat && !email && !api && !assetRows && (records.length > 1 || (asRecord && !savedApp && Object.keys(records[0]).length > SEARCH_FIELDS))
  const query = searchable ? typed : ''
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
  }, [anchor.left, anchor.top, anchor.right, anchor.bottom, clearTop, clearBottom, side, query, openKey])

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

  const count = (target: DataSide) => {
    const { records: rows, finding: written, chat: sent, email: mailed, api: called } = views[target]
    if (written !== undefined) return written ? 'Preview' : 'No finding'
    if (sent) return run.status === 'waiting' ? 'Waiting' : sent.posted ? 'Posted' : 'Not posted'
    if (mailed) return mailed.sent ? 'Sent' : 'Not sent'
    if (called) return statusLine(called.status)
    if (target === 'output' && type.id === 'createAsset' && rows && run.assetRows) return 'Saved'
    return rows ? rowCount(rows.length) : 'Failed'
  }

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

      <div className={styles.controls} data-tabbed={tabbed || undefined} data-search={searchable || undefined}>
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
        {searchable ? (
          <label className={styles.search}>
            <MagnifyingGlass size={14} aria-hidden />
            <input
              className={styles.searchInput}
              value={typed}
              placeholder={asRecord ? 'Search fields…' : 'Search rows…'}
              aria-label={asRecord ? 'Search fields' : 'Search rows'}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        ) : null}
      </div>

      <div
        className={styles.scroll}
        role={tabbed ? 'tabpanel' : 'region'}
        aria-label={`${SIDE_LABELS[side]} rows`}
      >
        {api ? (
          <div className={styles.made}>
            {view.error ? <p className={`${styles.empty} ${styles.error}`}>{view.error}</p> : null}
            <ApiPreview api={api} />
          </div>
        ) : view.error && !view.records ? (
          <p className={`${styles.empty} ${styles.error}`}>{view.error}</p>
        ) : chat ? (
          <ChatPreview chat={chat} onReply={onReply} className={styles.made} />
        ) : email ? (
          <EmailPreview email={email} className={styles.made} />
        ) : finding !== undefined ? (
          finding ? (
            <FindingReport finding={finding} className={styles.made} />
          ) : (
            <p className={styles.empty}>{view.emptyMessage}</p>
          )
        ) : groups ? (
          <GroupList
            groups={groups}
            label={side === 'input' ? 'Inputs' : 'Branches'}
            open={open}
            onToggle={toggleGroup}
            query={query}
            onViewAll={onViewAll}
          />
        ) : assetRows ? (
          <SavedAsset settings={paramsFor('createAsset', node.config.params)} rows={assetRows} saved={Boolean(run.assetRows)} />
        ) : !records.length ? (
          <p className={styles.empty}>No rows.</p>
        ) : savedApp ? (
          <SavedApp record={records[0]} />
        ) : (
          <Rows records={records} query={query} layout={layout} onViewAll={onViewAll} />
        )}
      </div>
    </div>
  )
}
