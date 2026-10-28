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
import { BriefingLanding } from './landing/BriefingLanding'
import type { TopBarView } from './landing/LandingTopBar'
import { Briefing2Landing } from './landing/Briefing2Landing'
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
  type FindingToastItem,
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
  parseFirstResponseCommand,
  parseSlashCommand,
  slashChatTitle,
  underwayMessage,
  workUnderwayReply,
} from './slashCommands'
import { FirstResponseCard, FirstResponseLoader } from './FirstResponseCard'
import {
  FOLLOW_UP_PROMPTS,
  firstResponseFor,
  firstResponseKind,
  followUpReply,
  type FirstResponse,
} from './firstResponseDemo'
import type { HubChatComponent, HubWorkToast } from './landing/HubChatbox'
import type { LandingTellMeMorePayload } from './landing/LandingHomeDefault'
import { DUMPING_ALERT_BRIEFING, DUMPING_BRIEFING_SOURCES } from './landing/dumpingBriefing'
import { LandingAskAsset, LandingAskMap, LandingAskStage, type LandingAskStageHandle } from './landing/LandingAskStage'
import { findingReply, tellMeMorePrompt } from './landing/landingAskReplies'
import { findingExperience } from './landing/landingFindingExperiences'
import { CommandPalette } from './CommandPalette'
import {
  persistFindingsStyle,
  persistLandingVariant,
  persistStudioStyle,
  persistTopBarVariant,
  readFindingsStyle,
  readLandingVariant,
  readStudioStyle,
  readTopBarVariant,
  type FindingsStyle,
  type LandingVariant,
  type StudioAskBar,
  type StudioStyle,
  type TopBarVariant,
} from './prototypeChrome'
import {
  persistChatInteractionModel,
  readChatInteractionModel,
  type ChatInteractionModel,
} from './interactionModel'
import { StoryView } from './story/StoryView'
import type { StoryMapView } from './story/StoryMap'
import type { StoryAiSnapshot, StoryMapCapture } from './story/storyAiScenarios'
import { StoryMapStatesContext, type StoryMapStates } from './story/storyMapStates'
import { StoryAiModeBar, type StoryAiModeStatus } from './story/StoryAiModeBar'
import {
  CHART_PERIOD_LABEL,
  isChartCard,
  periodPrompt,
  type ChartChatComponent,
  type ChatComponent,
} from './story/storyChartPeriod'
import { monitorWorkflowReply } from './story/storyMonitor'
import { sceneAtPhase, storySceneAt } from './story/storyDemoScenes'
import { periodReply, topSchoolsReply, withMapState } from './story/storySelectionReplies'
import {
  MUSSAFAH_LOCATION,
  TOP_SCHOOLS_PROMPT,
  locationAnnotation,
  locationPrompt,
  locationRegion,
  schoolMarkersAnnotation,
  snapshotRegion,
  topSchoolsAnnotation,
  type StoryLocation,
} from './story/storyAnnotations'
import { StoryLocationModal } from './story/StoryLocationModal'
import { getLandingStory, type LandingStory } from './story/storyDemoData'
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
import { SessionsPanel } from './SessionsPanel'
import {
  conversationSummary,
  loadConversations,
  loadStoryVersions,
  mapStateIds,
  sameStorySnapshot,
  storeConversations,
  storeStoryVersions,
  type SavedChatMessage,
  type SavedConversation,
} from './savedConversations'
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
import { WorkflowDetailPanel, WorkflowProposalCard } from './WorkflowProposalCard'
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

type ChatMessage = SavedChatMessage

const SUBCONTEXT_EXIT_MS = 280
/** How long the AI mode bar's Update button spins before the story version is stored. */
const STORY_UPDATE_MS = 1200
/** Without `scrollend`, the Briefing composer stays shrunk until scrolling has been quiet this long. */
const BRIEFING_SCROLL_IDLE_MS = 200
/** Briefing View: the composer's fade before the story mounts under the flying map. */
const STORY_MOUNT_DELAY_MS = 320
/** How long the landed flight waits for the story map's remaining tiles before revealing it anyway. */
const STORY_PAINT_GRACE_MS = 600
/** Reveals the story under the Briefing page even if the flight or its map never report back. */
const STORY_REVEAL_FALLBACK_MS = 4000
/** Back to the Briefing: the story chrome sliding out (StoryView.module.css). */
const STORY_LEAVE_MS = 420
/** The Briefing map's flight home (BriefingMap RETURN_MS), after which the page settles. */
const STORY_RETURN_MS = 1600
const SUPPORTS_SCROLLEND = typeof window !== 'undefined' && 'onscrollend' in window
/** Lets the rail open and start thinking before the attached charts animate to the new period. */

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

type StoryApplyStage = { visualId: string | null; snapshot: StoryAiSnapshot }

/** Map screenshot for the reply's map-state card, taken once the last change has animated in. */
type StoryMapCaptureRequest = { stateId: string; delay: number }

type PendingStoryApply = {
  messageId: string
  storyId: string | null
  conversationId: string
  stages: StoryApplyStage[]
  applied: number
  capture: StoryMapCaptureRequest | null
}

/** Period re-plots leave the map as is; annotations fly the camera, and Mussafah also grows its region. */
const PERIOD_CAPTURE_DELAY_MS = 700
const ANNOTATION_CAPTURE_DELAY_MS = 3400
const REGION_ANNOTATION_CAPTURE_DELAY_MS = 4900
/** The landing map slides in first; its annotation lands once it has settled. */
const LANDING_MAP_SETTLE_MS = 760

type LandingAskMapState = {
  open: boolean
  snapshot: StoryAiSnapshot | null
  capture: StoryMapCaptureRequest | null
}

const LANDING_MAP_CLOSED: LandingAskMapState = { open: false, snapshot: null, capture: null }
type LandingAskSubject = { finding: LandingTellMeMorePayload } | { location: StoryLocation } | null

type LandingAskPlan = {
  reply: AssistantReplyPayload
  stateId: string
  map: { snapshot: StoryAiSnapshot; captureDelay: number } | null
}

/**
 * The reply to a schools prompt (city-wide, or in a location as the story builder asks it) or a finding's
 * Tell Me More, and what it annotates on the map that joins it.
 */
function planLandingAsk(subject: LandingAskSubject): LandingAskPlan {
  const slide = 0
  const finding = subject && 'finding' in subject ? subject.finding : null
  const location = subject && 'location' in subject ? subject.location : null
  const experience = finding ? findingExperience(finding.id) : null
  const stateId = `map-state-${Date.now()}`
  if (experience) {
    const snapshot: StoryAiSnapshot | null = experience.map
      ? { cards: null, region: false, areaEffect: null, filterLabels: {}, findingPlace: experience.map.place }
      : null
    return {
      stateId,
      reply:
        experience.map && snapshot
          ? withMapState(experience.reply, { stateId, snapshot, ...experience.map })
          : experience.reply,
      map: snapshot ? { snapshot, captureDelay: REGION_ANNOTATION_CAPTURE_DELAY_MS } : null,
    }
  }
  const region = location ? locationRegion(location) : null
  const annotation = location
    ? locationAnnotation(slide, location)
    : finding
      ? schoolMarkersAnnotation(slide)
      : topSchoolsAnnotation(slide)
  const place = location?.name ?? 'Abu Dhabi'
  const snapshot: StoryAiSnapshot = {
    cards: null,
    region: region !== null,
    areaEffect: null,
    filterLabels: region ? { loc: region.label } : {},
    annotation: location ? { slide, location } : finding ? { slide, kind: 'markers' } : { slide },
  }
  return {
    stateId,
    reply: withMapState(finding ? findingReply(finding, annotation) : topSchoolsReply(annotation), {
      stateId,
      snapshot,
      title: finding
        ? `${finding.title} · on the map`
        : location
          ? `Schools exposed to factory emissions · ${place}`
          : `Top ${annotation.schools.length} schools by traffic · ${place}`,
      tag: place,
      meta: finding
        ? `${annotation.schools.length + annotation.junctions.length} places marked`
        : `${annotation.schools.length} schools annotated`,
    }),
    map: { snapshot, captureDelay: region ? REGION_ANNOTATION_CAPTURE_DELAY_MS : ANNOTATION_CAPTURE_DELAY_MS },
  }
}

/** Typed into the landing AI bar on the first keystroke: the story builder's location prompt, already set to Mussafah. */
const LANDING_DEMO_PROMPT = locationPrompt(MUSSAFAH_LOCATION)

function lastMapState(messages: ChatMessage[]): { stateId: string; snapshot: StoryAiSnapshot } | undefined {
  return messages
    .flatMap((message) => (message.role === 'assistant' ? (message.reply?.createdComponents ?? []) : []))
    .flatMap((component) => (component.preview?.kind === 'story-map-state' ? [component.preview] : []))
    .at(-1)
}

/** The map card a reply attached for this state, with the reply's opening paragraph as its insight. */
function mapStateAsset(messages: ChatMessage[], stateId: string | null) {
  if (!stateId) return null
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    const component = message.reply?.createdComponents?.find((item) => item.id === stateId)
    if (component?.preview?.kind !== 'story-map-state') continue
    const opening = message.reply?.blocks?.find((block) => block.type === 'text')
    return {
      stateId,
      title: component.title,
      place: component.preview.tag,
      caption: component.preview.meta,
      analysis: opening?.type === 'text' ? opening.content : undefined,
    }
  }
  return null
}

/** The story itself as context: the pill its chat opens with. */
function storyContextChip(story: LandingStory): LandingContextChip {
  return { id: `story-${story.id}`, label: story.storyTitle, categoryId: 'slides' }
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
  /** Story changes owned by the current conversation; a new token makes the story animate to them. */
  const [storyAi, setStoryAi] = useState<{
    token: number
    snapshot: StoryAiSnapshot | null
    storyId: string | null
    /** Conversation whose prompts produced `snapshot`; reopened from the AI mode bar. */
    conversationId: string | null
    capture?: StoryMapCaptureRequest | null
  }>({ token: 0, snapshot: null, storyId: null, conversationId: null })
  const [storyVersions, setStoryVersions] = useState<Record<string, StoryAiSnapshot>>(loadStoryVersions)
  /** Update in progress: the bar spins before `snapshot` becomes the story's saved version. */
  const [storyUpdate, setStoryUpdate] = useState<{ conversationId: string; snapshot: StoryAiSnapshot } | null>(null)
  /** Story whose AI mode bar is showing; it stays up until the story is closed. */
  const [aiBarStoryId, setAiBarStoryId] = useState<string | null>(null)
  /** Map screenshots + cameras behind each reply's map-state card. */
  const [mapCaptures, setMapCaptures] = useState<Record<string, StoryMapCapture>>({})
  const [activeMapStateId, setActiveMapStateId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<SavedConversation[]>(loadConversations)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  /** Replies loaded from a saved conversation render finished instead of replaying their reveal. */
  const [settledReplyIds, setSettledReplyIds] = useState<ReadonlySet<string>>(() => new Set())
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
  const [findingsStyle, setFindingsStyle] = useState<FindingsStyle>(() => readFindingsStyle())
  const onFindingsStyleChange = useCallback((next: FindingsStyle) => {
    persistFindingsStyle(next)
    setFindingsStyle(next)
  }, [])
  const [studioStyle, setStudioStyle] = useState<StudioStyle>(() => readStudioStyle())
  const [paletteOpen, setPaletteOpen] = useState(false)
  const composerDockRef = useRef<HTMLDivElement>(null)
  /** The Briefing page rests on its findings rather than Assets or below (where the composer docks at the bottom). */
  const [briefingAtFindings, setBriefingAtFindings] = useState(true)
  const onBriefingAssetsProgress = useCallback((progress: number) => {
    composerDockRef.current?.style.setProperty('--briefing-assets-t', progress.toFixed(3))
    setBriefingAtFindings(progress < 0.5)
  }, [])
  const briefingScrollIdleRef = useRef(0)
  const onBriefingScroll = useCallback((scrolling: boolean) => {
    const dock = composerDockRef.current
    if (!dock) return
    window.clearTimeout(briefingScrollIdleRef.current)
    if (!scrolling) {
      delete dock.dataset.scrolling
      return
    }
    dock.dataset.scrolling = 'true'
    if (SUPPORTS_SCROLLEND) return
    briefingScrollIdleRef.current = window.setTimeout(() => {
      delete dock.dataset.scrolling
    }, BRIEFING_SCROLL_IDLE_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(briefingScrollIdleRef.current), [])
  const findingPoolIndexRef = useRef(0)
  const alertPoolIndexRef = useRef(0)
  const [hubWorkToast, setHubWorkToast] = useState<HubWorkToast | null>(null)
  const hubWorkUserTextRef = useRef('')
  const [hubStoryOpen, setHubStoryOpen] = useState(false)
  const [hubMorphFrom, setHubMorphFrom] = useState<DOMRect | null>(null)
  /** A landing AI bar prompt: the bar grows to full screen from `origin` and holds the conversation. */
  const [landingAsk, setLandingAsk] = useState<{ origin: DOMRect } | null>(null)
  const [landingAskShrunk, setLandingAskShrunk] = useState(false)
  /** The stage is on its way out, so the landing can take its room back as it goes. */
  const [landingAskLeaving, setLandingAskLeaving] = useState(false)
  const [landingAskMap, setLandingAskMap] = useState<LandingAskMapState>(LANDING_MAP_CLOSED)
  /** The reply's map-state card brings in the map; until then its annotation waits here. */
  const landingAskPendingRef = useRef<{
    messageId: string
    stateId: string
    snapshot: StoryAiSnapshot
    captureDelay: number
  } | null>(null)
  const landingAskMapTimer = useRef(0)
  const landingAskStageRef = useRef<LandingAskStageHandle>(null)
  /** Story chart cards attached to the hub chatbox via "Add to chat". */
  const [storyChatComponents, setStoryChatComponents] = useState<ChatComponent[]>([])
  /** Charts added while the chat panel is open; they live as pills in the rail composer. */
  const [railChatComponents, setRailChatComponents] = useState<ChatComponent[]>([])
  /** The last confirmed card monitor, drafted as a workflow above the story's chat input. */
  const [storyWorkflow, setStoryWorkflow] = useState<{ proposal: WorkflowProposal; prompt: string } | null>(null)
  /**
   * A prompt sent from the landing AI bar answers here first, after a loader while `loading`; `landing` is the
   * annotated map it shows and opens.
   */
  const [firstResponse, setFirstResponse] = useState<{
    response: FirstResponse
    landing?: LandingAskPlan
    loading: boolean
  } | null>(null)
  const firstResponseLoaded = useCallback(
    () => setFirstResponse((current) => current && { ...current, loading: false }),
    [],
  )
  const pendingStoryApplyRef = useRef<PendingStoryApply | null>(null)
  const [storySlideIndex, setStorySlideIndex] = useState(0)
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

  /** Applies the reply's story changes up to `count` stages; the last stage lands when the reply finishes. */
  const applyStoryStages = useCallback((messageId: string, upTo: number) => {
    const pending = pendingStoryApplyRef.current
    if (!pending || pending.messageId !== messageId) return
    const count = Math.min(upTo, pending.stages.length)
    if (count <= pending.applied) return
    pending.applied = count
    const last = count >= pending.stages.length
    if (last) pendingStoryApplyRef.current = null
    const { snapshot } = pending.stages[count - 1]
    setStoryAi((current) => ({
      token: current.token + 1,
      snapshot,
      storyId: pending.storyId,
      conversationId: pending.conversationId,
      capture: last ? pending.capture : null,
    }))
  }, [])

  const flushStoryApply = useCallback(() => {
    const pending = pendingStoryApplyRef.current
    if (pending) applyStoryStages(pending.messageId, pending.stages.length)
  }, [applyStoryStages])

  /** A story change shows up on the story when its visual appears in the chat. */
  const onReplyVisual = useCallback(
    (messageId: string, componentId: string) => {
      const index = pendingStoryApplyRef.current?.stages.findIndex((stage) => stage.visualId === componentId) ?? -1
      if (index >= 0) applyStoryStages(messageId, index + 1)
    },
    [applyStoryStages],
  )

  /** Hiding the rail unmounts the thread; mark replies finished so reopening doesn't replay them. */
  const settleReplies = useCallback(() => {
    flushStoryApply()
    setSettledReplyIds((current) => {
      const ids = messages.filter((msg) => msg.role === 'assistant' && !current.has(msg.id)).map((msg) => msg.id)
      return ids.length > 0 ? new Set([...current, ...ids]) : current
    })
  }, [flushStoryApply, messages])

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
      settleReplies()
      setOpen(false)
      setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, subcontext.view, closeSubcontext, expanded, sessionsOpen, shareOpen, isHub, hubStoryOpen, hubRailMode, settleReplies])

  const startAssistantReply = useCallback((reply: AssistantReplyPayload) => {
    const aid = uid()
    assistantMsgId.current = aid
    setMessages((m) => [...m, { id: aid, role: 'assistant', text: '', reply }])
    setStreaming(true)
    setReplyRendering(true)

    const thinkingMs = Math.max(900, (reply.timeline.length || 1) * 540)
    streamTimer.current = setTimeout(() => {
      streamTimer.current = null
      assistantMsgId.current = null
      setStreaming(false)
    }, thinkingMs)
    return aid
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
      const demo = parseFirstResponseCommand(t)
      if (demo) {
        const response = firstResponseFor(demo.kind, demo.rest || undefined)
        setDraft('')
        if (!titleEditedRef.current && !messages.some((msg) => msg.role === 'assistant')) {
          setChatTitle(truncateTitle(response.chatTitle))
        }
        setActiveConversationId((id) => id ?? uid())
        setMessages((m) => [...m, { id: uid(), role: 'user', text: response.prompt }])
        startAssistantReply(response.reply)
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
        setActiveConversationId((id) => id ?? uid())
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
      setActiveConversationId((id) => id ?? uid())
      setMessages((m) => [...m, { id: uid(), role: 'user', text: t }])
      startAssistantReply(reply)
    },
    [streaming, messages, startAssistantReply, cueThenShowFindings],
  )

  /** Attach a hovered chart card to the open chat panel's composer, or else to the story chatbox. */
  const addStoryComponentToChat = useCallback(
    (component: ChatComponent, sourceRect: DOMRect) => {
      if (open && hubRailMode === 'thread') {
        setRailChatComponents((prev) => (prev.some((item) => item.id === component.id) ? prev : [...prev, component]))
        composerRef.current?.insertMention({ id: `component-${component.id}`, name: component.label, categoryId: 'assets' })
        return
      }
      if (open) {
        settleReplies()
        setOpen(false)
        setSessionsOpen(false)
        setHubRailMode('thread')
      }
      setStoryChatComponents((prev) => (prev.some((item) => item.id === component.id) ? prev : [...prev, component]))
      if (isHub && activeStoryId != null) {
        const chip = storyContextChip(getLandingStory(activeStoryId))
        setLandingChips((prev) => (prev.some((item) => item.id === chip.id) ? prev : [...prev, chip]))
      }
      if (open || !hubStoryOpen) setHubMorphFrom(sourceRect)
      setHubStoryOpen(true)
    },
    [activeStoryId, hubRailMode, hubStoryOpen, isHub, open, settleReplies],
  )

  /** A confirmed card monitor opens the story chatbox with its draft workflow above the input. */
  const showStoryWorkflow = useCallback(
    (proposal: WorkflowProposal, prompt: string) => {
      setStoryWorkflow({ proposal, prompt })
      if (open) {
        settleReplies()
        setOpen(false)
        setSessionsOpen(false)
        setHubRailMode('thread')
      }
      setHubStoryOpen(true)
    },
    [open, settleReplies],
  )

  /** Each attached chart is re-plotted for 2024–2025 as its chart appears in the reply. */
  const submitStoryComponents = useCallback(
    (text: string, components: HubChatComponent[]) => {
      const attached = components.flatMap((item): ChartChatComponent[] =>
        isChartCard(item.id) ? [{ id: item.id, label: item.label }] : [],
      )
      if (attached.length === 0) return
      const prompt = text.trim() || periodPrompt(attached.map((item) => item.label))
      const conversationId = activeConversationId ?? uid()
      const baseReply = periodReply(attached, sceneAtPhase(storySceneAt(0), 0))
      const previous = storyAi.storyId === null || storyAi.storyId === activeStoryId ? storyAi.snapshot : null
      const stages = attached.map((_, index): StoryApplyStage => ({
        visualId: baseReply.createdComponents?.[index]?.id ?? null,
        snapshot: {
          cards: previous?.cards ?? null,
          region: previous?.region ?? false,
          areaEffect: previous?.areaEffect ?? null,
          filterLabels: previous?.filterLabels ?? {},
          periodCards: [
            ...new Set([...(previous?.periodCards ?? []), ...attached.slice(0, index + 1).map((card) => card.id)]),
          ],
          annotation: previous?.annotation,
        },
      }))
      const stateId = `map-state-${Date.now()}`
      const reply = withMapState(baseReply, {
        stateId,
        snapshot: stages[stages.length - 1].snapshot,
        title: `${attached.map((item) => item.label).join(' · ')} · ${CHART_PERIOD_LABEL}`,
        tag: previous?.region ? snapshotRegion(previous).label : 'Abu Dhabi',
        meta: `${attached.length} ${attached.length === 1 ? 'chart' : 'charts'} re-plotted`,
      })
      setActiveMapStateId(stateId)
      setActiveConversationId(conversationId)
      clearStream()
      setStoryChatComponents([])
      setRailChatComponents([])
      setDraft('')
      setLandingChips([])
      setHubRailMode('thread')
      setSessionsOpen(false)
      setOpen(true)
      setExpanded(false)
      if (!titleEditedRef.current && !messages.some((msg) => msg.role === 'assistant')) {
        setChatTitle(titleFromReply(reply))
      }
      setMessages((m) => [...m, { id: uid(), role: 'user', text: prompt }])
      const messageId = startAssistantReply(reply)
      pendingStoryApplyRef.current = {
        messageId,
        storyId: activeStoryId,
        conversationId,
        stages,
        applied: 0,
        capture: { stateId, delay: PERIOD_CAPTURE_DELAY_MS },
      }
    },
    [activeConversationId, activeStoryId, clearStream, messages, startAssistantReply, storyAi],
  )

  const ownsStoryAi = storyAi.storyId === null || storyAi.storyId === activeStoryId
  const [storyLocation, setStoryLocation] = useState<StoryLocation | null>(null)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const storyPrompts = activeStoryId != null
  /** The picked location's pill is still in the rail composer. */
  const locationInDraft = storyLocation !== null && draft.includes(`@${storyLocation.name}`)
  /** Story prompts, offered in the rail composer: per location, or city-wide until the map is annotated. */
  const storyAnnotationPrompt = !storyPrompts
    ? undefined
    : storyLocation && locationInDraft
      ? locationPrompt(storyLocation)
      : !(ownsStoryAi && storyAi.snapshot?.annotation)
        ? TOP_SCHOOLS_PROMPT
        : undefined
  /** Charts whose pills are still in the rail composer; while any are, the rail asks to re-plot them. */
  const railComponentsInDraft = useMemo(
    () => railChatComponents.filter((item) => draft.includes(`@${item.label}`)),
    [draft, railChatComponents],
  )
  const railComponentPrompt =
    railComponentsInDraft.length > 0 ? periodPrompt(railComponentsInDraft.map((item) => item.label)) : undefined

  /**
   * The top 10 schools (in `location`, when set) are annotated as the reply's chart appears. From the hub
   * the reply opens in the rail; from the rail it is already open.
   */
  const runStoryAnnotation = useCallback(
    (location: StoryLocation | null, fromHub: boolean) => {
      if (streaming) return
      const slide = storySlideIndex
      const region = location ? locationRegion(location) : null
      const annotation = location ? locationAnnotation(slide, location) : topSchoolsAnnotation(slide)
      const conversationId = activeConversationId ?? uid()
      const previous = ownsStoryAi ? storyAi.snapshot : null
      const filterLabels = previous?.filterLabels ?? {}
      const snapshot: StoryAiSnapshot = {
        cards: previous?.cards ?? null,
        // A location's own region replaces the previous one; city-wide prompts keep only the Mussafah focus.
        region: location ? region !== null : Boolean(previous?.region && !previous.annotation?.location),
        areaEffect: previous?.areaEffect ?? null,
        filterLabels: region ? { ...filterLabels, loc: region.label } : filterLabels,
        periodCards: previous?.periodCards,
        annotation: location ? { slide, location } : { slide },
      }
      const stateId = `map-state-${Date.now()}`
      const place = location?.name ?? 'Abu Dhabi'
      const baseReply = topSchoolsReply(annotation)
      const reply = withMapState(baseReply, {
        stateId,
        snapshot,
        title: location
          ? `Schools exposed to factory emissions · ${place}`
          : `Top ${annotation.schools.length} schools by traffic · ${place}`,
        tag: place,
        meta: `${annotation.schools.length} schools annotated`,
      })
      setActiveMapStateId(stateId)
      setDraft('')
      setStoryLocation(null)
      setActiveConversationId(conversationId)
      if (fromHub) {
        clearStream()
        setLandingChips([])
        setHubRailMode('thread')
        setSessionsOpen(false)
        setOpen(true)
        setExpanded(false)
      }
      if (!titleEditedRef.current && !messages.some((msg) => msg.role === 'assistant')) {
        setChatTitle(titleFromReply(reply))
      }
      const prompt = location ? locationPrompt(location) : TOP_SCHOOLS_PROMPT
      setMessages((m) => [...m, { id: uid(), role: 'user', text: prompt }])
      const messageId = startAssistantReply(reply)
      pendingStoryApplyRef.current = {
        messageId,
        storyId: activeStoryId,
        conversationId,
        stages: [{ visualId: baseReply.createdComponents?.[0]?.id ?? null, snapshot }],
        applied: 0,
        capture: { stateId, delay: region ? REGION_ANNOTATION_CAPTURE_DELAY_MS : ANNOTATION_CAPTURE_DELAY_MS },
      }
    },
    [
      activeConversationId,
      activeStoryId,
      clearStream,
      messages,
      ownsStoryAi,
      startAssistantReply,
      storyAi.snapshot,
      storySlideIndex,
      streaming,
    ],
  )
  const submitStoryAnnotation = useCallback(
    () => runStoryAnnotation(locationInDraft ? storyLocation : null, false),
    [locationInDraft, runStoryAnnotation, storyLocation],
  )
  const submitHubLocation = useCallback(
    (location: StoryLocation) => runStoryAnnotation(location, true),
    [runStoryAnnotation],
  )

  const openLocationPicker = useCallback(() => setLocationPickerOpen(true), [])
  const closeLocationPicker = useCallback(() => setLocationPickerOpen(false), [])
  const applyStoryLocation = useCallback((location: StoryLocation) => {
    setLocationPickerOpen(false)
    setStoryLocation(location)
    composerRef.current?.insertMention({ id: location.id, name: location.name, categoryId: 'location' })
  }, [])

  const send = useCallback(() => {
    if (railComponentsInDraft.length > 0 && !streaming) {
      // A draft that is only the chart pills sends the default re-plot prompt.
      const typed = railComponentsInDraft.reduce((text, item) => text.replaceAll(`@${item.label}`, ''), draft)
      submitStoryComponents(typed.trim() ? draft : '', railComponentsInDraft)
      return
    }
    sendText(draft)
  }, [draft, railComponentsInDraft, sendText, streaming, submitStoryComponents])

  const sendRailSuggested = useCallback(() => {
    if (railComponentPrompt) {
      if (!streaming) submitStoryComponents(railComponentPrompt, railComponentsInDraft)
      return
    }
    submitStoryAnnotation()
  }, [railComponentPrompt, railComponentsInDraft, streaming, submitStoryAnnotation, submitStoryComponents])

  useEffect(() => {
    if (!activeConversationId || streaming || !messages.some((msg) => msg.role === 'assistant')) return
    const captures = Object.fromEntries(
      mapStateIds(messages).flatMap((id) => (mapCaptures[id] ? [[id, mapCaptures[id]]] : [])),
    )
    setConversations((list) => {
      const existing = list.find((item) => item.id === activeConversationId)
      if (
        existing &&
        existing.messages === messages &&
        existing.title === chatTitle &&
        existing.story === storyAi.snapshot &&
        Object.keys(existing.mapCaptures ?? {}).length === Object.keys(captures).length
      ) {
        return list
      }
      const saved: SavedConversation = {
        id: activeConversationId,
        title: chatTitle,
        updatedAt: Date.now(),
        messages,
        storyId: storyAi.snapshot ? storyAi.storyId : null,
        story: storyAi.snapshot,
        mapCaptures: captures,
      }
      return [saved, ...list.filter((item) => item.id !== activeConversationId)]
    })
  }, [activeConversationId, streaming, messages, chatTitle, storyAi, mapCaptures])

  useEffect(() => {
    storeConversations(conversations)
  }, [conversations])

  const sessionSummaries = useMemo(
    () => conversations.map((item) => conversationSummary(item)),
    [conversations],
  )

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
    pendingStoryApplyRef.current = null
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
    setActiveConversationId(null)
    setActiveMapStateId(null)
    pendingStoryApplyRef.current = null
    setStoryAi((current) => ({ token: current.token + 1, snapshot: null, storyId: null, conversationId: null }))
  }, [clearStream, closeSubcontextImmediately])

  /** Puts a saved conversation in the rail without touching the story. */
  const loadConversation = useCallback(
    (saved: SavedConversation) => {
      clearStream()
      setMessages(saved.messages)
      setSettledReplyIds(new Set(saved.messages.filter((msg) => msg.role === 'assistant').map((msg) => msg.id)))
      setSources([])
      setSourcesPanelDismissed(false)
      setDraft('')
      closeSubcontextImmediately()
      setChatTitle(saved.title)
      titleEditedRef.current = true
      setActiveConversationId(saved.id)
      if (saved.mapCaptures) setMapCaptures((current) => ({ ...current, ...saved.mapCaptures }))
      if (isHub) {
        setHubRailMode('thread')
        setSessionsOpen(false)
        setLandingChips([])
      }
    },
    [clearStream, closeSubcontextImmediately, isHub],
  )

  const openSession = useCallback(
    (id: string) => {
      const saved = conversations.find((item) => item.id === id)
      if (!saved) return
      loadConversation(saved)
      setActiveMapStateId(saved.story ? (mapStateIds(saved.messages).at(-1) ?? null) : null)
      if (saved.storyId) setActiveStoryId(saved.storyId)
      setStoryAi((current) => ({
        token: current.token + 1,
        snapshot: saved.story,
        storyId: saved.storyId,
        conversationId: saved.id,
      }))
    },
    [conversations, loadConversation],
  )

  const storeMapCapture = useCallback((stateId: string, capture: StoryMapCapture) => {
    setMapCaptures((current) => ({ ...current, [stateId]: capture }))
  }, [])

  const mapStates = useMemo<StoryMapStates>(
    () => ({
      captures: mapCaptures,
      activeStateId: activeMapStateId,
      restore: (stateId, snapshot) => {
        if (landingAsk) {
          setActiveMapStateId(stateId)
          setLandingAskShrunk(false)
          setLandingAskMap({ open: true, snapshot: { ...snapshot, camera: mapCaptures[stateId]?.camera }, capture: null })
          return
        }
        const storyId = activeStoryId ?? storyAi.storyId
        if (!storyId) return
        if (!activeStoryId) setActiveStoryId(storyId)
        setActiveMapStateId(stateId)
        setStoryAi((current) => ({
          token: current.token + 1,
          snapshot: { ...snapshot, camera: mapCaptures[stateId]?.camera },
          storyId,
          conversationId: activeConversationId ?? current.conversationId,
        }))
      },
    }),
    [mapCaptures, activeMapStateId, activeStoryId, activeConversationId, storyAi.storyId, landingAsk],
  )

  useEffect(() => {
    storeStoryVersions(storyVersions)
  }, [storyVersions])

  /** Back to the story as authored; detaching the conversation also drops its updated version. */
  const resetStoryAi = useCallback(() => {
    pendingStoryApplyRef.current = null
    settleReplies()
    setOpen(false)
    setSessionsOpen(false)
    setHubRailMode('thread')
    setActiveMapStateId(null)
    setStoryUpdate(null)
    setAiBarStoryId(null)
    setStoryAi((current) => ({ token: current.token + 1, snapshot: null, storyId: null, conversationId: null }))
  }, [settleReplies])

  const updateStoryAi = useCallback(() => {
    const { snapshot, conversationId } = storyAi
    if (!snapshot || !conversationId) return
    setStoryUpdate({ conversationId, snapshot })
  }, [storyAi])

  useEffect(() => {
    if (!storyUpdate) return
    const timer = window.setTimeout(() => {
      setStoryVersions((current) => ({ ...current, [storyUpdate.conversationId]: storyUpdate.snapshot }))
      setStoryUpdate(null)
    }, STORY_UPDATE_MS)
    return () => window.clearTimeout(timer)
  }, [storyUpdate])

  /**
   * Briefing View: the composer steps aside as the map starts flying to the story's opening view
   * (`flight`). The story then mounts over the Briefing page with its map hidden, loading during the
   * flight (`cover`); its chrome comes in as soon as the flight lands (`storyEntrance`), over the
   * Briefing map, and its own map fades in once loaded (`fade`) before the page underneath unmounts.
   */
  const [storyHandoff, setStoryHandoff] = useState<'flight' | 'cover' | 'fade' | null>(null)
  const [storyFlightId, setStoryFlightId] = useState<string | null>(null)
  const [storyEntrance, setStoryEntrance] = useState<'wait' | 'play' | 'leave' | 'gone' | undefined>(undefined)
  const storyGateRef = useRef({ landed: false, loaded: false, painted: false })
  const storyGraceRef = useRef(0)

  /** Home cards always open the story as authored; AI versions come back only through their conversation. */
  const openStoryFromHome = useCallback((storyId: string) => {
    setActiveMapStateId(null)
    setStoryAi((current) => ({ token: current.token + 1, snapshot: null, storyId: null, conversationId: null }))
    setActiveStoryId(storyId)
    setStoryHandoff(null)
    setStoryFlightId(null)
    setStoryEntrance(undefined)
  }, [])

  const startStoryFlight = useCallback((storyId: string) => {
    storyGateRef.current = { landed: false, loaded: false, painted: false }
    window.clearTimeout(storyGraceRef.current)
    setStoryFlightId(storyId)
    setStoryHandoff('flight')
  }, [])
  useEffect(() => {
    if (storyHandoff !== 'flight' || !storyFlightId) return
    const timer = window.setTimeout(() => {
      openStoryFromHome(storyFlightId)
      setStoryHandoff('cover')
      setStoryEntrance('wait')
    }, STORY_MOUNT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [storyHandoff, storyFlightId, openStoryFromHome])
  const playStoryEntrance = useCallback(() => {
    setStoryEntrance((current) => (current === 'wait' ? 'play' : current))
  }, [])
  const revealStory = useCallback(() => {
    playStoryEntrance()
    setStoryHandoff((current) => (current === 'cover' ? 'fade' : current))
  }, [playStoryEntrance])
  const passStoryGate = useCallback(
    (gate: 'landed' | 'loaded' | 'painted') => {
      const passed = storyGateRef.current
      passed[gate] = true
      if (gate === 'landed') playStoryEntrance()
      if (passed.landed && passed.painted) revealStory()
      else if (passed.landed && passed.loaded && gate !== 'painted') {
        window.clearTimeout(storyGraceRef.current)
        storyGraceRef.current = window.setTimeout(revealStory, STORY_PAINT_GRACE_MS)
      }
    },
    [playStoryEntrance, revealStory],
  )
  const landStoryFlight = useCallback(() => passStoryGate('landed'), [passStoryGate])

  const closeStory = useCallback(() => {
    setActiveStoryId(null)
    setStoryHandoff(null)
    setStoryEntrance(undefined)
    setHubStoryOpen(false)
    setHubMorphFrom(null)
    setLandingChips([])
    setStoryChatComponents([])
    setStoryWorkflow(null)
    // Landing hub should reopen idle (orb + placeholder), not focused/engaged.
    setLandingFocusToken(0)
  }, [])

  /**
   * Back to the Briefing. The Briefing map stays mounted under the story on the opening view, so this
   * snaps it to wherever the story camera is now and flies it home while the story chrome leaves.
   */
  const [storyRelease, setStoryRelease] = useState<StoryMapView | 'home' | null>(null)
  /** Remounts the Briefing page when a story is left before it has settled, dropping its flight state. */
  const [landingEpoch, setLandingEpoch] = useState(0)
  /** The Briefing top bar's Briefing / Studio switch; the Studio has no hub composer unless its page asks for it. */
  const [briefingView, setBriefingView] = useState<TopBarView>('briefing')
  const [studioAskBar, setStudioAskBar] = useState<StudioAskBar | null>(null)
  /** Picking a style from the palette also opens the view it styles. */
  const pickFindingsStyle = useCallback(
    (next: FindingsStyle) => {
      onFindingsStyleChange(next)
      setBriefingView('briefing')
    },
    [onFindingsStyleChange],
  )
  const pickStudioStyle = useCallback((next: StudioStyle) => {
    persistStudioStyle(next)
    setStudioStyle(next)
    setBriefingView('studio')
  }, [])
  const leaveStory = useCallback(
    (from?: StoryMapView) => {
      if (storyRelease) return
      const opening = storyHandoff === 'flight' || (storyHandoff === 'cover' && storyEntrance !== 'play')
      if (opening || landingVariant !== 'briefing' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setLandingEpoch((epoch) => epoch + 1)
        closeStory()
        return
      }
      // `from` is the story's camera. Without it the Briefing map is still on the opening view, which is where the flight home starts.
      setStoryRelease(from ?? 'home')
      setStoryEntrance('leave')
    },
    [closeStory, landingVariant, storyEntrance, storyHandoff, storyRelease],
  )
  useEffect(() => {
    if (!storyRelease || storyEntrance !== 'leave') return
    const timer = window.setTimeout(() => {
      setActiveStoryId(null)
      setStoryEntrance(undefined)
      setHubStoryOpen(false)
      setHubMorphFrom(null)
      setLandingChips([])
      setStoryChatComponents([])
      setStoryWorkflow(null)
      setLandingFocusToken(0)
    }, STORY_LEAVE_MS)
    return () => window.clearTimeout(timer)
  }, [storyRelease, storyEntrance])
  useEffect(() => {
    if (!storyRelease) return
    const timer = window.setTimeout(() => {
      setStoryRelease(null)
      setStoryHandoff(null)
    }, STORY_RETURN_MS)
    return () => window.clearTimeout(timer)
  }, [storyRelease])
  useEffect(() => {
    if (storyHandoff !== 'cover') return
    const timer = window.setTimeout(revealStory, STORY_REVEAL_FALLBACK_MS)
    return () => window.clearTimeout(timer)
  }, [storyHandoff, revealStory])

  const storyConversationOpen = open && hubRailMode === 'thread' && messages.length > 0

  const toggleStoryConversation = useCallback(() => {
    if (storyConversationOpen) {
      settleReplies()
      setOpen(false)
      return
    }
    if (messages.length === 0 && storyAi.conversationId) {
      const saved = conversations.find((item) => item.id === storyAi.conversationId)
      if (saved) loadConversation(saved)
    }
    setLandingChips([])
    setHubRailMode('thread')
    setSessionsOpen(false)
    setOpen(true)
    setExpanded(false)
  }, [storyConversationOpen, settleReplies, messages.length, storyAi.conversationId, conversations, loadConversation])

  const deleteSession = useCallback(
    (id: string) => {
      setConversations((list) => list.filter((item) => item.id !== id))
      if (id === activeConversationId) resetConversation()
    },
    [activeConversationId, resetConversation],
  )

  const deleteActiveConversation = useCallback(() => {
    if (activeConversationId) setConversations((list) => list.filter((item) => item.id !== activeConversationId))
    resetConversation()
  }, [activeConversationId, resetConversation])

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
    setActiveConversationId(null)
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

  const openHubChat = useCallback(() => {
    setHubRailMode('thread')
    setSessionsOpen(false)
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
        setLandingChips([storyContextChip(story)])
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

  /** Briefing landings send AI bar prompts to the full-screen stage instead of the rail. */
  const landingTakeover =
    isHub && activeStoryId == null && (landingVariant === 'briefing' || landingVariant === 'briefing-2')

  const landingBarRect = useCallback(
    () => composerDockRef.current?.querySelector('form')?.getBoundingClientRect() ?? null,
    [],
  )

  const openLandingAsk = useCallback(() => {
    const origin = landingBarRect() ?? new DOMRect(window.innerWidth / 2 - 320, window.innerHeight - 104, 640, 72)
    window.clearTimeout(landingAskMapTimer.current)
    landingAskPendingRef.current = null
    setLandingAskMap(LANDING_MAP_CLOSED)
    setLandingAsk((current) => current ?? { origin })
    setLandingChips([])
    setHubWorkToast(null)
    setFirstResponse(null)
  }, [landingBarRect])

  /** The docked monitor opens full screen as the reply to the request its form wrote; its run state carries over. */
  const openStoryWorkflowConversation = useCallback(() => {
    if (!storyWorkflow) return
    const reply = monitorWorkflowReply(storyWorkflow.proposal)
    setStoryWorkflow(null)
    clearStream()
    closeSubcontextImmediately()
    setSources([])
    setSourcesPanelDismissed(false)
    setDraft('')
    pendingStoryApplyRef.current = null
    if (open) {
      settleReplies()
      setOpen(false)
    }
    openLandingAsk()
    setActiveConversationId(uid())
    setActiveMapStateId(null)
    setChatTitle(truncateTitle(storyWorkflow.proposal.title))
    titleEditedRef.current = false
    setMessages([{ id: uid(), role: 'user', text: storyWorkflow.prompt }])
    startAssistantReply(reply)
  }, [clearStream, closeSubcontextImmediately, open, openLandingAsk, settleReplies, startAssistantReply, storyWorkflow])

  /** Runs a landing ask: the reply streams in and the annotated map slides in alongside it. */
  const runLandingAsk = useCallback(
    (prompt: string, subject: LandingAskSubject) => {
      const finding = subject && 'finding' in subject ? subject.finding : null
      const { reply, stateId, map } = planLandingAsk(subject)
      resetConversation()
      openLandingAsk()
      setActiveConversationId(uid())
      setActiveMapStateId(map ? stateId : null)
      setChatTitle(finding ? truncateTitle(finding.title) : titleFromReply(reply))
      setMessages([{ id: uid(), role: 'user', text: prompt }])
      const messageId = startAssistantReply(reply)
      if (map) landingAskPendingRef.current = { messageId, stateId, ...map }
    },
    [openLandingAsk, resetConversation, startAssistantReply],
  )

  /** The map slides in with the reply's map-state card (or at the end of the reply); the annotation follows. */
  const revealLandingAskMap = useCallback((messageId: string, componentId: string | null) => {
    const pending = landingAskPendingRef.current
    if (!pending || pending.messageId !== messageId) return
    if (componentId !== null && componentId !== pending.stateId) return
    landingAskPendingRef.current = null
    setLandingAskMap((current) => ({ ...current, open: true }))
    window.clearTimeout(landingAskMapTimer.current)
    landingAskMapTimer.current = window.setTimeout(() => {
      setLandingAskMap({
        open: true,
        snapshot: pending.snapshot,
        capture: { stateId: pending.stateId, delay: pending.captureDelay },
      })
    }, LANDING_MAP_SETTLE_MS)
  }, [])

  /** Back to the landing; the conversation stays in past sessions. */
  const closeLandingAsk = useCallback(() => {
    window.clearTimeout(landingAskMapTimer.current)
    landingAskPendingRef.current = null
    setLandingAsk(null)
    setLandingAskShrunk(false)
    setLandingAskLeaving(false)
    setLandingAskMap(LANDING_MAP_CLOSED)
    setSessionsOpen(false)
    resetConversation()
  }, [resetConversation])

  const clearLandingAskMap = useCallback(() => {
    window.clearTimeout(landingAskMapTimer.current)
    landingAskPendingRef.current = null
    setLandingAskMap(LANDING_MAP_CLOSED)
  }, [])

  /** The asset header's collapse: the map slides away and the chat takes the width; its map card brings it back. */
  const collapseLandingAskMap = useCallback(() => {
    setLandingAskMap((current) => ({ ...current, open: false }))
  }, [])

  const landingAskAsset = useMemo(() => mapStateAsset(messages, activeMapStateId), [messages, activeMapStateId])

  /** New chat inside the stage: the chat empties and the map slides away; the stage stays up. */
  const newLandingAsk = useCallback(() => {
    clearLandingAskMap()
    resetConversation()
  }, [clearLandingAskMap, resetConversation])

  const deleteLandingAsk = useCallback(() => {
    clearLandingAskMap()
    deleteActiveConversation()
  }, [clearLandingAskMap, deleteActiveConversation])

  const deleteLandingSession = useCallback(
    (id: string) => {
      if (id === activeConversationId) clearLandingAskMap()
      deleteSession(id)
    },
    [activeConversationId, clearLandingAskMap, deleteSession],
  )

  /** A past chat opens in the stage with its last map view; story chats go back to their story. */
  const openLandingSession = useCallback(
    (id: string) => {
      const saved = conversations.find((item) => item.id === id)
      if (!saved) return
      if (saved.storyId) {
        closeLandingAsk()
        openSession(id)
        setOpen(true)
        setExpanded(false)
        return
      }
      clearLandingAskMap()
      loadConversation(saved)
      const state = lastMapState(saved.messages)
      setActiveMapStateId(state?.stateId ?? null)
      if (state) {
        const camera = saved.mapCaptures?.[state.stateId]?.camera ?? mapCaptures[state.stateId]?.camera
        setLandingAskMap({ open: true, snapshot: { ...state.snapshot, camera }, capture: null })
      }
    },
    [conversations, closeLandingAsk, openSession, clearLandingAskMap, loadConversation, mapCaptures],
  )

  useEffect(() => () => window.clearTimeout(landingAskMapTimer.current), [])

  /**
   * The first response container opens full screen with its conversation already answered (no replay), and a
   * map answer opens its annotated map beside the chat. A `followUp` sent from the AI bar is answered after it.
   */
  const openFirstResponse = useCallback(
    (followUp?: string) => {
      if (!firstResponse) return
      const { response, landing } = firstResponse
      const reply = landing?.reply ?? response.reply
      if (open) {
        settleReplies()
        setOpen(false)
      }
      resetConversation()
      setSources(response.kind === 'workflow' ? [] : sourcesForDemoConversation(true))
      openLandingAsk()
      setActiveConversationId(uid())
      setActiveMapStateId(landing?.map ? landing.stateId : null)
      setChatTitle(truncateTitle(landing ? titleFromReply(reply) : response.chatTitle))
      const replyId = uid()
      setMessages([
        { id: uid(), role: 'user', text: response.prompt },
        { id: replyId, role: 'assistant', text: '', reply },
      ])
      setSettledReplyIds((current) => new Set([...current, replyId]))
      if (landing?.map) {
        setLandingAskMap({
          open: true,
          snapshot: landing.map.snapshot,
          capture: { stateId: landing.stateId, delay: landing.map.captureDelay },
        })
      }
      if (followUp) {
        setMessages((current) => [...current, { id: uid(), role: 'user', text: followUp }])
        startAssistantReply(followUpReply(response, followUp))
      }
    },
    [firstResponse, open, openLandingAsk, resetConversation, settleReplies, startAssistantReply],
  )

  const submitLandingAsk = useCallback(
    (text: string, chips: LandingContextChip[]) => {
      if (isFindingSlashCommand(text)) {
        setLandingChips([])
        cueThenShowFindings()
        return
      }
      const slash = parseSlashCommand(text)
      if (landingTakeover && chips.length === 0) {
        const prompt = text.trim()
        const demo = parseFirstResponseCommand(prompt)
        // A second prompt while the first answer is up (or still loading) continues full screen.
        if (firstResponse && prompt && !slash && !demo) {
          openFirstResponse(prompt)
          return
        }
        const kind =
          demo?.kind ??
          (slash?.id === 'workflow'
            ? 'workflow'
            : !slash && prompt
              ? prompt === LANDING_DEMO_PROMPT || prompt === TOP_SCHOOLS_PROMPT
                ? 'map'
                : firstResponseKind(prompt)
              : null)
        if (kind === 'map') {
          // Map answers are the annotated schools map: city-wide traffic, or factory emissions in Mussafah.
          const asked = demo ? demo.rest || LANDING_DEMO_PROMPT : prompt
          const byTraffic = asked === TOP_SCHOOLS_PROMPT
          setFirstResponse({
            response: {
              ...firstResponseFor('map', asked),
              headline: byTraffic
                ? 'Schools with the heaviest traffic around them'
                : 'Schools most exposed to Mussafah emissions',
              text: byTraffic
                ? 'I ranked the schools by the traffic around them over the last 2 months and annotated the top 10.'
                : 'I ranked the schools by their exposure to the factory emissions and annotated the top 10.',
            },
            landing: planLandingAsk(byTraffic ? null : { location: MUSSAFAH_LOCATION }),
            loading: true,
          })
          return
        }
        if (kind) {
          const asked = demo ? demo.rest || undefined : slash ? undefined : prompt
          setFirstResponse({ response: firstResponseFor(kind, asked), loading: true })
          return
        }
      }
      if (slash?.id === 'workflow' && !landingTakeover) {
        setLandingChips([])
        setHubRailMode('thread')
        setSessionsOpen(false)
        setOpen(true)
        setExpanded(false)
        sendText(text)
        return
      }
      if (slash && isHub && !landingTakeover && landingVariant !== 'feed-chat' && landingVariant !== 'briefing') {
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
      if (landingTakeover) {
        openLandingAsk()
        sendText(composed || fallback)
        return
      }
      // Clear before open so the transfer effect does not re-insert into the composer
      setLandingChips([])
      setHubRailMode('thread')
      setSessionsOpen(false)
      setOpen(true)
      setExpanded(false)
      sendText(composed || fallback)
    },
    [
      sendText,
      cueThenShowFindings,
      isHub,
      landingVariant,
      landingTakeover,
      openLandingAsk,
      firstResponse,
      openFirstResponse,
    ],
  )

  const onTellMeMore = useCallback(
    (item: LandingTellMeMorePayload) => {
      if (landingTakeover && !landingAsk) {
        if (findingToastsRef.current.length > 0) dismissFindings('all')
        runLandingAsk(tellMeMorePrompt(item), { finding: item })
        return
      }
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
    [clearStream, dismissFindings, landingAsk, landingTakeover, runLandingAsk],
  )

  const openFinding = useCallback(
    (finding: FindingToastItem) => {
      onTellMeMore({
        id: finding.id,
        title: finding.title,
        domain: finding.domain,
        finding: `${finding.before}${finding.highlight}${finding.after}`,
      })
    },
    [onTellMeMore],
  )

  const openLandingFinding = useCallback(
    (finding: FindingToastItem) => {
      const item: LandingTellMeMorePayload = {
        id: finding.id,
        title: finding.title,
        domain: finding.domain,
        finding: `${finding.before}${finding.highlight}${finding.after}`,
      }
      runLandingAsk(tellMeMorePrompt(item), { finding: item })
    },
    [runLandingAsk],
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
  const ownsActiveStory = storyAi.storyId === null || storyAi.storyId === activeStoryId
  const savedStoryVersion =
    ownsActiveStory && storyAi.conversationId ? (storyVersions[storyAi.conversationId] ?? null) : null
  const storyAiSnapshot = ownsActiveStory ? (storyAi.snapshot ?? savedStoryVersion) : null
  const storyAiState = useMemo(
    () => ({ token: storyAi.token, snapshot: storyAiSnapshot, capture: storyAi.capture ?? null }),
    [storyAi.token, storyAiSnapshot, storyAi.capture],
  )
  const storyHasUnsavedAi =
    ownsActiveStory && storyAi.snapshot !== null && !sameStorySnapshot(storyAi.snapshot, savedStoryVersion)
  if (activeStoryId && aiBarStoryId !== activeStoryId && (storyHasUnsavedAi || savedStoryVersion)) {
    setAiBarStoryId(activeStoryId)
  } else if (aiBarStoryId !== null && aiBarStoryId !== activeStoryId) {
    setAiBarStoryId(null)
  }
  const storyBarStatus: StoryAiModeStatus | null =
    !activeStoryId || aiBarStoryId !== activeStoryId
      ? null
      : storyUpdate && storyUpdate.conversationId === storyAi.conversationId
        ? 'updating'
        : storyHasUnsavedAi
          ? 'unsaved'
          : storyAiSnapshot
            ? 'saved'
            : 'original'
  const showLauncher = !isHub && !open
  const hubSessionsRail = isHub && open && hubRailMode === 'sessions'
  const hubThreadRail = isHub && open && hubRailMode === 'thread'
  const railComposerOpen = open && !hubSessionsRail
  const hubChatComponents = storyActive ? storyChatComponents : []
  const inStudio = landingVariant === 'briefing' && !storyActive && briefingView === 'studio'
  const showHub =
    isHub &&
    (!inStudio || studioAskBar !== null) &&
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
                    onReplyComplete={() => {
                      onReplyComplete()
                      applyStoryStages(assistant.id, Number.POSITIVE_INFINITY)
                      revealLandingAskMap(assistant.id, null)
                    }}
                    onVisualReveal={(componentId) => {
                      onReplyVisual(assistant.id, componentId)
                      revealLandingAskMap(assistant.id, componentId)
                    }}
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
                      assistant.id.startsWith('demo-') ||
                      settledReplyIds.has(assistant.id)
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
        suggestedPrompt={streaming ? undefined : (railComponentPrompt ?? storyAnnotationPrompt)}
        onSendSuggested={sendRailSuggested}
        onPickLocation={storyPrompts ? openLocationPicker : undefined}
      />
      {locationPickerOpen ? (
        <StoryLocationModal onApply={applyStoryLocation} onClose={closeLocationPicker} />
      ) : null}
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

  /** Styles 5, 6 and 8 on the findings: the alert aurora opens from the middle of the section instead of the bottom. */
  const alertCentre =
    !storyActive &&
    landingVariant === 'briefing' &&
    (findingsStyle === 5 || findingsStyle === 6 || findingsStyle === 8) &&
    briefingAtFindings
  /** The composer's border cue has played, so the composer and findings give the middle to the alert. */
  const alertTakesCentre = alertCentre && alertItems.length > 0 && !findingBorderCue
  /** Styles 5 and 6 on the findings: a toast takes the finding's place instead of floating over the composer. */
  const toastInFindings = toastOverHub && alertCentre

  const landingHome =
    landingVariant === 'briefing' ? (
      <BriefingLanding
        key={landingEpoch}
        topBar={topBar}
        onOpenStory={openStoryFromHome}
        onStoryFlight={startStoryFlight}
        onStoryArrive={landStoryFlight}
        storyHandoff={storyHandoff === 'cover' || storyHandoff === 'fade' ? storyHandoff : undefined}
        storyRelease={storyRelease}
        onTellMeMore={onTellMeMore}
        reserveComposer={isHub}
        onAssetsProgress={onBriefingAssetsProgress}
        onScrollActivity={onBriefingScroll}
        findingsStyle={findingsStyle}
        studioStyle={studioStyle}
        alert={alertTakesCentre}
        findingToast={toastInFindings ? noticeToast(false) : null}
        view={briefingView}
        onViewChange={setBriefingView}
        onStudioAskBarChange={setStudioAskBar}
      />
    ) : landingVariant === 'briefing-2' ? (
      <Briefing2Landing
        topBar={topBar}
        onOpenStory={openStoryFromHome}
        onTellMeMore={onTellMeMore}
        reserveComposer={isHub}
      />
    ) : landingVariant === 'feed' || landingVariant === 'feed-card' || landingVariant === 'feed-chat' ? (
      <FeedLanding
        contained={landingVariant === 'feed-card'}
        conversational={landingVariant === 'feed-chat'}
        topBar={topBar}
        onOpenStory={openStoryFromHome}
        onTellMeMore={onTellMeMore}
        reserveComposer={isHub}
      />
    ) : (
      <LandingHomeDefault
        onOpenStory={openStoryFromHome}
        onTellMeMore={onTellMeMore}
        topBar={topBar}
        listing={landingVariant === 'conversations' ? 'conversations' : 'stories'}
        onOpenConversation={openConversation}
        reserveComposer={isHub}
      />
    )

  /** The shrunk stage docks as a rail and pushes the landing over, like the story chat's rail. */
  const landingAskRail = Boolean(landingAsk) && landingAskShrunk && !landingAskLeaving

  return (
    <StoryMapStatesContext.Provider value={mapStates}>
      <div
        className={`${styles.demoPage}${open || landingAskRail ? ` ${styles.demoPageRailOpen}` : ''}${
          storyActive ? ` ${styles.demoPageStory}` : ''
        }`}
      >
        <div className={styles.demoPageShader} aria-hidden>
          <MeshGradient
            speed={open || storyActive ? 0 : 0.4}
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
          {!storyActive || storyHandoff || storyRelease ? landingHome : null}
          {storyActive ? (
            <StoryView
              storyId={activeStoryId}
              entrance={storyEntrance}
              mapHidden={storyHandoff === 'cover' || storyRelease !== null}
              onMapReady={passStoryGate}
              onBack={leaveStory}
              onAsk={isHub ? openStoryAsk : undefined}
              agentOpen={open || hubStoryOpen}
              onCloseAsk={hubStoryOpen ? () => setCompactRestoreToken((n) => n + 1) : undefined}
              findingUnread={findingUnread}
              onRestoreFindings={restoreUnreadFindings}
              aiState={storyAiState}
              onMapCapture={storeMapCapture}
              aiModeBar={
                storyBarStatus ? (
                  <StoryAiModeBar
                    status={storyBarStatus}
                    conversationOpen={storyConversationOpen}
                    onReset={resetStoryAi}
                    onUpdate={updateStoryAi}
                    onToggleConversation={toggleStoryConversation}
                  />
                ) : null
              }
              onAddToChat={isHub ? addStoryComponentToChat : undefined}
              onMonitorConfirm={isHub ? showStoryWorkflow : undefined}
              onSlideIndexChange={setStorySlideIndex}
            />
          ) : null}
        </div>
        {storyActive || inStudio ? null : <OverlayScrollThumb scrollEl={landingScrollEl} />}
        </div>
        {showAlertAurora ? (
          <FindingReveal
            key={`${auroraReplayKey}-${alertCentre ? 'centre' : 'bottom'}`}
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
            centre={alertCentre}
            held={findingBorderCue}
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
            ref={composerDockRef}
            className={`${styles.composerDock}${storyActive ? ` ${styles.composerDockStory}` : ''}${
              inStudio
                ? ` ${styles.composerDockStudio}`
                : !storyActive && landingVariant === 'briefing'
                  ? ` ${styles.composerDockCenter}`
                  : ''
            }${hubSessionsRail ? ` ${styles.composerDockShifted}` : ''}`}
            data-findings-style={!storyActive && !inStudio && landingVariant === 'briefing' ? findingsStyle : undefined}
            data-studio-bar={inStudio ? (studioAskBar ?? undefined) : undefined}
            data-alert={alertTakesCentre ? 'true' : undefined}
            data-ask={landingAsk ? 'true' : undefined}
            data-story-flight={storyHandoff === 'flight' ? 'true' : undefined}
            data-story-return={storyRelease ? 'true' : undefined}
          >
            {toastOverHub && !toastInFindings ? noticeToast(true) : null}
            {storyActive && storyWorkflow ? (
              <div key={storyWorkflow.proposal.id} className={styles.composerWorkflow}>
                <WorkflowProposalCard
                  compact
                  proposal={storyWorkflow.proposal}
                  onRunFailed={reportWorkflowRunFailed}
                  onExpand={(proposal) => {
                    openHubChat()
                    setSubcontext({ view: 'workflow', proposal })
                  }}
                  onOpenConversation={openStoryWorkflowConversation}
                  onClose={() => setStoryWorkflow(null)}
                />
              </div>
            ) : null}
            {!storyActive && !landingAsk && firstResponse ? (
              <div
                key={firstResponse.response.id}
                className={`${styles.composerWorkflow} ${styles.composerAnswer}`}
              >
                <div className={styles.answerBackdrop} aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                {firstResponse.loading ? (
                  <FirstResponseLoader
                    steps={(firstResponse.landing?.reply ?? firstResponse.response.reply).timeline.map(
                      (step) => step.titleInProgress ?? step.title,
                    )}
                    onDone={firstResponseLoaded}
                  />
                ) : (
                  <FirstResponseCard
                    response={firstResponse.response}
                    map={
                      firstResponse.landing?.map ? (
                        <LandingAskMap
                          preview
                          snapshot={firstResponse.landing.map.snapshot}
                          capture={null}
                          onCapture={storeMapCapture}
                        />
                      ) : undefined
                    }
                    onExpand={() => openFirstResponse()}
                    onClose={() => setFirstResponse(null)}
                    onRunFailed={reportWorkflowRunFailed}
                    onOpenWorkflow={(proposal) => {
                      openHubChat()
                      setSubcontext({ view: 'workflow', proposal })
                    }}
                  />
                )}
              </div>
            ) : null}
            <HubChatbox
                // Remount when leaving a story so draft/focus/files don't carry over engaged.
                key={storyActive ? `story-${activeStoryId}` : 'landing'}
                onSubmit={submitLandingAsk}
                chips={landingChips}
                onRemoveChip={(id) => setLandingChips((prev) => prev.filter((c) => c.id !== id))}
                onOpenSessions={openHubSessions}
                onOpenChat={openHubChat}
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
                        setStoryChatComponents([])
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
                components={hubChatComponents}
                onRemoveComponent={(id) => setStoryChatComponents((prev) => prev.filter((item) => item.id !== id))}
                componentPrompt={
                  hubChatComponents.length > 0 ? periodPrompt(hubChatComponents.map((item) => item.label)) : undefined
                }
                onSubmitComponents={submitStoryComponents}
                onSubmitLocation={storyActive && !streaming ? submitHubLocation : undefined}
                demoPrompt={
                  !landingTakeover
                    ? undefined
                    : firstResponse
                      ? FOLLOW_UP_PROMPTS[firstResponse.response.kind]
                      : LANDING_DEMO_PROMPT
                }
              />
          </div>
        ) : null}
        {landingAsk ? (
          <LandingAskStage
            origin={landingAsk.origin}
            returnTo={landingBarRect}
            title={chatTitle}
            handleRef={landingAskStageRef}
            header={
              <div className={styles.landingAskHeader}>
                <PanelHeader
                  onClose={() => landingAskStageRef.current?.close()}
                  expanded={false}
                  chatTitle={chatTitle}
                  onChatTitleChange={onChatTitleChange}
                  onOpenSession={openLandingSession}
                  sessions={sessionSummaries}
                  activeSessionId={activeConversationId}
                  onDeleteSession={deleteLandingSession}
                  onOpenFinding={openLandingFinding}
                  onNewSession={newLandingAsk}
                  onDeleteConversation={deleteLandingAsk}
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
                  shrunk={landingAskShrunk}
                  onToggleShrunk={() => setLandingAskShrunk((current) => !current)}
                />
              </div>
            }
            thinking={replyRendering}
            mapOpen={landingAskMap.open}
            shrunk={landingAskShrunk}
            chat={<div className={styles.landingAskChat}>{chatMiddle}</div>}
            map={
              <LandingAskAsset
                stateId={landingAskAsset?.stateId ?? null}
                title={landingAskAsset?.title ?? chatTitle}
                place={landingAskAsset?.place ?? 'Abu Dhabi'}
                caption={landingAskAsset?.caption}
                analysis={landingAskAsset?.analysis}
                onShowInConversation={
                  landingAskAsset ? () => showInConversation({ componentId: landingAskAsset.stateId }) : undefined
                }
                onCollapse={collapseLandingAskMap}
              >
                <LandingAskMap
                  snapshot={landingAskMap.snapshot}
                  capture={landingAskMap.capture}
                  onCapture={storeMapCapture}
                />
              </LandingAskAsset>
            }
            onClosing={() => setLandingAskLeaving(true)}
            onClosed={closeLandingAsk}
          />
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
                        sessions={sessionSummaries}
                        activeSessionId={activeConversationId}
                        onOpenSession={openSession}
                        onDeleteSession={deleteSession}
                        onOpenFinding={openFinding}
                        onShareSession={() => setShareOpen(true)}
                      />
                    </aside>
                  ) : null}
                  <div className={`${styles.chatColumn} ${splitOpen ? styles.chatColumnSplit : ''}`}>
                    {hubSessionsRail ? (
                      <div className={styles.hubSessionsFill}>
                        <SessionsPanel
                          variant="fullscreen"
                          sessions={sessionSummaries}
                          activeSessionId={activeConversationId}
                          onOpenSession={openSession}
                          onDeleteSession={deleteSession}
                          onOpenFinding={openFinding}
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
                        sessions={sessionSummaries}
                        activeSessionId={activeConversationId}
                        onDeleteSession={deleteSession}
                        onOpenFinding={openFinding}
                        onNewSession={resetConversation}
                        onDeleteConversation={deleteActiveConversation}
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
          findingsStyle={findingsStyle}
          studioStyle={studioStyle}
          onFindingsStyle={pickFindingsStyle}
          onStudioStyle={pickStudioStyle}
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
    </StoryMapStatesContext.Provider>
  )
}
