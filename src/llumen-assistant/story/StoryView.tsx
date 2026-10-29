/**
 * Landing Story content type — Figma slide-landing-screen-map (3359:3802).
 * Full-page main content (not agent subcontext). Map from llumen-map-legend layers.
 */
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  Buildings,
  CalendarBlank,
  CaretDown,
  ChatCircleText,
  Check,
  Compass,
  Copy,
  DotsSix,
  DotsThreeVertical,
  Export,
  Eye,
  EyeSlash,
  GearSix,
  GenderIntersex,
  GridFour,
  Info,
  Layout,
  List,
  MapPin,
  MapTrifold,
  PaintBucket,
  Pause,
  PencilSimple,
  Play,
  Plus,
  Sidebar,
  Student,
  SquaresFour,
  Target,
  Toolbox,
  Trash,
  type IconProps,
} from '@phosphor-icons/react'
import { llumenAssets } from '../assets'
import { ShareModal } from '../ShareModal'
import { useAnchoredTooltip } from '../landing/useAnchoredTooltip'
import {
  AnimatedNumber,
  BiodiversityChart,
  EMISSIONS_LINE,
  EmissionsChart,
  GROUNDWATER_LINE,
  GroundwaterChart,
  KpiLine,
  MonitoringSitesChart,
  formatCount,
  warpPath,
} from './StoryCharts'
import { StoryCardConfigModal } from './StoryCardConfigModal'
import { StoryMonitorModal } from './StoryMonitorModal'
import { defaultMonitorConfig, monitorPrompt, monitorWorkflowProposal, type MonitorConfig } from './storyMonitor'
import type { WorkflowProposal } from '../assistantReplyTypes'
import { SplitIcon } from './StorySplitIcon'
import { DEFAULT_CHART_KPI, resolveKpi, type ChartCardId, type ChartKpiConfig } from './storyKpi'
import { StorySummaryConfigModal } from './StorySummaryConfigModal'
import {
  SUMMARY_REGENERATE_MS,
  defaultSummaryConfig,
  gradientVars,
  type SummaryConfig,
} from './storySummary'
import gradientStyles from './storyGradientBorder.module.css'
import {
  StoryEditPanel,
  type StoryEditSection,
  type StoryPresentationSettings,
} from './StoryEditPanel'
import {
  getLandingStory,
  type LandingStory,
  type StoryFilter,
  type StorySlide,
} from './storyDemoData'
import {
  StoryMap,
  STORY_MAP_STYLE,
  type StoryMapActionTooltip,
  type StoryMapHandle,
  type StoryMapLayerVisibility,
  type StoryMapView,
} from './StoryMap'
import {
  MUSSAFAH_LOAD_X,
  MUSSAFAH_PERIOD,
  MUSSAFAH_VOLUME_X,
  mussafahInsight,
  regionBusyJunctions,
  type StoryAiSnapshot,
  type StoryAreaEffect,
  type StoryMapCapture,
  type StoryMapRegion,
} from './storyAiScenarios'
import {
  PERIOD_LOAD_X,
  PERIOD_VOLUME_LEGEND,
  PERIOD_VOLUME_X,
  periodScene,
  type ChatComponent,
} from './storyChartPeriod'
import { locationAnnotation, schoolMarkersAnnotation, snapshotRegion, topSchoolsAnnotation } from './storyAnnotations'
import { basemapComparison, comparisonPhase, type ComparisonMapOption } from './storyComparison'
import { createCameraLink } from './storyCameraLink'
import type { BackgroundBasemap, StoryBackground } from './storyBackground'
import { StoryBackgroundLayer } from './StoryBackgroundLayer'
import { BackgroundSettings } from './StoryBackgroundSettings'
import { StoryAnnotationsPanel, type AnnotationDrawingState, type AnnotationPatch } from './StoryAnnotationsPanel'
import {
  annotationValidity,
  createAnnotation,
  reshapeAnnotation,
  type AnnotationData,
  type DrawnShape,
  type MapAnnotationItem,
} from './storyMapAnnotations'
import annotationStyles from './StoryAnnotations.module.css'
import {
  sceneAtPhase,
  sceneState,
  storySceneAt,
  type ColumnGlyphColors,
  type StoryScene,
} from './storyDemoScenes'
import { StoryTimeSeries } from './StoryTimeSeries'
import type { TimelineChartSeries } from './storyTimelineCharts'
import {
  DEFAULT_SLIDE_TIMELINE,
  timelineFrameCount,
  timelineGranularityById,
  timelineRangeById,
  timelineStepMs,
  withGranularity,
  withRange,
  type SlideTimeline,
} from './storyTimeline'
import styles from './StoryView.module.css'

export type StoryViewProps = {
  storyId: string
  /** `from`: the map's camera when the Back button was pressed (absent when the story is deleted). */
  onBack: (from?: StoryMapView) => void
  /** Opens left agent rail with current story/slide context. */
  onAsk?: (context: { story: LandingStory; slideIndex: number; sourceRect: DOMRect }) => void
  /** The agent is open; the Ask orb stays on screen and closes it through `onCloseAsk`. */
  agentOpen?: boolean
  onCloseAsk?: () => void
  /** Red dot when findings were dismissed before every entry was seen. */
  findingUnread?: boolean
  /** Reopens findings that were dismissed before every entry was seen. */
  onRestoreFindings?: (sourceRect: DOMRect) => void
  /**
   * A new `token` animates the story to `snapshot` (a saved conversation's changes),
   * or back to its original slides when `snapshot` is null.
   */
  aiState?: {
    token: number
    snapshot: StoryAiSnapshot | null
    /** Screenshot the map for `onMapCapture` once this change has animated in. */
    capture?: { stateId: string; delay: number } | null
  }
  /** Map screenshot for a reply's map-state card, taken after the prompt's animation settles; without it replies get no card. */
  onMapCapture?: (stateId: string, capture: StoryMapCapture) => void
  /** Status bar for the AI-changed story. */
  aiModeBar?: ReactNode
  /** Top-right of the story header. */
  headerEnd?: ReactNode
  /** Shows "Add to chat" beside a hovered chart card; `sourceRect` is the clicked button. */
  onAddToChat?: (component: ChatComponent, sourceRect: DOMRect) => void
  /** A card's "Monitor this" form was confirmed; `prompt` is the request the workflow answers. */
  onMonitorConfirm?: (proposal: WorkflowProposal, prompt: string) => void
  /** Reports the slide on screen, so prompts sent from outside the story can use its data. */
  onSlideIndexChange?: (index: number) => void
  /**
   * Arriving on the map from the Briefing: `wait` holds the header, insight cards, map data and
   * navigation back over the bare map; `play` brings them in. Leaving for the Briefing: `leave` sends
   * them back out, then `gone` dissolves the story onto the Briefing map underneath.
   */
  entrance?: 'wait' | 'play' | 'leave' | 'gone'
  /** Hides the map (the Briefing map underneath shows the same view) until it has loaded; it fades in after. */
  mapHidden?: boolean
  /** The story map's first load: `loaded` (style and layers up), then `painted` (all of its first tiles drawn). */
  onMapReady?: (stage: 'loaded' | 'painted') => void
}

export type { StoryAiSnapshot }

function relabelFilterMap(
  current: Record<string, StoryFilter[]>,
  slides: StorySlide[],
  fallback: StoryFilter[],
  labels: Record<string, string>,
): Record<string, StoryFilter[]> {
  return Object.fromEntries(
    slides.map((item) => {
      const list = (current[item.id] ?? fallback).map((filter) =>
        labels[filter.id] ? { ...filter, label: labels[filter.id] } : filter,
      )
      for (const [id, label] of Object.entries(labels)) {
        if (!list.some((filter) => filter.id === id)) list.push({ id, label })
      }
      return [item.id, list]
    }),
  )
}

function changedFilterIds(from: Record<string, StoryFilter[]>, to: Record<string, StoryFilter[]>): string[] {
  const changed = new Set<string>()
  for (const [slideId, list] of Object.entries(to)) {
    const before = from[slideId] ?? []
    for (const filter of list) {
      if (before.find((item) => item.id === filter.id)?.label !== filter.label) changed.add(filter.id)
    }
  }
  return [...changed]
}

const INSIGHT_CARD_LABELS: Record<InsightCardId, string> = {
  summary: 'Executive Summary',
  emissions: 'Traffic Volume vs Typical Pattern',
  groundwater: 'Average Junction Load',
  biodiversity: 'Junction Traffic Status',
  sites: 'Live Junction Data',
  deviation: 'Permit Limit Deviation Rate',
}

const CHART_CARD_ORDER: ChartCardId[] = ['emissions', 'groundwater', 'biodiversity', 'sites']

function isChartCardId(id: string): id is ChartCardId {
  return id === 'emissions' || id === 'groundwater' || id === 'biodiversity' || id === 'sites'
}

function filterIcon(id: string) {
  switch (id) {
    case 'loc':
      return <MapPin size={18} weight="regular" aria-hidden />
    case 'year':
      return <CalendarBlank size={18} weight="regular" aria-hidden />
    case 'ssi':
      return <SquaresFour size={18} weight="regular" aria-hidden />
    case 'type':
      return <Buildings size={18} weight="regular" aria-hidden />
    case 'gender':
      return <GenderIntersex size={18} weight="regular" aria-hidden />
    case 'level':
      return <Student size={18} weight="regular" aria-hidden />
    default:
      return <SquaresFour size={18} weight="regular" aria-hidden />
  }
}

type StoryViewLayout = 'sidebar' | 'grid' | 'comparison'

type ComparisonChoice = {
  option: ComparisonMapOption
  layers: StoryMapLayerVisibility
  /** The lower map always has its own filters; its time series is used while maps are unlinked. */
  filters?: StoryFilter[]
  timeline?: SlideTimeline
  charts?: TimelineChartSeries[]
  /** The lower map's own basemap; unset, it follows the story's. */
  mapStyle?: BackgroundBasemap
}

/** Which comparison map a control acts on; outside comparison, always the story's map. */
type MapPane = 'upper' | 'lower'

const NO_TIMELINE_CHARTS: TimelineChartSeries[] = []
type MapDataLayerKey = keyof StoryMapLayerVisibility

/** Upper map share of the screen height. */
const COMPARISON_SPLIT_DEFAULT = 0.5
const COMPARISON_SPLIT_MIN = 0.25
const COMPARISON_SPLIT_MAX = 0.8
const COMPARISON_SPLIT_STEP = 0.05

function clampSplit(value: number) {
  return Math.min(COMPARISON_SPLIT_MAX, Math.max(COMPARISON_SPLIT_MIN, value))
}

const VIEW_LAYOUTS: { id: StoryViewLayout; label: string; icon: ComponentType<IconProps> }[] = [
  { id: 'sidebar', label: 'Sidebar', icon: Sidebar },
  { id: 'grid', label: 'Grid', icon: GridFour },
  { id: 'comparison', label: 'Comparison', icon: SplitIcon },
]

const LAYOUT_MENU_WIDTH = 200
const LAYOUT_MENU_HEIGHT = 132

const INSIGHT_CARD_IDS = ['summary', 'emissions', 'groundwater', 'biodiversity', 'sites', 'deviation'] as const

/** Cards one cell wide; they keep that cell when the grid gains columns instead of stretching. */
const ONE_CELL_CARDS: ReadonlySet<InsightCardId> = new Set<InsightCardId>(['deviation'])

/** Edit-mode grid: a row per full-width card, rows of one-cell cards, then 3 empty rows. */
const EMPTY_GRID_ROWS = 3

/**
 * Grid layout spans the full page width with square cells. At 12 columns a cell is about the
 * sidebar edit-grid cell (184px); fewer columns grow the cells. Each card spans 2 cells.
 */
const GRID_COLUMN_OPTIONS = [4, 6, 8, 12] as const
type GridColumns = (typeof GRID_COLUMN_OPTIONS)[number]
const DEFAULT_GRID_COLUMNS: GridColumns = 8
const GRID_CELL_SIZE = 184
const GRID_CELL_GAP = 12
const GRID_CARD_SPAN = 2

/** Sidebar layout keeps the 184px cell; more columns widen the sidebar instead of shrinking cells. */
const SIDEBAR_COLUMN_OPTIONS = [2, 3, 4] as const
type SidebarColumns = (typeof SIDEBAR_COLUMN_OPTIONS)[number]
const DEFAULT_SIDEBAR_COLUMNS: SidebarColumns = 2

/** Demo summaries read as generated a little before the story was opened. */
const SUMMARY_SEEDED_AGO_MS = 12 * 60_000
const SUMMARY_TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** Width of a card's hover toolbar with `buttons` icons; the summary pill slides left by it. */
const cardActionsWidth = (buttons: number) => buttons * 26 + (buttons - 1) * 2 + 6

/** An icon in a card's hover toolbar, named by a tooltip on hover and focus. */
function CardActionButton({
  label,
  ariaLabel,
  active = false,
  menu,
  onClick,
  children,
}: {
  label: string
  ariaLabel: string
  active?: boolean
  /** Edit mode: the button opens the card's menu. */
  menu?: { open: boolean }
  onClick?: (button: HTMLButtonElement) => void
  children: ReactNode
}) {
  const tooltip = useAnchoredTooltip()
  return (
    <>
      <button
        type="button"
        className={`${styles.cardAction} ${styles.cardActionIcon}${active ? ` ${styles.cardActionActive}` : ''}`}
        aria-label={ariaLabel}
        data-card-menu-trigger={menu ? '' : undefined}
        aria-haspopup={menu ? 'menu' : undefined}
        aria-expanded={menu?.open}
        aria-controls={menu?.open ? 'insight-card-menu' : undefined}
        aria-describedby={tooltip.describedBy}
        onClick={(event) => {
          tooltip.hide()
          onClick?.(event.currentTarget)
        }}
        onMouseEnter={tooltip.show}
        onMouseLeave={tooltip.hide}
        onFocus={tooltip.show}
        onBlur={tooltip.hide}
      >
        {children}
      </button>
      {tooltip.node(label)}
    </>
  )
}

function ColumnsControl<T extends number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (columns: T) => void
}) {
  return (
    <div className={styles.gridColumnsControl} role="radiogroup" aria-label={label}>
      <GridFour className={styles.gridColumnsIcon} size={18} weight="regular" aria-hidden />
      {options.map((columns) => (
        <button
          key={columns}
          type="button"
          role="radio"
          aria-checked={value === columns}
          aria-label={`${columns} columns`}
          className={`${styles.gridColumnsOption}${value === columns ? ` ${styles.gridColumnsOptionActive}` : ''}`}
          onClick={() => onChange(columns)}
        >
          {columns}
        </button>
      ))}
    </div>
  )
}
/** Matches `.infoPopover`'s width. */
const INFO_POPOVER_W = 340

/** Space kept clear around the grid: sides, top, and the bottom toolbar. */
const GRID_INSET_X = 20
const GRID_INSET_TOP = 20
const GRID_INSET_BOTTOM = 128

const CHART_CARD_BY_ASSET: Record<string, ChartCardId> = {
  'chart-emissions': 'emissions',
  'chart-groundwater': 'groundwater',
  'chart-biodiversity': 'biodiversity',
  'chart-sites': 'sites',
}

type InsightCardId = 'summary' | 'deviation' | ChartCardId

type InsightCardPrefs = {
  hidden?: boolean
  border?: boolean
  outline?: boolean
  deleted?: boolean
  kpi?: ChartKpiConfig
  summary?: SummaryConfig
}

const CARD_MENU_WIDTH = 200
const CARD_MENU_HEIGHT = 192
const FILTER_MENU_WIDTH = 200
const FILTER_MENU_HEIGHT = 88

function copySlide(slide: StorySlide): StorySlide {
  return {
    ...slide,
    pollutants: slide.pollutants.map((pollutant) => ({ ...pollutant })),
  }
}

function makeFilterMap(slides: StorySlide[], filters: StoryFilter[]) {
  return Object.fromEntries(
    slides.map((slide) => [slide.id, filters.map((filter) => ({ ...filter }))]),
  ) as Record<string, StoryFilter[]>
}

function makePresentationSettings(): StoryPresentationSettings {
  return {
    darkLogoName: '',
    lightLogoName: '',
    textDirection: 'ltr',
    autoplay: false,
    multiSlide: true,
    pagesMode: true,
  }
}

export function StoryView({
  storyId,
  onBack,
  onAsk,
  agentOpen = false,
  onCloseAsk,
  findingUnread = false,
  onRestoreFindings,
  aiState,
  onMapCapture,
  aiModeBar,
  headerEnd,
  onAddToChat,
  onMonitorConfirm,
  onSlideIndexChange,
  entrance,
  mapHidden = false,
  onMapReady,
}: StoryViewProps) {
  const story = useMemo(() => getLandingStory(storyId), [storyId])
  const [storyTitle, setStoryTitle] = useState(story.storyTitle)
  const [storyDescription, setStoryDescription] = useState(story.description)
  const [presentationSettings, setPresentationSettings] = useState(makePresentationSettings)
  const [autoplaying, setAutoplaying] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const [pageRename, setPageRename] = useState<{ slideId: string; title: string } | null>(null)
  const chapters = story.chapters
  const [slides, setSlides] = useState<StorySlide[]>(() => story.slides.map(copySlide))
  const [filtersBySlide, setFiltersBySlide] = useState<Record<string, StoryFilter[]>>(() =>
    makeFilterMap(story.slides, story.filters),
  )
  const [legendOpen, setLegendOpen] = useState(true)
  const [editSection, setEditSection] = useState<StoryEditSection | null>(null)
  const [storyMode, setStoryMode] = useState<'edit' | 'view'>('view')
  const [shareOpen, setShareOpen] = useState(false)
  const [storyMenuOpen, setStoryMenuOpen] = useState(false)
  const [storyMenuPos, setStoryMenuPos] = useState({ top: 0, left: 0 })
  const storyMenuRef = useRef<HTMLButtonElement>(null)
  const [slideMenuOpen, setSlideMenuOpen] = useState(false)
  const [slideMenuPos, setSlideMenuPos] = useState({ top: 0, left: 0 })
  const slideMenuRef = useRef<HTMLButtonElement>(null)
  const [directSlideEditor, setDirectSlideEditor] = useState(false)
  /** The open description tooltip, placed under its info icon in the title group's coordinates. */
  const [info, setInfo] = useState<{ kind: 'story' | 'slide'; left: number; top: number } | null>(null)
  const titleGroupRef = useRef<HTMLDivElement>(null)
  const toggleInfo = (kind: 'story' | 'slide', button: HTMLElement) => {
    const group = titleGroupRef.current
    if (info?.kind === kind || !group) {
      setInfo(null)
      return
    }
    const bounds = group.getBoundingClientRect()
    const icon = button.getBoundingClientRect()
    const width = Math.min(INFO_POPOVER_W, window.innerWidth - 40)
    const x = Math.max(20, Math.min(icon.left - 8, window.innerWidth - 20 - width))
    setInfo({ kind, left: x - bounds.left, top: icon.bottom - bounds.top + 6 })
  }
  const [layers, setLayers] = useState<StoryMapLayerVisibility>({
    junctions: true,
    distribution: true,
  })
  const [mapStyle, setMapStyle] = useState<BackgroundBasemap>({
    kind: 'basemap',
    id: 'aimsun-teal',
    url: STORY_MAP_STYLE,
    dimension: '3d',
  })
  const [background, setBackground] = useState<StoryBackground>(mapStyle)
  const [mapDataTab, setMapDataTab] = useState<'layers' | 'annotations'>('layers')
  /** Annotations belong to the story's main map, so every slide shows them against its own data. */
  const [mapAnnotations, setMapAnnotations] = useState<MapAnnotationItem[]>([])
  /** The comparison map's own annotations, against the data it shows. */
  const [lowerAnnotations, setLowerAnnotations] = useState<MapAnnotationItem[]>([])
  const [lowerMapDataTab, setLowerMapDataTab] = useState<'layers' | 'annotations'>('layers')
  /** The map that the selection, drawing and reshaping below belong to. */
  const [annotationPane, setAnnotationPane] = useState<MapPane>('upper')
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [annotationDrawing, setAnnotationDrawing] = useState<AnnotationDrawingState | null>(null)
  /** The annotation being reshaped on the flat map, and how it looked before, for Cancel. */
  const [annotationEditing, setAnnotationEditing] = useState<{ id: string; original: MapAnnotationItem } | null>(null)
  const backgroundPanelTitle =
    background.kind === 'basemap'
      ? 'Map Data'
      : background.kind === 'color'
        ? 'Color Background'
        : background.mediaType === 'video'
          ? 'Video Background'
          : 'Image Background'
  const [timelineBySlide, setTimelineBySlide] = useState<Record<string, SlideTimeline>>({})
  const [timelinePlaying, setTimelinePlaying] = useState(false)
  const [chartsBySlide, setChartsBySlide] = useState<Record<string, TimelineChartSeries[]>>({})
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [cardPrefsBySlide, setCardPrefsBySlide] = useState<
    Record<string, Partial<Record<InsightCardId, InsightCardPrefs>>>
  >({})
  const [cardMenu, setCardMenu] = useState<{
    slideId: string
    cardId: InsightCardId
    top: number
    left: number
  } | null>(null)
  const [cardConfig, setCardConfig] = useState<{ slideId: string; cardId: InsightCardId } | null>(null)
  const [monitorTarget, setMonitorTarget] = useState<{ slideId: string; cardId: InsightCardId } | null>(null)
  /** Saved monitoring workflows, keyed `${slideId}:${cardId}`. */
  const [monitors, setMonitors] = useState<Record<string, MonitorConfig>>({})
  const [filterMenu, setFilterMenu] = useState<{
    slideId: string
    target: 'upper' | 'lower'
    filterId: string
    label: string
    remove: () => void
    top: number
    left: number
  } | null>(null)
  const [regeneratingSlideId, setRegeneratingSlideId] = useState<string | null>(null)
  const [summaryUpdatedAt, setSummaryUpdatedAt] = useState<Record<string, number>>({})
  const [storyOpenedAt] = useState(() => Date.now() - SUMMARY_SEEDED_AGO_MS)
  const [layoutBySlide, setLayoutBySlide] = useState<Record<string, StoryViewLayout>>({})
  const [gridColumnsBySlide, setGridColumnsBySlide] = useState<Record<string, GridColumns>>({})
  const [sidebarColumnsBySlide, setSidebarColumnsBySlide] = useState<Record<string, SidebarColumns>>({})
  const [comparisonBySlide, setComparisonBySlide] = useState<Record<string, ComparisonChoice>>({})
  const [comparisonLegendOpen, setComparisonLegendOpen] = useState({ upper: false, lower: false })
  const [mapsLinked, setMapsLinked] = useState(true)
  const [lowerPlaying, setLowerPlaying] = useState(false)
  const [lowerSpeed, setLowerSpeed] = useState(1)
  const [filterTarget, setFilterTarget] = useState<'upper' | 'lower'>('upper')
  const [cameraLink] = useState(createCameraLink)
  const [comparisonSplit, setComparisonSplit] = useState(COMPARISON_SPLIT_DEFAULT)
  const [splitDragging, setSplitDragging] = useState(false)
  const [aiFocus, setAiFocus] = useState<{ cards: ChartCardId[]; key: number } | null>(null)
  const [aiRegion, setAiRegion] = useState<StoryMapRegion | null>(null)
  const [areaEffect, setAreaEffect] = useState<StoryAreaEffect | null>(null)
  const [flashedFilters, setFlashedFilters] = useState<{ ids: string[]; key: number } | null>(null)
  /** Filters as they were before the first AI prompt, restored when `aiState` resets. */
  const [filtersBeforeAi, setFiltersBeforeAi] = useState<Record<string, StoryFilter[]> | null>(null)
  const [restoredCards, setRestoredCards] = useState<{ ids: InsightCardId[]; key: number } | null>(null)
  const [cameraRequest, setCameraRequest] = useState<{ camera: NonNullable<StoryAiSnapshot['camera']> } | null>(null)
  const [periodCards, setPeriodCards] = useState<ChartCardId[]>([])
  const [annotationRequest, setAnnotationRequest] = useState<StoryAiSnapshot['annotation'] | null>(null)
  /** The annotation whose recommended action was pinned in edit mode; a new annotation starts unpinned. */
  const [pinnedActionFor, setPinnedActionFor] = useState<StoryAiSnapshot['annotation'] | null>(null)
  /** Closed in view mode on `slide`: it stays pinned in edit mode, and shows pinned again once the slide changes. */
  const [closedAction, setClosedAction] = useState<{
    annotation: StoryAiSnapshot['annotation'] | null
    slide: number
  } | null>(null)
  // Starts below any token so a story opened with a saved snapshot replays its changes on mount.
  const [appliedAiToken, setAppliedAiToken] = useState(-1)
  if (aiState && aiState.token !== appliedAiToken) {
    setAppliedAiToken(aiState.token)
    const { snapshot } = aiState
    if (
      snapshot ||
      aiFocus ||
      aiRegion ||
      areaEffect ||
      filtersBeforeAi ||
      periodCards.length > 0 ||
      annotationRequest
    ) {
      const key = Date.now()
      const base = filtersBeforeAi ?? filtersBySlide
      const nextFilters = snapshot ? relabelFilterMap(base, slides, story.filters, snapshot.filterLabels) : base
      const changed = changedFilterIds(filtersBySlide, nextFilters)
      const visibleBefore = aiFocus?.cards ?? CHART_CARD_ORDER
      const visibleAfter = snapshot?.cards ?? CHART_CARD_ORDER
      const restored = CHART_CARD_ORDER.filter((id) => visibleAfter.includes(id) && !visibleBefore.includes(id))
      setRestoredCards(restored.length > 0 && !snapshot?.cards ? { ids: restored, key } : null)
      setAiFocus(snapshot?.cards ? { cards: snapshot.cards, key } : null)
      setAiRegion(snapshot?.region ? snapshotRegion(snapshot) : null)
      setAreaEffect(snapshot?.areaEffect ?? null)
      setFiltersBySlide(nextFilters)
      setFiltersBeforeAi(snapshot ? base : null)
      setCameraRequest(snapshot?.camera ? { camera: snapshot.camera } : null)
      setPeriodCards(snapshot?.periodCards ?? [])
      setAnnotationRequest(snapshot?.annotation ?? null)
      if (changed.length > 0) setFlashedFilters({ ids: changed, key })
      const chartsOnly =
        changed.length === 0 &&
        !(snapshot?.cards || snapshot?.region || snapshot?.areaEffect || aiFocus || aiRegion || areaEffect)
      if (!chartsOnly) setRegeneratingSlideId(slides[slideIndex]?.id ?? null)
    }
  }
  const mapHandleRef = useRef<StoryMapHandle | null>(null)
  const onMapHandle = useCallback((handle: StoryMapHandle | null) => {
    mapHandleRef.current = handle
  }, [])
  const lowerMapHandleRef = useRef<StoryMapHandle | null>(null)
  const onLowerMapHandle = useCallback((handle: StoryMapHandle | null) => {
    lowerMapHandleRef.current = handle
  }, [])
  const aiCapture = aiState?.capture ?? null
  useEffect(() => {
    if (!aiCapture || !onMapCapture) return
    window.setTimeout(() => {
      void mapHandleRef.current?.capture().then((capture) => onMapCapture(aiCapture.stateId, capture))
    }, aiCapture.delay)
  }, [aiCapture, onMapCapture])
  const rootRef = useRef<HTMLDivElement>(null)
  /** Live drag value; written straight to the CSS variable so the story view skips re-rendering. */
  const splitDragRef = useRef<{ value: number; frame: number | null } | null>(null)

  const endSplitDrag = () => {
    const drag = splitDragRef.current
    if (!drag) return
    if (drag.frame !== null) cancelAnimationFrame(drag.frame)
    splitDragRef.current = null
    rootRef.current?.style.setProperty('--comparison-split', String(drag.value))
    setComparisonSplit(drag.value)
    setSplitDragging(false)
  }
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false)
  const [layoutMenuPos, setLayoutMenuPos] = useState({ top: 0, left: 0 })
  const layoutMenuRef = useRef<HTMLButtonElement>(null)

  const activeSlideIndex = Math.min(slideIndex, slides.length - 1)
  if (closedAction && closedAction.slide !== activeSlideIndex) setClosedAction(null)
  const slide = slides[activeSlideIndex]
  const [timelineSlideId, setTimelineSlideId] = useState(slide.id)
  if (timelineSlideId !== slide.id) {
    setTimelineSlideId(slide.id)
    setTimelinePlaying(false)
    setLowerPlaying(false)
  }
  const filters = filtersBySlide[slide.id] ?? story.filters
  const timeline = timelineBySlide[slide.id] ?? DEFAULT_SLIDE_TIMELINE
  const timelineRange = timelineRangeById(timeline.rangeId)
  const timelineGranularity = timelineGranularityById(timeline.granularityId)
  const frameCount = timelineFrameCount(timelineRange, timelineGranularity)
  const frameStepMs = timelineStepMs(frameCount, playbackSpeed)
  const framePhase = timeline.frame / frameCount
  const baseScene = storySceneAt(activeSlideIndex)
  const scene = useMemo(() => sceneAtPhase(baseScene, framePhase), [baseScene, framePhase])
  const insight = scene.insight
  const emissionsLine = useMemo(
    () => warpPath(EMISSIONS_LINE, insight.emissionsWarp),
    [insight.emissionsWarp],
  )
  const groundwaterLine = useMemo(
    () => warpPath(GROUNDWATER_LINE, insight.groundwaterWarp),
    [insight.groundwaterWarp],
  )
  const hasPeriodCards = periodCards.length > 0
  const pastScene = useMemo(() => (hasPeriodCards ? periodScene(scene) : null), [hasPeriodCards, scene])
  const pastInsight = pastScene?.insight ?? insight
  const pastEmissionsLine = useMemo(
    () => warpPath(EMISSIONS_LINE, pastInsight.emissionsWarp),
    [pastInsight.emissionsWarp],
  )
  const pastGroundwaterLine = useMemo(
    () => warpPath(GROUNDWATER_LINE, pastInsight.groundwaterWarp),
    [pastInsight.groundwaterWarp],
  )
  const inPeriod = (id: ChartCardId) => pastScene !== null && periodCards.includes(id)
  // Feature-anchored to one slide's data: other slides show different values in those columns.
  const mapAnnotation = useMemo(() => {
    if (!annotationRequest) return null
    const { slide: from, location, kind } = annotationRequest
    const annotation = location
      ? locationAnnotation(from, location)
      : kind === 'markers'
        ? schoolMarkersAnnotation(from)
        : topSchoolsAnnotation(from)
    if (annotation.layer === 'region') return aiRegion ? annotation : null
    return from === activeSlideIndex && !aiRegion ? annotation : null
  }, [activeSlideIndex, aiRegion, annotationRequest])
  const actionTooltip = useMemo<StoryMapActionTooltip>(
    () => ({
      mode: storyMode,
      pinned:
        annotationRequest !== null &&
        pinnedActionFor === annotationRequest &&
        (storyMode === 'edit' || closedAction?.annotation !== annotationRequest),
      onPinnedChange: (pinned) => {
        setPinnedActionFor(pinned ? annotationRequest : null)
        setClosedAction(null)
      },
      onClose: () => setClosedAction({ annotation: annotationRequest, slide: activeSlideIndex }),
    }),
    [activeSlideIndex, annotationRequest, closedAction, pinnedActionFor, storyMode],
  )
  useEffect(() => {
    onSlideIndexChange?.(activeSlideIndex)
  }, [activeSlideIndex, onSlideIndexChange])
  const regionInsight = useMemo(() => (aiRegion ? mussafahInsight(framePhase) : null), [aiRegion, framePhase])
  const legendPlace = aiRegion ? aiRegion.label : 'Abu Dhabi'
  const mainLegend = aiRegion ? { ...scene.legend, junctionCount: aiRegion.junctions.length } : scene.legend
  const annotationData = useMemo<AnnotationData>(() => {
    const state = sceneState(baseScene)
    return { slideIndex: activeSlideIndex, heights: state.heights, radii: state.radii, layers }
  }, [activeSlideIndex, baseScene, layers])
  const annotationDataLabel = `Slide ${activeSlideIndex + 1} · ${slide.title}`
  const annotationStates = useMemo(
    () => Object.fromEntries(mapAnnotations.map((item) => [item.id, annotationValidity(item, annotationData)])),
    [annotationData, mapAnnotations],
  )
  const editingAnnotations = storyMode === 'edit'
  const showAnnotationsTab = editingAnnotations || mapAnnotations.length > 0
  const annotationsOf = (pane: MapPane) => (pane === 'lower' ? lowerAnnotations : mapAnnotations)
  const setAnnotationsOf = (pane: MapPane) => (pane === 'lower' ? setLowerAnnotations : setMapAnnotations)
  const editingAnnotationId = annotationEditing?.id ?? null
  const editingAnnotation = useMemo(() => {
    if (!editingAnnotationId) return null
    const items = annotationPane === 'lower' ? lowerAnnotations : mapAnnotations
    return items.find((item) => item.id === editingAnnotationId) ?? null
  }, [annotationPane, editingAnnotationId, lowerAnnotations, mapAnnotations])
  // The edited annotation is drawn by the editing session (with its handles) instead of the regular layers.
  const mapAnnotationItems = useMemo(
    () =>
      editingAnnotationId && annotationPane === 'upper'
        ? mapAnnotations.filter((item) => item.id !== editingAnnotationId)
        : mapAnnotations,
    [annotationPane, editingAnnotationId, mapAnnotations],
  )
  const lowerAnnotationItems = useMemo(
    () =>
      editingAnnotationId && annotationPane === 'lower'
        ? lowerAnnotations.filter((item) => item.id !== editingAnnotationId)
        : lowerAnnotations,
    [annotationPane, editingAnnotationId, lowerAnnotations],
  )
  const startAnnotationDrawing = (tool: AnnotationDrawingState['tool'], pane: MapPane = 'upper') => {
    setAnnotationPane(pane)
    setAnnotationEditing(null)
    setEditSection(null)
    if (pane === 'lower') {
      setLowerMapDataTab('annotations')
      setComparisonLegendOpen((current) => ({ ...current, lower: true }))
    } else {
      setMapDataTab('annotations')
      setLegendOpen(true)
      setComparisonLegendOpen((current) => ({ ...current, upper: true }))
    }
    setSelectedAnnotationId(null)
    setAnnotationDrawing({ tool, points: 0 })
  }
  const onAnnotationDrawn = (shape: DrawnShape, pane: MapPane = 'upper') => {
    setAnnotationDrawing(null)
    const item =
      pane === 'lower'
        ? createAnnotation(shape, lowerAnnotations, lowerAnnotationData, lowerAnnotationDataLabel)
        : createAnnotation(shape, mapAnnotations, annotationData, annotationDataLabel)
    setAnnotationsOf(pane)((items) => [item, ...items])
    setSelectedAnnotationId(item.id)
  }
  const updateAnnotation = (id: string, patch: AnnotationPatch, pane: MapPane = 'upper') =>
    setAnnotationsOf(pane)((items) =>
      items.map((item) =>
        item.id === id ? { ...item, ...patch, style: patch.style ? { ...item.style, ...patch.style } : item.style } : item,
      ),
    )
  const editAnnotationShape = (id: string, pane: MapPane = 'upper') => {
    const original = annotationsOf(pane).find((item) => item.id === id)
    if (!original) return
    setAnnotationPane(pane)
    setAnnotationDrawing(null)
    setSelectedAnnotationId(id)
    setAnnotationEditing({ id, original })
  }
  const onAnnotationEdited = (shape: DrawnShape, pane: MapPane = 'upper') => {
    if (!editingAnnotationId) return
    const [data, label] =
      pane === 'lower' ? [lowerAnnotationData, lowerAnnotationDataLabel] : [annotationData, annotationDataLabel]
    setAnnotationsOf(pane)((items) =>
      items.map((item) => (item.id === editingAnnotationId ? reshapeAnnotation(item, shape, data, label) : item)),
    )
  }
  const cancelAnnotationEditing = () => {
    if (annotationEditing) {
      const { id, original } = annotationEditing
      // Only the shape reverts; color, text and layer settings changed meanwhile stay.
      setAnnotationsOf(annotationPane)((items) =>
        items.map((item) =>
          item.id === id ? { ...original, style: item.style, visible: item.visible, opacity: item.opacity } : item,
        ),
      )
    }
    setAnnotationEditing(null)
  }
  const reorderAnnotations = (from: number, to: number, pane: MapPane = 'upper') =>
    setAnnotationsOf(pane)((items) => {
      const next = [...items]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  const annotating = annotationDrawing !== null || annotationEditing !== null
  const onDrawProgress = (points: number) =>
    setAnnotationDrawing((current) => (current && current.points !== points ? { ...current, points } : current))
  const deleteAnnotation = (id: string, pane: MapPane = 'upper') => {
    setAnnotationsOf(pane)((items) => items.filter((item) => item.id !== id))
    setSelectedAnnotationId(null)
    if (editingAnnotationId === id) setAnnotationEditing(null)
  }
  const leaveAnnotationEditing = () => {
    setAnnotationDrawing(null)
    setAnnotationEditing(null)
    setSelectedAnnotationId(null)
  }
  const previewStory: LandingStory = {
    ...story,
    storyTitle,
    description: storyDescription,
    filters,
    chapters,
    slides,
  }
  const slidesConfigOpen = editSection === 'slide' && !directSlideEditor
  const canPrev = activeSlideIndex > 0
  const canNext = activeSlideIndex < slides.length - 1

  const updateTimeline = (slideId: string, update: (current: SlideTimeline) => SlideTimeline) => {
    setTimelineBySlide((current) => ({
      ...current,
      [slideId]: update(current[slideId] ?? DEFAULT_SLIDE_TIMELINE),
    }))
  }

  useEffect(() => {
    if (!timelinePlaying) return
    const slideId = slide.id
    const timer = window.setTimeout(() => {
      setTimelineBySlide((current) => {
        const entry = current[slideId] ?? DEFAULT_SLIDE_TIMELINE
        return { ...current, [slideId]: { ...entry, frame: (entry.frame + 1) % frameCount } }
      })
    }, frameStepMs)
    return () => window.clearTimeout(timer)
  }, [timelinePlaying, timeline.frame, frameStepMs, slide.id, frameCount])

  const cardPrefs = cardPrefsBySlide[slide.id] ?? {}
  const openCardMenu = cardMenu?.slideId === slide.id ? cardMenu : null
  const openFilterMenu = filterMenu?.slideId === slide.id && storyMode === 'edit' ? filterMenu : null
  const openCardConfig = cardConfig?.slideId === slide.id ? cardConfig : null
  const openMonitor = monitorTarget?.slideId === slide.id ? monitorTarget : null

  const chartKpi = (cardId: ChartCardId) => {
    const config = cardPrefs[cardId]?.kpi
    if (!config) return undefined
    const kpi = resolveKpi(config, inPeriod(cardId) && pastScene ? pastScene : scene)
    return kpi ? <KpiLine {...kpi} /> : null
  }

  const summaryConfig =
    cardPrefs.summary?.summary ?? defaultSummaryConfig(slide.id)
  const viewLayout = layoutBySlide[slide.id] ?? 'sidebar'
  const basemap = basemapComparison(activeSlideIndex)
  const comparison: ComparisonChoice = comparisonBySlide[slide.id] ?? { option: basemap, layers: basemap.layers }
  const lowerFiltersFor = (option: ComparisonMapOption) =>
    filters
      .filter((filter) => option.source !== 'filters' || option.id !== `filter-${filter.id}`)
      .map((filter) => ({ ...filter }))
  const lowerFilters = comparison.filters ?? lowerFiltersFor(comparison.option)
  const lowerTimeline = (!mapsLinked && comparison.timeline) || timeline
  const lowerRange = timelineRangeById(lowerTimeline.rangeId)
  const lowerGranularity = timelineGranularityById(lowerTimeline.granularityId)
  const lowerFrameCount = timelineFrameCount(lowerRange, lowerGranularity)
  const lowerStepMs = mapsLinked ? frameStepMs : timelineStepMs(lowerFrameCount, lowerSpeed)
  const lowerAnimating = mapsLinked ? timelinePlaying : lowerPlaying
  const comparisonFramePhase = comparisonPhase(
    lowerTimeline.frame / lowerFrameCount,
    comparison.option,
  )
  const updateComparison = (update: (current: ComparisonChoice) => ComparisonChoice) =>
    setComparisonBySlide((current) => ({
      ...current,
      [slide.id]: update(current[slide.id] ?? comparison),
    }))
  const setMapsLinking = (linked: boolean) => {
    setMapsLinked(linked)
    if (linked) {
      setLowerPlaying(false)
      return
    }
    updateComparison((current) => ({
      ...current,
      filters: current.filters ?? lowerFiltersFor(current.option),
      timeline: { ...timeline },
    }))
    setLowerPlaying(timelinePlaying)
    setLowerSpeed(playbackSpeed)
  }

  useEffect(() => {
    if (mapsLinked || !lowerPlaying) return
    const slideId = slide.id
    const timer = window.setTimeout(() => {
      setComparisonBySlide((current) => {
        const entry = current[slideId]
        if (!entry?.timeline) return current
        const nextTimeline = { ...entry.timeline, frame: (entry.timeline.frame + 1) % lowerFrameCount }
        return { ...current, [slideId]: { ...entry, timeline: nextTimeline } }
      })
    }, lowerStepMs)
    return () => window.clearTimeout(timer)
  }, [mapsLinked, lowerPlaying, lowerTimeline.frame, lowerStepMs, slide.id, lowerFrameCount])

  const comparisonBaseScene = storySceneAt(comparison.option.sceneIndex)
  const comparisonScene = useMemo(
    () => sceneAtPhase(comparisonBaseScene, comparisonFramePhase),
    [comparisonBaseScene, comparisonFramePhase],
  )
  const lowerAnnotationData = useMemo<AnnotationData>(() => {
    const state = sceneState(comparisonBaseScene)
    return {
      slideIndex: comparison.option.sceneIndex,
      heights: state.heights,
      radii: state.radii,
      layers: comparison.layers,
    }
  }, [comparison.layers, comparison.option.sceneIndex, comparisonBaseScene])
  const lowerAnnotationDataLabel = `${comparison.option.eyebrow} · ${comparison.option.title}`
  const lowerAnnotationStates = useMemo(
    () =>
      Object.fromEntries(lowerAnnotations.map((item) => [item.id, annotationValidity(item, lowerAnnotationData)])),
    [lowerAnnotationData, lowerAnnotations],
  )
  const lowerMapStyle = comparison.mapStyle ?? mapStyle
  const toggleComparisonLayer = (key: MapDataLayerKey) =>
    updateComparison((current) => ({
      ...current,
      layers: { ...current.layers, [key]: !current.layers[key] },
    }))
  const placedIds = INSIGHT_CARD_IDS.filter((id) => !cardPrefs[id]?.deleted)
  const placedOneCell = placedIds.filter((id) => ONE_CELL_CARDS.has(id)).length
  const placedFull = placedIds.length - placedOneCell
  const sidebarColumns =
    viewLayout === 'sidebar'
      ? (sidebarColumnsBySlide[slide.id] ?? DEFAULT_SIDEBAR_COLUMNS)
      : DEFAULT_SIDEBAR_COLUMNS
  const sidebarRows =
    INSIGHT_CARD_IDS.length - ONE_CELL_CARDS.size + Math.ceil(ONE_CELL_CARDS.size / sidebarColumns) + EMPTY_GRID_ROWS
  const emptyGridCells = sidebarRows * sidebarColumns - placedFull * sidebarColumns - placedOneCell

  const bodyRef = useRef<HTMLDivElement>(null)
  const [bodySize, setBodySize] = useState({ width: 0, height: 0 })
  const gridColumns = gridColumnsBySlide[slide.id] ?? DEFAULT_GRID_COLUMNS
  const gridWidth = bodySize.width - 2 * GRID_INSET_X
  const gridCell =
    gridWidth > 0 ? (gridWidth - (gridColumns - 1) * GRID_CELL_GAP) / gridColumns : GRID_CELL_SIZE
  const gridCellsUsed = placedFull * GRID_CARD_SPAN + placedOneCell
  const gridRows = Math.max(
    1,
    Math.ceil(gridCellsUsed / gridColumns),
    Math.ceil((bodySize.height - GRID_INSET_TOP + GRID_CELL_GAP) / (gridCell + GRID_CELL_GAP)),
  )
  const gridLayoutEmptyCells = Math.max(0, gridColumns * gridRows - gridCellsUsed)

  useEffect(() => {
    const body = bodyRef.current
    if (viewLayout !== 'grid' || !body) return
    const observer = new ResizeObserver(() =>
      setBodySize({ width: body.clientWidth, height: body.clientHeight }),
    )
    observer.observe(body)
    return () => observer.disconnect()
  }, [viewLayout])

  useEffect(() => {
    if (!regeneratingSlideId) return
    const timer = window.setTimeout(() => {
      setSummaryUpdatedAt((current) => ({ ...current, [regeneratingSlideId]: Date.now() }))
      setRegeneratingSlideId(null)
    }, SUMMARY_REGENERATE_MS)
    return () => window.clearTimeout(timer)
  }, [regeneratingSlideId])

  const updateCard = (cardId: InsightCardId, patch: InsightCardPrefs) => {
    setCardPrefsBySlide((current) => ({
      ...current,
      [slide.id]: { ...current[slide.id], [cardId]: { ...current[slide.id]?.[cardId], ...patch } },
    }))
  }

  const toggleCardMenu = (cardId: InsightCardId, button: HTMLElement) => {
    if (openCardMenu?.cardId === cardId) {
      setCardMenu(null)
      return
    }
    const rect = button.getBoundingClientRect()
    const below = rect.bottom + 6
    setCardMenu({
      slideId: slide.id,
      cardId,
      top:
        below + CARD_MENU_HEIGHT > window.innerHeight - 8
          ? Math.max(8, rect.top - 6 - CARD_MENU_HEIGHT)
          : below,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - CARD_MENU_WIDTH - 8)),
    })
    setStoryMenuOpen(false)
    setSlideMenuOpen(false)
    setLayoutMenuOpen(false)
  }

  const toggleFilterMenu = (target: 'upper' | 'lower', filter: StoryFilter, remove: () => void, button: HTMLElement) => {
    if (openFilterMenu?.target === target && openFilterMenu.filterId === filter.id) {
      setFilterMenu(null)
      return
    }
    const rect = button.getBoundingClientRect()
    const below = rect.bottom + 6
    setFilterMenu({
      slideId: slide.id,
      target,
      filterId: filter.id,
      label: filter.label,
      remove,
      top:
        below + FILTER_MENU_HEIGHT > window.innerHeight - 8
          ? Math.max(8, rect.top - 6 - FILTER_MENU_HEIGHT)
          : below,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - FILTER_MENU_WIDTH - 8)),
    })
    setStoryMenuOpen(false)
    setSlideMenuOpen(false)
    setLayoutMenuOpen(false)
    setCardMenu(null)
  }

  useEffect(() => {
    if (!openFilterMenu) return
    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as Element).closest('#story-filter-menu, [data-filter-menu-trigger]')) return
      setFilterMenu(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFilterMenu(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openFilterMenu])

  const toggleLayoutMenu = () => {
    const rect = layoutMenuRef.current?.getBoundingClientRect()
    if (!rect) return
    if (layoutMenuOpen) {
      setLayoutMenuOpen(false)
      return
    }
    const below = rect.bottom + 6
    setLayoutMenuPos({
      top: below + LAYOUT_MENU_HEIGHT > window.innerHeight - 8 ? rect.top - 6 - LAYOUT_MENU_HEIGHT : below,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - LAYOUT_MENU_WIDTH - 8)),
    })
    setStoryMenuOpen(false)
    setSlideMenuOpen(false)
    setCardMenu(null)
    setLayoutMenuOpen(true)
  }

  useEffect(() => {
    if (!layoutMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const menu = document.getElementById('story-layout-menu')
      if (layoutMenuRef.current?.contains(event.target as Node) || menu?.contains(event.target as Node)) return
      setLayoutMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLayoutMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [layoutMenuOpen])

  useEffect(() => {
    if (!openCardMenu) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element
      if (target.closest('#insight-card-menu, [data-card-menu-trigger]')) return
      setCardMenu(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCardMenu(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openCardMenu])

  const canAddToChat = Boolean(onAddToChat)
  const addCardToChat = (id: InsightCardId, button: HTMLElement) => {
    onAddToChat?.({ id, label: INSIGHT_CARD_LABELS[id] }, button.getBoundingClientRect())
    button.blur()
  }

  const summaryRegenerating = regeneratingSlideId === slide.id
  const summaryStatusStyle = {
    '--actions-w': `${cardActionsWidth(canAddToChat ? 2 : 1)}px`,
  } as CSSProperties
  const summaryRegenerate = (
    <button
      type="button"
      className={styles.summaryStatus}
      style={summaryStatusStyle}
      data-busy={summaryRegenerating || undefined}
      disabled={summaryRegenerating}
      onClick={() => setRegeneratingSlideId(slide.id)}
    >
      <ArrowsClockwise size={14} className={styles.summaryStatusIcon} aria-hidden />
      {summaryRegenerating ? 'Regenerating…' : 'Regenerate'}
    </button>
  )
  const summaryUpdated = (
    <span className={styles.summaryUpdated} data-busy={summaryRegenerating || undefined} role="status">
      {summaryRegenerating ? (
        <ArrowsClockwise size={12} className={styles.summaryStatusIcon} aria-hidden />
      ) : null}
      {summaryRegenerating
        ? 'Updating…'
        : `Last updated ${SUMMARY_TIME.format(summaryUpdatedAt[slide.id] ?? storyOpenedAt)}`}
    </span>
  )

  const insightCard = (
    id: InsightCardId,
    className: string,
    title: string,
    children: ReactNode,
    style?: CSSProperties,
  ) => {
    const prefs = cardPrefs[id] ?? {}
    const focused = aiFocus !== null && isChartCardId(id) && aiFocus.cards.includes(id)
    if (aiFocus && id !== 'summary' && !focused) return null
    if (!focused && (prefs.deleted || (prefs.hidden && storyMode !== 'edit'))) return null
    const restored = !focused && restoredCards !== null && restoredCards.ids.includes(id)
    const menuOpen = openCardMenu?.cardId === id
    const focusDelay = focused
      ? aiFocus.cards.indexOf(id as ChartCardId) * 140 + 220
      : restored
        ? restoredCards.ids.indexOf(id) * 110 + 260
        : null
    const period = isChartCardId(id) && inPeriod(id)
    return (
      <section
        key={focused ? `${id}-${aiFocus.key}` : restored ? `${id}-restored-${restoredCards.key}` : id}
        className={[
          className,
          styles.insightCard,
          focused || restored ? styles.insightCardFocusIn : '',
          period ? styles.insightCardPeriod : '',
          prefs.hidden && !focused ? styles.insightCardHidden : '',
          prefs.border ? styles.insightCardBorder : '',
          prefs.outline ? styles.insightCardOutline : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={focusDelay === null ? style : ({ ...style, '--focus-delay': `${focusDelay}ms` } as CSSProperties)}
      >
        {children}
        {id === 'summary' && storyMode === 'edit' ? summaryRegenerate : null}
        <div
          className={`${styles.cardActions}${menuOpen ? ` ${styles.cardActionsOpen}` : ''}`}
          role="toolbar"
          aria-label={`${title} actions`}
        >
          {canAddToChat ? (
            <CardActionButton
              label="Add to chat"
              ariaLabel={`Add ${title} to chat`}
              onClick={(button) => addCardToChat(id, button)}
            >
              <ChatCircleText size={16} aria-hidden />
            </CardActionButton>
          ) : null}
          {id === 'summary' ? null : (
            <CardActionButton
              label="Monitor this"
              ariaLabel={`Monitor ${title}`}
              onClick={() => {
                setCardMenu(null)
                setMonitorTarget({ slideId: slide.id, cardId: id })
              }}
            >
              <Target size={16} weight="regular" aria-hidden />
            </CardActionButton>
          )}
          <CardActionButton
            label="More options"
            ariaLabel={`More options for ${title}`}
            active={menuOpen}
            menu={{ open: menuOpen }}
            onClick={(button) => toggleCardMenu(id, button)}
          >
            <DotsThreeVertical size={16} weight="bold" aria-hidden />
          </CardActionButton>
        </div>
      </section>
    )
  }

  const toggleSection = (section: StoryEditSection) => {
    setDirectSlideEditor(false)
    setEditSection((current) => (current === section ? null : section))
  }
  /** In comparison, each map's controls open their panels for that map (filters, layers, basemap). */
  const toolActive = (section: StoryEditSection, target: MapPane) =>
    editSection === section && (viewLayout !== 'comparison' || filterTarget === target)
  const toggleTool = (section: StoryEditSection, target: MapPane) => {
    const open = toolActive(section, target)
    setFilterTarget(target)
    setDirectSlideEditor(false)
    setEditSection(open ? null : section)
  }

  useEffect(() => {
    if (!storyMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const menu = document.getElementById('story-title-menu')
      if (storyMenuRef.current?.contains(event.target as Node) || menu?.contains(event.target as Node)) return
      setStoryMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStoryMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [storyMenuOpen])

  const toggleStoryMenu = () => {
    const rect = storyMenuRef.current?.getBoundingClientRect()
    if (!rect) return
    if (storyMenuOpen) {
      setStoryMenuOpen(false)
      return
    }
    const width = 200
    setStoryMenuPos({
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    })
    setSlideMenuOpen(false)
    setStoryMenuOpen(true)
    setLayoutMenuOpen(false)
  }

  useEffect(() => {
    if (!slideMenuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const menu = document.getElementById('slide-title-menu')
      if (slideMenuRef.current?.contains(event.target as Node) || menu?.contains(event.target as Node)) return
      setSlideMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSlideMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [slideMenuOpen])

  const toggleSlideMenu = () => {
    if (slideMenuOpen) {
      setSlideMenuOpen(false)
      return
    }
    if (slideMenuRef.current) openSlideMenu(slideMenuRef.current)
  }

  const openSlideMenu = (anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect()
    const width = 200
    setSlideMenuPos({
      top: rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    })
    setStoryMenuOpen(false)
    setSlideMenuOpen(true)
    setLayoutMenuOpen(false)
  }

  const duplicateActiveSlide = () => {
    const id = `${story.id}-slide-${Date.now()}`
    const nextSlide = {
      ...copySlide(slide),
      id,
      chapterId: slide.chapterId,
      title: `${slide.title} copy`,
    }
    const sourceFilters = filtersBySlide[slide.id] ?? filters
    setSlides((items) => [...items, nextSlide])
    setFiltersBySlide((current) => ({
      ...current,
      [id]: sourceFilters.map((filter) => ({ ...filter })),
    }))
    setTimelineBySlide((current) =>
      current[slide.id] ? { ...current, [id]: { ...current[slide.id] } } : current,
    )
    setCardPrefsBySlide((current) =>
      current[slide.id] ? { ...current, [id]: { ...current[slide.id] } } : current,
    )
    setLayoutBySlide((current) =>
      current[slide.id] ? { ...current, [id]: current[slide.id] } : current,
    )
    setSlideIndex(slides.length)
    setSlideMenuOpen(false)
  }

  const deleteSlide = (slideId: string) => {
    if (slides.length === 1) return
    const deletedIndex = slides.findIndex((item) => item.id === slideId)
    if (deletedIndex === -1) return
    const omit = <T,>(current: Record<string, T>) => {
      const next = { ...current }
      delete next[slideId]
      return next
    }
    setSlides((items) => items.filter((item) => item.id !== slideId))
    setFiltersBySlide(omit)
    setTimelineBySlide(omit)
    setCardPrefsBySlide(omit)
    setLayoutBySlide(omit)
    setSlideIndex((currentIndex) => {
      if (currentIndex > deletedIndex) return currentIndex - 1
      return Math.min(currentIndex, slides.length - 2)
    })
  }

  const deleteActiveSlide = () => {
    if (slides.length === 1) return
    deleteSlide(slide.id)
    setSlideMenuOpen(false)
    setDirectSlideEditor(false)
    setEditSection(null)
  }

  const addSlide = (chapterId: string, insertAt = slides.length, title?: string) => {
    const source = slides[activeSlideIndex] ?? slides[0]
    if (!source) return
    const id = `${story.id}-slide-${Date.now()}`
    const chapterSlides = slides.filter((item) => item.chapterId === chapterId)
    const nextSlide = {
      ...copySlide(source),
      id,
      chapterId,
      title: title ?? `Untitled slide ${chapterSlides.length + 1}`,
    }
    setSlides((items) => [...items.slice(0, insertAt), nextSlide, ...items.slice(insertAt)])
    setFiltersBySlide((current) => ({
      ...current,
      [id]: filters.map((filter) => ({ ...filter })),
    }))
    setSlideIndex(insertAt)
  }

  const deleteStory = () => {
    setStoryMenuOpen(false)
    setEditSection(null)
    onBack()
  }

  const commitPageRename = () => {
    if (!pageRename) return
    const title = pageRename.title.trim()
    if (title) {
      setSlides((items) =>
        items.map((item) => (item.id === pageRename.slideId ? { ...item, title } : item)),
      )
    }
    setPageRename(null)
  }

  const pagesNav =
    presentationSettings.multiSlide && presentationSettings.pagesMode ? (
      <nav className={styles.pages} aria-label="Story pages">
        {slides.map((page, index) => {
          const active = index === activeSlideIndex
          const pillClass = `${styles.pagePill}${active ? ` ${styles.pagePillActive}` : ''}`
          if (pageRename?.slideId === page.id) {
            return (
              <span key={page.id} className={pillClass}>
                <input
                  className={styles.pageRenameInput}
                  aria-label="Page name"
                  value={pageRename.title}
                  size={Math.max(pageRename.title.length, 6)}
                  autoFocus
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => setPageRename({ slideId: page.id, title: event.target.value })}
                  onBlur={commitPageRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitPageRename()
                    if (event.key === 'Escape') setPageRename(null)
                  }}
                />
              </span>
            )
          }
          return (
            <span key={page.id} className={pillClass}>
              <button
                type="button"
                className={styles.pageSelect}
                aria-current={active ? 'page' : undefined}
                onClick={() => setSlideIndex(index)}
              >
                {page.title}
              </button>
              {storyMode === 'edit' ? (
                <button
                  ref={active ? slideMenuRef : undefined}
                  type="button"
                  className={`${styles.slideMenuBtn} ${styles.pageMenuBtn}${active && slideMenuOpen ? ` ${styles.slideMenuBtnOpen}` : ''}`}
                  aria-label={`${page.title} actions`}
                  aria-haspopup="menu"
                  aria-expanded={active && slideMenuOpen}
                  aria-controls="slide-title-menu"
                  onClick={(event) => {
                    if (active) {
                      toggleSlideMenu()
                      return
                    }
                    setSlideIndex(index)
                    openSlideMenu(event.currentTarget)
                  }}
                >
                  <DotsThreeVertical size={14} weight="bold" aria-hidden />
                </button>
              ) : null}
            </span>
          )
        })}
        {storyMode === 'edit' ? (
          <button
            type="button"
            className={styles.pageAddBtn}
            onClick={() =>
              addSlide(slides[slides.length - 1].chapterId, slides.length, `Page ${slides.length + 1}`)
            }
          >
            <Plus size={16} weight="bold" aria-hidden />
            Add Page
          </button>
        ) : (
          <button
            type="button"
            className={styles.infoBtn}
            aria-label="Show slide description"
            aria-expanded={info?.kind === 'slide'}
            aria-describedby={info?.kind === 'slide' ? 'slide-description' : undefined}
            onClick={(event) => toggleInfo('slide', event.currentTarget)}
          >
            <Info size={18} weight="regular" aria-hidden />
          </button>
        )}
      </nav>
    ) : null

  useEffect(() => {
    if (
      !autoplaying ||
      !presentationSettings.autoplay ||
      !presentationSettings.multiSlide ||
      presentationSettings.pagesMode
    )
      return
    const timer = window.setInterval(
      () => setSlideIndex((index) => (index + 1) % slides.length),
      4000,
    )
    return () => window.clearInterval(timer)
  }, [
    autoplaying,
    presentationSettings.autoplay,
    presentationSettings.multiSlide,
    presentationSettings.pagesMode,
    slides.length,
  ])

  const backgroundButtonFor = (pane: MapPane) => (
    <button
      type="button"
      className={`${styles.mapDataBackgroundBtn}${toolActive('map', pane) ? ` ${styles.mapDataBackgroundBtnActive}` : ''}`}
      aria-pressed={toolActive('map', pane)}
      onClick={() => toggleTool('map', pane)}
    >
      <MapTrifold size={16} weight="regular" aria-hidden />
      Background
    </button>
  )
  const backgroundButton = backgroundButtonFor('upper')

  const timeSeries = (
    <StoryTimeSeries
      range={timelineRange}
      granularity={timelineGranularity}
      frameCount={frameCount}
      frame={timeline.frame}
      playing={timelinePlaying}
      speed={playbackSpeed}
      stepMs={frameStepMs}
      onFrameChange={(frame) => updateTimeline(slide.id, (current) => ({ ...current, frame }))}
      onPlayingChange={setTimelinePlaying}
      onSpeedChange={setPlaybackSpeed}
      onGranularityChange={(granularityId) =>
        updateTimeline(slide.id, (current) => withGranularity(current, granularityId))
      }
      onRangeChange={(rangeId) => updateTimeline(slide.id, (current) => withRange(current, rangeId))}
      chartScene={baseScene}
      charts={chartsBySlide[slide.id] ?? NO_TIMELINE_CHARTS}
      onChartsChange={(charts) => setChartsBySlide((current) => ({ ...current, [slide.id]: charts }))}
      editable={storyMode === 'edit'}
    />
  )

  const updateLowerTimeline = (update: (current: SlideTimeline) => SlideTimeline) =>
    updateComparison((current) => ({ ...current, timeline: update(current.timeline ?? lowerTimeline) }))

  const lowerTimeSeries = (
    <StoryTimeSeries
      range={lowerRange}
      granularity={lowerGranularity}
      frameCount={lowerFrameCount}
      frame={lowerTimeline.frame}
      playing={lowerPlaying}
      speed={lowerSpeed}
      stepMs={lowerStepMs}
      onFrameChange={(frame) => updateLowerTimeline((current) => ({ ...current, frame }))}
      onPlayingChange={(playing) => {
        updateLowerTimeline((current) => current)
        setLowerPlaying(playing)
      }}
      onSpeedChange={setLowerSpeed}
      onGranularityChange={(granularityId) =>
        updateLowerTimeline((current) => withGranularity(current, granularityId))
      }
      onRangeChange={(rangeId) => updateLowerTimeline((current) => withRange(current, rangeId))}
      chartScene={comparisonBaseScene}
      chartPhaseOffset={comparison.option.phaseOffset}
      charts={comparison.charts ?? NO_TIMELINE_CHARTS}
      onChartsChange={(charts) => updateComparison((current) => ({ ...current, charts }))}
      editable={storyMode === 'edit'}
    />
  )

  const linkMapsHint = mapsLinked
    ? 'Shared camera and time series; separate filters'
    : 'Each map has its own camera, time series and filters'
  const linkMapsToggle = (
    <button
      type="button"
      role="switch"
      aria-checked={mapsLinked}
      aria-description={linkMapsHint}
      title={linkMapsHint}
      className={styles.linkMaps}
      onClick={() => setMapsLinking(!mapsLinked)}
    >
      Link maps
      <span className={`${styles.linkMapsSwitch}${mapsLinked ? ` ${styles.linkMapsSwitchOn}` : ''}`} aria-hidden>
        <span className={styles.linkMapsThumb} />
      </span>
    </button>
  )
  /** Comparison sets the Link maps pill beside the Layout pill (or alone, outside edit mode). */
  const withLinkMaps = (layoutBar: ReactNode) =>
    viewLayout === 'comparison' ? (
      <div className={styles.layoutRow}>
        {layoutBar}
        {linkMapsToggle}
      </div>
    ) : (
      layoutBar
    )

  const filterRow = (
    target: 'upper' | 'lower',
    list: StoryFilter[],
    onRemove: (filterId: string) => void,
  ) => {
    const editingHere = editSection === 'filters' && filterTarget === target
    return (
      <div className={styles.filters}>
        {storyMode === 'edit' ? (
          <>
            <button
              type="button"
              className={`${styles.filterAddBtn}${editingHere ? ` ${styles.filterAddBtnActive}` : ''}`}
              aria-pressed={editingHere}
              aria-label={target === 'lower' ? 'Filters for the comparison map' : undefined}
              onClick={() => {
                setDirectSlideEditor(false)
                setFilterTarget(target)
                setEditSection(editingHere ? null : 'filters')
              }}
            >
              <Plus size={16} weight="bold" aria-hidden />
              Filters
            </button>
            {list.length > 0 ? <span className={styles.filterDivider} aria-hidden /> : null}
          </>
        ) : null}
        {list.map((f, index) => (
          <Fragment key={flashedFilters?.ids.includes(f.id) ? `${f.id}-${flashedFilters.key}` : f.id}>
            <span
              className={[
                styles.filterPill,
                storyMode === 'edit' ? styles.filterPillEditing : '',
                flashedFilters?.ids.includes(f.id) ? styles.filterPillUpdated : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {filterIcon(f.id)}
              <span>{f.label}</span>
              {storyMode === 'edit' ? (
                <>
                  <CaretDown className={styles.filterCaret} size={14} weight="bold" aria-hidden />
                  <button
                    type="button"
                    className={`${styles.filterMenuBtn}${
                      openFilterMenu?.target === target && openFilterMenu.filterId === f.id
                        ? ` ${styles.filterMenuBtnOpen}`
                        : ''
                    }`}
                    data-filter-menu-trigger
                    aria-label={`${f.label} filter options`}
                    aria-haspopup="menu"
                    aria-expanded={openFilterMenu?.target === target && openFilterMenu.filterId === f.id}
                    aria-controls="story-filter-menu"
                    onClick={(event) => toggleFilterMenu(target, f, () => onRemove(f.id), event.currentTarget)}
                  >
                    <DotsThreeVertical size={16} weight="bold" aria-hidden />
                  </button>
                </>
              ) : null}
            </span>
            {f.id === 'year' && index < list.length - 1 ? <span className={styles.filterDivider} aria-hidden /> : null}
          </Fragment>
        ))}
      </div>
    )
  }

  const editingLowerFilters =
    (editSection === 'filters' || editSection === 'assets') && filterTarget === 'lower' && viewLayout === 'comparison'
  const editingLowerMap = editSection === 'map' && filterTarget === 'lower' && viewLayout === 'comparison'
  const setLowerFilters = (update: (current: StoryFilter[]) => StoryFilter[]) =>
    updateComparison((current) => ({ ...current, filters: update(current.filters ?? lowerFilters) }))

  const toggleLayer = (key: MapDataLayerKey) =>
    setLayers((current) => ({ ...current, [key]: !current[key] }))

  const mapLegend = (
    legend: StoryScene['legend'],
    layerState: StoryMapLayerVisibility,
    onToggle: (key: MapDataLayerKey) => void,
    addLayer: boolean,
    place = 'Abu Dhabi',
    pane: MapPane = 'upper',
  ) => (
    <div className={styles.mapDataBody}>
      <div className={styles.legendGroup}>
        <div className={styles.legendHead}>
          <p className={styles.legendSection}>{place} Monitored Junctions</p>
          <span className={styles.legendActions}>
            <button type="button" className={styles.legendIconBtn} aria-label="Junction style">
              <PaintBucket size={16} weight="regular" aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.legendIconBtn}${layerState.junctions ? '' : ` ${styles.legendIconOff}`}`}
              aria-label="Toggle monitored junctions"
              aria-pressed={layerState.junctions}
              onClick={() => onToggle('junctions')}
            >
              {layerState.junctions ? (
                <Eye size={16} weight="regular" aria-hidden />
              ) : (
                <EyeSlash size={16} weight="regular" aria-hidden />
              )}
            </button>
          </span>
        </div>
        <div className={styles.legendRow}>
          <span className={styles.legendMark}>
            <i
              className={styles.diskOther}
              style={{
                borderColor: legend.diskRing,
                backgroundColor: `${legend.diskRing}1f`,
              }}
            />
            Other
          </span>
          <span className={styles.legendCount}>
            <AnimatedNumber value={legend.junctionCount} format={formatCount} />
          </span>
        </div>
        <div className={styles.legendScale}>
          <span>Low</span>
          <span
            className={styles.diskScale}
            style={{ '--disk-scale': legend.diskScale } as CSSProperties}
            aria-hidden
          >
            <i />
            <i />
            <i />
          </span>
          <span>High</span>
        </div>
      </div>
      <div className={styles.legendGroup}>
        <div className={styles.legendHead}>
          <p className={styles.legendSection}>{place} Value Distribution</p>
          <span className={styles.legendActions}>
            <button type="button" className={styles.legendIconBtn} aria-label="Distribution style">
              <PaintBucket size={16} weight="regular" aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.legendIconBtn}${layerState.distribution ? '' : ` ${styles.legendIconOff}`}`}
              aria-label="Toggle value distribution"
              aria-pressed={layerState.distribution}
              onClick={() => onToggle('distribution')}
            >
              {layerState.distribution ? (
                <Eye size={16} weight="regular" aria-hidden />
              ) : (
                <EyeSlash size={16} weight="regular" aria-hidden />
              )}
            </button>
          </span>
        </div>
        <div className={styles.legendScale}>
          <span>Low</span>
          <span className={styles.columnScale} aria-hidden>
            <ColumnGlyph height={16} colors={legend.glyphs[0]} />
            <ColumnGlyph height={24} colors={legend.glyphs[1]} />
            <ColumnGlyph height={34} colors={legend.glyphs[2]} />
          </span>
          <span>High</span>
        </div>
      </div>
      {addLayer ? (
        <button
          type="button"
          className={`${styles.addMapLayerBtn}${toolActive('layers', pane) ? ` ${styles.addMapLayerBtnActive}` : ''}`}
          aria-pressed={toolActive('layers', pane)}
          onClick={() => toggleTool('layers', pane)}
        >
          <Plus size={16} weight="bold" aria-hidden />
          Map layer
        </button>
      ) : null}
    </div>
  )

  /**
   * Each comparison map's Map Data, as the sidebar layout's: its basemap, layers and annotations, for that
   * map. Only a basemap shows behind a comparison map, so there are no background settings here.
   */
  const comparisonMapData = (
    pane: MapPane,
    legend: StoryScene['legend'],
    layerState: StoryMapLayerVisibility,
    onToggle: (key: MapDataLayerKey) => void,
    place: string,
  ) => {
    const upper = pane === 'upper'
    const open = comparisonLegendOpen[pane] || storyMode === 'edit'
    const items = annotationsOf(pane)
    const tab = upper ? mapDataTab : lowerMapDataTab
    const setTab = upper ? setMapDataTab : setLowerMapDataTab
    const showTabs = editingAnnotations || items.length > 0
    const here = annotationPane === pane
    const handle = upper ? mapHandleRef : lowerMapHandleRef
    return (
      <div className={styles.mapData}>
        {storyMode === 'edit' ? (
          <div className={`${styles.mapDataHeader} ${styles.mapDataHeaderEdit}`}>
            <span>Map Data</span>
            {backgroundButtonFor(pane)}
          </div>
        ) : (
          <button
            type="button"
            className={`${styles.mapDataHeader}${open ? '' : ` ${styles.mapDataHeaderSolo}`}`}
            onClick={() => setComparisonLegendOpen((current) => ({ ...current, [pane]: !current[pane] }))}
            aria-expanded={open}
          >
            <span>Map Data</span>
            <CaretDown size={18} weight="regular" className={open ? undefined : styles.caretClosed} aria-hidden />
          </button>
        )}
        {open ? (
          <>
            {showTabs ? (
              <div className={annotationStyles.tabs} role="tablist" aria-label="Map data">
                {(['layers', 'annotations'] as const).map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="tab"
                    aria-selected={tab === name}
                    className={`${annotationStyles.tab}${tab === name ? ` ${annotationStyles.tabActive}` : ''}`}
                    onClick={() => {
                      setTab(name)
                      if (name === 'layers' && here) setSelectedAnnotationId(null)
                    }}
                  >
                    {name === 'layers' ? 'Map layers' : 'Annotations'}
                    {name === 'annotations' && items.length > 0 ? (
                      <span className={annotationStyles.tabCount}>{items.length}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            {showTabs && tab === 'annotations' ? (
              <StoryAnnotationsPanel
                items={items}
                selectedId={here ? selectedAnnotationId : null}
                editable={editingAnnotations}
                drawing={here ? annotationDrawing : null}
                editingId={here ? editingAnnotationId : null}
                onStartDrawing={(tool) => startAnnotationDrawing(tool, pane)}
                onFinishDrawing={() => handle.current?.finishDrawing()}
                onUndoDrawing={() => handle.current?.undoDrawing()}
                onCancelDrawing={() => setAnnotationDrawing(null)}
                onSelect={(id) => {
                  setAnnotationPane(pane)
                  setSelectedAnnotationId(id)
                }}
                onChange={(id, patch) => updateAnnotation(id, patch, pane)}
                onDelete={(id) => deleteAnnotation(id, pane)}
                onEdit={(id) => editAnnotationShape(id, pane)}
                onFinishEditing={() => setAnnotationEditing(null)}
                onCancelEditing={cancelAnnotationEditing}
                onReorder={(from, to) => reorderAnnotations(from, to, pane)}
              />
            ) : (
              mapLegend(legend, layerState, onToggle, storyMode === 'edit', place, pane)
            )}
          </>
        ) : null}
      </div>
    )
  }

  const insightCards = (
    <>
      {insightCard(
        'summary',
        [
          styles.summaryCard,
          gradientStyles.gradientBorder,
          regeneratingSlideId === slide.id ? styles.summaryRegenerating : '',
        ]
          .filter(Boolean)
          .join(' '),
        'Executive Summary',
        <>
          <h2 className={styles.summaryTitle}>Executive Summary</h2>
          {summaryUpdated}
          {aiRegion && regionInsight ? (
            <p className={styles.summaryBody}>
              {aiRegion.label}&apos;s traffic volume rose{' '}
              <em className={styles.summaryEmphasis}>14% year over year</em> in {MUSSAFAH_PERIOD}, peaking at
              11.8k vehicles per hour on the E30 approach. Average junction load climbed to{' '}
              <em className={styles.summaryEmphasis}>
                <AnimatedNumber value={regionInsight.load} format={formatCount} />%
              </em>
              , with{' '}
              <em className={styles.summaryEmphasis}>
                {regionBusyJunctions(aiRegion)} of {aiRegion.junctions.length} junctions
              </em>{' '}
              over capacity during the 06:00–09:00 shift change.
            </p>
          ) : (
          <p className={styles.summaryBody}>
            Abu Dhabi&apos;s traffic operations view combines monitored-junction activity and
            value-distribution signals across{' '}
            <em className={styles.summaryEmphasis}>
              <AnimatedNumber value={scene.legend.junctionCount} format={formatCount} /> junctions
            </em>
            . Currently,{' '}
            <em className={styles.summaryEmphasis}>
              <AnimatedNumber value={insight.online} format={formatCount} /> junctions are reporting
            </em>{' '}
            at <AnimatedNumber value={insight.uptime} format={formatCount} />% data coverage, while{' '}
            <AnimatedNumber value={insight.marine} format={formatCount} /> show congested conditions.
            Hourly traffic volume and junction-load trends identify the busiest corridors so
            operations teams can prioritize signal timing and field response.
          </p>
          )}
        </>,
        {
          ...gradientVars(summaryConfig.gradient),
          '--summary-accent': summaryConfig.accent,
        } as CSSProperties,
      )}
      {insightCard(
        'emissions',
        styles.visualCard,
        'Traffic volume',
        regionInsight ? (
          <EmissionsChart
            yLabels={regionInsight.volumeLabels}
            line={regionInsight.volumeLine}
            xLabels={MUSSAFAH_VOLUME_X}
            legend={['2024', '2023']}
            kpi={chartKpi('emissions')}
          />
        ) : inPeriod('emissions') ? (
          <EmissionsChart
            yLabels={pastInsight.emissionsLabels}
            line={pastEmissionsLine}
            xLabels={PERIOD_VOLUME_X}
            legend={PERIOD_VOLUME_LEGEND}
            kpi={chartKpi('emissions')}
          />
        ) : (
          <EmissionsChart
            yLabels={insight.emissionsLabels}
            line={emissionsLine}
            kpi={chartKpi('emissions')}
          />
        ),
      )}
      {insightCard(
        'groundwater',
        styles.visualCard,
        'Average junction load',
        regionInsight || !inPeriod('groundwater') ? (
          <GroundwaterChart
            value={regionInsight?.load ?? insight.groundwaterValue}
            line={regionInsight?.loadLine ?? groundwaterLine}
            xLabels={regionInsight ? MUSSAFAH_LOAD_X : undefined}
            kpi={chartKpi('groundwater')}
          />
        ) : (
          <GroundwaterChart
            value={pastInsight.groundwaterValue}
            line={pastGroundwaterLine}
            xLabels={PERIOD_LOAD_X}
            kpi={chartKpi('groundwater')}
          />
        ),
      )}
      {insightCard(
        'biodiversity',
        styles.visualCard,
        'Junction traffic status',
        <BiodiversityChart
          terrestrial={(inPeriod('biodiversity') ? pastInsight : insight).terrestrial}
          marine={(inPeriod('biodiversity') ? pastInsight : insight).marine}
          kpi={chartKpi('biodiversity')}
        />,
      )}
      {insightCard(
        'sites',
        styles.visualCard,
        'Live junction data',
        <MonitoringSitesChart
          online={(inPeriod('sites') ? pastInsight : insight).online}
          sites={insight.sites}
          uptime={(inPeriod('sites') ? pastInsight : insight).uptime}
          offlineBars={(inPeriod('sites') ? pastInsight : insight).offlineBars}
          kpi={chartKpi('sites')}
        />,
      )}
      {insightCard(
        'deviation',
        styles.kpiCellCard,
        'Permit limit deviation rate',
        <>
          <p className={styles.kpiCellLabel}>Permit limit deviation rate</p>
          <p className={styles.kpiCellValue}>+14%</p>
          <p className={styles.kpiCellNote}>average non-compliant facility is going 14% over their legal limit</p>
        </>,
      )}
    </>
  )

  const askButton = onAsk ? (
    <button
      type="button"
      className={styles.askBtn}
      aria-label={agentOpen ? 'Close the assistant' : 'Ask about this story'}
      aria-expanded={agentOpen}
      onClick={(event) => {
        if (agentOpen) {
          onCloseAsk?.()
          return
        }
        const sourceRect = event.currentTarget.getBoundingClientRect()
        if (findingUnread && onRestoreFindings) {
          onRestoreFindings(sourceRect)
          return
        }
        onAsk({ story: previewStory, slideIndex: activeSlideIndex, sourceRect })
      }}
    >
      <img className={styles.askIcon} src={llumenAssets.launcherOrb} alt="" width={24} height={24} />
      {findingUnread ? <span className={styles.unreadDot} /> : null}
    </button>
  ) : null

  const modeSwitch = (target: 'upper' | 'lower') => (
    <div
      className={`${styles.modeSwitch}${storyMode === 'edit' ? ` ${styles.modeSwitchEdit}` : ''}`}
      role="group"
      aria-label={target === 'lower' ? 'Comparison map mode' : 'Story mode'}
    >
      <button
        type="button"
        className={`${styles.modeBtn}${storyMode === 'view' ? ` ${styles.modeBtnActive}` : ''}`}
        aria-label="View mode"
        aria-pressed={storyMode === 'view'}
        onClick={() => {
          setStoryMode('view')
          setDirectSlideEditor(false)
          setEditSection(null)
          setStoryMenuOpen(false)
          setSlideMenuOpen(false)
          setLayoutMenuOpen(false)
          setInfo(null)
          leaveAnnotationEditing()
        }}
      >
        <Eye size={20} weight="regular" aria-hidden />
      </button>
      <button
        type="button"
        className={`${styles.modeBtn}${storyMode === 'edit' ? ` ${styles.modeBtnActive}` : ''}`}
        aria-label="Edit mode"
        aria-pressed={storyMode === 'edit'}
        onClick={() => {
          setStoryMode('edit')
          setInfo(null)
        }}
      >
        <PencilSimple size={20} weight="regular" aria-hidden />
      </button>
      <div className={styles.modeActions} aria-hidden={storyMode !== 'edit'} inert={storyMode !== 'edit'}>
        <div className={styles.modeActionsClip}>
          <div className={styles.modeActionsInner}>
            <span className={styles.modeDivider} aria-hidden />
            <button
              type="button"
              className={`${styles.modeAction}${toolActive('assets', target) ? ` ${styles.modeActionActive}` : ''}`}
              onClick={() => toggleTool('assets', target)}
            >
              <Plus size={18} weight="bold" aria-hidden />
              Assets
            </button>
            <button
              type="button"
              className={`${styles.modeAction}${toolActive('tools', target) ? ` ${styles.modeActionActive}` : ''}`}
              onClick={() => toggleTool('tools', target)}
            >
              <Toolbox size={18} weight="regular" aria-hidden />
              Tools
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div
      ref={rootRef}
      className={`${styles.root}${splitDragging ? ` ${styles.rootSplitDragging}` : ''}`}
      style={{ '--comparison-split': comparisonSplit } as CSSProperties}
      aria-label={`${story.storyTitle} story`}
      data-entrance={entrance}
      data-map-hidden={mapHidden || undefined}
      inert={entrance === 'leave' || entrance === 'gone'}
    >
      <div className={`${styles.mapPane}${viewLayout === 'comparison' ? ` ${styles.mapPaneUpper}` : ''}`}>
        <StoryMap
          className={`${styles.map} ${styles.mapFullHeight}`}
          fitParentHeight
          layers={layers}
          sceneIndex={activeSlideIndex}
          framePhase={framePhase}
          frameDuration={timelinePlaying ? frameStepMs : 500}
          frameLinear={timelinePlaying}
          styleUrl={mapStyle.url}
          flat={mapStyle.dimension === '2d' || (annotationPane === 'upper' && annotating)}
          cameraLink={viewLayout === 'comparison' && mapsLinked ? cameraLink : undefined}
          region={aiRegion}
          cameraRequest={cameraRequest}
          areaEffect={areaEffect}
          annotation={mapAnnotation}
          actionTooltip={actionTooltip}
          annotations={{
            items: mapAnnotationItems,
            validity: annotationStates,
            selectedId: editingAnnotations && annotationPane === 'upper' ? selectedAnnotationId : null,
            onSelect: editingAnnotations
              ? (id) => {
                  setAnnotationPane('upper')
                  setSelectedAnnotationId(id)
                  if (!id) return
                  setMapDataTab('annotations')
                  setLegendOpen(true)
                  setComparisonLegendOpen((current) => ({ ...current, upper: true }))
                }
              : undefined,
            drawing: annotationPane === 'upper' ? (annotationDrawing?.tool ?? null) : null,
            onDrawn: (shape) => onAnnotationDrawn(shape, 'upper'),
            onDrawProgress,
            onDrawCancel: () => setAnnotationDrawing(null),
            editing: annotationPane === 'upper' ? editingAnnotation : null,
            onEdited: (shape) => onAnnotationEdited(shape, 'upper'),
          }}
          onHandle={onMapHandle}
          onReady={onMapReady}
        />
      </div>
      {viewLayout === 'comparison' ? (
        <section className={styles.mapPaneLower} aria-label={`Comparison map: ${comparison.option.title}`}>
          <StoryMap
            className={`${styles.map} ${styles.mapFullHeight}`}
            fitParentHeight
            layers={comparison.layers}
            sceneIndex={comparison.option.sceneIndex}
            framePhase={comparisonFramePhase}
            frameDuration={lowerAnimating ? lowerStepMs : 500}
            frameLinear={lowerAnimating}
            styleUrl={lowerMapStyle.url}
            flat={lowerMapStyle.dimension === '2d' || (annotationPane === 'lower' && annotating)}
            controlsClassName={styles.comparisonControls}
            cameraLink={mapsLinked ? cameraLink : undefined}
            flyToScene={false}
            annotations={{
              items: lowerAnnotationItems,
              validity: lowerAnnotationStates,
              selectedId: editingAnnotations && annotationPane === 'lower' ? selectedAnnotationId : null,
              onSelect: editingAnnotations
                ? (id) => {
                    setAnnotationPane('lower')
                    setSelectedAnnotationId(id)
                    if (!id) return
                    setLowerMapDataTab('annotations')
                    setComparisonLegendOpen((current) => ({ ...current, lower: true }))
                  }
                : undefined,
              drawing: annotationPane === 'lower' ? (annotationDrawing?.tool ?? null) : null,
              onDrawn: (shape) => onAnnotationDrawn(shape, 'lower'),
              onDrawProgress,
              onDrawCancel: () => setAnnotationDrawing(null),
              editing: annotationPane === 'lower' ? editingAnnotation : null,
              onEdited: (shape) => onAnnotationEdited(shape, 'lower'),
            }}
            onHandle={onLowerMapHandle}
          />
        </section>
      ) : null}
      {background.kind !== 'basemap' && viewLayout !== 'comparison' ? (
        <StoryBackgroundLayer
          background={background}
          onDuration={(duration) =>
            setBackground((current) =>
              current.kind === 'media' && current.duration !== duration ? { ...current, duration } : current,
            )
          }
        />
      ) : null}
      {background.kind === 'basemap' && viewLayout === 'grid' ? (
        <div className={styles.mapBlur} aria-hidden />
      ) : null}

      <div className={styles.overlay}>
        <header className={styles.header} dir={presentationSettings.textDirection}>
          <div className={styles.titleRow}>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => onBack(mapHandleRef.current?.view())}
              aria-label="Back to home"
            >
              <ArrowLeft size={20} weight="regular" aria-hidden />
            </button>
            <div ref={titleGroupRef} className={styles.titleGroup}>
              <div className={styles.storyTitleRow}>
                <h1 className={styles.storyTitle}>{storyTitle}</h1>
                {storyMode === 'view' ? (
                  <button
                    type="button"
                    className={`${styles.infoBtn} ${styles.infoBtnSmall}`}
                    aria-label="Show story description"
                    aria-expanded={info?.kind === 'story'}
                    aria-describedby={info?.kind === 'story' ? 'story-description' : undefined}
                    onClick={(event) => toggleInfo('story', event.currentTarget)}
                  >
                    <Info size={14} weight="regular" aria-hidden />
                  </button>
                ) : null}
                {storyMode === 'edit' ? (
                  <button
                    ref={storyMenuRef}
                    type="button"
                    className={`${styles.storyMenuBtn}${storyMenuOpen ? ` ${styles.storyMenuBtnOpen}` : ''}`}
                    aria-label="Story actions"
                    aria-haspopup="menu"
                    aria-expanded={storyMenuOpen}
                    aria-controls="story-title-menu"
                    onClick={toggleStoryMenu}
                  >
                    <DotsThreeVertical size={16} weight="bold" aria-hidden />
                  </button>
                ) : null}
              </div>
              {pagesNav ?? (
                <div className={styles.slideTitleRow}>
                  <h2 className={styles.slideTitle}>{slide.title}</h2>
                  {storyMode === 'edit' ? (
                    <button
                      ref={slideMenuRef}
                      type="button"
                      className={`${styles.slideMenuBtn}${slideMenuOpen ? ` ${styles.slideMenuBtnOpen}` : ''}`}
                      aria-label="Slide actions"
                      aria-haspopup="menu"
                      aria-expanded={slideMenuOpen}
                      aria-controls="slide-title-menu"
                      onClick={toggleSlideMenu}
                    >
                      <DotsThreeVertical size={16} weight="bold" aria-hidden />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.infoBtn}
                      aria-label="Show slide description"
                      aria-expanded={info?.kind === 'slide'}
                      aria-describedby={info?.kind === 'slide' ? 'slide-description' : undefined}
                      onClick={(event) => toggleInfo('slide', event.currentTarget)}
                    >
                      <Info size={18} weight="regular" aria-hidden />
                    </button>
                  )}
                </div>
              )}
              {storyMode === 'view' && info ? (
                <div
                  id={`${info.kind}-description`}
                  className={styles.infoPopover}
                  style={{ left: info.left, top: info.top }}
                  role="tooltip"
                >
                  {(info.kind === 'story' ? storyDescription : slide.finding) || 'No description added.'}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.shareBtn}
              aria-haspopup="dialog"
              onClick={() => setShareOpen(true)}
            >
              <Export size={16} weight="regular" aria-hidden />
              Share
            </button>
            {headerEnd ? <div className={styles.headerEnd}>{headerEnd}</div> : null}
          </div>
          {filterRow('upper', filters, (filterId) =>
            setFiltersBySlide((current) => ({
              ...current,
              [slide.id]: (current[slide.id] ?? filters).filter((item) => item.id !== filterId),
            })),
          )}
          <div className={styles.headerRule} aria-hidden />
        </header>

        <div
          ref={bodyRef}
          className={[
            styles.body,
            viewLayout === 'grid' ? styles.bodyGrid : slide.focusLayout ? styles.bodyFocus : '',
            viewLayout === 'comparison' ? styles.bodyComparison : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={
            viewLayout === 'grid'
              ? ({
                  '--grid-inset-x': `${GRID_INSET_X}px`,
                  '--grid-inset-top': `${GRID_INSET_TOP}px`,
                  '--grid-inset-bottom': `${GRID_INSET_BOTTOM}px`,
                } as CSSProperties)
              : undefined
          }
          dir={presentationSettings.textDirection}
        >
          {withLinkMaps(storyMode === 'edit' ? (
            <div className={styles.layoutBar}>
              <button
                ref={layoutMenuRef}
                type="button"
                className={`${styles.layoutBtn}${layoutMenuOpen ? ` ${styles.layoutBtnOpen}` : ''}`}
                aria-label="Layout"
                aria-haspopup="menu"
                aria-expanded={layoutMenuOpen}
                aria-controls="story-layout-menu"
                onClick={toggleLayoutMenu}
              >
                <Layout size={18} weight="regular" aria-hidden />
                Layout
                <CaretDown className={styles.layoutBtnCaret} size={14} weight="bold" aria-hidden />
              </button>
              {viewLayout === 'grid' ? (
                <ColumnsControl
                  label="Grid width"
                  options={GRID_COLUMN_OPTIONS}
                  value={gridColumns}
                  onChange={(columns) => setGridColumnsBySlide((current) => ({ ...current, [slide.id]: columns }))}
                />
              ) : null}
              {viewLayout === 'sidebar' ? (
                <ColumnsControl
                  label="Sidebar width"
                  options={SIDEBAR_COLUMN_OPTIONS}
                  value={sidebarColumns}
                  onChange={(columns) =>
                    setSidebarColumnsBySlide((current) => ({ ...current, [slide.id]: columns }))
                  }
                />
              ) : null}
            </div>
          ) : null)}
          {viewLayout === 'grid' ? (
            <aside
              className={`${styles.insight} ${styles.insightLayoutGrid}${storyMode === 'edit' ? ` ${styles.insightLayoutGridEditing}` : ''}`}
              style={
                {
                  '--grid-columns': gridColumns,
                  '--grid-rows': gridRows,
                  '--grid-cell': `${gridCell}px`,
                  '--grid-gap': `${GRID_CELL_GAP}px`,
                  '--grid-card-span': GRID_CARD_SPAN,
                } as CSSProperties
              }
              aria-label="Story insight"
            >
              {insightCards}
              {storyMode === 'edit'
                ? Array.from({ length: gridLayoutEmptyCells }, (_, index) => (
                    <div key={`cell-${index}`} className={styles.gridCell} aria-hidden />
                  ))
                : null}
            </aside>
          ) : (
            <aside
              id="story-insight"
              className={[
                styles.insight,
                slide.layout === 'full-width' ? styles.insightFullWidth : '',
                slide.layout === 'sidebar' && slide.sidebarWidth === 'small'
                  ? styles.insightSmall
                  : '',
                slide.focusLayout ? styles.insightFocus : '',
                storyMode === 'edit' ? styles.insightGrid : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ '--sidebar-columns': sidebarColumns } as CSSProperties}
              aria-label="Story insight"
            >
              {insightCards}
              {storyMode === 'edit'
                ? Array.from({ length: emptyGridCells }, (_, index) => (
                    <div key={`cell-${index}`} className={styles.gridCell} aria-hidden />
                  ))
                : null}
            </aside>
          )}
        </div>

        {viewLayout === 'comparison' ? (
          <header
            className={styles.comparisonTitle}
            dir={presentationSettings.textDirection}
          >
            <p className={styles.storyTitle}>{comparison.option.eyebrow}</p>
            <h2 className={styles.slideTitle}>{comparison.option.title}</h2>
            <div className={styles.comparisonFilters}>
              {filterRow('lower', lowerFilters, (filterId) =>
                setLowerFilters((current) => current.filter((item) => item.id !== filterId)),
              )}
            </div>
            <div className={`${styles.headerRule} ${styles.comparisonRule}`} aria-hidden />
          </header>
        ) : null}

        {viewLayout === 'comparison' ? (
          <div
            className={`${styles.splitHandle}${splitDragging ? ` ${styles.splitHandleActive}` : ''}`}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize comparison maps"
            aria-valuemin={COMPARISON_SPLIT_MIN * 100}
            aria-valuemax={COMPARISON_SPLIT_MAX * 100}
            aria-valuenow={Math.round(comparisonSplit * 100)}
            tabIndex={0}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              splitDragRef.current = { value: comparisonSplit, frame: null }
              setSplitDragging(true)
            }}
            onPointerMove={(event) => {
              const drag = splitDragRef.current
              const root = rootRef.current
              if (!drag || !root) return
              const rect = root.getBoundingClientRect()
              drag.value = clampSplit((event.clientY - rect.top) / rect.height)
              drag.frame ??= requestAnimationFrame(() => {
                drag.frame = null
                root.style.setProperty('--comparison-split', String(drag.value))
              })
            }}
            onPointerUp={endSplitDrag}
            onPointerCancel={endSplitDrag}
            onDoubleClick={() => setComparisonSplit(COMPARISON_SPLIT_DEFAULT)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
              event.preventDefault()
              const step = event.key === 'ArrowUp' ? -COMPARISON_SPLIT_STEP : COMPARISON_SPLIT_STEP
              setComparisonSplit((current) => clampSplit(current + step))
            }}
          >
            <span className={styles.splitHandleGrip} aria-hidden>
              <DotsSix size={16} weight="bold" />
            </span>
          </div>
        ) : null}

        {editSection ? (
          <StoryEditPanel
            section={editSection}
            storyTitle={storyTitle}
            storyDescription={storyDescription}
            presentationSettings={presentationSettings}
            slides={slides}
            activeSlideIndex={activeSlideIndex}
            filters={editingLowerFilters ? lowerFilters : filters}
            onStoryTitleChange={setStoryTitle}
            onStoryDescriptionChange={setStoryDescription}
            onPresentationSettingsChange={(settings) => {
              setPresentationSettings(settings)
              if (!settings.autoplay || !settings.multiSlide || settings.pagesMode) setAutoplaying(false)
            }}
            onSelectSlide={setSlideIndex}
            onSlideChange={(nextSlide) =>
              setSlides((items) =>
                items.map((item) => (item.id === nextSlide.id ? nextSlide : item)),
              )
            }
            onFiltersChange={(nextFilters) =>
              editingLowerFilters
                ? setLowerFilters(() => nextFilters)
                : setFiltersBySlide((current) => ({ ...current, [slide.id]: nextFilters }))
            }
            onAddSlide={() => addSlide(slide.chapterId)}
            onDuplicateSlide={(slideId) => {
              const source = slides.find((item) => item.id === slideId) ?? slide
              if (!source) return
              const id = `${story.id}-slide-${Date.now()}`
              const nextSlide = {
                ...copySlide(source),
                id,
                chapterId: source.chapterId,
                title: `${source.title} copy`,
              }
              const sourceFilters = filtersBySlide[source.id] ?? filters
              setSlides((items) => [...items, nextSlide])
              setFiltersBySlide((current) => ({
                ...current,
                [id]: sourceFilters.map((filter) => ({ ...filter })),
              }))
              setSlideIndex(slides.length)
            }}
            onDeleteSlide={(slideId) => {
              if (slides.length === 1) return
              const deletedIndex = slides.findIndex((item) => item.id === slideId)
              if (deletedIndex === -1) return
              setSlides((items) => items.filter((item) => item.id !== slideId))
              setFiltersBySlide((current) => {
                const next = { ...current }
                delete next[slideId]
                return next
              })
              setSlideIndex((currentIndex) => {
                if (currentIndex > deletedIndex) return currentIndex - 1
                if (currentIndex === deletedIndex) {
                  return Math.min(currentIndex, slides.length - 2)
                }
                return currentIndex
              })
            }}
            onDeleteSlides={() => {
              setEditSection(null)
              onBack()
            }}
            directSlideEditor={directSlideEditor}
            onClose={() => {
              setDirectSlideEditor(false)
              setEditSection(null)
            }}
            mapStyleId={editingLowerMap ? lowerMapStyle.id : mapStyle.id}
            mapDimension={editingLowerMap ? lowerMapStyle.dimension : mapStyle.dimension}
            background={editingLowerMap ? lowerMapStyle : background}
            basemapOnly={viewLayout === 'comparison'}
            onBackgroundChange={(next) => {
              if (editingLowerMap) {
                if (next.kind === 'basemap') updateComparison((current) => ({ ...current, mapStyle: next }))
                return
              }
              setBackground(next)
              if (next.kind === 'basemap') setMapStyle(next)
            }}
            onAddCharts={(chartIds) => {
              chartIds.forEach((chartId) => {
                const cardId = CHART_CARD_BY_ASSET[chartId]
                if (cardId) updateCard(cardId, { deleted: false, hidden: false })
              })
            }}
          />
        ) : null}

        {viewLayout === 'grid' ? (
          <div className={styles.timelineDock}>
            {timeSeries}
            {storyMode === 'edit' ? (
              <div className={styles.mapData}>
                <div
                  className={`${styles.mapDataHeader} ${styles.mapDataHeaderEdit}${
                    background.kind === 'basemap' ? ` ${styles.mapDataHeaderSolo}` : ''
                  }`}
                >
                  <span>Grid Background</span>
                  {backgroundButton}
                </div>
                {background.kind !== 'basemap' ? (
                  <BackgroundSettings
                    background={background}
                    onChange={setBackground}
                    onReplace={() => toggleSection('map')}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {viewLayout === 'comparison' ? (
          <>
            <div className={`${styles.mapStack} ${styles.mapStackComparisonUpper}`}>
              {timeSeries}
              {comparisonMapData('upper', mainLegend, layers, toggleLayer, legendPlace)}
            </div>
            <div className={styles.mapStack}>
              {mapsLinked ? null : lowerTimeSeries}
              {comparisonMapData('lower', comparisonScene.legend, comparison.layers, toggleComparisonLayer, 'Abu Dhabi')}
            </div>
          </>
        ) : (
        <div
          className={`${styles.mapStack}${viewLayout === 'grid' ? ` ${styles.mapStackUnderGrid}` : ''}`}
          aria-hidden={viewLayout === 'grid' || undefined}
        >
          {viewLayout === 'grid' ? null : timeSeries}
          {background.kind === 'basemap' || storyMode === 'edit' ? (
          <div className={styles.mapData}>
            {storyMode === 'edit' ? (
              <div className={`${styles.mapDataHeader} ${styles.mapDataHeaderEdit}`}>
                <span>{backgroundPanelTitle}</span>
                {backgroundButton}
              </div>
            ) : (
              <button
                type="button"
                className={styles.mapDataHeader}
                onClick={() => setLegendOpen((o) => !o)}
                aria-expanded={legendOpen}
              >
                <span>Map Data</span>
                <CaretDown
                  size={18}
                  weight="regular"
                  className={legendOpen ? undefined : styles.caretClosed}
                  aria-hidden
                />
              </button>
            )}
            {background.kind !== 'basemap' ? (
              <BackgroundSettings
                background={background}
                onChange={setBackground}
                onReplace={() => toggleSection('map')}
              />
            ) : legendOpen || storyMode === 'edit' ? (
              <>
                {showAnnotationsTab ? (
                  <div className={annotationStyles.tabs} role="tablist" aria-label="Map data">
                    {(['layers', 'annotations'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={mapDataTab === tab}
                        className={`${annotationStyles.tab}${mapDataTab === tab ? ` ${annotationStyles.tabActive}` : ''}`}
                        onClick={() => {
                          setMapDataTab(tab)
                          if (tab === 'layers') setSelectedAnnotationId(null)
                        }}
                      >
                        {tab === 'layers' ? 'Map layers' : 'Annotations'}
                        {tab === 'annotations' && mapAnnotations.length > 0 ? (
                          <span className={annotationStyles.tabCount}>{mapAnnotations.length}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
                {showAnnotationsTab && mapDataTab === 'annotations' ? (
                  <StoryAnnotationsPanel
                    items={mapAnnotations}
                    selectedId={selectedAnnotationId}
                    editable={editingAnnotations}
                    drawing={annotationDrawing}
                    editingId={editingAnnotationId}
                    onStartDrawing={(tool) => startAnnotationDrawing(tool)}
                    onFinishDrawing={() => mapHandleRef.current?.finishDrawing()}
                    onUndoDrawing={() => mapHandleRef.current?.undoDrawing()}
                    onCancelDrawing={() => setAnnotationDrawing(null)}
                    onSelect={(id) => {
                      setAnnotationPane('upper')
                      setSelectedAnnotationId(id)
                    }}
                    onChange={(id, patch) => updateAnnotation(id, patch)}
                    onDelete={(id) => deleteAnnotation(id)}
                    onEdit={(id) => editAnnotationShape(id)}
                    onFinishEditing={() => setAnnotationEditing(null)}
                    onCancelEditing={cancelAnnotationEditing}
                    onReorder={(from, to) => reorderAnnotations(from, to)}
                  />
                ) : (
                  mapLegend(mainLegend, layers, toggleLayer, storyMode === 'edit', legendPlace)
                )}
              </>
            ) : null}
          </div>
          ) : null}
        </div>
        )}

        <div
          className={`${styles.lowerNav}${viewLayout === 'comparison' ? ` ${styles.lowerNavUpper}` : ''}`}
          aria-label="Story navigation"
        >
          {askButton}

          {presentationSettings.multiSlide && !presentationSettings.pagesMode ? (
            <div className={styles.navCluster}>
              {presentationSettings.autoplay ? (
                <button
                  type="button"
                  className={styles.navArrow}
                  aria-label={autoplaying ? 'Pause autoplay' : 'Start autoplay'}
                  aria-pressed={autoplaying}
                  onClick={() => setAutoplaying((playing) => !playing)}
                >
                  {autoplaying ? (
                    <Pause size={18} weight="fill" aria-hidden />
                  ) : (
                    <Play size={18} weight="fill" aria-hidden />
                  )}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.navArrow}
                aria-label="Previous slide"
                disabled={!canPrev}
                onClick={() => canPrev && setSlideIndex((i) => i - 1)}
              >
                <ArrowLeft size={20} weight="regular" aria-hidden />
              </button>
              <button
                type="button"
                className={`${styles.navCount}${slidesConfigOpen ? ` ${styles.navCountActive}` : ''}`}
                aria-label={`Slide ${activeSlideIndex + 1} of ${slides.length}, open slides configuration`}
                aria-haspopup="dialog"
                aria-expanded={slidesConfigOpen}
                onClick={() => {
                  setDirectSlideEditor(false)
                  setEditSection(slidesConfigOpen ? null : 'slide')
                }}
              >
                <List size={16} weight="regular" aria-hidden />
                {activeSlideIndex + 1}/{slides.length}
              </button>
              {storyMode === 'edit' ? (
                <button
                  type="button"
                  className={`${styles.navCount} ${styles.navAddSlide}`}
                  aria-label="Add slide"
                  title="Add slide"
                  onClick={() => addSlide(slide.chapterId, activeSlideIndex + 1)}
                >
                  <Plus size={16} weight="bold" aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                className={styles.navArrow}
                aria-label="Next slide"
                disabled={!canNext}
                onClick={() => canNext && setSlideIndex((i) => i + 1)}
              >
                <ArrowRight size={20} weight="regular" aria-hidden />
              </button>
            </div>
          ) : null}

          {modeSwitch('upper')}
        </div>
        {viewLayout === 'comparison' ? (
          <div className={styles.lowerNav} aria-label="Comparison map toolbar">
            {askButton}
            {modeSwitch('lower')}
          </div>
        ) : null}
      </div>
    {slideMenuOpen
      ? createPortal(
          <div
            id="slide-title-menu"
            className={styles.storyMenu}
            role="menu"
            aria-label="Slide actions"
            style={{ top: slideMenuPos.top, left: slideMenuPos.left }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setDirectSlideEditor(true)
                setEditSection('slide')
                setSlideMenuOpen(false)
              }}
            >
              <GearSix size={16} weight="regular" aria-hidden />
              Configure
            </button>
            {pagesNav ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPageRename({ slideId: slide.id, title: slide.title })
                  setSlideMenuOpen(false)
                }}
              >
                <PencilSimple size={16} weight="regular" aria-hidden />
                Rename page
              </button>
            ) : null}
            <button type="button" role="menuitem" onClick={duplicateActiveSlide}>
              <Copy size={16} weight="regular" aria-hidden />
              Duplicate slide
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.storyMenuDanger}
              disabled={slides.length === 1}
              onClick={deleteActiveSlide}
            >
              <Trash size={16} weight="regular" aria-hidden />
              Delete slide
            </button>
          </div>,
          document.body,
        )
      : null}
    {layoutMenuOpen
      ? createPortal(
          <div
            id="story-layout-menu"
            className={`${styles.storyMenu} ${styles.layoutMenu}`}
            role="menu"
            aria-label="Layout"
            style={{ top: layoutMenuPos.top, left: layoutMenuPos.left }}
          >
            {VIEW_LAYOUTS.map((option) => {
              const Icon = option.icon
              const selected = viewLayout === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={selected ? styles.storyMenuSelected : undefined}
                  onClick={() => {
                    if (option.id === 'comparison' && viewLayout !== 'comparison') {
                      setComparisonLegendOpen({ upper: false, lower: !comparisonBySlide[slide.id] })
                    }
                    setLayoutBySlide((current) => ({ ...current, [slide.id]: option.id }))
                    setLayoutMenuOpen(false)
                  }}
                >
                  <Icon size={16} weight="regular" aria-hidden />
                  {option.label}
                  {selected ? <Check className={styles.storyMenuCheck} size={14} weight="bold" aria-hidden /> : null}
                </button>
              )
            })}
          </div>,
          document.body,
        )
      : null}
    {storyMenuOpen
      ? createPortal(
          <div
            id="story-title-menu"
            className={styles.storyMenu}
            role="menu"
            aria-label="Story actions"
            style={{ top: storyMenuPos.top, left: storyMenuPos.left }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setDirectSlideEditor(false)
                setEditSection('story')
                setStoryMenuOpen(false)
              }}
            >
              <GearSix size={16} weight="regular" aria-hidden />
              Configure
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setStoryMenuOpen(false)
                setShareOpen(true)
              }}
            >
              <Export size={16} weight="regular" aria-hidden />
              Share story
            </button>
            <button type="button" role="menuitem" className={styles.storyMenuDanger} onClick={deleteStory}>
              <Trash size={16} weight="regular" aria-hidden />
              Delete story
            </button>
          </div>,
          document.body,
        )
      : null}
    {openFilterMenu
      ? createPortal(
          <div
            id="story-filter-menu"
            className={styles.storyMenu}
            role="menu"
            aria-label={`${openFilterMenu.label} filter`}
            style={{ top: openFilterMenu.top, left: openFilterMenu.left }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setFilterMenu(null)
                setDirectSlideEditor(false)
                setFilterTarget(openFilterMenu.target)
                setEditSection('filters')
              }}
            >
              <GearSix size={16} weight="regular" aria-hidden />
              Configure
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.storyMenuDanger}
              onClick={() => {
                openFilterMenu.remove()
                setFilterMenu(null)
              }}
            >
              <Trash size={16} weight="regular" aria-hidden />
              Remove
            </button>
          </div>,
          document.body,
        )
      : null}
    {openCardMenu
      ? createPortal(
          <div
            id="insight-card-menu"
            className={styles.storyMenu}
            role="menu"
            aria-label="Card actions"
            style={{ top: openCardMenu.top, left: openCardMenu.left }}
          >
            <button
              type="button"
              role="menuitem"
              disabled={openCardMenu.cardId !== 'summary' && !isChartCardId(openCardMenu.cardId)}
              onClick={() => {
                setCardMenu(null)
                setDirectSlideEditor(false)
                setEditSection(null)
                setCardConfig({ slideId: slide.id, cardId: openCardMenu.cardId })
              }}
            >
              <GearSix size={16} weight="regular" aria-hidden />
              Configure
            </button>
            <button type="button" role="menuitem" onClick={() => setCardMenu(null)}>
              <Compass size={16} weight="regular" aria-hidden />
              Explore
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.storyMenuDanger}
              onClick={() => {
                updateCard(openCardMenu.cardId, { deleted: true })
                setCardMenu(null)
              }}
            >
              <Trash size={16} weight="regular" aria-hidden />
              Remove
            </button>
          </div>,
          document.body,
        )
      : null}
      {openCardConfig?.cardId === 'summary' ? (
        <StorySummaryConfigModal
          key={`${openCardConfig.slideId}-summary`}
          initial={summaryConfig}
          slides={slides}
          currentSlideId={slide.id}
          onSave={(summary) => {
            updateCard('summary', { summary })
            if (summary.autoRegenerate) setRegeneratingSlideId(slide.id)
            setCardConfig(null)
          }}
          onClose={() => setCardConfig(null)}
        />
      ) : openCardConfig && isChartCardId(openCardConfig.cardId) ? (
        <StoryCardConfigModal
          key={`${openCardConfig.slideId}-${openCardConfig.cardId}`}
          initial={cardPrefs[openCardConfig.cardId]?.kpi ?? DEFAULT_CHART_KPI[openCardConfig.cardId]}
          onSave={(kpi) => {
            updateCard(openCardConfig.cardId, { kpi })
            setCardConfig(null)
          }}
          onClose={() => setCardConfig(null)}
        />
      ) : null}
      {openMonitor ? (
        <StoryMonitorModal
          key={`${openMonitor.slideId}-${openMonitor.cardId}`}
          cardTitle={INSIGHT_CARD_LABELS[openMonitor.cardId]}
          initial={monitors[`${openMonitor.slideId}:${openMonitor.cardId}`] ?? defaultMonitorConfig()}
          onConfirm={(config) => {
            const key = `${openMonitor.slideId}:${openMonitor.cardId}`
            setMonitors((current) => ({ ...current, [key]: config }))
            setMonitorTarget(null)
            const cardTitle = INSIGHT_CARD_LABELS[openMonitor.cardId]
            onMonitorConfirm?.(
              monitorWorkflowProposal(`monitor-${key}-${Date.now()}`, cardTitle, config),
              monitorPrompt(cardTitle, config),
            )
          }}
          onClose={() => setMonitorTarget(null)}
        />
      ) : null}
      {aiModeBar}
      <ShareModal
        open={shareOpen}
        title={`Share “${storyTitle}”`}
        note="Recipients get a link to this story, with its pages, filters and map views. Your edits reach them as you make them."
        onClose={() => setShareOpen(false)}
      />
    </div>
  )
}

function ColumnGlyph({ height, colors }: { height: number; colors: ColumnGlyphColors }) {
  const [front, side, top] = colors
  const w = 8
  const d = 4
  return (
    <svg
      className={styles.columnGlyph}
      width={w + d}
      height={height + d}
      viewBox={`0 0 ${w + d} ${height + d}`}
      aria-hidden
    >
      <polygon points={`0,${d} ${d},0 ${w + d},0 ${w},${d}`} style={{ fill: top }} />
      <rect x="0" y={d} width={w} height={height} style={{ fill: front }} />
      <polygon
        points={`${w},${d} ${w + d},0 ${w + d},${height} ${w},${height + d}`}
        style={{ fill: side }}
      />
    </svg>
  )
}
