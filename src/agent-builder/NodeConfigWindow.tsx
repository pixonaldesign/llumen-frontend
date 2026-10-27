import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import {
  CaretLeft,
  CaretRight,
  CheckCircle,
  CircleNotch,
  Database,
  MagnifyingGlass,
  MinusCircle,
  Play,
  Plugs,
  TestTube,
  WarningCircle,
  X,
  type Icon,
} from '@phosphor-icons/react'
import { Field, Menu, Popover, Select } from './ConfigControls'
import { buttonClass, inputClass, layerClass, PopoverLayer } from './configStyles'
import { columnsOf } from './createAsset'
import { DataViewBody, type DataView } from './DataViews'
import { SAMPLE_ROWS } from './flowData'
import { KindConfig } from './KindConfig'
import { referencesFor, type EditorContext } from './kindEditor'
import { kindSummary, type AnyParams } from './nodeKinds'
import { formatBytes } from './recordUtils'
import { NodeSettingsPanel } from './NodeSettingsPanel'
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
  /** A branch to open on, e.g. the case edited from the card. */
  focus?: string
  onNavigate: (id: string) => void
  onClose: () => void
}

const mergeRecords = (sources: readonly UpstreamNode[]) =>
  sources.some((source) => source.records) ? sources.flatMap((source) => source.records ?? []) : null

/** The node's configuration window: input on the left, its settings in the middle, output on the right. */
export function NodeConfigWindow(props: NodeConfigWindowProps) {
  const { node, type, run, previous, next, upstream, fixture, onClose } = props
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const TypeIcon = type.icon
  const isTrigger = type.category === 'triggers'
  const hasInput = type.inputs.length > 0
  const name = nodeName(node, type)
  const summary = kindSummary(type.id, node.config.params) ?? (isTrigger ? undefined : type.title)

  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null
    windowRef.current?.focus({ preventScroll: true })
    return () => returnFocus?.focus?.({ preventScroll: true })
  }, [])

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
              />
            ) : null}
            <ConfigColumn
              {...props}
              name={name}
              isTrigger={isTrigger}
              hasInput={hasInput}
              connected={connected}
            />
            <OutputColumn node={node} type={type} run={run} format={type.category === 'dataFlow' ? 'parquet' : 'json'} />
          </div>
          <div ref={setLayer} className={layerClass} />
        </PopoverLayer.Provider>
      </div>
    </div>
  )
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

function Tabs<T extends string>({
  tabs,
  value,
  label,
  onChange,
}: {
  tabs: readonly { id: T; label: string }[]
  value: T
  label: string
  onChange: (value: T) => void
}) {
  return (
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
        </button>
      ))}
    </div>
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
}

function InputColumn({ upstream, fixture, workflowName, onClearFixture, onExecutePrevious }: InputColumnProps) {
  const [tab, setTab] = useState<DataView | 'vars'>('schema')
  const [sourceId, setSourceId] = useState<string | undefined>(() => upstream.find((source) => source.direct)?.id ?? upstream[0]?.id)
  const [query, setQuery] = useState('')
  const source = upstream.find((item) => item.id === sourceId) ?? upstream[0]
  const records = fixture ?? source?.records ?? null
  const running = upstream.some((item) => item.run.status === 'running')

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
    if (!records.length) return <EmptyState icon={<Database size={20} />} title="Execution completed without output" />
    return <DataViewBody view={tab} records={records} query={query} />
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
              value={source?.id}
              options={upstream.map((item) => {
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
              })}
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

/** Display-only trees, as in the builder; nothing substitutes them at run time. */
function GlobalVars({ workflowName }: { workflowName: string }) {
  const llumen: DataRecord = {
    'workflow.name': workflowName,
    'execution.id': 'exec_9b21',
    'execution.mode': 'builder_debug',
    now: new Date().toISOString().slice(0, 19) + 'Z',
  }
  return (
    <div className={styles.vars}>
      <p className={styles.varsGroup}>$llumen</p>
      <DataViewBody view="schema" records={[llumen]} />
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
}: ConfigColumnProps) {
  const [tab, setTab] = useState<'configuration' | 'settings'>('configuration')
  const [fixtureOpen, setFixtureOpen] = useState(false)
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
              onClick={() => setFixtureOpen((open) => !open)}
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
              <KindConfig ctx={ctx} onParams={onParams} />
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

const FINDINGS_NOTE = 'Findings are written for runs of the published Flow, not for test runs from the builder.'

function OutputColumn({ node, type, run, format }: { node: CanvasNode; type: NodeType; run: NodeRun; format: string }) {
  const [tab, setTab] = useState<DataView>('schema')
  const outputs = nodeOutputs(node, type)
  const branching = outputs.length > 1
  const [picked, setPicked] = useState<string | null>(null)
  const ports = run.ports ?? {}
  const portId = picked && outputs.some((port) => port.id === picked) ? picked : (outputs.find((port) => ports[port.id]?.length)?.id ?? outputs[0]?.id)
  const records = run.status === 'success' || (run.status === 'error' && run.ports) ? (portId ? (ports[portId] ?? (branching ? [] : null)) : null) : null
  const status =
    run.status === 'success'
      ? { label: 'Succeeded', icon: <CheckCircle size={12} weight="fill" aria-hidden /> }
      : run.status === 'error'
        ? { label: 'Failed', icon: <WarningCircle size={12} weight="fill" aria-hidden /> }
        : run.status === 'running'
          ? { label: 'Executing', icon: <CircleNotch className={styles.spin} size={12} weight="bold" aria-hidden /> }
          : run.status === 'skipped'
            ? { label: 'Skipped', icon: <MinusCircle size={12} weight="fill" aria-hidden /> }
            : null

  const body = () => {
    if (run.status === 'running') return <EmptyState icon={<CircleNotch className={styles.spin} size={20} />} title="Executing…" />
    if (run.status === 'error' && !records?.length) {
      return (
        <EmptyState icon={<WarningCircle size={20} />} title="Execution failed">
          {run.message ?? 'The node failed without a message.'}
          {run.ports ? ' On Error is set to continue, so the steps after it still ran.' : null}
          {run.code ? (
            <>
              {' '}
              <code className={kindStyles.hintCode}>{run.code}</code>
            </>
          ) : null}
        </EmptyState>
      )
    }
    if (run.status === 'skipped') {
      return (
        <EmptyState icon={<MinusCircle size={20} />} title="Skipped">
          {run.message}
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
    return <DataViewBody view={tab} records={records} />
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
        {records?.length ? (
          <p className={styles.columnMeta}>
            {records.length} {records.length === 1 ? 'item' : 'items'} · {format} · {formatBytes(records)}
          </p>
        ) : null}
        {branching && (run.status === 'success' || run.ports) ? (
          <Tabs
            tabs={outputs.map((port) => ({ id: port.id, label: `${port.label ?? port.id} · ${ports[port.id]?.length ?? 0}` }))}
            value={portId ?? ''}
            label="Branch"
            onChange={setPicked}
          />
        ) : null}
        <Tabs tabs={OUTPUT_TABS} value={tab} label="Output format" onChange={setTab} />
      </div>
      {run.note && records?.length ? <p className={`${styles.hint} ${styles.outputNote}`}>{run.note}</p> : null}
      {run.status === 'error' && records?.length ? (
        <p className={`${styles.error} ${styles.outputNote}`}>
          {run.message} The error was published as output, so the steps after it ran.
        </p>
      ) : null}
      <div className={styles.columnScroll} data-native-scroll>
        {body()}
      </div>
    </section>
  )
}
