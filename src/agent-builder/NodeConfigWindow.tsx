import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import {
  CaretLeft,
  CaretRight,
  ChatCircleDots,
  CheckCircle,
  CircleNotch,
  Database,
  MagnifyingGlass,
  MinusCircle,
  Play,
  Plugs,
  Stack,
  TestTube,
  WarningCircle,
  X,
  type Icon,
} from '@phosphor-icons/react'
import { Field, Menu, Popover, Select } from './ConfigControls'
import { buttonClass, inputClass, layerClass, PopoverLayer, ShowMissing } from './configStyles'
import { columnsOf } from './createAsset'
import { DataViewBody, type DataView } from './DataViews'
import { FieldTree, type TreeSource } from './FieldTree'
import { ChatPreview } from './ChatPreview'
import { ApiPreview } from './ApiPreview'
import { EmailPreview } from './EmailPreview'
import type { ChatReply } from './chatMessage'
import { FindingReport } from './FindingReport'
import { SAMPLE_ROWS } from './flowData'
import { llumenVars } from './globalVars'
import { KindConfig } from './KindConfig'
import { referencesFor, type EditorContext } from './kindEditor'
import { kindSummary, type AnyParams } from './nodeKinds'
import { formatBytes } from './recordUtils'
import { NodeSettingsPanel } from './NodeSettingsPanel'
import { currentProblemKeys, needsInput, type ProblemAction } from './nodeProblems'
import { ProblemReport } from './ProblemReport'
import {
  nodeName,
  nodeOutputs,
  nodeSettings,
  type CanvasNode,
  type DataRecord,
  type NodeCategoryId,
  type NodeConfig,
  type NodeRun,
  type NodeSettings,
  type NodeType,
} from './nodeCatalog'
import tones from './nodeTones.module.css'
import kindStyles from './KindConfig.module.css'
import styles from './NodeConfigWindow.module.css'

const LABEL_MAX = 60

/** Exact tab labels from the builder; Global Vars is input-only. */
const INPUT_TABS: readonly { id: DataView | 'vars'; label: string }[] = [
  { id: 'schema', label: 'Schema' },
  { id: 'table', label: 'Table' },
  { id: 'json', label: 'JSON' },
  { id: 'vars', label: 'Global Vars' },
]
const OUTPUT_TABS = INPUT_TABS.slice(0, 3) as readonly { id: DataView; label: string }[]
/** Messages read first as the recipient sees them; the step's record stays a tab away. */
const PREVIEW_TAB_LABEL: Readonly<Record<string, string>> = { sendChatMessage: 'Chat', sendEmail: 'Email', sendApiRequest: 'Request' }

const TRIGGER_ACTIONS: Record<string, string> = {
  scheduleTrigger: 'Run Schedule Now',
  chatInput: 'Test Chat',
  webhook: 'Send Test Webhook',
}

export type NeighbourNode = { id: string; name: string; icon: Icon; tone: string }
/** An ancestor and what it produced on its last run; `alias` is how templates reference it. */
export type UpstreamNode = NeighbourNode & {
  run: NodeRun
  records: DataRecord[] | null
  direct: boolean
  alias: string
  typeId: string
  category: NodeCategoryId
}

const SIDE_EFFECT_WARNING: Record<string, string> = {
  sendEmail: 'This sends the email to its recipients, unless no mail server is set up.',
  sendChatMessage: 'This posts the message in the Flow’s chat session, if the run has one.',
  sendApiRequest: 'This calls the API for real.',
}

type NodeConfigWindowProps = {
  node: CanvasNode
  type: NodeType
  run: NodeRun
  workflowName: string
  /** Nodes wired straight into and out of this one, for the header pills. */
  previous: readonly NeighbourNode[]
  next: readonly NeighbourNode[]
  /** Every ancestor, nearest first. */
  upstream: readonly UpstreamNode[]
  /** Hand-written input that replaces the upstream rows for this node's test runs. */
  fixture: DataRecord[] | null
  onConfig: (patch: Partial<NodeConfig>, key: string) => void
  onParams: (patch: Partial<AnyParams>, key: string) => void
  hasChatTrigger: boolean
  onSettings: (patch: Partial<NodeSettings>) => void
  onFixture: (records: DataRecord[] | null) => void
  onExecute: () => void
  onExecutePrevious: () => void
  /** Answers a Send and wait step parked on the chat. */
  onReply?: (reply: ChatReply) => void
  /** A branch to open on, e.g. the case edited from the card. */
  focus?: string
  /** A problem's fix to open on, picked from the canvas: its field, or fixture input. */
  reveal?: ProblemAction
  onNavigate: (id: string) => void
  onClose: () => void
}

type ConfigTab = 'configuration' | 'settings'

const mergeRecords = (sources: readonly UpstreamNode[]) =>
  sources.some((source) => source.records) ? sources.flatMap((source) => source.records ?? []) : null

/** The node's configuration window: input on the left, its settings in the middle, output on the right. */
export function NodeConfigWindow(props: NodeConfigWindowProps) {
  const { node, type, run, previous, next, upstream, fixture, reveal, onClose } = props
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  /** A field chip is being dragged, so the fields it can drop into are marked. */
  const [fieldDrag, setFieldDrag] = useState(false)
  const windowRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const TypeIcon = type.icon
  const isTrigger = type.category === 'triggers'
  const hasInput = type.inputs.length > 0
  const name = nodeName(node, type)
  const summary = kindSummary(type.id, node.config.params) ?? (isTrigger ? undefined : type.title)
  const [tab, setTab] = useState<ConfigTab>(reveal?.kind === 'field' && reveal.tab ? reveal.tab : 'configuration')
  const [fixtureOpen, setFixtureOpen] = useState(reveal?.kind === 'fixture')
  const [shownId, setShownId] = useState(node.id)
  if (shownId !== node.id) {
    setShownId(node.id)
    setTab('configuration')
    setFixtureOpen(false)
  }
  const steps = upstream.filter((step) => step.category !== 'triggers').map(({ id, typeId, name, direct }) => ({ id, typeId, name, direct }))
  const current = currentProblemKeys(type.id, node.config.params, needsInput(type.id, type.inputs.length) && !previous.length && !fixture, () => ({
    wired: steps.filter((step) => step.direct),
    upstream: steps,
  }))

  const act = (action: ProblemAction) => {
    if (action.kind === 'fixture') return setFixtureOpen(true)
    if (action.kind === 'executePrevious') return props.onExecutePrevious()
    setTab(action.tab ?? 'configuration')
    requestAnimationFrame(() => revealField(windowRef.current, action.field))
  }

  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null
    windowRef.current?.focus({ preventScroll: true })
    return () => returnFocus?.focus?.({ preventScroll: true })
  }, [])

  const revealed = reveal?.kind === 'field' ? reveal.field : undefined
  useEffect(() => {
    if (!revealed) return
    const frame = requestAnimationFrame(() => revealField(windowRef.current, revealed))
    return () => cancelAnimationFrame(frame)
  }, [revealed])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const connected = fixture ?? mergeRecords(upstream.filter((source) => source.direct))

  return (
    <div className={styles.overlay} data-native-scroll onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={windowRef}
        className={`${styles.window} ${tones[`tone_${type.tone}`]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-field-drag={fieldDrag || undefined}
      >
        <PopoverLayer.Provider value={layer}>
          <header className={styles.head}>
            <div className={styles.headSide}>
              <NeighbourPill direction="previous" nodes={previous} onNavigate={props.onNavigate} />
            </div>
            <div className={styles.headCenter}>
              <span className={styles.headIcon} aria-hidden>
                <TypeIcon size={18} weight="fill" />
              </span>
              <div className={styles.headText}>
                <h2 id={titleId} className={styles.headTitle}>
                  {name}
                </h2>
                {summary && summary !== name ? <p className={styles.headSummary}>{summary}</p> : null}
              </div>
            </div>
            <div className={`${styles.headSide} ${styles.headEnd}`}>
              <NeighbourPill direction="next" nodes={next} onNavigate={props.onNavigate} />
              <button type="button" className={styles.close} aria-label="Close configuration" onClick={onClose}>
                <X size={16} weight="bold" aria-hidden />
              </button>
            </div>
          </header>

          <div key={node.id} className={hasInput ? styles.columns : `${styles.columns} ${styles.columnsNoInput}`}>
            {hasInput ? (
              <InputColumn
                upstream={upstream}
                fixture={fixture}
                workflowName={props.workflowName}
                onClearFixture={() => props.onFixture(null)}
                onExecutePrevious={props.onExecutePrevious}
                onFieldDrag={setFieldDrag}
              />
            ) : null}
            <ConfigColumn
              {...props}
              name={name}
              isTrigger={isTrigger}
              hasInput={hasInput}
              connected={connected}
              tab={tab}
              onTab={setTab}
              fixtureOpen={fixtureOpen}
              onFixtureOpen={setFixtureOpen}
            />
            <OutputColumn
              node={node}
              type={type}
              run={run}
              format={type.category === 'dataFlow' ? 'parquet' : 'json'}
              current={current}
              onAction={act}
              onReply={props.onReply}
            />
          </div>
          <div ref={setLayer} className={layerClass} />
        </PopoverLayer.Provider>
      </div>
    </div>
  )
}

/** Brings a configuration field into view, by its label, and focuses its control. */
function revealField(root: HTMLElement | null, label: string) {
  const name = CSS.escape(label)
  const column = '[aria-label="Configuration"]'
  const field = root?.querySelector<HTMLElement>(`${column} [data-field="${name}"], ${column} [role="group"][aria-label="${name}"]`)
  const card = [...(root?.querySelectorAll<HTMLElement>(`${column} section[aria-labelledby]`) ?? [])].find(
    (section) => document.getElementById(section.getAttribute('aria-labelledby') ?? '')?.textContent?.trim() === label,
  )
  const target = field ?? card
  if (!target) return
  target.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  if (field) (field.querySelector('label')?.control ?? field.querySelector<HTMLElement>('input, textarea, select, button'))?.focus({ preventScroll: true })
  target.removeAttribute('data-attention')
  void target.offsetWidth
  target.setAttribute('data-attention', '')
  target.addEventListener('animationend', () => target.removeAttribute('data-attention'), { once: true })
}

/* ---------- Header ---------- */

function NeighbourPill({
  direction,
  nodes,
  onNavigate,
}: {
  direction: 'previous' | 'next'
  nodes: readonly NeighbourNode[]
  onNavigate: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const first = nodes[0]
  if (!first) return null
  const NodeIcon = first.icon
  const many = nodes.length > 1
  const label = direction === 'previous' ? 'Previous node' : 'Next node'
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={styles.pill}
        aria-label={many ? `${label}s` : `${label}: ${first.name}`}
        aria-haspopup={many ? 'menu' : undefined}
        aria-expanded={many ? open : undefined}
        onClick={() => (many ? setOpen((current) => !current) : onNavigate(first.id))}
      >
        {direction === 'previous' ? <CaretLeft size={12} weight="bold" aria-hidden /> : null}
        <span className={`${styles.pillIcon} ${tones[`tone_${first.tone}`]}`} aria-hidden>
          <NodeIcon size={12} weight="fill" />
        </span>
        <span className={styles.pillName}>{first.name}</span>
        {many ? <span className={styles.pillCount}>+{nodes.length - 1}</span> : null}
        {direction === 'next' ? <CaretRight size={12} weight="bold" aria-hidden /> : null}
      </button>
      {open ? (
        <Menu
          anchorRef={ref}
          label={`${label}s`}
          align={direction === 'next' ? 'end' : 'start'}
          items={nodes.map((item) => {
            const ItemIcon = item.icon
            return {
              id: item.id,
              label: item.name,
              icon: (
                <span className={`${styles.pillIcon} ${tones[`tone_${item.tone}`]}`}>
                  <ItemIcon size={12} weight="fill" />
                </span>
              ),
            }
          })}
          onPick={(id) => {
            setOpen(false)
            onNavigate(id)
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

/* ---------- Columns ---------- */

/** Small underlined tabs; the bar runs out to the column's edges by `--column-pad`. */
export function Tabs<T extends string>({
  tabs,
  value,
  label,
  onChange,
  trailing,
}: {
  tabs: readonly { id: T; label: string; count?: number }[]
  value: T
  label: string
  onChange: (value: T) => void
  /** Sits at the bar's far end, outside the tab list, e.g. a count. */
  trailing?: ReactNode
}) {
  const list = (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          className={styles.tab}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count === undefined ? null : <span className={styles.tabCount}>{tab.count.toLocaleString()}</span>}
        </button>
      ))}
    </div>
  )
  return trailing ? (
    <div className={styles.tabsBar}>
      {list}
      <span className={styles.tabsTrailing}>{trailing}</span>
    </div>
  ) : (
    list
  )
}

function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden>
        {icon}
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {children ? <p className={styles.emptyText}>{children}</p> : null}
      {action}
    </div>
  )
}

type InputColumnProps = {
  upstream: readonly UpstreamNode[]
  fixture: DataRecord[] | null
  workflowName: string
  onClearFixture: () => void
  onExecutePrevious: () => void
  onFieldDrag: (dragging: boolean) => void
}

/** The source picker's entry for every upstream node at once. */
const ALL_SOURCES = '*all'

function InputColumn({ upstream, fixture, workflowName, onClearFixture, onExecutePrevious, onFieldDrag }: InputColumnProps) {
  const direct = upstream.filter((item) => item.direct)
  const [tab, setTab] = useState<DataView | 'vars'>('schema')
  const [sourceId, setSourceId] = useState<string | undefined>(() => (upstream.length > 1 ? ALL_SOURCES : upstream[0]?.id))
  const [query, setQuery] = useState('')
  /** Only the schema lists every node; the table and JSON show one, the first connected node with data unless one is picked. */
  const canShowAll = tab === 'schema' && upstream.length > 1
  const all = sourceId === ALL_SOURCES && canShowAll && !fixture
  const fallback = direct.find((item) => item.records) ?? upstream.find((item) => item.records) ?? upstream[0]
  const source = all ? undefined : (upstream.find((item) => item.id === sourceId) ?? fallback)
  const records = fixture ?? (all ? mergeRecords(upstream) : (source?.records ?? null))
  const running = upstream.some((item) => item.run.status === 'running')
  /** The rows coming straight in are `{{field}}`; with several inputs, or from earlier steps, a field names its node. */
  const tokenPrefix = (item: UpstreamNode) => (item.direct && direct.length === 1 ? null : item.alias)
  const treeSource = (item: UpstreamNode, open: boolean): TreeSource => ({
    id: item.id,
    name: item.name,
    icon: item.icon,
    tone: item.tone,
    records: item.records,
    prefix: tokenPrefix(item),
    open,
  })
  const fixtureSource: TreeSource = { id: 'fixture', name: 'Fixture input', icon: TestTube, tone: 'data', records: fixture, prefix: null, open: true }

  const body = () => {
    if (tab === 'vars') return <GlobalVars workflowName={workflowName} />
    if (!upstream.length && !fixture) {
      return (
        <EmptyState icon={<Plugs size={20} />} title="No upstream nodes">
          Connect an upstream node to inspect its output here.
        </EmptyState>
      )
    }
    if (!records) {
      return (
        <EmptyState
          icon={running ? <CircleNotch className={styles.spin} size={20} /> : <Database size={20} />}
          title={running ? 'Running previous nodes…' : 'No data yet.'}
          action={
            <button type="button" className={buttonClass()} disabled={running} onClick={onExecutePrevious}>
              <Play size={14} weight="fill" aria-hidden />
              Execute Previous Nodes
            </button>
          }
        >
          {source?.run.status === 'error' ? `${source.name} failed: ${source.run.message ?? 'see its output.'}` : null}
        </EmptyState>
      )
    }
    if (all) return <FieldTree key={ALL_SOURCES} sources={upstream.map((item) => treeSource(item, item.direct))} query={query} onDragChange={onFieldDrag} />
    if (!records.length) return <EmptyState icon={<Database size={20} />} title="Execution completed without output" />
    if (tab === 'schema') {
      const only = fixture || !source ? fixtureSource : treeSource(source, true)
      return <FieldTree key={only.id} flat sources={[only]} query={query} onDragChange={onFieldDrag} />
    }
    const prefix = fixture || !source ? null : tokenPrefix(source)
    return <DataViewBody view={tab} records={records} query={query} fields={{ prefix, onDragChange: onFieldDrag }} />
  }

  return (
    <section className={styles.column} aria-label="Input">
      <div className={styles.columnHead}>
        <h3 className={styles.columnTitle}>Input</h3>
        <Tabs tabs={INPUT_TABS} value={tab} label="Input format" onChange={setTab} />
      </div>
      {tab !== 'vars' && (upstream.length || fixture) ? (
        <div className={styles.columnTools}>
          {fixture ? (
            <div className={styles.fixtureBanner}>
              <TestTube size={14} aria-hidden />
              <span>
                Fixture input · {fixture.length} {fixture.length === 1 ? 'item' : 'items'}
              </span>
              <button type="button" className={buttonClass(undefined, 'small')} onClick={onClearFixture}>
                Clear
              </button>
            </div>
          ) : (
            <Select
              label="Upstream node"
              value={all ? ALL_SOURCES : source?.id}
              options={[
                ...(canShowAll
                  ? [
                      {
                        id: ALL_SOURCES,
                        label: 'All nodes',
                        meta: `${upstream.length} nodes`,
                        icon: (
                          <span className={styles.pillIcon}>
                            <Stack size={12} weight="fill" />
                          </span>
                        ),
                      },
                    ]
                  : []),
                ...upstream.map((item) => {
                  const ItemIcon = item.icon
                  return {
                    id: item.id,
                    label: item.name,
                    group: item.direct ? 'Connected' : 'Earlier steps',
                    meta: item.records ? `${item.records.length} ${item.records.length === 1 ? 'item' : 'items'}` : 'Not run',
                    icon: (
                      <span className={`${styles.pillIcon} ${tones[`tone_${item.tone}`]}`}>
                        <ItemIcon size={12} weight="fill" />
                      </span>
                    ),
                  }
                }),
              ]}
              onChange={setSourceId}
            />
          )}
          {records?.length ? (
            <label className={styles.search}>
              <MagnifyingGlass size={14} aria-hidden />
              <input
                className={styles.searchInput}
                value={query}
                placeholder="Search input data…"
                aria-label="Search input data"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          ) : null}
        </div>
      ) : null}
      <div className={styles.columnScroll} data-native-scroll>
        {body()}
      </div>
    </section>
  )
}

/** The globals as the builder shows them; conditions read them as `{{ $llumen.… }}` and `{{ $vars.… }}`. */
function GlobalVars({ workflowName }: { workflowName: string }) {
  return (
    <div className={styles.vars}>
      <p className={styles.varsGroup}>$llumen</p>
      <DataViewBody view="schema" records={[llumenVars(workflowName)]} />
      <p className={styles.varsGroup}>$vars</p>
      <p className={styles.noMatch}>No workflow variables yet.</p>
    </div>
  )
}

type ConfigColumnProps = NodeConfigWindowProps & {
  name: string
  isTrigger: boolean
  hasInput: boolean
  connected: DataRecord[] | null
  tab: ConfigTab
  onTab: (tab: ConfigTab) => void
  fixtureOpen: boolean
  onFixtureOpen: (open: boolean) => void
}

function ConfigColumn({
  node,
  type,
  run,
  upstream,
  fixture,
  connected,
  isTrigger,
  hasInput,
  hasChatTrigger,
  onConfig,
  onParams,
  onSettings,
  onFixture,
  onExecute,
  onExecutePrevious,
  focus,
  workflowName,
  tab,
  onTab: setTab,
  fixtureOpen,
  onFixtureOpen: setFixtureOpen,
}: ConfigColumnProps) {
  const [confirming, setConfirming] = useState(false)
  const fixtureRef = useRef<HTMLButtonElement>(null)
  const executeRef = useRef<HTMLButtonElement>(null)
  const labelId = useId()
  const running = run.status === 'running'
  const label = node.config.name ?? ''
  const ctx: EditorContext = {
    node,
    type,
    run,
    records: connected,
    columns: connected ? columnsOf(connected) : [],
    upstream,
    references: referencesFor(connected, upstream),
    hasChatTrigger,
    onExecutePrevious,
    focus,
    workflowName,
  }

  return (
    <section className={`${styles.column} ${styles.configColumn}`} aria-label="Configuration">
      <div className={styles.configHead}>
        <div className={styles.switcher} role="tablist" aria-label="Configuration or settings">
          {(['configuration', 'settings'] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={styles.switcherTab} onClick={() => setTab(id)}>
              {id === 'configuration' ? 'Configuration' : 'Settings'}
            </button>
          ))}
        </div>
        <div className={styles.configActions}>
          {hasInput ? (
            <button
              ref={fixtureRef}
              type="button"
              className={buttonClass(fixture ? 'active' : undefined)}
              aria-expanded={fixtureOpen}
              onClick={() => setFixtureOpen(!fixtureOpen)}
            >
              <TestTube size={14} aria-hidden />
              With fixture input
            </button>
          ) : null}
          <button
            ref={executeRef}
            type="button"
            className={buttonClass('primary')}
            disabled={running}
            aria-haspopup={type.sideEffect ? 'dialog' : undefined}
            aria-expanded={type.sideEffect ? confirming : undefined}
            onClick={() => (type.sideEffect ? setConfirming((open) => !open) : onExecute())}
          >
            {running ? <CircleNotch className={styles.spin} size={14} weight="bold" aria-hidden /> : <Play size={14} weight="fill" aria-hidden />}
            {isTrigger ? (TRIGGER_ACTIONS[type.id] ?? 'Execute Node') : 'Execute Node'}
          </button>
        </div>
      </div>
      {confirming ? (
        <Popover anchorRef={executeRef} onClose={() => setConfirming(false)} align="end" label="Confirm live execution">
          <div className={kindStyles.confirm}>
            <p className={kindStyles.confirmTitle}>Run this action for real?</p>
            <p className={styles.hint}>{SIDE_EFFECT_WARNING[type.id] ?? 'This step has effects outside the flow.'} Test runs of actions aren’t sandboxed.</p>
            <div className={kindStyles.confirmActions}>
              <button type="button" className={buttonClass(undefined, 'small')} onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={buttonClass('primary', 'small')}
                onClick={() => {
                  setConfirming(false)
                  onExecute()
                }}
              >
                Execute
              </button>
            </div>
          </div>
        </Popover>
      ) : null}
      {fixtureOpen ? (
        <FixtureEditor
          anchorRef={fixtureRef}
          initial={fixture ?? connected ?? SAMPLE_ROWS}
          active={Boolean(fixture)}
          onApply={(records) => {
            onFixture(records)
            setFixtureOpen(false)
          }}
          onClose={() => setFixtureOpen(false)}
        />
      ) : null}

      <div className={styles.columnScroll} data-native-scroll>
        <div className={styles.stack}>
          {tab === 'configuration' ? (
            <>
              <Field label="Node Label" htmlFor={labelId} meta={`Optional · ${label.length}/${LABEL_MAX}`}>
                <input
                  id={labelId}
                  className={inputClass}
                  value={label}
                  maxLength={LABEL_MAX}
                  placeholder={type.title}
                  onChange={(event) => onConfig({ name: event.target.value || undefined }, 'name')}
                />
              </Field>
              <ShowMissing value={run.status === 'error'}>
                <KindConfig ctx={ctx} onParams={onParams} />
              </ShowMissing>
            </>
          ) : (
            <NodeSettingsPanel settings={nodeSettings(node)} branching={nodeOutputs(node, type).length > 1} onChange={onSettings} />
          )}
        </div>
      </div>
    </section>
  )
}

function FixtureEditor({
  anchorRef,
  initial,
  active,
  onApply,
  onClose,
}: {
  anchorRef: RefObject<HTMLElement | null>
  initial: readonly DataRecord[]
  active: boolean
  onApply: (records: DataRecord[] | null) => void
  onClose: () => void
}) {
  const [text, setText] = useState(() => JSON.stringify(initial, null, 2))
  const [error, setError] = useState<string | null>(null)
  const textareaId = useId()

  const apply = () => {
    try {
      const parsed: unknown = JSON.parse(text)
      const rows = Array.isArray(parsed) ? parsed : [parsed]
      if (!rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) throw new Error('rows')
      onApply(rows as DataRecord[])
    } catch {
      setError('Enter a JSON object or an array of objects.')
    }
  }

  return (
    <Popover anchorRef={anchorRef} onClose={onClose} align="end" label="Fixture input">
      <div className={styles.fixture}>
        <label className={styles.label} htmlFor={textareaId}>
          Fixture input
        </label>
        <p className={styles.hint}>Test this node against these rows instead of the previous step’s output.</p>
        <textarea
          id={textareaId}
          className={styles.fixtureText}
          value={text}
          spellCheck={false}
          aria-invalid={Boolean(error)}
          onChange={(event) => {
            setText(event.target.value)
            setError(null)
          }}
        />
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.fixtureActions}>
          {active ? (
            <button type="button" className={buttonClass(undefined, 'small')} onClick={() => onApply(null)}>
              Stop using fixture
            </button>
          ) : null}
          <button type="button" className={buttonClass('primary', 'small')} onClick={apply}>
            Use fixture
          </button>
        </div>
      </div>
    </Popover>
  )
}

const FINDINGS_NOTE = 'Findings are written for runs of the published Flow, not for test runs from the builder. Run this node to preview the finding a published run would write.'

type OutputColumnProps = {
  node: CanvasNode
  type: NodeType
  run: NodeRun
  format: string
  /** The problems the node has now, to mark the run's fixed ones. */
  current: ReadonlySet<string>
  onAction: (action: ProblemAction) => void
  onReply?: (reply: ChatReply) => void
}

function OutputColumn({ node, type, run, format, current, onAction, onReply }: OutputColumnProps) {
  const previewLabel = PREVIEW_TAB_LABEL[type.id]
  const [tab, setTab] = useState<DataView | 'preview'>(previewLabel ? 'preview' : 'schema')
  const outputs = nodeOutputs(node, type)
  const branching = outputs.length > 1
  const [picked, setPicked] = useState<string | null>(null)
  const ports = run.ports ?? {}
  const portId = picked && outputs.some((port) => port.id === picked) ? picked : (outputs.find((port) => ports[port.id]?.length)?.id ?? outputs[0]?.id)
  const records = run.status === 'success' || (run.status === 'error' && run.ports) ? (portId ? (ports[portId] ?? (branching ? [] : null)) : null) : null
  const finding = run.status === 'success' ? run.finding : undefined
  const chat = (run.status === 'success' || run.status === 'waiting') && previewLabel ? run.chat : undefined
  const email = run.status === 'success' && previewLabel ? run.email : undefined
  const api = (run.status === 'success' || run.status === 'error') && previewLabel ? run.api : undefined
  const previewing = (chat || email || api) && tab === 'preview'
  const [query, setQuery] = useState('')
  const searchable = Boolean(records?.length) && !previewing && !finding && run.status !== 'running'
  const status =
    run.status === 'success'
      ? { label: 'Succeeded', icon: <CheckCircle size={12} weight="fill" aria-hidden /> }
      : run.status === 'error'
        ? { label: 'Failed', icon: <WarningCircle size={12} weight="fill" aria-hidden /> }
        : run.status === 'running'
          ? { label: 'Executing', icon: <CircleNotch className={styles.spin} size={12} weight="bold" aria-hidden /> }
          : run.status === 'waiting'
            ? { label: 'Waiting for a reply', icon: <ChatCircleDots size={12} weight="fill" aria-hidden /> }
            : run.status === 'skipped'
            ? { label: 'Skipped', icon: <MinusCircle size={12} weight="fill" aria-hidden /> }
            : null

  const body = () => {
    if (run.status === 'running') return <EmptyState icon={<CircleNotch className={styles.spin} size={20} />} title="Executing…" />
    if (api && tab === 'preview') return <ApiPreview api={api} className={styles.finding} />
    if (run.status === 'error' && !records?.length) return <ProblemReport run={run} current={current} onAction={onAction} />
    if (run.status === 'skipped') {
      return (
        <EmptyState icon={<MinusCircle size={20} />} title="Skipped">
          {run.message}
        </EmptyState>
      )
    }
    if (chat && (tab === 'preview' || !records)) return <ChatPreview chat={chat} onReply={onReply} className={styles.finding} />
    if (email && tab === 'preview') return <EmailPreview email={email} className={styles.finding} />
    if (finding) return <FindingReport finding={finding} className={styles.finding} />
    if (finding === null) {
      return (
        <EmptyState icon={<Database size={20} />} title="Nothing to write about">
          {run.note}
        </EmptyState>
      )
    }
    if (!records) {
      return (
        <EmptyState icon={<Database size={20} />} title="No output data">
          {type.id === 'aiFindings' ? FINDINGS_NOTE : 'Run this node from the builder to populate schema, table, and JSON previews here.'}
        </EmptyState>
      )
    }
    if (!records.length) {
      return (
        <EmptyState icon={<CheckCircle size={20} />} title={branching ? 'No rows on this branch' : 'Execution completed without output'}>
          {type.id === 'aiFindings' ? FINDINGS_NOTE : run.note}
        </EmptyState>
      )
    }
    return <DataViewBody view={tab === 'preview' ? 'schema' : tab} records={records} query={query} structured />
  }

  return (
    <section className={styles.column} aria-label="Output">
      <div className={styles.columnHead}>
        <div className={styles.outputTitleRow}>
          <h3 className={styles.columnTitle}>Output</h3>
          {status ? (
            <span className={styles.status} data-status={run.status}>
              {status.icon}
              {status.label}
            </span>
          ) : null}
        </div>
        {records ? (
          <p className={styles.columnMeta}>
            {records.length
              ? `${records.length} ${records.length === 1 ? 'item' : 'items'} · ${format} · ${formatBytes(records)}`
              : branching
                ? 'No items on this branch'
                : 'No items'}
          </p>
        ) : null}
        {branching && (run.status === 'success' || run.ports) ? (
          <Tabs
            tabs={outputs.map((port) => ({ id: port.id, label: port.label ?? port.id, count: ports[port.id]?.length ?? 0 }))}
            value={portId ?? ''}
            label="Branch"
            onChange={setPicked}
          />
        ) : null}
        {type.id === 'aiFindings' ? null : <Tabs tabs={previewLabel ? [{ id: 'preview', label: previewLabel }, ...OUTPUT_TABS] : OUTPUT_TABS} value={tab} label="Output format" onChange={setTab} />}
      </div>
      {searchable ? (
        <div className={styles.columnTools}>
          <label className={styles.search}>
            <MagnifyingGlass size={14} aria-hidden />
            <input
              className={styles.searchInput}
              value={query}
              placeholder="Search output data…"
              aria-label="Search output data"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
      ) : null}
      {run.note && (records?.length || finding) && !previewing ? <p className={`${styles.hint} ${styles.outputNote}`}>{run.note}</p> : null}
      {run.status === 'error' && records?.length ? (
        <p className={`${styles.error} ${styles.outputNote}`}>
          {run.message} The error was published as output, so the steps after it ran.
        </p>
      ) : run.status === 'error' && previewing ? (
        <p className={`${styles.error} ${styles.outputNote}`}>{run.message}</p>
      ) : null}
      <div className={styles.columnScroll} data-native-scroll>
        {body()}
      </div>
    </section>
  )
}
