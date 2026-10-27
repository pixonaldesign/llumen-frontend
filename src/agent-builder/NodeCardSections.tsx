import { useEffect, useState } from 'react'
import { ArrowsInSimple, ArrowsOutSimple, Info, Minus, PencilSimple, Plus, Warning } from '@phosphor-icons/react'
import { ContentBlockView, DataPreviewView } from './CardSectionViews'
import {
  cardContent,
  cardEdgeOutputs,
  cardHasFooter,
  cardHeader,
  cardTitle,
  cardValues,
  dataPreview,
  outputPreview,
  previewCount,
  type DataPreview,
  type HeaderAction,
} from './cardSections'
import { NodeDataCard } from './NodeDataCard'
import { RunInfo, RunStatus } from './NodeCardMinimal'
import { appearanceVars, inkRgb } from './nodeAppearance'
import { DetailBadges, NodeFill, Port, ResizeHandles, type NodeCardProps } from './nodeParts'
import type { FlowState } from './triggerCard'
import {
  nodeIssue,
  nodeNotice,
  nodeOutputs,
  NODE_DEFAULT_WIDTH,
  portKey,
  type CanvasNode,
  type DataRecord,
  type NodePort,
  type NodeRun,
  type PortSide,
} from './nodeCatalog'
import { plural } from './kindEditor'
import { branchAddLabel, isAuthoredBranch } from './nodeKinds'
import tones from './nodeTones.module.css'
import minimal from './NodeCardMinimal.module.css'
import styles from './NodeCardSections.module.css'

const UNPUBLISHED: FlowState = { published: false }

type Status = { text: string; tone?: 'error' }
type Countdown = NonNullable<NodeRun['countdown']>
type Footer = { view: 'input' | 'output'; preview: DataPreview | null; status: Status | null }

/** Output once the node has run, input while it waits on upstream data; null while there's nothing to show. */
function cardFooter(node: CanvasNode, run: NodeRun, input: readonly DataRecord[] | null, output: readonly DataRecord[] | null, isTrigger: boolean): Footer | null {
  if (run.status === 'idle' && !isTrigger && input?.length) return { view: 'input', preview: dataPreview(input), status: null }
  const preview = run.status === 'success' ? outputPreview(node, run, output) : null
  let status: Status | null = null
  if (run.status === 'running') status = { text: 'Running…' }
  else if (run.status === 'error') status = { text: run.message ?? 'This node failed.', tone: 'error' }
  else if (run.status === 'skipped') status = { text: run.message ?? 'Skipped.' }
  else if (run.note) status = { text: run.note }
  else if (!preview && run.status === 'success') status = { text: 'No output.' }
  return preview || status ? { view: 'output', preview, status } : null
}

/** `h:mm:ss`, or days and hours past a day; rounds up so the last second reads 0:01, not 0:00. */
function clock(seconds: number) {
  const total = Math.ceil(seconds)
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3600)
  if (days) return `${days}d ${hours}h`
  const minutes = Math.floor((total % 3600) / 60)
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours ? `${hours}:${pad(minutes)}:${pad(total % 60)}` : `${minutes}:${pad(total % 60)}`
}

/** A wait's time left and progress, ticking each frame over the playback, which may be a time-lapse of the wait. */
function WaitCountdown({ startedAt, playMs, seconds }: Countdown) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    let frame = requestAnimationFrame(function tick(time) {
      setNow(time)
      if (time - startedAt < playMs) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [startedAt, playMs])
  const progress = Math.min(1, Math.max(0, (now - startedAt) / playMs))
  return (
    <div className={styles.countdown} role="timer" aria-label={`Resumes in ${clock(seconds * (1 - progress))}`}>
      <div className={styles.countdownHead}>
        <span>Resumes in</span>
        <span className={styles.countdownTime}>{clock(seconds * (1 - progress))}</span>
      </div>
      <div className={styles.countdownTrack} aria-hidden>
        <span className={styles.countdownFill} style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
  )
}

function CardFooter({ view, preview, status }: Footer) {
  const count = preview ? previewCount(preview) : undefined
  const hint = preview?.kind === 'results' ? preview.hint : undefined
  return (
    <div className={styles.footer}>
      <div className={styles.footerHead}>
        <span className={styles.footerLabel}>{view === 'input' ? 'Input' : 'Output'}</span>
        {count ? <span>{count}</span> : null}
        {hint ? <span className={styles.footerHint}>{hint}</span> : null}
      </div>
      {preview ? <DataPreviewView preview={preview} /> : null}
      {status ? (
        <p className={styles.footerStatus} data-tone={status.tone} role={status.tone === 'error' ? 'alert' : undefined}>
          {status.text}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Sectioned node: a header with the category and the node's actions, content with the title and
 * whatever the node holds (values as badges, a prompt to edit, a map or chart), and a footer with its run data;
 * the run result sits above the card. What fills each section comes from `cardSections.ts`.
 */
export function NodeCardSections({
  node,
  type,
  position,
  selected,
  dragging,
  run,
  input,
  output,
  activePorts,
  connectedPorts,
  ports,
  resize,
  cardRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
  onAddOutput,
  appearanceOpen,
  dataOpen,
  onParamsChange,
  onToggleDetails,
  onOpenConfig,
  onRemoveOutput,
  inputSources,
  headless = false,
  onOpenData,
  flow = UNPUBLISHED,
}: NodeCardProps) {
  const TypeIcon = type.icon
  const isTrigger = type.category === 'triggers'
  const { category } = cardHeader(type)
  const { title, subtitle } = cardTitle(node, type)
  const blocks = cardContent(node)
  const values = cardValues(node, type, flow)
  const hidden = Boolean(node.config.hideDetails)
  const issue = nodeIssue(node) ?? nodeNotice(node)
  const outputs = nodeOutputs(node, type)
  const addLabel = branchAddLabel(type.id)
  const edgeOutputs = outputs.length > 1 && cardEdgeOutputs(type)
  const branchOutputs = outputs.length > 1 && !edgeOutputs
  const branchInputs = type.inputs.length > 1
  const empty = !blocks.length && !values.length && !branchOutputs && !branchInputs && !issue

  /* The header button only shows or hides the run data, on every kind; without a footer there's no button. */
  const footer = cardHasFooter(type) ? cardFooter(node, run, input, output, isTrigger) : null
  const actions: HeaderAction[] = []
  if (onOpenConfig && footer?.preview?.kind === 'asset') {
    actions.push({ id: 'editAsset', label: 'Edit asset', icon: PencilSimple, onSelect: () => onOpenConfig() })
  }
  if (headless) {
    if (onOpenData) actions.push({ id: 'data', label: 'Input and output', icon: Info, onSelect: onOpenData })
  } else if (onToggleDetails && footer) {
    const label = `${hidden ? 'Show' : 'Hide'} ${footer.view}`
    actions.push({ id: 'footer', label, icon: hidden ? ArrowsOutSimple : ArrowsInSimple, onSelect: onToggleDetails })
  }
  const actionBar = actions.length ? (
    <div className={styles.headerActions}>
      {actions.map((action) => {
        const ActionIcon = action.icon
        return (
          <button
            key={action.id}
            type="button"
            className={styles.headerAction}
            aria-label={action.label}
            aria-pressed={action.pressed}
            data-tooltip={action.label}
            onClick={action.onSelect}
          >
            <ActionIcon size={16} aria-hidden />
          </button>
        )
      })}
    </div>
  ) : null

  const port = (value: NodePort, side: PortSide, placement: string) => {
    const key = portKey({ nodeId: node.id, portId: value.id, side })
    return (
      <Port
        nodeId={node.id}
        port={value}
        side={side}
        active={activePorts.has(key)}
        connected={connectedPorts.has(key)}
        handlers={ports}
        className={`${minimal.port} ${placement}`}
        activeClassName={minimal.portActive}
      />
    )
  }

  const className = [
    styles.node,
    tones[`tone_${type.tone}`],
    selected ? styles.selected : null,
    dragging ? minimal.dragging : null,
    dataOpen || appearanceOpen ? minimal.raised : null,
    styles[`run_${run.status}`],
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={cardRef}
      className={className}
      style={{
        left: position.x,
        top: position.y,
        width: node.frame?.w ?? type.width ?? NODE_DEFAULT_WIDTH,
        minHeight: node.frame?.h,
      }}
      role="group"
      aria-label={title}
      data-node-id={node.id}
      data-selected={selected || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <div className={styles.runAbove}>
        <RunInfo run={run} isTrigger={isTrigger} isDefault={flow.defaultTriggerId === node.id} />
      </div>

      {edgeOutputs ? (
        <ul className={styles.edgeOutputs} aria-label="Outputs">
          {outputs.map((value) => (
            <li key={value.id} className={styles.edgeOutput}>
              {port(value, 'out', minimal.portOut)}
              <span className={styles.edgeOutputLabel}>{value.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        className={styles.card}
        style={appearanceVars(node.appearance, { padding: ['--card-pad'], radius: ['--card-radius', '--node-radius'] })}
        data-ink={inkRgb(node.appearance) ? 'dark' : undefined}
        data-headless={headless || undefined}
      >
        <NodeFill paint={node.appearance} />
        {type.inputs.length === 1 ? port(type.inputs[0], 'in', minimal.portIn) : null}
        {outputs.length === 1 ? port(outputs[0], 'out', minimal.portOut) : null}

        {headless ? null : (
          <div className={styles.header}>
            <TypeIcon size={16} weight="regular" className={styles.headerIcon} aria-hidden />
            <span className={styles.category}>{category}</span>
            {actionBar}
          </div>
        )}

        <div className={styles.content}>
          {headless ? (
            <div className={styles.titleBlock}>
              <div className={styles.contentHead}>
                <TypeIcon size={20} weight="regular" className={styles.headerIcon} aria-hidden />
                {actionBar}
              </div>
              <div className={styles.title}>
                <span className={minimal.name} title={title}>
                  {title}
                </span>
                <RunStatus run={run} />
              </div>
              {values.length ? <DetailBadges fields={values} className={styles.badges} /> : null}
            </div>
          ) : (
            <div className={styles.titleBlock}>
              <div className={styles.title}>
                <span className={minimal.name} title={title}>
                  {title}
                </span>
                <RunStatus run={run} />
              </div>
              {subtitle || empty ? <span className={styles.subtitle}>{subtitle ?? type.description}</span> : null}
              {values.length ? <DetailBadges fields={values} className={styles.badges} /> : null}
            </div>
          )}

          {run.status === 'running' && run.countdown ? <WaitCountdown {...run.countdown} /> : null}

          {blocks.map((block) => (
            <ContentBlockView key={block.kind} block={block} context={{ selected, onParamsChange }} />
          ))}

          {branchInputs ? (
            <ul className={`${minimal.rows} ${styles.branches}`} aria-label="Inputs">
              {type.inputs.map((value) => {
                const source = inputSources?.[value.id]
                return (
                  <li key={value.id} className={`${minimal.row} ${styles.branch}`}>
                    {port(value, 'in', minimal.rowPortIn)}
                    <span className={`${minimal.rowLabel} ${styles.branchLabel}`} title={source ? `${value.label}: ${source.names.join(', ')}` : undefined}>
                      {source ? source.names.join(', ') : value.label}
                    </span>
                    {source && source.rows !== null ? <span className={styles.branchCount}>{plural(source.rows, 'row')}</span> : null}
                  </li>
                )
              })}
            </ul>
          ) : null}

          {branchOutputs ? (
            <ul className={`${minimal.rows} ${styles.branches}`} aria-label="Outputs">
              {outputs.map((value, index) => (
                <li key={value.id} className={`${minimal.row} ${styles.branch}`}>
                  {value.tone && value.tone !== 'neutral' ? (
                    <span className={`${minimal.rowDot} ${minimal[`rowDot_${value.tone}`]}`} aria-hidden />
                  ) : (
                    <span className={minimal.rowIndex}>{value.id === 'default' ? '–' : index + 1}</span>
                  )}
                  <span className={`${minimal.rowLabel} ${styles.branchLabel} ${value.id === 'default' ? minimal.rowLabelMuted : ''}`}>{value.label}</span>
                  {run.ports?.[value.id] ? <span className={styles.branchCount}>{plural(run.ports[value.id].length, 'row')}</span> : null}
                  {isAuthoredBranch(type.id, value.id) && (onOpenConfig || onRemoveOutput) ? (
                    <span className={styles.branchActions}>
                      {onOpenConfig ? (
                        <button type="button" className={styles.branchAction} aria-label={`Edit ${value.label}`} data-tooltip="Edit" onClick={() => onOpenConfig(value.id)}>
                          <PencilSimple size={14} aria-hidden />
                        </button>
                      ) : null}
                      {onRemoveOutput ? (
                        <button type="button" className={styles.branchAction} aria-label={`Remove ${value.label}`} data-tooltip="Remove" onClick={() => onRemoveOutput(value.id)}>
                          <Minus size={14} weight="bold" aria-hidden />
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                  {port(value, 'out', minimal.rowPortOut)}
                </li>
              ))}
              {addLabel ? (
                <li>
                  <button type="button" className={`${styles.branch} ${styles.addBranch}`} onClick={onAddOutput}>
                    <Plus size={12} weight="bold" aria-hidden />
                    {addLabel}
                  </button>
                </li>
              ) : null}
            </ul>
          ) : addLabel ? (
            <button type="button" className={`${styles.branch} ${styles.addBranch}`} onClick={onAddOutput}>
              <Plus size={12} weight="bold" aria-hidden />
              {addLabel}
            </button>
          ) : null}

          {issue ? (
            <p className={minimal.issue} role="status">
              <Warning size={14} weight="fill" aria-hidden />
              {issue}
            </p>
          ) : null}
        </div>

        {footer && !hidden && !headless ? <CardFooter {...footer} /> : null}

        {run.status === 'running' && !run.countdown ? <span className={minimal.progress} aria-hidden /> : null}

        <ResizeHandles resize={resize} />
      </div>

      {dataOpen ? <NodeDataCard name={title} isTrigger={isTrigger} hasInputs={type.inputs.length > 0} run={run} input={input} output={output} /> : null}
    </div>
  )
}
