import { ArrowSquareOut, CaretDown, ChatTeardropText, Check, FloppyDisk, Play, SidebarSimple, WarningCircle, X } from '@phosphor-icons/react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { WorkflowProposal, WorkflowStep } from './assistantReplyTypes'
import railStyles from './compact-assistant.module.css'
import thinkingStyles from './AssistantTimelineReply.module.css'
import styles from './WorkflowProposalCard.module.css'
import { executeWorkflow, saveWorkflow, useWorkflowRun } from './workflowRunState'

type CardStatus = 'draft' | 'running' | 'saved' | 'published'

const STATUS_LABEL: Record<CardStatus, string> = {
  draft: 'Draft',
  running: 'Running',
  saved: 'Saved',
  published: 'Published',
}

function neighbors(stepId: string, edges: [string, string][]): Set<string> {
  const linked = new Set<string>([stepId])
  for (const [from, to] of edges) {
    if (from === stepId) linked.add(to)
    if (to === stepId) linked.add(from)
  }
  return linked
}

type GraphMetrics = {
  padX: number
  padY: number
  colGap: number
  rowGap: number
  nodeW: number
  nodeH: number
}

const THUMB_METRICS: GraphMetrics = {
  padX: 16,
  padY: 28,
  colGap: 20,
  rowGap: 18,
  nodeW: 28,
  nodeH: 14,
}

const EXAMINE_METRICS: GraphMetrics = {
  padX: 8,
  padY: 36,
  colGap: 40,
  rowGap: 72,
  nodeW: 112,
  nodeH: 48,
}

type PlacedNode = {
  step: WorkflowStep
  x: number
  y: number
  w: number
  h: number
}

type PlacedWire = {
  id: string
  d: string
  accent: boolean
}

type GraphLayout = {
  width: number
  height: number
  nodes: PlacedNode[]
  wires: PlacedWire[]
}

const LANE_ORDER: Record<WorkflowStep['lane'], number> = {
  left: 0,
  spine: 1,
  right: 2,
  join: 1,
}

function nodeFill(step: WorkflowStep) {
  if (step.tone === 'trigger') return '#5dcaa5'
  if (step.tone === 'delivery') return '#7c6cf0'
  if (step.tone === 'asset') return '#8a6244'
  if (step.tone === 'agent') return '#3d5278'
  return '#3c4454'
}

function isEndpoint(step: WorkflowStep) {
  return step.tone === 'trigger' || step.tone === 'delivery'
}

/** Examine nodes grow with the label so the request text stays readable. */
function nodeSize(step: WorkflowStep, metrics: GraphMetrics) {
  if (metrics.nodeW < 40) {
    return {
      w: isEndpoint(step) ? metrics.nodeW + 8 : metrics.nodeW,
      h: isEndpoint(step) ? metrics.nodeH + 4 : metrics.nodeH,
    }
  }
  const text = Math.ceil(step.label.length * 7.6)
  return { w: Math.max(metrics.nodeW, text + 40), h: metrics.nodeH }
}

/** Same columns, rows, and wires for the thumbnail and the examine view. */
function layoutWorkflow(proposal: WorkflowProposal, metrics: GraphMetrics): GraphLayout {
  const incoming = new Map<string, string[]>()
  for (const step of proposal.steps) incoming.set(step.id, [])
  for (const [from, to] of proposal.edges) incoming.get(to)?.push(from)

  const column = new Map<string, number>()
  const rank = (id: string): number => {
    const known = column.get(id)
    if (known != null) return known
    const parents = incoming.get(id) ?? []
    const value = parents.length === 0 ? 0 : Math.max(...parents.map(rank)) + 1
    column.set(id, value)
    return value
  }
  for (const step of proposal.steps) rank(step.id)

  const columns = new Map<number, WorkflowStep[]>()
  for (const step of proposal.steps) {
    const col = column.get(step.id) ?? 0
    const list = columns.get(col) ?? []
    list.push(step)
    columns.set(col, list)
  }
  for (const list of columns.values()) {
    list.sort((a, b) => LANE_ORDER[a.lane] - LANE_ORDER[b.lane])
  }

  const colIndexes = [...columns.keys()].sort((a, b) => a - b)
  const maxRows = Math.max(1, ...[...columns.values()].map((list) => list.length))
  const rowStride = metrics.nodeH + metrics.rowGap
  const blockH = maxRows * metrics.nodeH + (maxRows - 1) * metrics.rowGap
  const height = metrics.padY * 2 + blockH
  const top = metrics.padY

  const nodes: PlacedNode[] = []
  let cursor = metrics.padX
  for (const col of colIndexes) {
    const list = columns.get(col) ?? []
    const colWidth = Math.max(...list.map((step) => nodeSize(step, metrics).w))
    const stackH = list.length * metrics.nodeH + (list.length - 1) * metrics.rowGap
    const stackTop = top + (blockH - stackH) / 2
    list.forEach((step, row) => {
      const { w, h } = nodeSize(step, metrics)
      nodes.push({
        step,
        x: cursor + (colWidth - w) / 2,
        y: stackTop + row * rowStride + (metrics.nodeH - h) / 2,
        w,
        h,
      })
    })
    cursor += colWidth + metrics.colGap
  }

  const byId = new Map(nodes.map((node) => [node.step.id, node]))
  const wires: PlacedWire[] = proposal.edges.flatMap(([from, to]) => {
    const source = byId.get(from)
    const target = byId.get(to)
    if (!source || !target) return []
    const x1 = source.x + source.w
    const y1 = source.y + source.h / 2
    const x2 = target.x
    const y2 = target.y + target.h / 2
    const bend = Math.max(12, (x2 - x1) * 0.45)
    return [
      {
        id: `${from}-${to}`,
        d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
        accent: source.step.tone === 'asset' && target.step.tone === 'delivery',
      },
    ]
  })

  return {
    width: Math.max(cursor - metrics.colGap + metrics.padX, 1),
    height,
    nodes,
    wires,
  }
}

function WorkflowGraph({
  proposal,
  variant,
  stateFor,
  onSelect,
}: {
  proposal: WorkflowProposal
  variant: 'thumb' | 'examine'
  stateFor?: (id: string) => 'idle' | 'selected' | 'linked' | 'dimmed'
  onSelect?: (id: string) => void
}) {
  const layout = useMemo(
    () => layoutWorkflow(proposal, variant === 'thumb' ? THUMB_METRICS : EXAMINE_METRICS),
    [proposal, variant],
  )
  const labeled = variant === 'examine'

  return (
    <div
      className={labeled ? styles.graphFrame : styles.thumbGraph}
      style={labeled ? { width: layout.width, height: layout.height } : undefined}
    >
      <svg
        className={labeled ? styles.graphSvg : styles.thumbSvg}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <g fill="none" strokeWidth={labeled ? 1.5 : 1.25}>
          {layout.wires.map((wire) => (
            <path
              key={wire.id}
              d={wire.d}
              stroke={wire.accent ? '#e7a39a' : 'rgba(226, 232, 240, 0.42)'}
            />
          ))}
        </g>
        {layout.nodes.map((node) => (
          <rect
            key={node.step.id}
            x={node.x}
            y={node.y}
            width={node.w}
            height={node.h}
            rx={isEndpoint(node.step) ? node.h / 2 : labeled ? 10 : 4}
            fill={nodeFill(node.step)}
            opacity={labeled ? 0 : 1}
          />
        ))}
      </svg>
      {labeled
        ? layout.nodes.map((node) => (
            <button
              key={node.step.id}
              type="button"
              className={styles.graphNode}
              data-tone={node.step.tone}
              data-state={stateFor?.(node.step.id) ?? 'idle'}
              data-endpoint={isEndpoint(node.step) ? 'true' : 'false'}
              aria-pressed={(stateFor?.(node.step.id) ?? 'idle') === 'selected'}
              title={node.step.label}
              style={{
                left: `${(node.x / layout.width) * 100}%`,
                top: `${(node.y / layout.height) * 100}%`,
                width: `${(node.w / layout.width) * 100}%`,
                height: `${(node.h / layout.height) * 100}%`,
              }}
              onClick={() => onSelect?.(node.step.id)}
            >
              <span className={styles.nodeDot} aria-hidden />
              <span className={styles.graphLabel}>{node.step.label}</span>
            </button>
          ))
        : null}
    </div>
  )
}

const ZOOM_MIN = 0.35
const ZOOM_MAX = 2.75

function ExamineCanvas({
  proposal,
  stateFor,
  onSelect,
  clearance = 108,
}: {
  proposal: WorkflowProposal
  stateFor: (id: string) => 'idle' | 'selected' | 'linked' | 'dimmed'
  onSelect: (id: string) => void
  clearance?: number
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef({ x: 0, y: 0, scale: 1 })
  const movedRef = useRef(false)
  const dragRef = useRef<{
    pointerId: number
    originX: number
    originY: number
    x: number
    y: number
  } | null>(null)
  const [view, setView] = useState(viewRef.current)
  const [panning, setPanning] = useState(false)
  const layout = useMemo(() => layoutWorkflow(proposal, EXAMINE_METRICS), [proposal])

  const commitView = (next: { x: number; y: number; scale: number }) => {
    viewRef.current = next
    setView(next)
  }

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const fit = () => {
      if (movedRef.current) return
      const rect = el.getBoundingClientRect()
      if (rect.width < 8 || rect.height < 8) return
      const padX = 48
      const padTop = 148
      const availW = Math.max(1, rect.width - padX * 2)
      const availH = Math.max(1, rect.height - padTop - clearance)
      const scale = Math.min(ZOOM_MAX, availW / layout.width, availH / layout.height)
      const x = (rect.width - layout.width * scale) / 2
      const y = padTop + (availH - layout.height * scale) / 2
      commitView({ x, y, scale })
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [clearance, layout.height, layout.width])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const px = event.clientX - rect.left
      const py = event.clientY - rect.top
      let dy = event.deltaY
      if (event.deltaMode === 1) dy *= 16
      else if (event.deltaMode === 2) dy *= rect.height
      const current = viewRef.current
      const nextScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current.scale * Math.exp(-dy * 0.0015)))
      const k = nextScale / current.scale
      movedRef.current = true
      commitView({
        scale: nextScale,
        x: px - (px - current.x) * k,
        y: py - (py - current.y) * k,
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('button')) return
    dragRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      x: viewRef.current.x,
      y: viewRef.current.y,
    }
    setPanning(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    movedRef.current = true
    commitView({
      ...viewRef.current,
      x: drag.x + (event.clientX - drag.originX),
      y: drag.y + (event.clientY - drag.originY),
    })
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setPanning(false)
  }

  return (
    <div
      ref={viewportRef}
      className={styles.canvas}
      data-panning={panning ? 'true' : 'false'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        ['--dot-x' as string]: `${view.x}px`,
        ['--dot-y' as string]: `${view.y}px`,
        ['--dot-gap' as string]: `${16 * view.scale}px`,
        ['--dot-r' as string]: `${view.scale}px`,
      }}
    >
      <div
        className={styles.world}
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
      >
        <WorkflowGraph proposal={proposal} variant="examine" stateFor={stateFor} onSelect={onSelect} />
      </div>
    </div>
  )
}

function WorkflowActionBar({
  proposal,
  onRunFailed,
  className,
  showSave = true,
}: {
  proposal: WorkflowProposal
  onRunFailed?: (proposal: WorkflowProposal) => void
  className?: string
  showSave?: boolean
}) {
  const runState = useWorkflowRun(proposal.id)
  const [saveOpen, setSaveOpen] = useState(false)
  const saveRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!saveOpen) return
    const onPointer = (event: PointerEvent) => {
      if (saveRef.current?.contains(event.target as Node)) return
      setSaveOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSaveOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [saveOpen])

  return (
    <div className={className ? `${styles.footer} ${className}` : styles.footer}>
      <button
        type="button"
        className={`${styles.action} ${styles.actionOutline}`}
        disabled={runState.running}
        onClick={() => executeWorkflow(proposal, onRunFailed)}
      >
        <Play size={14} weight="fill" aria-hidden />
        {runState.running ? 'Running' : 'Execute'}
      </button>
      {showSave ? (
        <div className={styles.saveWrap} ref={saveRef}>
          {saveOpen ? (
            <div className={styles.saveMenu} role="menu" aria-label="Save options">
              <button
                type="button"
                className={styles.saveItem}
                role="menuitem"
                onClick={() => {
                  saveWorkflow(proposal.id, 'saved')
                  setSaveOpen(false)
                }}
              >
                Save as draft
              </button>
              <button
                type="button"
                className={styles.saveItem}
                role="menuitem"
                onClick={() => {
                  saveWorkflow(proposal.id, 'published')
                  setSaveOpen(false)
                }}
              >
                Save & publish
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className={styles.action}
            disabled={runState.running}
            aria-haspopup="menu"
            aria-expanded={saveOpen}
            onClick={() => setSaveOpen((open) => !open)}
          >
            Save
            <span className={styles.chevron}>
              <CaretDown size={14} weight="bold" aria-hidden />
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

function WorkflowHeaderSave({ id, disabled }: { id: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div className={styles.headerSave} ref={ref}>
      {open ? (
        <div className={`${styles.saveMenu} ${styles.headerSaveMenu}`} role="menu" aria-label="Save options">
          <button
            type="button"
            className={styles.saveItem}
            role="menuitem"
            onClick={() => {
              saveWorkflow(id, 'draft')
              setOpen(false)
            }}
          >
            Save as draft
          </button>
          <button
            type="button"
            className={styles.saveItem}
            role="menuitem"
            onClick={() => {
              saveWorkflow(id, 'saved')
              setOpen(false)
            }}
          >
            Save workflow
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className={railStyles.saveToAssetsBtn}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <FloppyDisk size={18} weight="regular" aria-hidden />
        Save
        <CaretDown size={14} weight="bold" aria-hidden />
      </button>
    </div>
  )
}

function StepsPopover({
  open,
  anchorRef,
  panelRef,
  steps,
  onClose,
}: {
  open: boolean
  anchorRef: RefObject<HTMLButtonElement | null>
  panelRef?: RefObject<HTMLElement | null>
  steps: WorkflowStep[]
  onClose: () => void
}) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({ top: 0, left: 0, width: 360, placeAbove: false })

  const updatePosition = useMemo(() => {
    return () => {
      const trigger = anchorRef.current
      if (!trigger) return
      const triggerRect = trigger.getBoundingClientRect()
      const replyRoot = trigger.closest('[data-lc-reply-root]') as HTMLElement | null
      const panel = panelRef?.current
      const panelRect = panel?.getBoundingClientRect() ?? {
        left: 24,
        top: 24,
        width: window.innerWidth - 48,
        height: window.innerHeight - 48,
        right: window.innerWidth - 24,
        bottom: window.innerHeight - 24,
      }
      const alignRect = (replyRoot ?? panel)?.getBoundingClientRect() ?? panelRect
      const composer = panel?.querySelector('[data-lc-composer]')
      const composerTop = composer?.getBoundingClientRect().top ?? panelRect.bottom
      const edgePad = 12
      const gap = 4
      const left = alignRect.left
      const width = Math.max(220, Math.min(panelRect.width * 0.75, panelRect.right - left - edgePad))
      const popoverHeight = popoverRef.current?.offsetHeight ?? 0
      const spaceBelow = composerTop - triggerRect.bottom - gap - edgePad
      const spaceAbove = triggerRect.top - panelRect.top - gap - edgePad
      const placeAbove = popoverHeight > 0 && spaceBelow < popoverHeight && spaceAbove > spaceBelow
      let top = placeAbove ? triggerRect.top - popoverHeight - gap : triggerRect.bottom + gap
      const minTop = panelRect.top + edgePad
      const maxTop = Math.max(minTop, composerTop - popoverHeight - edgePad)
      top = Math.min(Math.max(top, minTop), maxTop)
      setLayout({ top, left, width, placeAbove })
    }
  }, [anchorRef, panelRef])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    requestAnimationFrame(updatePosition)
  }, [open, steps.length, updatePosition])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, anchorRef, onClose, updatePosition])

  if (!open) return null

  return createPortal(
    <div
      ref={popoverRef}
      className={`${thinkingStyles.thinkingPopover}${layout.placeAbove ? ` ${thinkingStyles.thinkingPopoverAbove}` : ''}`}
      style={{ top: layout.top, left: layout.left, width: layout.width }}
      role="dialog"
      aria-label="Workflow steps"
    >
      <div className={thinkingStyles.thinkingPanelHeader}>
        <p className={thinkingStyles.thinkingPanelTitle}>Steps</p>
        <button type="button" className={thinkingStyles.thinkingPanelClose} aria-label="Close steps" onClick={onClose}>
          <X size={16} weight="bold" aria-hidden />
        </button>
      </div>
      <ol className={thinkingStyles.thinkingStepList}>
        {steps.map((step) => (
          <li key={step.id} className={thinkingStyles.thinkingStepItem}>
            <span className={styles.stepDot} data-tone={step.tone} aria-hidden />
            <div className={thinkingStyles.thinkingStepText}>
              <span className={thinkingStyles.thinkingStepTitle}>{step.label}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>,
    document.body,
  )
}

function WorkflowExamineBody({
  proposal,
  onRunFailed,
}: {
  proposal: WorkflowProposal
  onRunFailed?: (proposal: WorkflowProposal) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const linked = useMemo(
    () => (selectedId ? neighbors(selectedId, proposal.edges) : null),
    [proposal.edges, selectedId],
  )
  const stateFor = (id: string): 'idle' | 'selected' | 'linked' | 'dimmed' => {
    if (!linked) return 'idle'
    if (id === selectedId) return 'selected'
    if (linked.has(id)) return 'linked'
    return 'dimmed'
  }

  return (
    <div className={styles.detailCanvas}>
      <ExamineCanvas
        proposal={proposal}
        stateFor={stateFor}
        onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
      />
      <WorkflowActionBar
        proposal={proposal}
        onRunFailed={onRunFailed}
        className={styles.viewportActions}
        showSave={false}
      />
    </div>
  )
}

export function WorkflowDetailPanel({
  proposal,
  onClose,
  onShowInConversation,
  onRunFailed,
}: {
  proposal: WorkflowProposal
  onClose: () => void
  onShowInConversation?: () => void
  onRunFailed?: (proposal: WorkflowProposal) => void
}) {
  const titleId = useId()
  const runState = useWorkflowRun(proposal.id)
  const pillStatus: CardStatus = runState.running ? 'running' : runState.badge

  return (
    <aside className={`${railStyles.componentDetail} ${railStyles.componentDetailMapBleed}`} aria-label={`${proposal.title} workflow`}>
      <div className={styles.detailStage}>
        <header className={railStyles.mapBleedHeader}>
          <div className={railStyles.mapBleedBlur} aria-hidden />
          <div className={railStyles.mapBleedHeaderInner}>
            <div className={railStyles.mapBleedHeaderText}>
              <div className={railStyles.detailTitleRow}>
                <h2 id={titleId} className={railStyles.mapBleedTitle}>
                  {proposal.title}
                </h2>
                <span className={styles.pill} data-status={pillStatus}>
                  {runState.badge === 'published' ? <Check size={12} weight="bold" aria-hidden /> : null}
                  {STATUS_LABEL[pillStatus]}
                </span>
              </div>
              <p className={railStyles.componentDetailDescription}>{proposal.summary}</p>
              <div className={railStyles.headerInsightRow}>
                {onShowInConversation ? (
                  <button type="button" className={railStyles.showInConversationBtn} onClick={onShowInConversation}>
                    <ChatTeardropText size={20} weight="regular" aria-hidden />
                    <span>Show in Conversation</span>
                  </button>
                ) : null}
                <WorkflowHeaderSave id={proposal.id} disabled={runState.running} />
              </div>
            </div>
            <div className={railStyles.componentDetailHeaderActions}>
              <button type="button" className={railStyles.componentDetailClose} onClick={onClose} aria-label="Collapse preview">
                <SidebarSimple size={20} weight="regular" aria-hidden />
              </button>
            </div>
          </div>
        </header>
        <WorkflowExamineBody proposal={proposal} onRunFailed={onRunFailed} />
      </div>
    </aside>
  )
}

export function WorkflowProposalCard({
  proposal,
  active = false,
  panelRef,
  onRunFailed,
  onExpand,
}: {
  proposal: WorkflowProposal
  active?: boolean
  panelRef?: RefObject<HTMLElement | null>
  onRunFailed?: (proposal: WorkflowProposal) => void
  onExpand?: (proposal: WorkflowProposal) => void
}) {
  const runState = useWorkflowRun(proposal.id)
  const [stepsOpen, setStepsOpen] = useState(false)
  const [errorOpen, setErrorOpen] = useState(false)
  const stepsRef = useRef<HTMLButtonElement>(null)
  const pillStatus: CardStatus = runState.running ? 'running' : runState.badge

  useEffect(() => {
    if (!runState.error) setErrorOpen(false)
  }, [runState.error])

  return (
    <div className={styles.wrap} data-workflow-id={proposal.id} data-active={active ? 'true' : 'false'}>
      <article className={styles.card} aria-label={proposal.title}>
        <div className={styles.body}>
          <div className={styles.titleRow}>
            <h3 className={styles.title}>{proposal.title}</h3>
            <div className={styles.titleMeta}>
              <span className={styles.pill} data-status={pillStatus}>
                {runState.badge === 'published' ? <Check size={12} weight="bold" aria-hidden /> : null}
                {STATUS_LABEL[pillStatus]}
              </span>
              <button
                type="button"
                className={styles.expandBtn}
                aria-label={`Open ${proposal.title}`}
                aria-pressed={active}
                onClick={() => onExpand?.(proposal)}
              >
                <ArrowSquareOut size={20} weight="regular" aria-hidden />
              </button>
            </div>
          </div>
          <p className={styles.summary}>{proposal.summary}</p>
          <button
            ref={stepsRef}
            type="button"
            className={styles.stepsToggle}
            aria-expanded={stepsOpen}
            aria-haspopup="dialog"
            onClick={() => setStepsOpen((open) => !open)}
          >
            Show steps
          </button>
          <WorkflowActionBar proposal={proposal} onRunFailed={onRunFailed} />
        </div>
      </article>

      {runState.error ? (
        <div className={styles.runError} role="status">
          <div className={styles.runErrorRow}>
            <span className={styles.runErrorLabel}>
              <WarningCircle size={16} weight="fill" aria-hidden />
              Run failed
            </span>
            <button
              type="button"
              className={styles.showError}
              aria-expanded={errorOpen}
              onClick={() => setErrorOpen((open) => !open)}
            >
              {errorOpen ? 'Hide error' : 'Show error'}
            </button>
          </div>
          {errorOpen ? <p className={styles.runErrorDetail}>{runState.error}</p> : null}
        </div>
      ) : null}

      <StepsPopover
        open={stepsOpen}
        anchorRef={stepsRef}
        panelRef={panelRef}
        steps={proposal.steps}
        onClose={() => setStepsOpen(false)}
      />
    </div>
  )
}
