import { useEffect, useState } from 'react'
import { BracketsAngle, CircleNotch, Minus, PencilSimple, Plus, Warning } from '@phosphor-icons/react'
import { ContentBlockView } from './CardSectionViews'
import { cardContent, cardEdgeOutputs, cardValues, type HeaderAction } from './cardSections'
import { NodeDataCard } from './NodeDataCard'
import { appearanceVars, inkRgb } from './nodeAppearance'
import { DetailBadges, NodeFill, Port, ResizeHandles, type NodeCardProps } from './nodeParts'
import type { FlowState } from './triggerCard'
import {
  formatCost,
  formatDuration,
  nodeIssue,
  nodeName,
  nodeNotice,
  nodeOutputs,
  NODE_DEFAULT_WIDTH,
  portKey,
  type NodePort,
  type NodeRun,
  type PortSide,
} from './nodeCatalog'
import { plural } from './kindEditor'
import { branchAddLabel, isAuthoredBranch, isFallbackBranch } from './nodeKinds'
import tones from './nodeTones.module.css'
import minimal from './NodeCardMinimal.module.css'
import styles from './NodeCardSections.module.css'

const UNPUBLISHED: FlowState = { published: false }

type Countdown = NonNullable<NodeRun['countdown']>

/** Triggers are entry points, not steps: they fire, so they have no duration or cost. */
function runMeta(run: NodeRun, isTrigger: boolean) {
  if (run.status === 'running') return 'Running'
  if (run.status === 'waiting') return 'Waiting for a reply'
  if (run.status === 'skipped') return 'Skipped'
  if (run.status !== 'success' || isTrigger) return null
  return [run.durationMs !== undefined ? formatDuration(run.durationMs) : null, run.cost ? formatCost(run.cost) : null]
    .filter(Boolean)
    .join(' · ')
}

/** A spinner while the node runs, a grey dot once it's skipped; sits after the name. */
function RunStatus({ run }: { run: NodeRun }) {
  if (run.status === 'running') return <CircleNotch size={12} weight="bold" className={minimal.spinner} aria-label="Running" />
  if (run.status === 'skipped') return <span className={`${minimal.status} ${minimal.status_skipped}`} role="img" aria-label="Skipped" />
  if (run.status === 'waiting') return <span className={`${minimal.status} ${minimal.status_waiting}`} role="img" aria-label="Waiting for a reply" />
  return null
}

/** Run details (on hover or selection) and the result badge, pushed to the end of their row. */
function RunInfo({ run, isTrigger, isDefault }: { run: NodeRun; isTrigger: boolean; isDefault: boolean }) {
  const meta = runMeta(run, isTrigger)
  const badge =
    run.status === 'success' || run.status === 'error' ? (
      <span className={`${minimal.badge} ${minimal[`badge_${run.status}`]}`}>{run.status === 'error' ? 'Failed' : isTrigger ? 'Fired' : 'Passed'}</span>
    ) : run.status === 'idle' && isDefault ? (
      <span className={`${minimal.badge} ${minimal.badge_default}`} data-tooltip="Run agent starts here unless you pick another trigger">
        Default
      </span>
    ) : null
  if (!meta && !badge) return null
  return (
    <span className={minimal.runInfo}>
      {meta ? <span className={minimal.meta}>{meta}</span> : null}
      {badge}
    </span>
  )
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

/**
 * A node in a category-colour frame: the icon and the node's actions, then the title and whatever the node
 * holds (values as badges, a prompt to edit, a map or chart) in a black panel. The run result sits above the
 * card; input and output open over the canvas. What fills the panel comes from `cardSections.ts`.
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
  onOpenConfig,
  onRemoveOutput,
  inputSources,
  wiringIssue,
  onOpenData,
  flow = UNPUBLISHED,
}: NodeCardProps) {
  const TypeIcon = type.icon
  const isTrigger = type.category === 'triggers'
  const title = nodeName(node, type)
  const blocks = cardContent(node)
  // Only a chart, table or map has no natural size; every other card hugs its content.
  const resizable = blocks.some((block) => block.kind === 'asset')
  const frame = resizable ? node.frame : undefined
  const values = cardValues(node, type, flow)
  const issue = nodeIssue(node) ?? wiringIssue ?? nodeNotice(node)
  const outputs = nodeOutputs(node, type)
  const addLabel = branchAddLabel(type.id)
  const edgeOutputs = outputs.length > 1 && cardEdgeOutputs(type)
  const branchOutputs = outputs.length > 1 && !edgeOutputs
  const branchInputs = type.inputs.length > 1

  const savedAsset = node.type === 'createAsset' && run.status === 'success' && Boolean(run.assetRows)
  const actions: HeaderAction[] = []
  if (onOpenConfig && savedAsset) actions.push({ id: 'editAsset', label: 'Edit asset', icon: PencilSimple, onSelect: () => onOpenConfig() })
  if (onOpenData) actions.push({ id: 'data', label: 'Input and output', icon: BracketsAngle, onSelect: onOpenData })
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
        width: frame?.w ?? type.width ?? NODE_DEFAULT_WIDTH,
        minHeight: frame?.h,
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
      >
        <NodeFill paint={node.appearance} />
        {type.inputs.length === 1 ? port(type.inputs[0], 'in', minimal.portIn) : null}
        {outputs.length === 1 ? port(outputs[0], 'out', minimal.portOut) : null}

        <div className={styles.content}>
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
                    <span className={minimal.rowIndex}>{isFallbackBranch(value.id) ? '–' : index + 1}</span>
                  )}
                  <span className={`${minimal.rowLabel} ${styles.branchLabel} ${isFallbackBranch(value.id) ? minimal.rowLabelMuted : ''}`}>{value.label}</span>
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

        {run.status === 'running' && !run.countdown ? <span className={minimal.progress} aria-hidden /> : null}

        {resizable ? <ResizeHandles resize={resize} /> : null}
      </div>

      {dataOpen ? <NodeDataCard name={title} isTrigger={isTrigger} hasInputs={type.inputs.length > 0} run={run} input={input} output={output} /> : null}
    </div>
  )
}
