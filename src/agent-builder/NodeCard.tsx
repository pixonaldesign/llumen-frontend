import { useState, type CSSProperties } from 'react'
import { CheckCircle, Check, CircleNotch, MinusCircle, Plus, Warning, XCircle } from '@phosphor-icons/react'
import { NodeAssetPreview } from './NodeAssetPreview'
import { NodeDataPanel } from './NodeDataPanel'
import { appearanceVars, hasCustomFill, inkRgb } from './nodeAppearance'
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
} from './nodeCatalog'
import { branchAddLabel, isFallbackBranch } from './nodeKinds'
import tones from './nodeTones.module.css'
import styles from './NodeCard.module.css'

type FooterTab = 'input' | 'output'

const UNPUBLISHED: FlowState = { published: false }

/** Detailed node: header, content, and a run footer with the data tabs. Actions live in the canvas's floating node toolbar. */
export function NodeCard({
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
  onDataOpen,
  onNoteChange,
  wiringIssue,
  flow = UNPUBLISHED,
}: NodeCardProps) {
  const [tab, setTab] = useState<FooterTab | null>(null)

  const TypeIcon = type.icon
  const name = nodeName(node, type)
  const config = node.config
  const isTrigger = type.category === 'triggers'
  const details = cardDetails(node, isTrigger, flow)
  const fields = config.hideDetails ? [] : details.fields
  const text = config.hideDetails ? undefined : details.text
  const issue = nodeIssue(node) ?? wiringIssue
  const notice = nodeNotice(node)
  const preview = nodePreview(node)
  const addLabel = branchAddLabel(type.id)
  const outputs = nodeOutputs(node, type)
  const annotation = isAnnotation(type)
  const running = run.status === 'running'
  const branchOutputs = outputs.length > 1
  const branchInputs = type.inputs.length > 1
  const activeTab: FooterTab = tab ?? (run.status === 'success' || run.status === 'error' || run.status === 'skipped' ? 'output' : 'input')
  const portState = (port: NodePort, side: 'in' | 'out') => {
    const key = portKey({ nodeId: node.id, portId: port.id, side })
    return { active: activePorts.has(key), connected: connectedPorts.has(key) }
  }

  const selectTab = (next: FooterTab) => {
    onDataOpen(!(dataOpen && activeTab === next))
    setTab(next)
  }

  const className = [
    styles.node,
    tones[`tone_${type.tone}`],
    annotation ? styles.note : null,
    hasCustomFill(node.appearance) ? styles.custom : null,
    dataOpen || appearanceOpen ? styles.raised : null,
    dragging ? styles.dragging : null,
    selected ? styles.selected : null,
    run.status === 'error' ? styles.failed : null,
  ]
    .filter(Boolean)
    .join(' ')
  const style: CSSProperties = {
    ...appearanceVars(node.appearance, { padding: ['--node-pad'], radius: ['--node-radius'] }),
    left: position.x,
    top: position.y,
    width: node.frame?.w ?? type.width ?? NODE_DEFAULT_WIDTH,
    minHeight: node.frame?.h,
  }

  const badges = config.hideDetails ? details.fields : []
  const hasContent = Boolean(
    fields.length || badges.length || text || issue || notice || preview || config.note !== undefined || branchOutputs || branchInputs,
  )

  return (
    <div
      ref={cardRef}
      className={className}
      style={style}
      role="group"
      aria-label={name}
      data-node-id={node.id}
      data-selected={selected || undefined}
      data-ink={inkRgb(node.appearance) ? 'dark' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <NodeFill paint={node.appearance} />

      <header className={styles.header}>
        {type.inputs.length === 1 ? (
          <Port nodeId={node.id} port={type.inputs[0]} side="in" {...portState(type.inputs[0], 'in')} handlers={ports} activeClassName={styles.portActive} className={`${styles.port} ${styles.portIn}`} />
        ) : null}
        <span className={styles.icon} aria-hidden>
          <TypeIcon size={20} weight={annotation ? 'fill' : 'regular'} />
        </span>
        <h3 className={styles.name} title={name}>
          {name}
        </h3>
        {outputs.length === 1 ? (
          <Port nodeId={node.id} port={outputs[0]} side="out" {...portState(outputs[0], 'out')} handlers={ports} activeClassName={styles.portActive} className={`${styles.port} ${styles.portOut}`} />
        ) : null}
      </header>

      {hasContent ? (
        <div className={styles.content}>
          <DetailBadges fields={badges} />
          {config.note !== undefined ? <EditableNote note={config.note} className={styles.noteBody} onChange={onNoteChange} /> : null}

          {fields.length ? (
            <dl className={styles.fields}>
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
          ) : null}

          {text ? (
            <div className={styles.prompt}>
              <p className={styles.promptText}>{text}</p>
            </div>
          ) : null}

          {preview ? <NodeAssetPreview kind={preview} interactive={selected} /> : null}

          {branchInputs ? (
            <ul className={styles.rows} aria-label="Inputs">
              {type.inputs.map((port, index) => (
                <li key={port.id} className={styles.row}>
                  <Port nodeId={node.id} port={port} side="in" {...portState(port, 'in')} handlers={ports} activeClassName={styles.portActive} className={`${styles.port} ${styles.rowPortIn}`} />
                  <span className={styles.rowBadge}>{index + 1}</span>
                  <span className={styles.rowLabel}>{port.label}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {branchOutputs ? (
            <ul className={styles.rows} aria-label="Outputs">
              {outputs.map((port, index) => (
                <li key={port.id} className={styles.row}>
                  {port.tone && port.tone !== 'neutral' ? (
                    <span className={`${styles.rowDot} ${styles[`rowDot_${port.tone}`]}`} aria-hidden />
                  ) : isFallbackBranch(port.id) ? null : (
                    <span className={styles.rowBadge}>{index + 1}</span>
                  )}
                  <span className={isFallbackBranch(port.id) ? `${styles.rowLabel} ${styles.rowLabelMuted}` : styles.rowLabel}>
                    {port.label}
                  </span>
                  {run.status === 'success' && run.ports?.[port.id]?.length ? (
                    <span className={styles.rowCheck} title="Route taken">
                      <Check size={14} weight="bold" aria-label="Route taken" />
                    </span>
                  ) : null}
                  <Port nodeId={node.id} port={port} side="out" {...portState(port, 'out')} handlers={ports} activeClassName={styles.portActive} className={`${styles.port} ${styles.rowPortOut}`} />
                </li>
              ))}
            </ul>
          ) : null}

          {addLabel ? (
            <button type="button" className={styles.addRow} onClick={onAddOutput}>
              <Plus size={16} weight="bold" aria-hidden />
              {addLabel}
            </button>
          ) : null}

          {issue || notice ? (
            <p className={styles.issue} role="status">
              <Warning size={16} weight="fill" className={styles.issueIcon} aria-hidden />
              {issue ?? notice}
            </p>
          ) : null}
        </div>
      ) : null}

      {annotation ? null : (
        <footer className={`${styles.footer} ${styles[`footer_${run.status}`]}`}>
          <div className={styles.footerBar}>
            <div className={styles.footerTabs} role="tablist" aria-label={`${name} data`}>
              {(['input', 'output'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === value}
                  aria-expanded={activeTab === value && dataOpen}
                  className={activeTab === value ? `${styles.footerTab} ${styles.footerTabActive}` : styles.footerTab}
                  onClick={() => selectTab(value)}
                >
                  {value === 'output' ? 'Output' : isTrigger ? 'Test' : 'Input'}
                </button>
              ))}
            </div>
            <div className={styles.meta}>
              {run.status === 'running' ? (
                <>
                  <span className={styles.metaText}>Running</span>
                  <CircleNotch size={18} weight="bold" className={`${styles.statusIcon} ${styles.spin}`} aria-label="Running" />
                </>
              ) : run.status === 'success' && isTrigger ? (
                <>
                  <span className={styles.metaText}>Fired</span>
                  <CheckCircle size={22} weight="fill" className={`${styles.statusIcon} ${styles.statusSuccess}`} aria-label="Fired" />
                </>
              ) : run.status === 'success' ? (
                <>
                  {run.durationMs !== undefined ? <span className={styles.metaText}>{formatDuration(run.durationMs)}</span> : null}
                  {run.cost ? <span className={styles.costChip}>{formatCost(run.cost)}</span> : null}
                  <CheckCircle size={22} weight="fill" className={`${styles.statusIcon} ${styles.statusSuccess}`} aria-label="Succeeded" />
                </>
              ) : run.status === 'error' ? (
                <>
                  <span className={styles.metaText}>Failed</span>
                  <XCircle size={22} weight="fill" className={`${styles.statusIcon} ${styles.statusError}`} aria-label="Failed" />
                </>
              ) : run.status === 'skipped' ? (
                <>
                  <span className={styles.metaText}>Skipped</span>
                  <MinusCircle size={22} weight="fill" className={`${styles.statusIcon} ${styles.statusSkipped}`} aria-label="Skipped" />
                </>
              ) : flow.defaultTriggerId === node.id ? (
                <span className={styles.metaText} data-tooltip="Run agent starts here unless you pick another trigger">
                  Default
                </span>
              ) : null}
            </div>
          </div>
          {dataOpen ? (
            activeTab === 'input' ? (
              <NodeDataPanel
                label={isTrigger ? 'Test payload' : 'Input'}
                records={isTrigger ? output : input}
                emptyMessage={type.inputs.length ? 'No input yet. Connect and run an upstream node.' : 'This node starts the flow.'}
              />
            ) : (
              <NodeDataPanel
                label="Output"
                records={run.status === 'success' ? output : null}
                emptyMessage={running ? 'Running…' : run.status === 'skipped' ? (run.message ?? 'Skipped.') : run.note && run.status === 'success' ? run.note : 'Run this node to see its output.'}
                error={run.status === 'error' ? run.message : undefined}
              />
            )
          ) : null}
        </footer>
      )}

      <ResizeHandles resize={resize} />
    </div>
  )
}
