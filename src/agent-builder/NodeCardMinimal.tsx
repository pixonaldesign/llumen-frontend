import { CircleNotch, Plus, Warning, type IconWeight } from '@phosphor-icons/react'
import type { IconContainer } from './cardGlow'
import { NodeAssetPreview } from './NodeAssetPreview'
import { NodeDataCard } from './NodeDataCard'
import { appearanceVars, inkRgb } from './nodeAppearance'
import { DetailBadges, EditableNote, FieldCopy, FieldValue, NodeFill, Port, ResizeHandles, type NodeCardProps } from './nodeParts'
import { cardDetails, type FlowState } from './triggerCard'
import {
  formatCost,
  formatDuration,
  isAnnotation,
  nodeIssue,
  nodeName,
  nodeNotice,
  nodeOutputs,
  nodePreview,
  NODE_DEFAULT_WIDTH,
  portKey,
  type NodePort,
  type NodeRun,
  type PortSide,
} from './nodeCatalog'
import { branchAddLabel, isFallbackBranch } from './nodeKinds'
import tones from './nodeTones.module.css'
import styles from './NodeCardMinimal.module.css'

const ICON_WEIGHTS: Record<IconContainer, IconWeight> = { tile: 'duotone', circle: 'regular', none: 'fill' }
const UNPUBLISHED: FlowState = { published: false }

/** Triggers are entry points, not steps: they fire, so they have no duration or cost. */
function runMeta(run: NodeRun, isTrigger: boolean) {
  if (run.status === 'running') return 'Running'
  if (run.status === 'skipped') return 'Skipped'
  if (run.status !== 'success' || isTrigger) return null
  return [run.durationMs !== undefined ? formatDuration(run.durationMs) : null, run.cost ? formatCost(run.cost) : null]
    .filter(Boolean)
    .join(' · ')
}

/** A spinner while the node runs, a grey dot once it's skipped; sits after the name. */
export function RunStatus({ run }: { run: NodeRun }) {
  if (run.status === 'running') return <CircleNotch size={12} weight="bold" className={styles.spinner} aria-label="Running" />
  if (run.status === 'skipped') return <span className={`${styles.status} ${styles.status_skipped}`} role="img" aria-label="Skipped" />
  return null
}

/** Run details (on hover or selection) and the result badge, pushed to the end of their row. */
export function RunInfo({ run, isTrigger, isDefault }: { run: NodeRun; isTrigger: boolean; isDefault: boolean }) {
  const meta = runMeta(run, isTrigger)
  const badge =
    run.status === 'success' || run.status === 'error' ? (
      <span className={`${styles.badge} ${styles[`badge_${run.status}`]}`}>{run.status === 'error' ? 'Failed' : isTrigger ? 'Fired' : 'Passed'}</span>
    ) : run.status === 'idle' && isDefault ? (
      <span className={`${styles.badge} ${styles.badge_default}`} data-tooltip="Run agent starts here unless you pick another trigger">
        Default
      </span>
    ) : null
  if (!meta && !badge) return null
  return (
    <span className={styles.runInfo}>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
      {badge}
    </span>
  )
}

/**
 * Minimal node: a plain card led by the icon and name, or, for charts and maps, the name above the
 * card. The run result is a badge at the top right; run details and Add condition appear on hover
 * or selection; data opens in a card underneath. Actions live in the canvas's floating node toolbar.
 */
export function NodeCardMinimal({
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
  onNoteChange,
  wiringIssue,
  iconContainer = 'tile',
  valuesPanel = false,
  flow = UNPUBLISHED,
}: NodeCardProps) {
  const TypeIcon = type.icon
  const name = nodeName(node, type)
  const config = node.config
  const isTrigger = type.category === 'triggers'
  const details = cardDetails(node, isTrigger, flow)
  const fields = config.hideDetails ? [] : details.fields
  const text = config.hideDetails ? undefined : details.text
  const issue = nodeIssue(node) ?? wiringIssue ?? nodeNotice(node)
  const preview = nodePreview(node)
  const addLabel = branchAddLabel(type.id)
  const outputs = nodeOutputs(node, type)
  const annotation = isAnnotation(type)
  const running = run.status === 'running'
  const branchOutputs = outputs.length > 1
  const branchInputs = type.inputs.length > 1
  const hasContent = Boolean(fields.length || text || preview || config.note !== undefined || branchOutputs || branchInputs)
  const errorText = run.status === 'error' && run.message && !(issue && run.message.startsWith(issue)) ? run.message : null

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
        className={`${styles.port} ${placement}`}
        activeClassName={styles.portActive}
      />
    )
  }

  const className = [
    styles.node,
    tones[`tone_${type.tone}`],
    annotation ? styles.note : null,
    selected ? styles.selected : null,
    dragging ? styles.dragging : null,
    dataOpen || appearanceOpen ? styles.raised : null,
    styles[`run_${run.status}`],
  ]
    .filter(Boolean)
    .join(' ')
  const cardClass = [styles.card, preview === 'map' ? styles.cardMap : null].filter(Boolean).join(' ')

  const runStatus = <RunStatus run={run} />
  const nameText = (
    <span className={styles.name} title={name}>
      {name}
    </span>
  )
  const runInfo = <RunInfo run={run} isTrigger={isTrigger} isDefault={flow.defaultTriggerId === node.id} />
  const valueList = fields.length ? (
    <dl className={valuesPanel ? `${styles.fields} ${styles.values}` : styles.fields}>
      {fields.map((field, index) => (
        <div key={`${index}:${field.label}`} className={styles.field}>
          <dt>{field.label}</dt>
          <dd data-muted={field.muted || undefined} title={field.value}>
            <FieldValue field={field} />
          </dd>
          {field.copy ? <FieldCopy value={field.copy} label={field.label} /> : null}
        </div>
      ))}
    </dl>
  ) : null

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
      aria-label={name}
      data-node-id={node.id}
      data-selected={selected || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      {preview ? (
        <div className={styles.previewHead}>
          <div className={styles.heroTitle}>
            {nameText}
            {runStatus}
          </div>
          {runInfo}
        </div>
      ) : null}
      {preview && config.hideDetails ? <DetailBadges fields={details.fields} className={styles.previewBadges} /> : null}

      <div
        className={cardClass}
        style={appearanceVars(node.appearance, { padding: ['--card-pad'], radius: ['--card-radius', '--node-radius'] })}
        data-ink={inkRgb(node.appearance) ? 'dark' : undefined}
      >
        <NodeFill paint={node.appearance} />
        {type.inputs.length === 1 ? port(type.inputs[0], 'in', styles.portIn) : null}
        {outputs.length === 1 ? port(outputs[0], 'out', styles.portOut) : null}

        {preview ? null : !annotation ? (
          <div className={styles.hero}>
            <div className={styles.heroTop}>
              <span className={styles.heroIcon} aria-hidden>
                <TypeIcon size={iconContainer === 'none' ? 32 : 24} weight={ICON_WEIGHTS[iconContainer]} />
              </span>
              {runInfo}
            </div>
            <div className={styles.heroTitle}>
              {nameText}
              {runStatus}
            </div>
            {config.hideDetails ? <DetailBadges fields={details.fields} className={styles.heroBadges} /> : null}
          </div>
        ) : (
          <div className={styles.title}>
            <TypeIcon size={14} weight="bold" className={styles.titleIcon} aria-hidden />
            {nameText}
            {runStatus}
            {runInfo}
          </div>
        )}

        {config.note !== undefined ? <EditableNote note={config.note} className={styles.noteText} onChange={onNoteChange} /> : null}

        {preview ? <NodeAssetPreview kind={preview} interactive={selected} bare /> : null}

        {valuesPanel ? null : valueList}

        {text ? <p className={styles.prompt}>{text}</p> : null}

        {branchInputs ? (
          <ul className={styles.rows} aria-label="Inputs">
            {type.inputs.map((value) => (
              <li key={value.id} className={styles.row}>
                {port(value, 'in', styles.rowPortIn)}
                <span className={styles.rowLabel}>{value.label}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {branchOutputs ? (
          <ul className={styles.rows} aria-label="Outputs">
            {outputs.map((value, index) => (
              <li key={value.id} className={styles.row}>
                {value.tone && value.tone !== 'neutral' ? (
                  <span className={`${styles.rowDot} ${styles[`rowDot_${value.tone}`]}`} aria-hidden />
                ) : (
                  <span className={styles.rowIndex}>{isFallbackBranch(value.id) ? '–' : index + 1}</span>
                )}
                <span className={isFallbackBranch(value.id) ? `${styles.rowLabel} ${styles.rowLabelMuted}` : styles.rowLabel}>
                  {value.label}
                </span>
                {port(value, 'out', styles.rowPortOut)}
              </li>
            ))}
          </ul>
        ) : null}

        {addLabel ? (
          <button type="button" className={styles.addRow} onClick={onAddOutput}>
            <Plus size={12} weight="bold" aria-hidden />
            {addLabel}
          </button>
        ) : null}

        {!hasContent && !issue && !isTrigger && !config.hideDetails ? <p className={styles.description}>{type.description}</p> : null}

        {issue ? (
          <p className={styles.issue} role="status">
            <Warning size={14} weight="fill" aria-hidden />
            {issue}
          </p>
        ) : null}

        {errorText ? <p className={styles.errorText}>{errorText}</p> : null}

        {running ? <span className={styles.progress} aria-hidden /> : null}

        <ResizeHandles resize={resize} />
      </div>

      {valuesPanel ? valueList : null}

      {dataOpen && !annotation ? (
        <NodeDataCard name={name} isTrigger={isTrigger} hasInputs={type.inputs.length > 0} run={run} input={input} output={output} />
      ) : null}
    </div>
  )
}
