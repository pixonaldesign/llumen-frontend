import {
  Article,
  Brain,
  Buildings,
  CaretRight,
  ChartLine,
  CheckCircle,
  Database,
  FileText,
  MagnifyingGlass,
  MapTrifold,
  PencilSimpleLine,
  Presentation,
  SealCheck,
  Stack,
  Wind,
  X,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type {
  AgentResponseBlock,
  AssistantReplyPayload,
  CreatedComponent,
  ThinkingStep,
  WorkflowProposal,
} from './assistantReplyTypes'
import { thinkingStepsFromTimeline } from './thinkingSteps'
import { InlineVisualCard } from './InlineVisualCard'
import { ReportThumbnail } from './ReportThumbnail'
import { WorkflowProposalCard } from './WorkflowProposalCard'
import { useRevealScrollbarOnScroll } from './useRevealScrollbarOnScroll'
import styles from './AssistantTimelineReply.module.css'

export type AssistantTimelineReplyProps = {
  reply: AssistantReplyPayload
  /** Final answer; shown after the timeline sequence completes (supports streaming). */
  streamingText?: string
  /** When true, the trailing word of `streamingText` is still typing — skip its reveal until complete. */
  isAnswerStreaming?: boolean
  /** Fired when the user opens a created component in the detail sub-panel. */
  onComponentSelect?: (component: CreatedComponent) => void
  /** Open report slides in the subcontext panel. */
  onReportOpen?: (reportId: string) => void
  /** Fired when a block requests opening subcontext (map/chart/slides). */
  onOpenSubcontext?: (block: AgentResponseBlock) => void
  /** Fired after the thinking sequence and all reply blocks finish rendering. */
  onReplyComplete?: () => void
  /** A workflow run failed. The failure chip stays on the card; any question is asked from the composer. */
  onWorkflowRunFailed?: (proposal: WorkflowProposal) => void
  /** Open the workflow graph in the subcontext panel. */
  onOpenWorkflow?: (proposal: WorkflowProposal) => void
  /** Proposal currently open in the subcontext panel. */
  activeWorkflowId?: string | null
  /** Highlights the chip for the component currently open in the detail panel. */
  selectedComponentId?: string | null
  /** When true, skip step animation (used for older turns in the transcript). */
  instantTimeline?: boolean
  /** Conversation column used to center the thinking popover. */
  conversationPanelRef?: RefObject<HTMLElement | null>
  className?: string
}

const HEADLINE_LEAD_MS = 180
const STEP_PROGRESS_MS = 920
const STEP_GAP_MS = 160
const THINKING_STEP_REVEAL_MS = 380

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function prefersReducedMotionSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotionSnapshot, () => false)
}

/** Splits text into alternating word / whitespace runs (preserves spaces and line breaks). */
function splitWordSpaceSegments(text: string): { text: string; isWord: boolean }[] {
  const segments: { text: string; isWord: boolean }[] = []
  const re = /\S+|\s+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    segments.push({ text: m[0], isWord: /\S/.test(m[0]) })
  }
  return segments
}

const WORD_REVEAL_STAGGER_MS = 48
const WORD_REVEAL_DURATION_MS = 440
const BLOCK_GAP_MS = 280
const VISUAL_BLOCK_ENTER_MS = 520

function countWords(text: string) {
  return splitWordSpaceSegments(text).filter((seg) => seg.isWord).length
}

function AnimatedWordsParagraph({
  text,
  className,
  reduceMotion,
  isStreamingTail = false,
  instant = false,
  onComplete,
}: {
  text: string
  className: string
  reduceMotion: boolean
  isStreamingTail?: boolean
  /** Skip word animation and show the full paragraph immediately. */
  instant?: boolean
  onComplete?: () => void
}) {
  const doneRef = useRef(false)

  useEffect(() => {
    doneRef.current = false
  }, [text])

  useEffect(() => {
    if (!onComplete || doneRef.current) return

    if (reduceMotion || instant || !text) {
      doneRef.current = true
      onComplete()
      return
    }

    const words = countWords(text)
    const duration =
      words <= 0 ? WORD_REVEAL_DURATION_MS : (words - 1) * WORD_REVEAL_STAGGER_MS + WORD_REVEAL_DURATION_MS
    const timer = window.setTimeout(() => {
      doneRef.current = true
      onComplete()
    }, duration)

    return () => clearTimeout(timer)
  }, [text, reduceMotion, instant, onComplete])

  if (!text) return null

  if (reduceMotion || instant) {
    return <p className={className}>{text}</p>
  }

  const segments = splitWordSpaceSegments(text)
  let wordIndex = 0

  return (
    <p className={className}>
      {segments.map((seg, idx) => {
        if (!seg.isWord) {
          return (
            <span key={`sp-${idx}`}>
              {seg.text}
            </span>
          )
        }

        const isLastSegment = idx === segments.length - 1
        const skipReveal = Boolean(isStreamingTail && isLastSegment)

        if (skipReveal) {
          return (
            <span key={`tail-${idx}`}>
              {seg.text}
            </span>
          )
        }

        const delay = wordIndex * WORD_REVEAL_STAGGER_MS
        wordIndex += 1
        return (
          <span
            key={`w-${idx}-${seg.text.slice(0, 24)}`}
            className={styles.wordReveal}
            style={{ animationDelay: `${delay}ms` }}
          >
            {seg.text}
          </span>
        )
      })}
    </p>
  )
}

function AnswerBlockShell({
  animating,
  reduceMotion,
  onComplete,
  children,
}: {
  animating: boolean
  reduceMotion: boolean
  onComplete?: () => void
  children: ReactNode
}) {
  const doneRef = useRef(false)

  useEffect(() => {
    doneRef.current = false
  }, [animating])

  useEffect(() => {
    if (!animating || !onComplete || doneRef.current) return
    if (reduceMotion) {
      doneRef.current = true
      onComplete()
      return
    }
    const timer = window.setTimeout(() => {
      doneRef.current = true
      onComplete()
    }, VISUAL_BLOCK_ENTER_MS)
    return () => clearTimeout(timer)
  }, [animating, reduceMotion, onComplete])

  return (
    <div className={animating && !reduceMotion ? styles.answerBlockEnter : undefined}>
      {children}
    </div>
  )
}

function ThinkingStepIcon({ step }: { step: ThinkingStep }) {
  const title = step.title.toLowerCase()
  const kind = step.kind

  let Icon = Brain

  if (/\b(draft|writing|response with)\b/.test(title)) {
    Icon = PencilSimpleLine
  } else if (/\b(finaliz)\b/.test(title) || (kind === 'done' && !/\b(draft|writing)\b/.test(title))) {
    Icon = CheckCircle
  } else if (/\b(search|searching|looking|semantic models|data sources|connected data|found)\b/.test(title)) {
    Icon = MagnifyingGlass
  } else if (/\b(generat(?:ing|e)?(?:\s+\w+)*\s+map|air-quality map|updating map|map context)\b/.test(title)) {
    Icon = MapTrifold
  } else if (/\b(query|queries|database|warehouse|validation query)\b/.test(title)) {
    Icon = Database
  } else if (/\b(analyz|compar|composition|attribution|pattern)\b/.test(title)) {
    Icon = ChartLine
  } else if (/\b(land[- ]?use|industrial|buildings?)\b/.test(title)) {
    Icon = Buildings
  } else if (/\b(wind|meteorolog|weather)\b/.test(title)) {
    Icon = Wind
  } else if (/\b(collect|gather|stack|components)\b/.test(title)) {
    Icon = Stack
  } else if (/\b(slide|presentation|visual summar)\b/.test(title)) {
    Icon = Presentation
  } else if (/\b(structur|report|executive)\b/.test(title)) {
    Icon = Article
  } else if (/\b(validat|check|verif)\b/.test(title)) {
    Icon = SealCheck
  } else if (/\b(understand|asking|intent|question|request)\b/.test(title)) {
    Icon = Brain
  } else if (/\b(review|read|inspect)\b/.test(title)) {
    Icon = FileText
  } else if (/\b(map|geographic|spatial)\b/.test(title)) {
    Icon = MapTrifold
  } else if (kind === 'search') {
    Icon = MagnifyingGlass
  } else if (kind === 'done') {
    Icon = CheckCircle
  }

  return (
    <span className={styles.thinkingStepIcon} aria-hidden>
      <Icon size={14} weight="regular" />
    </span>
  )
}

function ThinkingPopover({
  open,
  anchorRef,
  panelRef,
  steps,
  reduceMotion,
  onClose,
}: {
  open: boolean
  anchorRef: RefObject<HTMLButtonElement | null>
  panelRef?: RefObject<HTMLElement | null>
  steps: ThinkingStep[]
  reduceMotion: boolean
  onClose: () => void
}) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const thinkingScrollRef = useRevealScrollbarOnScroll()
  const [layout, setLayout] = useState({ top: 0, left: 0, width: 360, placeAbove: false })

  const updatePosition = useCallback(() => {
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

    // Flush to the message/reply left edge; 75% of the chat window width.
    const left = alignRect.left
    const width = Math.max(220, Math.min(panelRect.width * 0.75, panelRect.right - left - edgePad))

    const popoverHeight = popoverRef.current?.offsetHeight ?? 0
    const spaceBelow = composerTop - triggerRect.bottom - gap - edgePad
    const spaceAbove = triggerRect.top - panelRect.top - gap - edgePad
    const placeAbove =
      popoverHeight > 0 && spaceBelow < popoverHeight && spaceAbove > spaceBelow

    let top = placeAbove ? triggerRect.top - popoverHeight - gap : triggerRect.bottom + gap
    const minTop = panelRect.top + edgePad
    const maxTop = Math.max(minTop, composerTop - popoverHeight - edgePad)
    top = Math.min(Math.max(top, minTop), maxTop)

    setLayout({ top, left, width, placeAbove })
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
    // Capture so Escape closes thinking without dismissing the chat panel.
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, anchorRef, onClose])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  if (!open) return null

  return createPortal(
    <div
      ref={popoverRef}
      className={`${styles.thinkingPopover}${layout.placeAbove ? ` ${styles.thinkingPopoverAbove}` : ''}`}
      style={{
        top: layout.top,
        left: layout.left,
        width: layout.width,
      }}
      role="dialog"
      aria-label="Thinking"
      data-lc-thinking-popover
    >
      <div className={styles.thinkingPanelHeader}>
        <p className={styles.thinkingPanelTitle}>Thinking</p>
        <button
          type="button"
          className={styles.thinkingPanelClose}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          }}
          aria-label="Close thinking"
        >
          <X size={16} weight="bold" aria-hidden />
        </button>
      </div>
      <ol ref={thinkingScrollRef} className={styles.thinkingStepList}>
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={styles.thinkingStepItem}
            style={reduceMotion ? undefined : { animationDelay: `${index * 40}ms` }}
          >
            <ThinkingStepIcon step={step} />
            <div className={styles.thinkingStepText}>
              <span className={styles.thinkingStepTitle}>{step.title}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>,
    document.body,
  )
}

const OPENING_SUFFIX = ', let me work on this for you.'

export function AssistantTimelineReply({
  reply,
  streamingText,
  isAnswerStreaming = false,
  onComponentSelect,
  onReportOpen,
  onOpenSubcontext,
  onReplyComplete,
  onWorkflowRunFailed,
  onOpenWorkflow,
  activeWorkflowId = null,
  selectedComponentId = null,
  instantTimeline = false,
  conversationPanelRef,
  className,
}: AssistantTimelineReplyProps) {
  const { confirmation, timeline, createdComponents = [], blocks: replyBlocks = [], reports = [] } = reply
  const blocks = useMemo(
    () => replyBlocks.filter((block) => block.type !== 'question'),
    [replyBlocks],
  )
  const questionOnly =
    replyBlocks.length > 0 && replyBlocks.every((block) => block.type === 'question')
  const thinkingSteps = useMemo(
    () => reply.thinkingSteps ?? thinkingStepsFromTimeline(timeline),
    [reply.thinkingSteps, timeline],
  )
  const reduceMotion = usePrefersReducedMotion()
  const componentById = useMemo(() => {
    const map = new Map<string, CreatedComponent>()
    for (const c of createdComponents) map.set(c.id, c)
    return map
  }, [createdComponents])
  const reportById = useMemo(() => {
    const map = new Map(reports.map((r) => [r.id, r]))
    return map
  }, [reports])

  const [revealedCount, setRevealedCount] = useState(0)
  const [runningIndex, setRunningIndex] = useState<number | null>(null)
  const [sequenceComplete, setSequenceComplete] = useState(false)
  const [thoughtExpanded, setThoughtExpanded] = useState(false)
  const [thoughtSeconds, setThoughtSeconds] = useState<number | null>(null)
  const [revealedThinkingCount, setRevealedThinkingCount] = useState(0)
  const [revealedBlockCount, setRevealedBlockCount] = useState(0)
  const thoughtTriggerRef = useRef<HTMLButtonElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blockGapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const thoughtStartRef = useRef(Date.now())
  const openedSubcontextKeys = useRef(new Set<string>())
  const replyCompleteNotifiedRef = useRef(false)

  useEffect(() => {
    if (instantTimeline || reduceMotion) {
      if (revealedCount > 0 && thoughtSeconds === null) {
        setThoughtSeconds(Math.max(1, Math.round((Date.now() - thoughtStartRef.current) / 1000)))
      }
      return
    }
    if (revealedCount > 0 && thoughtSeconds === null) {
      setThoughtSeconds(Math.max(1, Math.round((Date.now() - thoughtStartRef.current) / 1000)))
    }
  }, [instantTimeline, reduceMotion, revealedCount, thoughtSeconds])

  const isThinking = !instantTimeline && revealedCount === 0 && timeline.length > 0

  useEffect(() => {
    if (instantTimeline || reduceMotion) {
      setRevealedThinkingCount(thinkingSteps.length)
      return
    }
    if (!isThinking) {
      setRevealedThinkingCount(thinkingSteps.length)
      return
    }

    setRevealedThinkingCount(0)
    let i = 0
    const interval = window.setInterval(() => {
      i += 1
      setRevealedThinkingCount(i)
      if (i >= thinkingSteps.length) clearInterval(interval)
    }, THINKING_STEP_REVEAL_MS)

    return () => clearInterval(interval)
  }, [instantTimeline, isThinking, reduceMotion, thinkingSteps.length])

  useEffect(() => {
    const clearT = () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    let cancelled = false

    startTimeoutRef.current = window.setTimeout(() => {
      if (cancelled) return

      if (instantTimeline || reduceMotion) {
        setRevealedCount(timeline.length)
        setRunningIndex(null)
        setSequenceComplete(true)
        return
      }

      setSequenceComplete(false)

      const schedule = (fn: () => void, ms: number) => {
        clearT()
        timeoutRef.current = window.setTimeout(fn, ms)
      }

      setRevealedCount(0)
      setRunningIndex(null)

      if (timeline.length === 0) {
        setSequenceComplete(true)
        return
      }

      const runStep = (i: number) => {
        if (i >= timeline.length) return
        setRevealedCount(i + 1)
        setRunningIndex(i)
        schedule(() => {
          setRunningIndex(null)
          if (i < timeline.length - 1) {
            schedule(() => runStep(i + 1), STEP_GAP_MS)
          } else {
            setSequenceComplete(true)
          }
        }, STEP_PROGRESS_MS)
      }

      schedule(() => runStep(0), HEADLINE_LEAD_MS)
    }, 0)

    return () => {
      cancelled = true
      if (startTimeoutRef.current != null) {
        clearTimeout(startTimeoutRef.current)
        startTimeoutRef.current = null
      }
      clearT()
    }
  }, [timeline, reduceMotion, instantTimeline])

  const useBlocks = blocks.length > 0

  useEffect(() => {
    if (blockGapTimerRef.current != null) {
      clearTimeout(blockGapTimerRef.current)
      blockGapTimerRef.current = null
    }

    if (!sequenceComplete) {
      setRevealedBlockCount(0)
      return
    }
    if (!useBlocks) {
      setRevealedBlockCount(0)
      return
    }
    if (instantTimeline || reduceMotion) {
      setRevealedBlockCount(blocks.length)
      return
    }

    setRevealedBlockCount(1)
  }, [sequenceComplete, useBlocks, blocks.length, instantTimeline, reduceMotion])

  const onActiveBlockComplete = useCallback(() => {
    if (instantTimeline || reduceMotion) return
    if (blockGapTimerRef.current != null) clearTimeout(blockGapTimerRef.current)
    blockGapTimerRef.current = window.setTimeout(() => {
      blockGapTimerRef.current = null
      setRevealedBlockCount((count) => Math.min(count + 1, blocks.length + 1))
    }, BLOCK_GAP_MS)
  }, [blocks.length, instantTimeline, reduceMotion])

  useEffect(() => {
    if (instantTimeline || replyCompleteNotifiedRef.current || !sequenceComplete) return

    const replyComplete = useBlocks
      ? reduceMotion
        ? revealedBlockCount >= blocks.length
        : revealedBlockCount > blocks.length
      : !isAnswerStreaming

    if (!replyComplete) return
    replyCompleteNotifiedRef.current = true
    onReplyComplete?.()
  }, [
    blocks.length,
    instantTimeline,
    isAnswerStreaming,
    onReplyComplete,
    reduceMotion,
    revealedBlockCount,
    sequenceComplete,
    useBlocks,
  ])

  useEffect(() => {
    if (!useBlocks || !onOpenSubcontext || instantTimeline) return
    const visible = blocks.slice(0, revealedBlockCount)
    for (const block of visible) {
      const key =
        block.type === 'visual'
          ? `visual:${block.componentId}:${block.openSubcontext ? '1' : '0'}`
          : block.type === 'report'
            ? `report:${block.reportId}`
            : null
      if (!key) continue
      const shouldOpen =
        (block.type === 'visual' && block.openSubcontext) ||
        (block.type === 'report' && block.openSubcontext)
      if (!shouldOpen || openedSubcontextKeys.current.has(key)) continue
      openedSubcontextKeys.current.add(key)
      onOpenSubcontext(block)
    }
  }, [useBlocks, blocks, revealedBlockCount, onOpenSubcontext, instantTimeline])

  const openingLine =
    confirmation && confirmation.trim().length > 0
      ? `${confirmation.trim()}${OPENING_SUFFIX}`
      : null

  const showThoughtRow = sequenceComplete && thoughtSeconds != null
  const thoughtLabel =
    thoughtSeconds != null
      ? `Thought for ${thoughtSeconds} second${thoughtSeconds === 1 ? '' : 's'}`
      : ''
  const visibleThinkingSteps = thinkingSteps.slice(
    0,
    isThinking ? revealedThinkingCount : thinkingSteps.length,
  )

  const thoughtBlock = showThoughtRow ? (
    <div className={styles.thinkingWrap}>
      <button
        ref={thoughtTriggerRef}
        type="button"
        className={styles.thinkingRow}
        onClick={() => setThoughtExpanded((open) => !open)}
        aria-expanded={thoughtExpanded}
        aria-haspopup="dialog"
      >
        <span className={isThinking ? styles.thinkingLabelActive : styles.thinkingLabel}>
          {thoughtLabel}
        </span>
        <CaretRight
          className={`${styles.thinkingCaret}${thoughtExpanded ? ` ${styles.thinkingCaretOpen}` : ''}`}
          size={14}
          weight="bold"
          aria-hidden
        />
      </button>
      <ThinkingPopover
        open={thoughtExpanded}
        anchorRef={thoughtTriggerRef}
        panelRef={conversationPanelRef}
        steps={visibleThinkingSteps}
        reduceMotion={reduceMotion}
        onClose={() => setThoughtExpanded(false)}
      />
    </div>
  ) : null

  const visibleBlocks = useBlocks
    ? blocks.slice(0, Math.min(revealedBlockCount, blocks.length))
    : []

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-lc-reply-root
    >
      {openingLine ? (
        <AnimatedWordsParagraph
          text={openingLine}
          className={styles.openingLine}
          reduceMotion={reduceMotion}
        />
      ) : null}

      {runningIndex != null && timeline[runningIndex] ? (
        <div className={styles.statusWrap} aria-live="polite">
          <div key={timeline[runningIndex].id} className={styles.statusLine}>
            <span className={`${styles.stepTitle} ${styles.stepTitleShimmer}`}>
              {timeline[runningIndex].titleInProgress ?? timeline[runningIndex].title}
            </span>
          </div>
        </div>
      ) : null}

      {thoughtBlock}

      {useBlocks && sequenceComplete ? (
        <div className={styles.finalReply} aria-live="polite">
          {visibleBlocks.map((block, index) => {
            const isAnimating =
              !instantTimeline &&
              !reduceMotion &&
              revealedBlockCount <= blocks.length &&
              index === revealedBlockCount - 1
            const isSettled = !isAnimating
            const prev = index > 0 ? visibleBlocks[index - 1] : null
            const isMedia = block.type === 'visual' || block.type === 'report'
            const prevIsCopy = prev?.type === 'text'
            // Top separator when a visual/report follows body text (no separator after component)
            const needsTopSeparator = isMedia && prevIsCopy
            const separatorClass = needsTopSeparator
              ? `${styles.answerBlockSeparator} ${styles.answerBlockSeparatorTop}`
              : undefined

            if (block.type === 'heading') {
              return (
                <AnswerBlockShell
                  key={`heading-${index}`}
                  animating={isAnimating}
                  reduceMotion={reduceMotion}
                  onComplete={isAnimating ? onActiveBlockComplete : undefined}
                >
                  <h3 className={styles.finalReplyHeading}>{block.content}</h3>
                </AnswerBlockShell>
              )
            }

            if (block.type === 'text') {
              return (
                <div key={`text-${index}`}>
                  <AnimatedWordsParagraph
                    text={block.content}
                    className={styles.finalReplyText}
                    reduceMotion={reduceMotion}
                    instant={isSettled}
                    onComplete={isAnimating ? onActiveBlockComplete : undefined}
                  />
                </div>
              )
            }

            if (block.type === 'visual') {
              const component = componentById.get(block.componentId)
              if (!component) return null
              return (
                <AnswerBlockShell
                  key={`visual-${block.componentId}-${index}`}
                  animating={isAnimating}
                  reduceMotion={reduceMotion}
                  onComplete={isAnimating ? onActiveBlockComplete : undefined}
                >
                  <div className={`${styles.visualBlock}${separatorClass ? ` ${separatorClass}` : ''}`}>
                    <InlineVisualCard
                      component={component}
                      caption={block.caption}
                      active={selectedComponentId === component.id}
                      onExpand={onComponentSelect ? () => onComponentSelect(component) : undefined}
                    />
                  </div>
                </AnswerBlockShell>
              )
            }

            if (block.type === 'workflow') {
              return (
                <AnswerBlockShell
                  key={`workflow-${block.proposal.id}`}
                  animating={isAnimating}
                  reduceMotion={reduceMotion}
                  onComplete={isAnimating ? onActiveBlockComplete : undefined}
                >
                  <WorkflowProposalCard
                    proposal={block.proposal}
                    active={activeWorkflowId === block.proposal.id}
                    panelRef={conversationPanelRef}
                    onRunFailed={onWorkflowRunFailed}
                    onExpand={onOpenWorkflow}
                  />
                </AnswerBlockShell>
              )
            }

            if (block.type !== 'report') return null
            const report = reportById.get(block.reportId)
            if (!report) return null
            return (
              <AnswerBlockShell
                key={`report-${block.reportId}`}
                animating={isAnimating}
                reduceMotion={reduceMotion}
                onComplete={isAnimating ? onActiveBlockComplete : undefined}
              >
                <div className={`${styles.visualBlock}${separatorClass ? ` ${separatorClass}` : ''}`}>
                  <ReportThumbnail report={report} onOpen={() => onReportOpen?.(block.reportId)} />
                </div>
              </AnswerBlockShell>
            )
          })}
        </div>
      ) : null}

      {!useBlocks && sequenceComplete && !questionOnly ? (
        <div className={styles.finalReply} aria-live="polite">
          {streamingText && streamingText.length > 0 ? (
            <AnimatedWordsParagraph
              text={streamingText}
              className={styles.finalReplyText}
              reduceMotion={reduceMotion}
              isStreamingTail={isAnswerStreaming}
            />
          ) : (
            <p className={styles.finalReplyPending}>Preparing your summary…</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
