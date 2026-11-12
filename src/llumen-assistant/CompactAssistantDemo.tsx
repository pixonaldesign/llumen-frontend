/**
 * Llumen compact assistant demo — air-quality conversation flow.
 * Integration: theme tokens in src/styles/tokens.css; icons in public/llumen-assets/*.svg.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { CaretDown } from '@phosphor-icons/react'
import { MeshGradient } from '@paper-design/shaders-react'
import gsap from 'gsap'
import styles from './compact-assistant.module.css'
import { llumenAssets } from './assets'
import LandingHomeDefault from './landing/LandingHomeDefault'
import { FeedLanding } from './landing/FeedLanding'
import { OverlayScrollThumb } from './landing/OverlayScrollThumb'
import { type LandingContextChip } from './landing/LandingChatbox'
import { HubChatbox } from './landing/HubChatbox'
import { FindingReveal } from './landing/FindingReveal'
import { FindingToastStack } from './landing/FindingToastStack'
import { FindingAuroraPanel } from './landing/FindingAuroraPanel'
import { DEFAULT_FINDING_AURORA, OCEAN_AURORA_STOPS, STAGED_AURORA_PHASE1_MS, type FindingAuroraSettings } from './landing/findingAuroraSettings'
import {
  FINDING_TOAST_SEED_COUNT,
  isAlertFinding,
  isFindingSlashCommand,
  nextAlertFromPool,
  nextFindingFromPool,
  relatedStoryId,
  type FindingToastInstance,
} from './landing/findingDemoData'
import {
  ENERGY_WORKFLOW_TITLE,
  ENERGY_WORKFLOW_USER_TEXT,
  energyWorkflowReply,
  isEnergyWorkflowExample,
  workflowChangeReply,
  workflowFixReply,
  workflowRunFailedReply,
  workflowWaitReply,
} from './energyWorkflowDemo'
import {
  parseSlashCommand,
  slashChatTitle,
  underwayMessage,
  workUnderwayReply,
} from './slashCommands'
import type { HubWorkToast } from './landing/HubChatbox'
import type { LandingTellMeMorePayload } from './landing/LandingHomeDefault'
import { DUMPING_ALERT_BRIEFING, DUMPING_BRIEFING_SOURCES } from './landing/dumpingBriefing'
import { CommandPalette } from './CommandPalette'
import {
  persistLandingVariant,
  persistTopBarVariant,
  readLandingVariant,
  readTopBarVariant,
  type LandingVariant,
  type TopBarVariant,
} from './prototypeChrome'
import {
  persistChatInteractionModel,
  readChatInteractionModel,
  type ChatInteractionModel,
} from './interactionModel'
import { StoryView } from './story/StoryView'
import type { LandingStory } from './story/storyDemoData'
import {
  MESH_COLORS_DEMO_PAGE,
  MESH_FRAME_DEMO_PAGE,
  MESH_MAX_PIXEL_COUNT_DEMO_PAGE,
} from './paperMeshConstants'
import { AssistantHero } from './AssistantHero'
import { AssistantLauncher } from './AssistantLauncher'
import { AssistantPanel } from './AssistantPanel'
import { ChatComposer, type ChatComposerHandle } from './ChatComposer'
import { AgentQuestionPrompt } from './AgentQuestionPrompt'
import { PanelHeader } from './PanelHeader'
import type { ChatQuestionIndexItem, ChatSearchState } from './PanelHeader'
import { useTranscriptSearch } from './useTranscriptSearch'
import { SessionsPanel, DEMO_SESSION_ID } from './SessionsPanel'
import { ShareModal } from './ShareModal'
import { SourcesPanel } from './SourcesPanel'
import { sourcesForDemoConversation } from './conversationSources'
import { splitTextWithInlineMentions, getCategoryIcon, type InlineContextItem } from './inlineContextData'
import type {
  AgentResponseBlock,
  AssistantReplyPayload,
  CreatedComponent,
  SubcontextState,
  WorkflowProposal,
} from './assistantReplyTypes'
import { AssistantTimelineReply } from './AssistantTimelineReply'
import { WorkflowDetailPanel } from './WorkflowProposalCard'
import { ComponentDetailPanel } from './ComponentDetailPanel'
import { SlidesDetailPanel } from './SlidesDetailPanel'
import {
  AIR_QUALITY_COMPONENTS,
  AIR_QUALITY_REPORT,
  TURN1_REPLY,
  TURN2_REPLY,
  detectConversationTurn,
  findComponent,
  findReport,
  replyForTurn,
} from './airQualityConversationDemo'
import type { SendVisualState } from './SendButton'
import { useRevealScrollbarOnScroll } from './useRevealScrollbarOnScroll'
import { useStickToBottomScroll } from './useStickToBottomScroll'
import { usePageCovered } from './pageCover'

type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string; reply?: AssistantReplyPayload }

const SUBCONTEXT_EXIT_MS = 280

/** Design-capture presets via `?preview=<name>` (used for Figma handoff). */
type FigmaPreviewMode =
  | 'empty'
  | 'conversation'
  | 'sessions'
  | 'fullscreen'
  | 'fullscreen-sessions'
  | 'detail'

function readFigmaPreviewMode(): FigmaPreviewMode | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('preview')
  switch (value) {
    case 'empty':
    case 'conversation':
    case 'sessions':
    case 'fullscreen':
    case 'fullscreen-sessions':
    case 'detail':
      return value
    default:
      return null
  }
}

function buildTurn1Seed(): ChatMessage[] {
  return [
    {
      id: 'demo-u1',
      role: 'user',
      text: 'What is driving the deterioration in air quality, where is it concentrated, and who may be exposed?',
    },
    {
      id: 'demo-a1',
      role: 'assistant',
      text: '',
      reply: TURN1_REPLY,
    },
  ]
}

function buildConversationSeed(): ChatMessage[] {
  return [
    {
      id: 'preview-u1',
      role: 'user',
      text: 'What is driving the deterioration in air quality, where is it concentrated, and who may be exposed?',
    },
    {
      id: 'preview-a1',
      role: 'assistant',
      text: '',
      reply: TURN1_REPLY,
    },
    {
      id: 'preview-u2',
      role: 'user',
      text: 'Are elevated NO₂ and PM₂.₅ more consistent with traffic or industrial activity?',
    },
    {
      id: 'preview-a2',
      role: 'assistant',
      text: '',
      reply: TURN2_REPLY,
    },
  ]
}

const SESSIONS_SIDEBAR_BREAKPOINT_PX = 1536

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function truncateTitle(text: string, max = 52) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  const slice = cleaned.slice(0, max - 1)
  const lastSpace = slice.lastIndexOf(' ')
  return `${(lastSpace > 24 ? slice.slice(0, lastSpace) : slice).trim()}…`
}

function titleFromReply(reply: AssistantReplyPayload) {
  if (reply.headline?.trim()) return truncateTitle(reply.headline)
  const firstText = reply.blocks?.find((b) => b.type === 'text')
  if (firstText?.type === 'text' && firstText.content.trim()) return truncateTitle(firstText.content)
  if (reply.confirmation?.trim()) return truncateTitle(reply.confirmation)
  return 'New chat'
}

function UserMessageBubble({
  messageId,
  text,
  questions,
  onJumpToQuestion,
}: {
  messageId: string
  text: string
  questions: ChatQuestionIndexItem[]
  onJumpToQuestion: (questionId: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const showJump = questions.length > 1

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <div data-message-id={messageId} className={styles.msgUserRow}>
      <div className={styles.msgUser}>
        <span className={styles.msgUserText}>
          {splitTextWithInlineMentions(text).map((segment, index) => {
            if (segment.type !== 'mention') {
              return <span key={`t-${index}`}>{segment.value}</span>
            }
            const Icon = getCategoryIcon(segment.categoryId)
            return (
              <span key={`m-${index}`} className={styles.inlineMention}>
                <Icon className={styles.inlineMentionIcon} size={12} weight="bold" aria-hidden />
                <span className={styles.inlineMentionLabel}>{segment.name}</span>
              </span>
            )
          })}
        </span>
        {showJump ? (
          <div className={styles.msgUserJumpWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.msgUserJumpBtn}
              aria-label="Jump to another message"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <CaretDown size={14} weight="bold" aria-hidden />
            </button>
            {menuOpen ? (
              <div className={styles.msgUserJumpMenu} role="menu" aria-label="Your messages in this chat">
                {questions.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={`${styles.msgUserJumpItem}${
                      item.id === messageId ? ` ${styles.msgUserJumpItemActive}` : ''
                    }`}
                    onClick={() => {
                      onJumpToQuestion(item.id)
                      setMenuOpen(false)
                    }}
                  >
                    <span className={styles.msgUserJumpItemNum}>{index + 1}</span>
                    <span className={styles.msgUserJumpItemText}>{item.question}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function CompactAssistantDemo() {
  const previewMode = useMemo(() => readFigmaPreviewMode(), [])
  const previewForceInstant = previewMode != null
  const [interactionModel, setInteractionModel] = useState<ChatInteractionModel>(() =>
    readChatInteractionModel(previewMode != null),
  )
  const isHub = interactionModel === 'hub'
  const [open, setOpen] = useState(() => previewMode != null)
  const [expanded, setExpanded] = useState(
    () => previewMode === 'fullscreen' || previewMode === 'fullscreen-sessions',
  )
  const [draft, setDraft] = useState('')
  const [subcontext, setSubcontext] = useState<SubcontextState>(() =>
    previewMode === 'detail'
      ? { view: 'map', componentId: 'air-quality-monitoring-map' }
      : { view: 'closed' },
  )
  const [subcontextClosing, setSubcontextClosing] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(
    () => previewMode === 'sessions' || previewMode === 'fullscreen-sessions',
  )
  const [shareOpen, setShareOpen] = useState(false)
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null)
  const [landingChips, setLandingChips] = useState<LandingContextChip[]>([])
  const [landingFocusToken, setLandingFocusToken] = useState(0)
  const [findingToasts, setFindingToasts] = useState<FindingToastInstance[]>([])
  const [findingToastIndex, setFindingToastIndex] = useState(0)
  const [alertIndex, setAlertIndex] = useState(0)
  const [findingAurora, setFindingAurora] = useState<FindingAuroraSettings>(DEFAULT_FINDING_AURORA)
  const [auroraPanelOpen, setAuroraPanelOpen] = useState(false)
  const [auroraReplayKey, setAuroraReplayKey] = useState(0)
  const [landingVariant, setLandingVariant] = useState<LandingVariant>(() => readLandingVariant())
  const [topBar, setTopBar] = useState<TopBarVariant>(() => readTopBarVariant())
  const [paletteOpen, setPaletteOpen] = useState(false)
  const findingPoolIndexRef = useRef(0)
  const alertPoolIndexRef = useRef(0)
  const [hubWorkToast, setHubWorkToast] = useState<HubWorkToast | null>(null)
  const hubWorkUserTextRef = useRef('')
  const [hubStoryOpen, setHubStoryOpen] = useState(false)
  const [hubMorphFrom, setHubMorphFrom] = useState<DOMRect | null>(null)
  const [hubRailMode, setHubRailMode] = useState<'thread' | 'sessions'>('thread')
  const [chatSearch, setChatSearch] = useState<ChatSearchState>({ open: false, query: '' })
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    previewMode === 'conversation' ||
    previewMode === 'sessions' ||
    previewMode === 'fullscreen' ||
    previewMode === 'fullscreen-sessions' ||
    previewMode === 'detail'
      ? buildConversationSeed()
      : [],
  )
  const [sources, setSources] = useState(() =>
    sourcesForDemoConversation(
      previewMode === 'conversation' ||
        previewMode === 'sessions' ||
        previewMode === 'fullscreen' ||
        previewMode === 'fullscreen-sessions' ||
        previewMode === 'detail',
    ),
  )
  const [sourcesPanelDismissed, setSourcesPanelDismissed] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [replyRendering, setReplyRendering] = useState(false)
  const [chatTitle, setChatTitle] = useState(() =>
    previewMode && previewMode !== 'empty' ? 'Air quality corridor review' : 'New chat',
  )
  const titleEditedRef = useRef(false)
  const streamTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const assistantMsgId = useRef<string | null>(null)
  const assistantPanelRef = useRef<HTMLDivElement>(null)
  const subcontextCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chatMiddleRef = useRef<HTMLDivElement>(null)
  const pendingPanelAnimRef = useRef<{ width: number; height: number; top: number; left: number } | null>(
    null,
  )
  const revealSessionsAfterExpandRef = useRef(false)
  const subcontextViewRef = useRef(subcontext.view)
  subcontextViewRef.current = subcontext.view
  const transcriptRevealRef = useRevealScrollbarOnScroll()
  const composerRef = useRef<ChatComposerHandle>(null)
  const transcriptContentKey = `${messages.length}:${streaming ? '1' : '0'}`
  const { ref: transcriptStickRef, releaseStick } = useStickToBottomScroll(transcriptContentKey)
  const transcriptElRef = useRef<HTMLDivElement | null>(null)

  const syncTranscriptScrollbarInset = useCallback(() => {
    const middle = chatMiddleRef.current
    if (!middle) return
    const tokenPx =
      Number.parseFloat(getComputedStyle(middle).getPropertyValue('--lc-scrollbar-size')) || 4
    // Keep a fixed reserve (token) in empty + filled states. Measuring the live
    // scrollbar/gutter made the composer shrink when the first answer appeared.
    middle.style.setProperty('--lc-transcript-scrollbar-inset', `${tokenPx}px`)
  }, [])

  const transcriptScrollRef = useCallback(
    (el: HTMLDivElement | null) => {
      transcriptElRef.current = el
      transcriptRevealRef(el)
      transcriptStickRef(el)
      syncTranscriptScrollbarInset()
    },
    [transcriptRevealRef, transcriptStickRef, syncTranscriptScrollbarInset],
  )

  const searchQueryActive = chatSearch.open ? chatSearch.query : ''
  const {
    matchCount: searchMatchCount,
    activeIndex: searchActiveMatch,
    goNext: goNextSearchMatch,
    goPrev: goPrevSearchMatch,
  } = useTranscriptSearch({
    rootRef: transcriptElRef,
    query: searchQueryActive,
    revision: transcriptContentKey,
    hitClass: styles.searchHit,
    activeHitClass: styles.searchHitActive,
  })

  const onChatSearchChange = useCallback((state: ChatSearchState) => {
    setChatSearch(state)
  }, [])

  const onSearchMatchNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      releaseStick()
      if (direction === 'prev') goPrevSearchMatch()
      else goNextSearchMatch()
    },
    [releaseStick, goPrevSearchMatch, goNextSearchMatch],
  )

  useEffect(() => {
    const transcript = transcriptElRef.current
    syncTranscriptScrollbarInset()
    if (!transcript) return
    const ro = new ResizeObserver(() => syncTranscriptScrollbarInset())
    ro.observe(transcript)
    window.addEventListener('resize', syncTranscriptScrollbarInset)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', syncTranscriptScrollbarInset)
    }
  }, [syncTranscriptScrollbarInset, transcriptContentKey])

  useLayoutEffect(() => {
    const start = pendingPanelAnimRef.current
    if (!start) return
    pendingPanelAnimRef.current = null
    const el = assistantPanelRef.current
    if (!el) return

    const vw = window.innerWidth
    const vh = window.innerHeight

    gsap.killTweensOf(el)

    if (expanded) {
      const end = { top: 0, left: 0, width: vw, height: vh }
      gsap.set(el, {
        position: 'fixed',
        top: start.top,
        left: start.left,
        width: start.width,
        height: start.height,
        margin: 0,
        right: 'auto',
        bottom: 'auto',
      })
      const tween = gsap.to(el, {
        top: end.top,
        left: end.left,
        width: end.width,
        height: end.height,
        duration: 0.62,
        ease: 'power3.inOut',
        onComplete: () => {
          gsap.set(el, { clearProps: 'top,left,width,height,margin,right,bottom,position' })
          if (revealSessionsAfterExpandRef.current && subcontextViewRef.current === 'closed') {
            setSessionsOpen(true)
          }
          revealSessionsAfterExpandRef.current = false
        },
      })
      return () => {
        tween.kill()
        gsap.set(el, { clearProps: 'top,left,width,height,margin,right,bottom,position' })
      }
    }

    const endRect = el.getBoundingClientRect()
    gsap.set(el, {
      position: 'fixed',
      top: start.top,
      left: start.left,
      width: start.width,
      height: start.height,
      margin: 0,
      right: 'auto',
      bottom: 'auto',
    })
    const tween = gsap.to(el, {
      top: endRect.top,
      left: endRect.left,
      width: endRect.width,
      height: endRect.height,
      duration: 0.62,
      ease: 'power3.inOut',
      onComplete: () => {
        gsap.set(el, { clearProps: 'top,left,width,height,margin,right,bottom,position' })
      },
    })
    return () => {
      tween.kill()
      gsap.set(el, { clearProps: 'top,left,width,height,margin,right,bottom,position' })
    }
  }, [expanded])

  const clearStream = useCallback(() => {
    if (streamTimer.current) {
      clearTimeout(streamTimer.current)
      streamTimer.current = null
    }
    assistantMsgId.current = null
    setStreaming(false)
    setReplyRendering(false)
  }, [])

  useEffect(() => {
    return () => clearStream()
  }, [clearStream])

  const openSubcontext = useCallback((next: SubcontextState) => {
    if (subcontextCloseTimerRef.current != null) {
      clearTimeout(subcontextCloseTimerRef.current)
      subcontextCloseTimerRef.current = null
    }
    setSubcontextClosing(false)
    setSubcontext(next)
  }, [])

  const closeSubcontext = useCallback(() => {
    if (subcontext.view === 'closed' || subcontextCloseTimerRef.current != null) return
    setSubcontextClosing(true)
    subcontextCloseTimerRef.current = setTimeout(() => {
      subcontextCloseTimerRef.current = null
      setSubcontext({ view: 'closed' })
      setSubcontextClosing(false)
    }, SUBCONTEXT_EXIT_MS)
  }, [subcontext.view])

  const closeSubcontextImmediately = useCallback(() => {
    if (subcontextCloseTimerRef.current != null) {
      clearTimeout(subcontextCloseTimerRef.current)
      subcontextCloseTimerRef.current = null
    }
    setSubcontextClosing(false)
    setSubcontext({ view: 'closed' })
  }, [])

  useEffect(() => {
    return () => {
      if (subcontextCloseTimerRef.current != null) clearTimeout(subcontextCloseTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (subcontext.view !== 'closed') setSessionsOpen(false)
  }, [subcontext.view])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (shareOpen) return
      if (isHub && hubStoryOpen && !open) {
        e.preventDefault()
        setHubStoryOpen(false)
        setHubMorphFrom(null)
        return
      }
      if (!open) return
      e.preventDefault()
      if (subcontext.view !== 'closed') {
        closeSubcontext()
        return
      }
      if (isHub && hubRailMode === 'sessions') {
        setOpen(false)
        setSessionsOpen(false)
        setHubRailMode('thread')
        return
      }
      if (sessionsOpen) {
        setSessionsOpen(false)
        return
      }
      if (expanded) {
        const el = assistantPanelRef.current
        if (el) {
          const rect = el.getBoundingClientRect()
          pendingPanelAnimRef.current = {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }
        }
        setExpanded(false)
        return
      }
      setOpen(false)
      setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, subcontext.view, closeSubcontext, expanded, sessionsOpen, shareOpen, isHub, hubStoryOpen, hubRailMode])

  const startAssistantReply = useCallback((reply: AssistantReplyPayload) => {
    const aid = uid()
    assistantMsgId.current = aid
    setMessages((m) => [...m, { id: aid, role: 'assistant', text: '', reply }])
    setStreaming(true)
    setReplyRendering(true)

    const thinkingMs = Math.max(1800, (reply.timeline.length || 1) * 1100)
    streamTimer.current = setTimeout(() => {
      streamTimer.current = null
      assistantMsgId.current = null
      setStreaming(false)
    }, thinkingMs)
  }, [])

  const findingToastsRef = useRef(findingToasts)
  findingToastsRef.current = findingToasts
  const findingToastIndexRef = useRef(findingToastIndex)
  findingToastIndexRef.current = findingToastIndex
  const alertIndexRef = useRef(alertIndex)
  alertIndexRef.current = alertIndex
  const seenFindingIdsRef = useRef(new Set<string>())
  const openedFromCompactRef = useRef(false)
  const findingShortcutTimer = useRef<number | null>(null)
  const pendingClearRef = useRef<{
    items: FindingToastInstance[]
    index: number
    alertIndex: number
    seen: Set<string>
  } | null>(null)
  const dismissedFindingsRef = useRef<{
    items: FindingToastInstance[]
    index: number
    alertIndex: number
    seen: Set<string>
  } | null>(null)
  const [stagedReveal, setStagedReveal] = useState(false)
  const [revealNonce, setRevealNonce] = useState(0)
  const [findingUnread, setFindingUnread] = useState(false)
  const [compactRestoreToken, setCompactRestoreToken] = useState(0)
  const [compactOrbHold, setCompactOrbHold] = useState<DOMRect | null>(null)
  /** Alert uses the tuned ramp. Toast uses yesterday's ocean blues. */
  const [orbCuePalette, setOrbCuePalette] = useState<'alert' | 'ocean'>('alert')
  const [findingBorderCue, setFindingBorderCue] = useState(false)
  const [toastOrbCue, setToastOrbCue] = useState(false)
  const [toastBoxCue, setToastBoxCue] = useState(false)
  const [toastShimmerExit, setToastShimmerExit] = useState(false)
  const toastShimmerTimer = useRef<number | null>(null)
  const [findingDismissSignal, setFindingDismissSignal] = useState(0)

  const pushNotices = useCallback(() => {
    const notices = findingToastsRef.current.filter((item) => !isAlertFinding(item))
    const seeding = notices.length === 0
    const count = seeding ? FINDING_TOAST_SEED_COUNT : 1
    const batch: FindingToastInstance[] = []
    for (let i = 0; i < count; i++) {
      const template = nextFindingFromPool(findingPoolIndexRef.current)
      findingPoolIndexRef.current += 1
      batch.push({ ...template, severity: 'notice', instanceId: uid() })
    }
    setFindingToasts((prev) => {
      const alerts = prev.filter((item) => isAlertFinding(item))
      const nextNotices = [...prev.filter((item) => !isAlertFinding(item)), ...batch].slice(-6)
      return [...nextNotices, ...alerts]
    })
    setFindingToastIndex(seeding ? 0 : Math.min(notices.length + batch.length, 6) - 1)
  }, [])

  const pushAlert = useCallback(() => {
    const template = nextAlertFromPool(alertPoolIndexRef.current)
    alertPoolIndexRef.current += 1
    const instance: FindingToastInstance = { ...template, severity: 'alert', instanceId: uid() }
    const alertCount = findingToastsRef.current.filter((item) => isAlertFinding(item)).length
    setFindingToasts((prev) => {
      const notices = prev.filter((item) => !isAlertFinding(item))
      const alerts = [...prev.filter((item) => isAlertFinding(item)), instance].slice(-4)
      return [...notices, ...alerts]
    })
    setAlertIndex(Math.min(alertCount + 1, 4) - 1)
    setStagedReveal(true)
    setRevealNonce((n) => n + 1)
  }, [])

  const dismissFindings = useCallback((which: 'notice' | 'alert' | 'all') => {
    const items = findingToastsRef.current
    const remaining = items.filter((item) => {
      if (which === 'all') return false
      if (which === 'notice') return isAlertFinding(item)
      return !isAlertFinding(item)
    })
    if (remaining.length === 0 && items.length > 0) {
      const snap = pendingClearRef.current ?? {
        items,
        index: findingToastIndexRef.current,
        alertIndex: alertIndexRef.current,
        seen: new Set(seenFindingIdsRef.current),
      }
      pendingClearRef.current = null
      const allSeen = snap.items.every((item) => snap.seen.has(item.instanceId))
      setFindingUnread(!allSeen)
      dismissedFindingsRef.current = allSeen ? null : snap
      seenFindingIdsRef.current = new Set()
      const returnToCompact = openedFromCompactRef.current
      openedFromCompactRef.current = false
      setStagedReveal(false)
      setCompactOrbHold(null)
      setFindingBorderCue(false)
      if (findingShortcutTimer.current != null) {
        window.clearTimeout(findingShortcutTimer.current)
        findingShortcutTimer.current = null
      }
      setFindingToastIndex(0)
      setAlertIndex(0)
      if (returnToCompact) setCompactRestoreToken((n) => n + 1)
    } else if (which !== 'notice') {
      setStagedReveal(false)
      setFindingBorderCue(false)
      setAlertIndex(0)
    }
    setFindingToasts(remaining)
  }, [])

  const closeAlert = useCallback(() => dismissFindings('alert'), [dismissFindings])

  const noticeItems = useMemo(
    () => findingToasts.filter((item) => !isAlertFinding(item)),
    [findingToasts],
  )
  const alertItems = useMemo(
    () => findingToasts.filter((item) => isAlertFinding(item)),
    [findingToasts],
  )

  useEffect(() => {
    const notice = noticeItems[Math.min(findingToastIndex, Math.max(0, noticeItems.length - 1))]
    const alert = alertItems[Math.min(alertIndex, Math.max(0, alertItems.length - 1))]
    if (notice) seenFindingIdsRef.current.add(notice.instanceId)
    if (alert) seenFindingIdsRef.current.add(alert.instanceId)
    if (
      findingToasts.length > 0 &&
      findingToasts.every((item) => seenFindingIdsRef.current.has(item.instanceId))
    ) {
      setFindingUnread(false)
    }
  }, [alertIndex, alertItems, findingToastIndex, findingToasts, noticeItems])

  const restoreUnreadFindings = useCallback(
    (sourceRect?: DOMRect) => {
      const saved = dismissedFindingsRef.current
      if (!saved) return
      const reveal = () => {
        seenFindingIdsRef.current = new Set(saved.seen)
        setFindingToasts(saved.items)
        setFindingToastIndex(saved.index)
        setAlertIndex(saved.alertIndex)
        setFindingUnread(false)
        if (saved.items.some((item) => isAlertFinding(item))) {
          setStagedReveal(true)
          setRevealNonce((n) => n + 1)
        }
      }
      if (activeStoryId != null && !hubStoryOpen && sourceRect) {
        openedFromCompactRef.current = true
        reveal()
        return
      }
      openedFromCompactRef.current = false
      reveal()
    },
    [activeStoryId, hubStoryOpen],
  )

  const TOAST_SHIMMER_HOLD_MS = 720
  const TOAST_SHIMMER_FADE_MS = 280
  const landingToastRevealTimer = useRef<number | null>(null)

  const playToastShimmer = useCallback(() => {
    // compact: orb only (no hub box). collapsed and expanded: the box is on screen.
    const stage = document.querySelector('[data-lc-hub-chat] [data-stage]')?.getAttribute('data-stage')
    const onBox = stage === 'collapsed' || stage === 'expanded'
    setToastShimmerExit(false)
    setToastOrbCue(stage === 'compact')
    setToastBoxCue(onBox)
    if (toastShimmerTimer.current != null) window.clearTimeout(toastShimmerTimer.current)
    toastShimmerTimer.current = window.setTimeout(() => {
      setToastShimmerExit(true)
      toastShimmerTimer.current = window.setTimeout(() => {
        toastShimmerTimer.current = null
        setToastOrbCue(false)
        setToastBoxCue(false)
        setToastShimmerExit(false)
      }, TOAST_SHIMMER_FADE_MS)
    }, TOAST_SHIMMER_HOLD_MS)
  }, [])

  const revealLandingToastAfterShimmer = useCallback((reveal: () => void) => {
    const stage = document.querySelector('[data-lc-hub-chat] [data-stage]')?.getAttribute('data-stage')
    const landingBox = stage === 'collapsed' || stage === 'expanded'
    playToastShimmer()
    if (!landingBox) {
      reveal()
      return
    }
    if (landingToastRevealTimer.current != null) window.clearTimeout(landingToastRevealTimer.current)
    landingToastRevealTimer.current = window.setTimeout(() => {
      landingToastRevealTimer.current = null
      reveal()
    }, TOAST_SHIMMER_HOLD_MS + TOAST_SHIMMER_FADE_MS)
  }, [playToastShimmer])

  const cueThenShowFindings = useCallback(() => {
    revealLandingToastAfterShimmer(() => pushNotices())
  }, [pushNotices, revealLandingToastAfterShimmer])

  useEffect(() => {
    if (!compactOrbHold) return
    setToastShimmerExit(false)
    const exit = window.setTimeout(() => setToastShimmerExit(true), 720)
    return () => {
      window.clearTimeout(exit)
      setToastShimmerExit(false)
    }
  }, [compactOrbHold])

  const requestCloseFindings = useCallback(() => {
    const items = findingToastsRef.current
    if (items.length === 0) return
    pendingClearRef.current = {
      items,
      index: findingToastIndexRef.current,
      alertIndex: alertIndexRef.current,
      seen: new Set(seenFindingIdsRef.current),
    }
    const hasAlert = items.some((item) => isAlertFinding(item))
    if (hasAlert) {
      dismissFindings('notice')
      setFindingDismissSignal((n) => n + 1)
      return
    }
    dismissFindings('all')
  }, [dismissFindings])

  const launchAlert = useCallback((then?: () => void, fromCompact = false, skipBorderCue = false) => {
    if (fromCompact) openedFromCompactRef.current = true
    pushAlert()
    if (!skipBorderCue) setFindingBorderCue(true)
    if (findingShortcutTimer.current != null) {
      window.clearTimeout(findingShortcutTimer.current)
    }
    findingShortcutTimer.current = window.setTimeout(() => {
      findingShortcutTimer.current = null
      setFindingBorderCue(false)
      then?.()
    }, STAGED_AURORA_PHASE1_MS)
  }, [pushAlert])

  const launchFindingShortcut = useCallback(() => {
    if (activeStoryId != null && !hubStoryOpen) {
      const ask = document.querySelector<HTMLButtonElement>('[aria-label="Ask about this story"]')
      if (ask) {
        const rect = ask.getBoundingClientRect()
        openedFromCompactRef.current = true
        setOrbCuePalette('alert')
        setCompactOrbHold(rect)
        // Aurora phase 1 plays now. The orb stays until that phase finishes. The hub chatbox stays closed.
        launchAlert(() => {
          setCompactOrbHold(null)
        }, true, true)
        return
      }
    }
    launchAlert()
  }, [activeStoryId, hubStoryOpen, launchAlert])

  const launchCurrentAurora = useCallback(() => {
    const template = nextAlertFromPool(alertPoolIndexRef.current)
    alertPoolIndexRef.current += 1
    const alert: FindingToastInstance = { ...template, severity: 'alert', instanceId: uid() }
    const show = (borderCue = true) => {
      pendingClearRef.current = null
      setFindingToasts([alert])
      setFindingToastIndex(0)
      setAlertIndex(0)
      setFindingUnread(false)
      setStagedReveal(true)
      setRevealNonce((n) => n + 1)
      setAuroraReplayKey((k) => k + 1)
      setFindingBorderCue(borderCue)
      setCompactOrbHold(null)
      if (findingShortcutTimer.current != null) {
        window.clearTimeout(findingShortcutTimer.current)
      }
      findingShortcutTimer.current = window.setTimeout(() => {
        findingShortcutTimer.current = null
        setFindingBorderCue(false)
      }, STAGED_AURORA_PHASE1_MS)
    }
    const storyAsk =
      activeStoryId != null && !hubStoryOpen
        ? document.querySelector<HTMLButtonElement>('[aria-label="Ask about this story"]')
        : null
    const launcher =
      !storyAsk && !isHub && !open
        ? document.querySelector<HTMLButtonElement>('[aria-label="Open Llumen assistant"]')
        : null
    if (findingShortcutTimer.current != null) {
      window.clearTimeout(findingShortcutTimer.current)
      findingShortcutTimer.current = null
    }
    if (!storyAsk && !launcher) {
      setOrbCuePalette('alert')
      show()
      return
    }
    const orb = (storyAsk ?? launcher)!
    const rect = orb.getBoundingClientRect()
    if (storyAsk) openedFromCompactRef.current = true
    setOrbCuePalette('alert')
    setCompactOrbHold(rect)
    if (storyAsk) {
      pendingClearRef.current = null
      setFindingToasts([alert])
      setFindingToastIndex(0)
      setAlertIndex(0)
      setFindingUnread(false)
      setStagedReveal(true)
      setRevealNonce((n) => n + 1)
      setAuroraReplayKey((k) => k + 1)
      setFindingBorderCue(false)
      findingShortcutTimer.current = window.setTimeout(() => {
        findingShortcutTimer.current = null
        setCompactOrbHold(null)
      }, STAGED_AURORA_PHASE1_MS)
      return
    }
    findingShortcutTimer.current = window.setTimeout(() => {
      setCompactOrbHold(null)
      setOpen(true)
      setExpanded(false)
      findingShortcutTimer.current = window.setTimeout(() => {
        findingShortcutTimer.current = null
        show()
      }, 420)
    }, STAGED_AURORA_PHASE1_MS)
  }, [activeStoryId, hubStoryOpen, isHub, open])

  const launchDualStateAurora = useCallback(() => {
    const notices: FindingToastInstance[] = []
    for (let i = 0; i < 4; i++) {
      const template = nextFindingFromPool(findingPoolIndexRef.current)
      findingPoolIndexRef.current += 1
      notices.push({ ...template, severity: 'notice', instanceId: uid() })
    }
    const reveal = () => {
      pendingClearRef.current = null
      setFindingToasts(notices)
      setFindingToastIndex(0)
      setAlertIndex(0)
      setFindingUnread(false)
      setStagedReveal(false)
      setFindingBorderCue(false)
      setCompactOrbHold(null)
    }
    const storyAsk =
      activeStoryId != null && !hubStoryOpen
        ? document.querySelector<HTMLButtonElement>('[aria-label="Ask about this story"]')
        : null
    const launcher =
      !storyAsk && !isHub && !open
        ? document.querySelector<HTMLButtonElement>('[aria-label="Open Llumen assistant"]')
        : null
    if (findingShortcutTimer.current != null) {
      window.clearTimeout(findingShortcutTimer.current)
      findingShortcutTimer.current = null
    }
    // Landing chat is already on screen: shimmer the border, then show the toast.
    if (!storyAsk && !launcher) {
      revealLandingToastAfterShimmer(reveal)
      return
    }
    const orb = storyAsk ?? launcher
    if (!orb) {
      reveal()
      return
    }
    if (storyAsk) openedFromCompactRef.current = true
    setOrbCuePalette('ocean')
    setFindingUnread(false)
    setCompactOrbHold(orb.getBoundingClientRect())
    // Story: shimmer the compact orb, then the toast. The hub chatbox stays closed.
    // Classic launcher: open the side rail, then the toast.
    const shimmerMs = storyAsk ? TOAST_SHIMMER_HOLD_MS + TOAST_SHIMMER_FADE_MS : STAGED_AURORA_PHASE1_MS
    findingShortcutTimer.current = window.setTimeout(() => {
      setCompactOrbHold(null)
      if (!storyAsk) {
        setOpen(true)
        setExpanded(false)
      }
      if (storyAsk) {
        findingShortcutTimer.current = null
        reveal()
        return
      }
      findingShortcutTimer.current = window.setTimeout(() => {
        findingShortcutTimer.current = null
        reveal()
      }, 420)
    }, shimmerMs)
  }, [activeStoryId, hubStoryOpen, isHub, open, revealLandingToastAfterShimmer])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyF' || !event.metaKey || !event.altKey || !event.shiftKey) return
      event.preventDefault()
      event.stopPropagation()
      launchFindingShortcut()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [launchFindingShortcut])

  useEffect(() => {
    if (findingToasts.length === 0) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || shareOpen) return
      if (document.querySelector('[data-finding-dashboards]')) return
      event.preventDefault()
      event.stopPropagation()
      requestCloseFindings()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [findingToasts.length, requestCloseFindings, shareOpen])

  const beginFindingCommand = useCallback(
    (command: 'monitor' | 'workflow', item: FindingToastInstance) => {
      const parsed = parseSlashCommand(`/${command} ${item.title}`)
      if (!parsed) return
      const threadOpen = open && hubRailMode === 'thread'
      if (command === 'monitor' && isHub && !threadOpen) {
        hubWorkUserTextRef.current = parsed.userText
        setHubWorkToast({ message: underwayMessage(parsed) })
        return
      }
      setLandingChips([])
      setHubWorkToast(null)
      hubWorkUserTextRef.current = ''
      setHubRailMode('thread')
      setSessionsOpen(false)
      setOpen(true)
      setExpanded(false)
      const priorAssistant = messages.filter((msg) => msg.role === 'assistant').length
      if (!titleEditedRef.current && priorAssistant === 0) {
        setChatTitle(truncateTitle(slashChatTitle(parsed)))
      }
      setMessages((m) => [...m, { id: uid(), role: 'user', text: parsed.userText }])
      startAssistantReply(workUnderwayReply(parsed))
    },
    [open, hubRailMode, isHub, messages, startAssistantReply],
  )

  const sendText = useCallback(
    (raw: string) => {
      const t = raw.trim()
      if (!t || streaming) return
      if (isFindingSlashCommand(t)) {
        setDraft('')
        cueThenShowFindings()
        return
      }
      const slash = parseSlashCommand(t)
      if (slash?.id === 'workflow' || isEnergyWorkflowExample(t)) {
        setDraft('')
        const priorAssistant = messages.filter((msg) => msg.role === 'assistant').length
        if (!titleEditedRef.current && priorAssistant === 0) {
          setChatTitle(ENERGY_WORKFLOW_TITLE)
        }
        const userText = slash?.id === 'workflow' ? ENERGY_WORKFLOW_USER_TEXT : t
        setMessages((m) => [...m, { id: uid(), role: 'user', text: userText }])
        startAssistantReply(energyWorkflowReply())
        return
      }
      if (slash) {
        setDraft('')
        const priorAssistant = messages.filter((msg) => msg.role === 'assistant').length
        if (!titleEditedRef.current && priorAssistant === 0) {
          setChatTitle(truncateTitle(slashChatTitle(slash)))
        }
        setMessages((m) => [...m, { id: uid(), role: 'user', text: t }])
        startAssistantReply(workUnderwayReply(slash))
        return
      }
      setDraft('')
      const priorAssistant = messages.filter((msg) => msg.role === 'assistant').length
      const turn = detectConversationTurn(t, priorAssistant)
      const reply = replyForTurn(turn)
      if (!titleEditedRef.current && priorAssistant === 0) {
        setChatTitle(titleFromReply(reply))
      }
      if (priorAssistant === 0) {
        setSources((prev) => (prev.length > 0 ? prev : sourcesForDemoConversation(true)))
        setSourcesPanelDismissed(false)
      }
      setMessages((m) => [...m, { id: uid(), role: 'user', text: t }])
      startAssistantReply(reply)
    },
    [streaming, messages, startAssistantReply, cueThenShowFindings],
  )

  const send = useCallback(() => {
    sendText(draft)
  }, [draft, sendText])

  const failedWorkflowByQuestion = useRef(new Map<string, WorkflowProposal>())
  const answeredQuestions = useRef(new Set<string>())

  const reportWorkflowRunFailed = useCallback(
    (proposal: WorkflowProposal) => {
      const reply = workflowRunFailedReply()
      const question = reply.blocks?.find((block) => block.type === 'question')
      if (question && question.type === 'question') {
        failedWorkflowByQuestion.current.set(question.id, proposal)
      }
      clearStream()
      startAssistantReply(reply)
    },
    [clearStream, startAssistantReply],
  )

  const answerWorkflowQuestion = useCallback(
    (questionId: string, optionId: string, label: string) => {
      if (answeredQuestions.current.has(questionId)) return
      answeredQuestions.current.add(questionId)
      const proposal = failedWorkflowByQuestion.current.get(questionId)
      const text = label.trim() || 'Wait'
      clearStream()
      setMessages((m) => [...m, { id: uid(), role: 'user', text }])
      if (optionId === 'fix' && proposal) {
        startAssistantReply(workflowFixReply(proposal))
        return
      }
      if (optionId === 'custom' && proposal && text) {
        startAssistantReply(workflowChangeReply(text, proposal))
        return
      }
      startAssistantReply(workflowWaitReply())
    },
    [clearStream, startAssistantReply],
  )

  const [dismissedQuestionIds, setDismissedQuestionIds] = useState<ReadonlySet<string>>(() => new Set())

  const dismissComposerQuestion = useCallback((questionId: string) => {
    setDismissedQuestionIds((prev) => {
      if (prev.has(questionId)) return prev
      const next = new Set(prev)
      next.add(questionId)
      return next
    })
  }, [])

  const composerQuestion = useMemo(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant' || !msg.reply?.blocks) continue
      const questions = msg.reply.blocks.filter((block) => block.type === 'question')
      const pendingIndex = questions.findIndex(
        (block) => !answeredQuestions.current.has(block.id) && !dismissedQuestionIds.has(block.id),
      )
      if (pendingIndex < 0) continue
      const block = questions[pendingIndex]
      return {
        id: block.id,
        prompt: block.prompt,
        options: block.options,
        questionIndex: pendingIndex + 1,
        questionCount: questions.length,
      }
    }
    return null
  }, [messages, dismissedQuestionIds])

  const viewHubWorkInChat = useCallback(() => {
    const text = hubWorkUserTextRef.current
    setHubWorkToast(null)
    hubWorkUserTextRef.current = ''
    setHubRailMode('thread')
    setSessionsOpen(false)
    setOpen(true)
    setExpanded(false)
    if (text) sendText(text)
  }, [sendText])

  const dismissHubWork = useCallback(() => {
    setHubWorkToast(null)
    hubWorkUserTextRef.current = ''
  }, [])

  const questionIndex = useMemo((): ChatQuestionIndexItem[] => {
    const items: ChatQuestionIndexItem[] = []
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (msg.role !== 'user') continue
      items.push({
        id: msg.id,
        question: msg.text,
        responseId: msg.id,
      })
    }
    return items
  }, [messages])

  const jumpToQuestion = useCallback((questionId: string) => {
    releaseStick()
    const root = chatMiddleRef.current
    const target = root?.querySelector(`[data-message-id="${CSS.escape(questionId)}"]`)
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [releaseStick])

  const showInConversation = useCallback((target: { componentId?: string; reportId?: string; workflowId?: string }) => {
    releaseStick()
    const root = chatMiddleRef.current
    if (!root) return
    const selector = target.componentId
      ? `[data-component-id="${CSS.escape(target.componentId)}"]`
      : target.reportId
        ? `[data-report-id="${CSS.escape(target.reportId)}"]`
        : target.workflowId
          ? `[data-workflow-id="${CSS.escape(target.workflowId)}"]`
          : null
    if (!selector) return
    const el = root.querySelector(selector)
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [releaseStick])

  const onChatTitleChange = useCallback((title: string) => {
    titleEditedRef.current = true
    setChatTitle(title)
  }, [])

  const lastAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return null
  }, [messages])

  const selectedComponent = useMemo((): CreatedComponent | null => {
    if (subcontext.view !== 'map' && subcontext.view !== 'chart') return null
    return findComponent(subcontext.componentId) ?? null
  }, [subcontext])

  const activeReport = useMemo(() => {
    if (subcontext.view !== 'slides') return null
    return findReport(subcontext.reportId) ?? AIR_QUALITY_REPORT
  }, [subcontext])

  const handleSessionsOpenChange = useCallback(
    (nextOpen: boolean) => {
      setSessionsOpen(nextOpen)
      if (
        nextOpen &&
        expanded &&
        subcontext.view !== 'closed' &&
        window.innerWidth < SESSIONS_SIDEBAR_BREAKPOINT_PX
      ) {
        closeSubcontext()
      }
    },
    [expanded, subcontext.view, closeSubcontext],
  )

  const sourcesFloatOpen =
    expanded &&
    subcontext.view === 'closed' &&
    !subcontextClosing &&
    sources.length > 0 &&
    !sourcesPanelDismissed

  const splitOpen = subcontext.view !== 'closed'

  const removeSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const addSource = useCallback((item: InlineContextItem) => {
    setSources((prev) =>
      prev.some((s) => s.id === item.id)
        ? prev
        : [...prev, { id: item.id, label: item.name, categoryId: item.categoryId }],
    )
    composerRef.current?.insertMention(item)
  }, [])

  const dismissSourcesPanel = useCallback(() => {
    setSourcesPanelDismissed(true)
  }, [])

  useEffect(() => {
    if (expanded) setSourcesPanelDismissed(false)
  }, [expanded])

  const onComponentSelect = useCallback((component: CreatedComponent) => {
    if (streaming) return
    const isMap = component.preview?.kind === 'image' && component.preview.detailView === 'map'
    openSubcontext({
      view: isMap ? 'map' : 'chart',
      componentId: component.id,
    })
  }, [streaming, openSubcontext])

  const onReportOpen = useCallback((reportId: string) => {
    setSessionsOpen(false)
    openSubcontext({ view: 'slides', reportId, activeSlide: 0 })
  }, [openSubcontext])

  const onOpenSubcontext = useCallback((block: AgentResponseBlock) => {
    if (block.type === 'visual' && block.openSubcontext) {
      openSubcontext({
        view: block.visualType === 'map' ? 'map' : 'chart',
        componentId: block.componentId,
      })
      return
    }
    if (block.type === 'report' && block.openSubcontext) {
      setSessionsOpen(false)
      openSubcontext({ view: 'slides', reportId: block.reportId, activeSlide: 0 })
    }
  }, [openSubcontext])

  const stop = useCallback(() => {
    clearStream()
  }, [clearStream])

  const onReplyComplete = useCallback(() => {
    setReplyRendering(false)
  }, [])

  const sendVisual: SendVisualState = streaming ? 'stop' : draft.trim() ? 'active' : 'inactive'

  const resetConversation = useCallback(() => {
    clearStream()
    setMessages([])
    setSources([])
    setSourcesPanelDismissed(false)
    setDraft('')
    closeSubcontextImmediately()
    setChatTitle('New chat')
    titleEditedRef.current = false
  }, [clearStream, closeSubcontextImmediately])

  const loadDemoSession = useCallback(() => {
    clearStream()
    setMessages(buildTurn1Seed())
    setSources(sourcesForDemoConversation(true))
    setSourcesPanelDismissed(false)
    setDraft('')
    closeSubcontextImmediately()
    setChatTitle('Air quality corridor review')
    titleEditedRef.current = true
  }, [clearStream, closeSubcontextImmediately])

  const openSession = useCallback(
    (id: string) => {
      if (id === DEMO_SESSION_ID) {
        loadDemoSession()
      } else {
        resetConversation()
      }
      if (isHub) {
        setHubRailMode('thread')
        setSessionsOpen(false)
        setLandingChips([])
      }
    },
    [loadDemoSession, resetConversation, isHub],
  )

  const closePanel = useCallback(() => {
    setOpen(false)
    setExpanded(false)
    closeSubcontextImmediately()
    setSessionsOpen(false)
    setHubRailMode('thread')
    clearStream()
    setMessages([])
    setSources([])
    setSourcesPanelDismissed(false)
    setDraft('')
    setChatTitle('New chat')
    titleEditedRef.current = false
  }, [clearStream, closeSubcontextImmediately])

  // Docked left rail: close only via header control (not outside click).

  const landingChipToMention = useCallback(
    (chip: LandingContextChip): InlineContextItem => ({
      id: chip.id,
      name: chip.label,
      categoryId: chip.categoryId ?? 'briefings',
      description: chip.domain,
    }),
    [],
  )

  const closeHubSessionsRail = useCallback(() => {
    setOpen(false)
    setSessionsOpen(false)
    setHubRailMode('thread')
  }, [])

  const onInteractionModelChange = useCallback(
    (next: ChatInteractionModel) => {
      persistChatInteractionModel(next)
      setInteractionModel(next)
      closePanel()
      setHubStoryOpen(false)
      setHubMorphFrom(null)
      setLandingChips([])
      setHubWorkToast(null)
      hubWorkUserTextRef.current = ''
    },
    [closePanel],
  )

  const onLandingVariantChange = useCallback((next: LandingVariant) => {
    persistLandingVariant(next)
    setLandingVariant(next)
  }, [])

  const onTopBarChange = useCallback((next: TopBarVariant) => {
    persistTopBarVariant(next)
    setTopBar(next)
  }, [])

  const openConversation = useCallback(
    (id: string) => {
      openSession(id)
      setOpen(true)
      setExpanded(false)
    },
    [openSession],
  )

  const openLauncher = useCallback(() => {
    setOpen(true)
    setExpanded(false)
  }, [])

  const openHubSessions = useCallback(() => {
    setHubRailMode('sessions')
    setSessionsOpen(true)
    setOpen(true)
    setExpanded(false)
  }, [])

  const openStoryAsk = useCallback(
    ({
      story,
      slideIndex,
      sourceRect,
    }: {
      story: LandingStory
      slideIndex: number
      sourceRect: DOMRect
    }) => {
      const slide = story.slides[slideIndex]
      const chipLabel = slide?.title ?? story.storyTitle
      if (isHub) {
        setHubMorphFrom(sourceRect)
        setHubStoryOpen(true)
        setLandingFocusToken((n) => n + 1)
        return
      }
      setDraft((prev) => {
        const mention = `@${chipLabel}`
        if (!prev.trim()) return `Tell me more about ${mention}`
        if (prev.includes(mention)) return prev
        return `${prev.trim()} ${mention}`
      })
      setOpen(true)
      setExpanded(false)
    },
    [isHub],
  )

  const submitLandingAsk = useCallback(
    (text: string, chips: LandingContextChip[]) => {
      if (isFindingSlashCommand(text)) {
        setLandingChips([])
        cueThenShowFindings()
        return
      }
      const slash = parseSlashCommand(text)
      if (slash?.id === 'workflow') {
        setLandingChips([])
        setHubRailMode('thread')
        setSessionsOpen(false)
        setOpen(true)
        setExpanded(false)
        sendText(text)
        return
      }
      if (slash && isHub && landingVariant !== 'feed-chat') {
        setLandingChips([])
        hubWorkUserTextRef.current = slash.userText
        setHubWorkToast({ message: underwayMessage(slash) })
        return
      }
      const chipLine =
        chips.length > 0
          ? `Context: ${chips.map((c) => (c.domain ? `${c.domain} — ${c.label}` : c.label)).join('; ')}`
          : ''
      const composed = [chipLine, text.trim()].filter(Boolean).join('\n\n')
      const fallback =
        chips.length === 1
          ? `Tell me more about ${chips[0].label}`
          : chips.length > 1
            ? 'Tell me more about these findings'
            : ''
      // Clear before open so the transfer effect does not re-insert into the composer
      setLandingChips([])
      setHubRailMode('thread')
      setSessionsOpen(false)
      setOpen(true)
      setExpanded(false)
      sendText(composed || fallback)
    },
    [sendText, cueThenShowFindings, isHub, landingVariant],
  )

  const onTellMeMore = useCallback(
    (item: LandingTellMeMorePayload) => {
      const detail = item.finding?.trim()
      const userText = detail
        ? `Tell me more about ${item.title}. ${detail}`
        : `Tell me more about ${item.title}`
      const dumpingBriefing = item.id === 'dumping-alert'
      clearStream()
      setMessages([
        { id: uid(), role: 'user', text: userText },
        {
          id: uid(),
          role: 'assistant',
          text: '',
          reply: dumpingBriefing ? DUMPING_ALERT_BRIEFING : TURN1_REPLY,
        },
      ])
      setSources(
        dumpingBriefing
          ? DUMPING_BRIEFING_SOURCES.map((source) => ({ ...source }))
          : sourcesForDemoConversation(true),
      )
      setSourcesPanelDismissed(false)
      setDraft('')
      setLandingChips([])
      setHubWorkToast(null)
      hubWorkUserTextRef.current = ''
      setChatTitle(truncateTitle(item.title))
      titleEditedRef.current = true
      setHubStoryOpen(false)
      setHubMorphFrom(null)
      setHubRailMode('thread')
      setSessionsOpen(false)
      setOpen(true)
      setExpanded(false)
    },
    [clearStream],
  )

  // Opening the rail with chips on the landing chatbox → move them into ChatComposer
  useEffect(() => {
    if (!open || landingChips.length === 0 || isHub) return
    const pending = landingChips
    setLandingChips([])
    let cancelled = false
    let tries = 0
    const insert = () => {
      if (cancelled) return
      if (!composerRef.current) {
        if (tries++ < 30) window.requestAnimationFrame(insert)
        return
      }
      for (const chip of pending) {
        composerRef.current.insertMention(landingChipToMention(chip))
      }
    }
    window.requestAnimationFrame(insert)
    return () => {
      cancelled = true
    }
  }, [open, landingChips, landingChipToMention, isHub])

  useEffect(() => {
    if (!(isHub && open && hubRailMode === 'thread' && hubStoryOpen)) return
    const id = window.setTimeout(() => {
      setHubStoryOpen(false)
      setHubMorphFrom(null)
    }, 360)
    return () => window.clearTimeout(id)
  }, [isHub, open, hubRailMode, hubStoryOpen])

  const isNewChat = messages.length === 0
  const hasAssistantReply = messages.some((m) => m.role === 'assistant')

  /** Pair each user message with the following assistant reply. */
  const turns = useMemo(() => {
    const grouped: {
      user: Extract<ChatMessage, { role: 'user' }>
      assistant?: Extract<ChatMessage, { role: 'assistant' }>
    }[] = []
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (msg.role !== 'user') {
        if (msg.role === 'assistant') {
          const last = grouped[grouped.length - 1]
          if (last && !last.assistant) last.assistant = msg
          else {
            grouped.push({
              user: { id: `agent-${msg.id}`, role: 'user', text: '' },
              assistant: msg,
            })
          }
        }
        continue
      }
      const next = messages[i + 1]
      const assistant = next?.role === 'assistant' ? next : undefined
      if (assistant) i += 1
      grouped.push({ user: msg, assistant })
    }
    return grouped
  }, [messages])

  const openRelatedFinding = useCallback((item: FindingToastInstance) => {
    const storyId = relatedStoryId(item)
    if (storyId) setActiveStoryId(storyId)
  }, [])

  const storyActive = activeStoryId != null
  const pageCovered = usePageCovered()
  const showLauncher = !isHub && !open
  const hubSessionsRail = isHub && open && hubRailMode === 'sessions'
  const hubThreadRail = isHub && open && hubRailMode === 'thread'
  const railComposerOpen = open && !hubSessionsRail
  const showHub =
    isHub &&
    (hubSessionsRail ||
      (!open && (!storyActive || hubStoryOpen)) ||
      (hubThreadRail && storyActive && hubStoryOpen))
  const showAlertAurora = alertItems.length > 0 || auroraPanelOpen
  const toastOverRail = noticeItems.length > 0 && railComposerOpen
  const toastOverHub = noticeItems.length > 0 && showHub && !toastOverRail
  const toastFallback = noticeItems.length > 0 && !toastOverRail && !toastOverHub
  const noticeToast = (overlay: boolean) =>
    noticeItems.length === 0 ? null : (
      <FindingToastStack
        items={noticeItems}
        activeIndex={findingToastIndex}
        onActiveIndexChange={setFindingToastIndex}
        onDismiss={() => dismissFindings('notice')}
        onTellMeMore={onTellMeMore}
        onMonitor={(item) => beginFindingCommand('monitor', item)}
        onOpenRelated={openRelatedFinding}
        overlay={overlay}
      />
    )

  const chatMiddle = (
    <div ref={chatMiddleRef} className={`${styles.middle} ${isNewChat ? styles.middleEmpty : ''}`}>
      {isNewChat ? (
        <AssistantHero />
      ) : (
        <div ref={transcriptScrollRef} className={styles.transcript}>
          {turns.map(({ user, assistant }) => (
            <div key={user.id} className={styles.msgTurn}>
              {user.text ? (
                <UserMessageBubble
                  messageId={user.id}
                  text={user.text}
                  questions={questionIndex}
                  onJumpToQuestion={jumpToQuestion}
                />
              ) : null}
              {assistant?.reply ? (
                <div data-message-id={assistant.id} className={styles.msgAssistantTimeline}>
                  <AssistantTimelineReply
                    key={assistant.id}
                    reply={assistant.reply}
                    streamingText={assistant.text}
                    isAnswerStreaming={streaming && assistantMsgId.current === assistant.id}
                    onComponentSelect={onComponentSelect}
                    onReportOpen={onReportOpen}
                    onOpenSubcontext={onOpenSubcontext}
                    onReplyComplete={onReplyComplete}
                    onWorkflowRunFailed={reportWorkflowRunFailed}
                    onOpenWorkflow={(proposal) => setSubcontext({ view: 'workflow', proposal })}
                    activeWorkflowId={subcontext.view === 'workflow' ? subcontext.proposal.id : null}
                    selectedComponentId={
                      subcontext.view === 'map' || subcontext.view === 'chart'
                        ? subcontext.componentId
                        : null
                    }
                    instantTimeline={
                      previewForceInstant ||
                      assistant.id !== lastAssistantMessageId ||
                      assistant.id.startsWith('demo-')
                    }
                    conversationPanelRef={chatMiddleRef}
                  />
                </div>
              ) : assistant ? (
                <div data-message-id={assistant.id} className={styles.msgAssistant}>
                  {assistant.text || '\u00a0'}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <ChatComposer
        ref={composerRef}
        value={draft}
        onChange={setDraft}
        onSend={send}
        onStop={stop}
        sendState={sendVisual}
        showParameters
        onAttachClick={() => {}}
        findingSlot={toastOverRail ? noticeToast(true) : null}
        findingCue={findingBorderCue && !showHub}
        findingCueColors={{
          stop1: findingAurora.colorStop1,
          stop2: findingAurora.colorStop2,
          stop3: findingAurora.colorStop3,
        }}
        questionSlot={
          composerQuestion ? (
            <AgentQuestionPrompt
              key={composerQuestion.id}
              prompt={composerQuestion.prompt}
              options={composerQuestion.options}
              questionIndex={composerQuestion.questionIndex}
              questionCount={composerQuestion.questionCount}
              onAnswer={(optionId, label) => answerWorkflowQuestion(composerQuestion.id, optionId, label)}
              onDismiss={() => dismissComposerQuestion(composerQuestion.id)}
            />
          ) : null
        }
      />
    </div>
  )

  const replayFindingAurora = useCallback(() => {
    setAuroraReplayKey((k) => k + 1)
  }, [])

  const onAuroraPanelOpenChange = useCallback((next: boolean) => {
    setAuroraPanelOpen(next)
    if (next) setAuroraReplayKey((k) => k + 1)
  }, [])

  const [landingScrollEl, setLandingScrollEl] = useState<HTMLDivElement | null>(null)

  const landingHome =
    landingVariant === 'feed' || landingVariant === 'feed-card' || landingVariant === 'feed-chat' ? (
      <FeedLanding
        contained={landingVariant === 'feed-card'}
        conversational={landingVariant === 'feed-chat'}
        topBar={topBar}
        onOpenStory={setActiveStoryId}
        onTellMeMore={onTellMeMore}
        reserveComposer={isHub}
      />
    ) : (
      <LandingHomeDefault
        onOpenStory={setActiveStoryId}
        onTellMeMore={onTellMeMore}
        topBar={topBar}
        listing={landingVariant === 'conversations' ? 'conversations' : 'stories'}
        onOpenConversation={openConversation}
        reserveComposer={isHub}
      />
    )

  return (
    <div
      className={`${styles.demoPage}${open ? ` ${styles.demoPageRailOpen}` : ''}${
        storyActive ? ` ${styles.demoPageStory}` : ''
      }${pageCovered ? ` ${styles.demoPageCovered}` : ''}`}
    >
      <div className={styles.demoPageShader} aria-hidden>
        <MeshGradient
          speed={open || storyActive || pageCovered ? 0 : 0.4}
          scale={1}
          distortion={0.09}
          swirl={0}
          frame={MESH_FRAME_DEMO_PAGE}
          colors={[...MESH_COLORS_DEMO_PAGE]}
          maxPixelCount={MESH_MAX_PIXEL_COUNT_DEMO_PAGE}
          className={styles.demoPageShaderCanvas}
        />
      </div>
      <div className={styles.demoLandingFrame}>
      <div
        className={styles.demoLandingLayer}
        ref={(node) => setLandingScrollEl((current) => (current === node ? current : node))}
      >
        {storyActive ? (
          <StoryView
            storyId={activeStoryId}
            onBack={() => {
              setActiveStoryId(null)
              setHubStoryOpen(false)
              setHubMorphFrom(null)
              setLandingChips([])
              // Landing hub should reopen idle (orb + placeholder), not focused/engaged.
              setLandingFocusToken(0)
            }}
            onAsk={isHub ? openStoryAsk : undefined}
            agentOpen={open || hubStoryOpen}
            findingUnread={findingUnread}
            onRestoreFindings={restoreUnreadFindings}
          />
        ) : (
          landingHome
        )}
      </div>
      {storyActive ? null : <OverlayScrollThumb scrollEl={landingScrollEl} />}
      </div>
      {showAlertAurora ? (
        <FindingReveal
          key={auroraReplayKey}
          items={alertItems}
          activeIndex={alertIndex}
          onActiveIndexChange={setAlertIndex}
          onClose={closeAlert}
          dismissSignal={findingDismissSignal}
          onMonitor={(item) => beginFindingCommand('monitor', item)}
          onTellMeMore={(item) =>
            onTellMeMore({
              id: item.id,
              title: item.title,
              domain: item.domain,
              finding: `${item.before}${item.highlight}${item.after}`.trim(),
            })
          }
          onOpenRelated={openRelatedFinding}
          settings={findingAurora}
          railOpen={open}
          pageColumnAnchor={railComposerOpen && !showHub}
          storyMode={storyActive}
          stagedReveal={stagedReveal}
          revealNonce={revealNonce}
        />
      ) : null}
      {compactOrbHold && !hubStoryOpen ? (
        <div
          className={styles.compactOrbHold}
          data-shimmer-exit={toastShimmerExit ? 'true' : 'false'}
          style={{
            left: compactOrbHold.left,
            top: compactOrbHold.top,
            width: compactOrbHold.width,
            height: compactOrbHold.height,
            ['--orb-shimmer-1' as string]:
              orbCuePalette === 'ocean' ? OCEAN_AURORA_STOPS[0] : findingAurora.colorStop1,
            ['--orb-shimmer-2' as string]:
              orbCuePalette === 'ocean' ? OCEAN_AURORA_STOPS[1] : findingAurora.colorStop2,
            ['--orb-shimmer-3' as string]:
              orbCuePalette === 'ocean' ? OCEAN_AURORA_STOPS[2] : findingAurora.colorStop3,
          }}
          aria-hidden
        >
          <span className={styles.compactOrbRing} />
          <img src={llumenAssets.launcherOrb} alt="" width={24} height={24} />
          {findingUnread ? <span className={styles.compactOrbHoldDot} /> : null}
        </div>
      ) : null}
      {showHub ? (
        <div
          className={`${styles.composerDock}${storyActive ? ` ${styles.composerDockStory}` : ''}${
            hubSessionsRail ? ` ${styles.composerDockShifted}` : ''
          }`}
        >
          {toastOverHub ? noticeToast(true) : null}
          <HubChatbox
              // Remount when leaving a story so draft/focus/files don't carry over engaged.
              key={storyActive ? `story-${activeStoryId}` : 'landing'}
              onSubmit={submitLandingAsk}
              chips={landingChips}
              onRemoveChip={(id) => setLandingChips((prev) => prev.filter((c) => c.id !== id))}
              onOpenSessions={openHubSessions}
              focusToken={landingFocusToken}
              exiting={hubThreadRail}
              placement={storyActive ? 'story' : 'landing'}
              morphFrom={storyActive ? hubMorphFrom : null}
              onWillCollapse={requestCloseFindings}
              collapseToken={compactRestoreToken}
              onCollapse={
                storyActive
                  ? () => {
                      setHubStoryOpen(false)
                      setHubMorphFrom(null)
                      if (hubSessionsRail) {
                        setOpen(false)
                        setSessionsOpen(false)
                        setHubRailMode('thread')
                      }
                    }
                  : undefined
              }
              workToast={hubWorkToast}
              onViewWorkInChat={viewHubWorkInChat}
              onDismissWork={dismissHubWork}
              findingUnread={findingUnread}
              onRestoreFindings={() => restoreUnreadFindings()}
              findingCue={findingBorderCue || toastBoxCue}
              orbCue={toastOrbCue && !findingBorderCue}
              shimmerExit={toastShimmerExit && toastBoxCue && !findingBorderCue}
              findingCueColors={
                findingBorderCue
                  ? {
                      stop1: findingAurora.colorStop1,
                      stop2: findingAurora.colorStop2,
                      stop3: findingAurora.colorStop3,
                    }
                  : {
                      stop1: OCEAN_AURORA_STOPS[0],
                      stop2: OCEAN_AURORA_STOPS[1],
                      stop3: OCEAN_AURORA_STOPS[2],
                    }
              }
            />
        </div>
      ) : null}
      {toastFallback ? (
        <div className={`${styles.findingToastDock}${storyActive ? ` ${styles.findingToastDockStory}` : ''}`}>
          {noticeToast(false)}
        </div>
      ) : null}
      <div
        className={`${styles.fabColumn}${open ? ` ${styles.fabColumnDocked}` : ''}${
          !showLauncher && !open ? ` ${styles.fabColumnHidden}` : ''
        }`}
      >
        <div
          className={`${styles.panelWrap} ${open ? '' : styles.panelWrapHidden}`}
          aria-hidden={!open}
        >
          {open && (
            <AssistantPanel
              ref={assistantPanelRef}
              expanded={false}
              splitView={splitOpen}
              allowOverflow={sessionsOpen || hubSessionsRail}
              thinking={replyRendering}
            >
              <div className={styles.splitBody}>
                {expanded && sessionsOpen ? (
                  <aside
                    className={styles.sessionsSidebar}
                    aria-label="Conversations"
                    data-lc-sessions-sidebar
                  >
                    <SessionsPanel
                      variant="fullscreen"
                      onOpenSession={openSession}
                      onShareSession={() => setShareOpen(true)}
                    />
                  </aside>
                ) : null}
                <div className={`${styles.chatColumn} ${splitOpen ? styles.chatColumnSplit : ''}`}>
                  {hubSessionsRail ? (
                    <div className={styles.hubSessionsFill}>
                      <SessionsPanel
                        variant="fullscreen"
                        onOpenSession={openSession}
                        onShareSession={() => setShareOpen(true)}
                        onClose={closeHubSessionsRail}
                      />
                    </div>
                  ) : (
                  <div className={styles.panelViewStack}>
                    <PanelHeader
                      onClose={closePanel}
                      expanded={false}
                      chatTitle={chatTitle}
                      onChatTitleChange={onChatTitleChange}
                      onOpenSession={openSession}
                      onNewSession={resetConversation}
                      onDeleteConversation={resetConversation}
                      onShareConversation={() => setShareOpen(true)}
                      hasAssistantReply={hasAssistantReply}
                      sessionsOpen={sessionsOpen}
                      sessionsFullscreen={false}
                      onSessionsOpenChange={handleSessionsOpenChange}
                      onChatSearchChange={onChatSearchChange}
                      searchMatchCount={searchMatchCount}
                      searchActiveMatch={searchActiveMatch}
                      onSearchMatchNavigate={onSearchMatchNavigate}
                      sources={sources}
                      onRemoveSource={removeSource}
                      onAddSource={addSource}
                      sourcesPanelOpen={sourcesFloatOpen}
                      onToggleSourcesPanel={() => setSourcesPanelDismissed((v) => !v)}
                      subcontextOpen={subcontext.view !== 'closed'}
                    />
                    <div className={styles.separator} />
                    {chatMiddle}
                  </div>
                  )}
                </div>
                {sourcesFloatOpen ? (
                    <SourcesPanel
                      sources={sources}
                      onRemove={removeSource}
                      onAdd={addSource}
                      onClose={dismissSourcesPanel}
                    />
                ) : null}
              </div>
            </AssistantPanel>
          )}
        </div>
        {showLauncher ? <AssistantLauncher onOpen={openLauncher} /> : null}
      </div>
      {/* Subcontext overlays the page beside the rail (outside rail overflow/transform). */}
      {open && selectedComponent ? (
        <div
          className={`${styles.detailOverlay} ${
            subcontextClosing ? styles.detailColumnExit : styles.detailColumnEnter
          }`}
        >
          <ComponentDetailPanel
            component={selectedComponent}
            onClose={closeSubcontext}
            onShowInConversation={() =>
              showInConversation({ componentId: selectedComponent.id })
            }
          />
        </div>
      ) : null}
      {open && subcontext.view === 'workflow' ? (
        <div
          className={`${styles.detailOverlay} ${
            subcontextClosing ? styles.detailColumnExit : styles.detailColumnEnter
          }`}
        >
          <WorkflowDetailPanel
            proposal={subcontext.proposal}
            onClose={closeSubcontext}
            onShowInConversation={() => showInConversation({ workflowId: subcontext.proposal.id })}
            onRunFailed={reportWorkflowRunFailed}
          />
        </div>
      ) : null}
      {open && activeReport && subcontext.view === 'slides' ? (
        <div
          className={`${styles.detailOverlay} ${
            subcontextClosing ? styles.detailColumnExit : styles.detailColumnEnter
          }`}
        >
          <SlidesDetailPanel
            report={activeReport}
            components={AIR_QUALITY_COMPONENTS}
            activeSlide={subcontext.activeSlide}
            onSlideChange={(index) =>
              setSubcontext({ view: 'slides', reportId: activeReport.id, activeSlide: index })
            }
            onClose={closeSubcontext}
            onShowInConversation={() => showInConversation({ reportId: activeReport.id })}
            onHome={() =>
              setSubcontext({ view: 'slides', reportId: activeReport.id, activeSlide: 0 })
            }
          />
        </div>
      ) : null}
      <FindingAuroraPanel
        hideTrigger
        open={auroraPanelOpen}
        onOpenChange={onAuroraPanelOpenChange}
        settings={findingAurora}
        onChange={setFindingAurora}
        onReplay={replayFindingAurora}
      />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        landing={landingVariant}
        topBar={topBar}
        ux={interactionModel}
        onLanding={onLandingVariantChange}
        onTopBar={onTopBarChange}
        onUx={onInteractionModelChange}
        onOpenAurora={() => onAuroraPanelOpenChange(true)}
        onCurrentAurora={launchCurrentAurora}
        onDualStateAurora={launchDualStateAurora}
      />
      <ShareModal
        open={shareOpen}
        title={`Share “${chatTitle}”`}
        onClose={() => setShareOpen(false)}
      />
    </div>
  )
}
