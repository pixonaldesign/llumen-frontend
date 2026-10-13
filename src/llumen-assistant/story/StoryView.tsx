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
  BoundingBox,
  Buildings,
  CalendarBlank,
  CaretDown,
  ChatCircleText,
  Check,
  Copy,
  DotsSix,
  DotsThree,
  DotsThreeVertical,
  Export,
  Eye,
  EyeSlash,
  GearSix,
  GenderIntersex,
  GridFour,
  IdentificationCard,
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
  Selection,
  Sidebar,
  Sparkle,
  Student,
  SquaresFour,
  Toolbox,
  Trash,
  X,
  type IconProps,
} from '@phosphor-icons/react'
import { llumenAssets } from '../assets'
import { ShareModal } from '../ShareModal'
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
import { StoryMap, STORY_MAP_STYLE, type StoryMapHandle, type StoryMapLayerVisibility } from './StoryMap'
import type { AssistantReplyPayload } from '../assistantReplyTypes'
import { StorySelectLayer, type StorySelectArea, type StorySelection } from './StorySelectLayer'
import {
  AREA_FILTER_LABELS,
  AREA_PROMPT,
  MUSSAFAH_LABEL,
  MUSSAFAH_LOAD_X,
  MUSSAFAH_MAX_HEIGHT_M,
  MUSSAFAH_PERIOD,
  MUSSAFAH_REGION,
  MUSSAFAH_VOLUME_X,
  areaFilterEffect,
  countInPolygon,
  mussafahInsight,
  mussafahPrompt,
  regionBusyJunctions,
  regionColumnHeights,
  regionJunctionRadii,
  type StoryAiSnapshot,
  type StoryAreaEffect,
  type StoryMapCapture,
  type StoryMapRegion,
} from './storyAiScenarios'
import { areaFilterReply, mussafahReply, withMapState } from './storySelectionReplies'
import {
  PERIOD_LOAD_X,
  PERIOD_VOLUME_LEGEND,
  PERIOD_VOLUME_X,
  periodScene,
  type ChatComponent,
} from './storyChartPeriod'
import { DEMO_COLUMNS, DEMO_JUNCTIONS } from './storyDemoMapData'
import { locationAnnotation, schoolMarkersAnnotation, snapshotRegion, topSchoolsAnnotation } from './storyAnnotations'
import { StoryComparisonModal } from './StoryComparisonModal'
import { comparisonOptions, comparisonPhase, type ComparisonMapOption } from './storyComparison'
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
  COLUMN_MAX_HEIGHT_M,
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
  onBack: () => void
  /** Opens left agent rail with current story/slide context. */
  onAsk?: (context: { story: LandingStory; slideIndex: number; sourceRect: DOMRect }) => void
  /** When the agent rail is open, hide the Ask icon. */
  agentOpen?: boolean
  /** Red dot when findings were dismissed before every entry was seen. */
  findingUnread?: boolean
  /** Reopens findings that were dismissed before every entry was seen. */
  onRestoreFindings?: (sourceRect: DOMRect) => void
  /** Select mode: pick insight components or drag an area on the map to prompt about. */
  selectMode?: boolean
  onSelectModeChange?: (on: boolean) => void
  /** A select-mode prompt was sent; the story already applied its changes. */
  onSelectionPrompt?: (request: { prompt: string; reply: AssistantReplyPayload; snapshot: StoryAiSnapshot }) => void
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
  /** Status bar for the AI-changed story; hidden while select mode shows its own banner. */
  aiModeBar?: ReactNode
  /** Top-right of the story header (e.g. the AI approach switcher). */
  headerEnd?: ReactNode
  /** Shows "Add to chat" beside a hovered chart card; `sourceRect` is the clicked button. */
  onAddToChat?: (component: ChatComponent, sourceRect: DOMRect) => void
  /** Reports the slide on screen, so prompts sent from outside the story can use its data. */
  onSlideIndexChange?: (index: number) => void
}

/** How long a prompt's camera flight and column animation take before the map is captured. */
const REGION_CAPTURE_DELAY_MS = 4900
const AREA_CAPTURE_DELAY_MS = 2300

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
}

const DEFAULT_FOCUS_CARDS: ChartCardId[] = ['emissions', 'groundwater']
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
}

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

const INSIGHT_CARD_IDS = ['summary', 'emissions', 'groundwater', 'biodiversity', 'sites'] as const

/** Edit-mode grid: one row per visual plus 3 empty rows; each row holds 2 cells. */
const GRID_ROWS = INSIGHT_CARD_IDS.length + 3

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
/** Space kept clear around the grid: sides, top, and the floating width control above the toolbar. */
const GRID_INSET_X = 20
const GRID_INSET_TOP = 20
const GRID_INSET_BOTTOM = 128

const CHART_CARD_BY_ASSET: Record<string, ChartCardId> = {
  'chart-emissions': 'emissions',
  'chart-groundwater': 'groundwater',
  'chart-biodiversity': 'biodiversity',
  'chart-sites': 'sites',
}

type InsightCardId = 'summary' | ChartCardId

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
    pagesMode: false,
  }
}

export function StoryView({
  storyId,
  onBack,
  onAsk,
  agentOpen = false,
  findingUnread = false,
  onRestoreFindings,
  selectMode = false,
  onSelectModeChange,
  onSelectionPrompt,
  aiState,
  onMapCapture,
  aiModeBar,
  headerEnd,
  onAddToChat,
  onSlideIndexChange,
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
  const [infoOpen, setInfoOpen] = useState(false)
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
  const [regeneratingSlideId, setRegeneratingSlideId] = useState<string | null>(null)
  const [layoutBySlide, setLayoutBySlide] = useState<Record<string, StoryViewLayout>>({})
  const [gridColumnsBySlide, setGridColumnsBySlide] = useState<Record<string, GridColumns>>({})
  const [sidebarColumnsBySlide, setSidebarColumnsBySlide] = useState<Record<string, SidebarColumns>>({})
  const [comparisonBySlide, setComparisonBySlide] = useState<Record<string, ComparisonChoice>>({})
  const [comparisonPickerOpen, setComparisonPickerOpen] = useState(false)
  const [comparisonLegendOpen, setComparisonLegendOpen] = useState({ upper: false, lower: false })
  const [comparisonInsightOpen, setComparisonInsightOpen] = useState(false)
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
  /** Filters as they were before the first select-mode prompt, restored when `aiState` resets. */
  const [filtersBeforeAi, setFiltersBeforeAi] = useState<Record<string, StoryFilter[]> | null>(null)
  const [aiFilterLabels, setAiFilterLabels] = useState<Record<string, string>>({})
  const [restoredCards, setRestoredCards] = useState<{ ids: InsightCardId[]; key: number } | null>(null)
  const [cameraRequest, setCameraRequest] = useState<{ camera: NonNullable<StoryAiSnapshot['camera']> } | null>(null)
  const [periodCards, setPeriodCards] = useState<ChartCardId[]>([])
  const [annotationRequest, setAnnotationRequest] = useState<StoryAiSnapshot['annotation'] | null>(null)
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
      setAiFilterLabels(snapshot?.filterLabels ?? {})
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
  const editingAnnotationId = annotationEditing?.id ?? null
  const editingAnnotation = useMemo(
    () => (editingAnnotationId ? (mapAnnotations.find((item) => item.id === editingAnnotationId) ?? null) : null),
    [editingAnnotationId, mapAnnotations],
  )
  // The edited annotation is drawn by the editing session (with its handles) instead of the regular layers.
  const mapAnnotationItems = useMemo(
    () => (editingAnnotationId ? mapAnnotations.filter((item) => item.id !== editingAnnotationId) : mapAnnotations),
    [editingAnnotationId, mapAnnotations],
  )
  const startAnnotationDrawing = (tool: AnnotationDrawingState['tool']) => {
    setAnnotationEditing(null)
    setEditSection(null)
    setMapDataTab('annotations')
    setLegendOpen(true)
    setSelectedAnnotationId(null)
    setAnnotationDrawing({ tool, points: 0 })
  }
  const onAnnotationDrawn = (shape: DrawnShape) => {
    setAnnotationDrawing(null)
    const item = createAnnotation(shape, mapAnnotations, annotationData, annotationDataLabel)
    setMapAnnotations((items) => [item, ...items])
    setSelectedAnnotationId(item.id)
  }
  const updateAnnotation = (id: string, patch: AnnotationPatch) =>
    setMapAnnotations((items) =>
      items.map((item) =>
        item.id === id ? { ...item, ...patch, style: patch.style ? { ...item.style, ...patch.style } : item.style } : item,
      ),
    )
  const editAnnotationShape = (id: string) => {
    const original = mapAnnotations.find((item) => item.id === id)
    if (!original) return
    setAnnotationDrawing(null)
    setSelectedAnnotationId(id)
    setAnnotationEditing({ id, original })
  }
  const onAnnotationEdited = (shape: DrawnShape) => {
    if (!editingAnnotationId) return
    setMapAnnotations((items) =>
      items.map((item) =>
        item.id === editingAnnotationId ? reshapeAnnotation(item, shape, annotationData, annotationDataLabel) : item,
      ),
    )
  }
  const cancelAnnotationEditing = () => {
    if (annotationEditing) {
      const { id, original } = annotationEditing
      // Only the shape reverts; color, text and layer settings changed meanwhile stay.
      setMapAnnotations((items) =>
        items.map((item) =>
          item.id === id ? { ...original, style: item.style, visible: item.visible, opacity: item.opacity } : item,
        ),
      )
    }
    setAnnotationEditing(null)
  }
  const reorderAnnotations = (from: number, to: number) =>
    setMapAnnotations((items) => {
      const next = [...items]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
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
  const openCardMenu = cardMenu?.slideId === slide.id && storyMode === 'edit' ? cardMenu : null
  const openCardPrefs = openCardMenu ? (cardPrefs[openCardMenu.cardId] ?? {}) : {}
  const openCardConfig = cardConfig?.slideId === slide.id && storyMode === 'edit' ? cardConfig : null

  const chartKpi = (cardId: ChartCardId) => {
    const config = cardPrefs[cardId]?.kpi
    if (!config) return undefined
    const kpi = resolveKpi(config, inPeriod(cardId) && pastScene ? pastScene : scene)
    return kpi ? <KpiLine {...kpi} /> : null
  }

  const summaryConfig =
    cardPrefs.summary?.summary ?? defaultSummaryConfig(slide.id)
  const viewLayout = layoutBySlide[slide.id] ?? 'sidebar'
  const comparisonMapOptions = comparisonOptions({
    slides,
    activeSlideIndex,
    filters,
    range: timelineRange,
  })
  const comparison: ComparisonChoice = comparisonBySlide[slide.id] ?? {
    option: comparisonMapOptions[0],
    layers: comparisonMapOptions[0].layers,
  }
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
  const toggleComparisonLayer = (key: MapDataLayerKey) =>
    updateComparison((current) => ({
      ...current,
      layers: { ...current.layers, [key]: !current.layers[key] },
    }))
  const placedCards = INSIGHT_CARD_IDS.filter((id) => !cardPrefs[id]?.deleted).length
  const sidebarColumns =
    viewLayout === 'sidebar'
      ? (sidebarColumnsBySlide[slide.id] ?? DEFAULT_SIDEBAR_COLUMNS)
      : DEFAULT_SIDEBAR_COLUMNS
  const emptyGridCells = (GRID_ROWS - placedCards) * sidebarColumns

  const bodyRef = useRef<HTMLDivElement>(null)
  const [bodySize, setBodySize] = useState({ width: 0, height: 0 })
  const gridColumns = gridColumnsBySlide[slide.id] ?? DEFAULT_GRID_COLUMNS
  const gridWidth = bodySize.width - 2 * GRID_INSET_X
  const gridCell =
    gridWidth > 0 ? (gridWidth - (gridColumns - 1) * GRID_CELL_GAP) / gridColumns : GRID_CELL_SIZE
  const gridRows = Math.max(
    1,
    Math.ceil((placedCards * GRID_CARD_SPAN) / gridColumns),
    Math.ceil((bodySize.height - GRID_INSET_TOP + GRID_CELL_GAP) / (gridCell + GRID_CELL_GAP)),
  )
  const gridLayoutEmptyCells = Math.max(0, gridColumns * gridRows - placedCards * GRID_CARD_SPAN)

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
    const timer = window.setTimeout(() => setRegeneratingSlideId(null), SUMMARY_REGENERATE_MS)
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

  const toggleLayoutMenu = () => {
    const rect = layoutMenuRef.current?.getBoundingClientRect()
    if (!rect) return
    if (layoutMenuOpen) {
      setLayoutMenuOpen(false)
      return
    }
    const above = rect.top - 6 - LAYOUT_MENU_HEIGHT
    setLayoutMenuPos({
      top: above < 8 ? rect.bottom + 6 : above,
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

  const canAddToChat = Boolean(onAddToChat) && !selectMode
  const addCardToChat = (id: ChartCardId, button: HTMLElement) => {
    onAddToChat?.({ id, label: INSIGHT_CARD_LABELS[id] }, button.getBoundingClientRect())
    button.blur()
  }

  const insightCard = (
    id: InsightCardId,
    className: string,
    title: string,
    children: ReactNode,
    style?: CSSProperties,
  ) => {
    const prefs = cardPrefs[id] ?? {}
    const focused = aiFocus !== null && id !== 'summary' && aiFocus.cards.includes(id)
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
    const chattable = canAddToChat && isChartCardId(id)
    return (
      <section
        key={focused ? `${id}-${aiFocus.key}` : restored ? `${id}-restored-${restoredCards.key}` : id}
        data-select-id={id}
        data-select-label={INSIGHT_CARD_LABELS[id]}
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
        {chattable ? (
          <div
            className={`${styles.cardActions}${menuOpen ? ` ${styles.cardActionsOpen}` : ''}`}
            role="toolbar"
            aria-label={`${title} actions`}
          >
            <button
              type="button"
              className={`${styles.cardAction} ${styles.cardActionIcon}`}
              aria-label={`Add ${title} to chat`}
              title="Add to chat"
              onClick={(event) => addCardToChat(id, event.currentTarget)}
            >
              <ChatCircleText size={16} aria-hidden />
            </button>
            <button
              type="button"
              className={`${styles.cardAction} ${styles.cardActionIcon}`}
              aria-label={`Generate from ${title}`}
              title="Generate"
            >
              <Sparkle size={16} aria-hidden />
            </button>
            {storyMode === 'edit' ? (
              <button
                type="button"
                data-card-menu-trigger
                className={`${styles.cardAction} ${styles.cardActionIcon}${menuOpen ? ` ${styles.cardActionActive}` : ''}`}
                aria-label={`More options for ${title}`}
                title="More options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuOpen ? 'insight-card-menu' : undefined}
                onClick={(event) => toggleCardMenu(id, event.currentTarget)}
              >
                <DotsThree size={16} weight="bold" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.cardAction} ${styles.cardActionIcon}`}
                aria-label={`More options for ${title}`}
                title="More options"
              >
                <DotsThree size={16} weight="bold" aria-hidden />
              </button>
            )}
          </div>
        ) : null}
        {storyMode === 'edit' && !chattable ? (
          <button
            type="button"
            data-card-menu-trigger
            className={`${styles.storyMenuBtn} ${styles.insightCardMenuBtn}${menuOpen ? ` ${styles.storyMenuBtnOpen}` : ''}`}
            aria-label={`${title} actions`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? 'insight-card-menu' : undefined}
            onClick={(event) => toggleCardMenu(id, event.currentTarget)}
          >
            <DotsThreeVertical size={20} weight="bold" aria-hidden />
          </button>
        ) : null}
      </section>
    )
  }

  const toggleSection = (section: StoryEditSection) => {
    setDirectSlideEditor(false)
    setEditSection((current) => (current === section ? null : section))
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
            aria-expanded={infoOpen}
            aria-describedby={infoOpen ? 'slide-description' : undefined}
            onClick={() => setInfoOpen((open) => !open)}
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

  const backgroundButton = (
    <button
      type="button"
      className={`${styles.mapDataBackgroundBtn}${editSection === 'map' ? ` ${styles.mapDataBackgroundBtnActive}` : ''}`}
      aria-pressed={editSection === 'map'}
      onClick={() => toggleSection('map')}
    >
      <MapTrifold size={16} weight="regular" aria-hidden />
      Background
    </button>
  )

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

  const linkMapsToggle = (
    <button
      type="button"
      role="switch"
      aria-checked={mapsLinked}
      className={styles.linkMaps}
      onClick={() => setMapsLinking(!mapsLinked)}
    >
      <span className={styles.linkMapsText}>
        <span className={styles.linkMapsLabel}>Link maps</span>
        <span className={styles.linkMapsHint}>
          {mapsLinked
            ? 'Shared camera and time series; separate filters'
            : 'Each map has its own camera, time series and filters'}
        </span>
      </span>
      <span className={`${styles.linkMapsSwitch}${mapsLinked ? ` ${styles.linkMapsSwitchOn}` : ''}`} aria-hidden>
        <span className={styles.linkMapsThumb} />
      </span>
    </button>
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
                <button
                  type="button"
                  className={styles.filterRemove}
                  aria-label={`Remove ${f.label}`}
                  onClick={() => onRemove(f.id)}
                >
                  <X size={12} weight="bold" aria-hidden />
                </button>
              ) : null}
            </span>
            {f.id === 'year' && index < list.length - 1 ? <span className={styles.filterDivider} aria-hidden /> : null}
          </Fragment>
        ))}
      </div>
    )
  }

  const editingLowerFilters =
    editSection === 'filters' && filterTarget === 'lower' && viewLayout === 'comparison'
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
          className={`${styles.addMapLayerBtn}${editSection === 'layers' ? ` ${styles.addMapLayerBtnActive}` : ''}`}
          aria-pressed={editSection === 'layers'}
          onClick={() => toggleSection('layers')}
        >
          <Plus size={16} weight="bold" aria-hidden />
          Map layer
        </button>
      ) : null}
    </div>
  )

  /** Comparison maps: collapsible legend only; the background stays out of the comparison. */
  const comparisonMapData = (
    pane: 'upper' | 'lower',
    legend: StoryScene['legend'],
    layerState: StoryMapLayerVisibility,
    onToggle: (key: MapDataLayerKey) => void,
  ) => {
    const open = comparisonLegendOpen[pane]
    return (
      <div className={styles.mapData}>
        <button
          type="button"
          className={`${styles.mapDataHeader}${open ? '' : ` ${styles.mapDataHeaderSolo}`}`}
          onClick={() => setComparisonLegendOpen((current) => ({ ...current, [pane]: !current[pane] }))}
          aria-expanded={open}
        >
          <span>Map Data</span>
          <CaretDown size={18} weight="regular" className={open ? undefined : styles.caretClosed} aria-hidden />
        </button>
        {open ? mapLegend(legend, layerState, onToggle, false) : null}
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
    </>
  )

  const exitSelectMode = useCallback(() => onSelectModeChange?.(false), [onSelectModeChange])

  const relabelFilters = (labels: Record<string, string>) => {
    setFiltersBeforeAi((before) => before ?? filtersBySlide)
    setAiFilterLabels((current) => ({ ...current, ...labels }))
    setRestoredCards(null)
    setFiltersBySlide((current) => relabelFilterMap(current, slides, story.filters, labels))
    setFlashedFilters({ ids: Object.keys(labels), key: Date.now() })
  }

  /** Viewport corners of a select-layer rectangle, projected onto the main map. */
  const areaPolygon = (area: StorySelectArea): [number, number][] | null => {
    const handle = mapHandleRef.current
    const base = rootRef.current?.getBoundingClientRect()
    if (!handle || !base) return null
    const left = base.left + area.left
    const top = base.top + area.top
    const right = left + area.width
    const bottom = top + area.height
    return [
      handle.unproject(left, top),
      handle.unproject(right, top),
      handle.unproject(right, bottom),
      handle.unproject(left, bottom),
    ]
  }

  const describeArea = (area: StorySelectArea) => {
    const polygon = areaPolygon(area)
    if (!polygon) return ''
    const columns =
      (aiRegion ? 0 : countInPolygon(DEMO_COLUMNS, polygon)) +
      (aiRegion ? countInPolygon(aiRegion.columns, polygon) : 0)
    const disks =
      (aiRegion ? 0 : countInPolygon(DEMO_JUNCTIONS, polygon)) +
      (aiRegion ? countInPolygon(aiRegion.junctions, polygon) : 0)
    return `${columns} columns · ${disks} disks`
  }

  const suggestSelectionPrompt = (selection: StorySelection) =>
    selection.area
      ? AREA_PROMPT
      : mussafahPrompt(
          (selection.targets.some((target) => isChartCardId(target.id))
            ? selection.targets.filter((target) => isChartCardId(target.id))
            : selection.targets
          ).map((target) => target.label),
        )

  const submitSelection = (selection: StorySelection, prompt: string) => {
    if (selection.area) {
      const polygon = areaPolygon(selection.area)
      if (!polygon) return
      const state = sceneState(scene)
      const { effect, stats } = areaFilterEffect({
        polygon,
        columns: aiRegion ? [] : DEMO_COLUMNS,
        junctions: aiRegion ? [] : DEMO_JUNCTIONS,
        heights: aiRegion ? [] : state.heights,
        radii: aiRegion ? [] : state.radii,
        regionColumns: aiRegion?.columns ?? [],
        regionJunctions: aiRegion?.junctions ?? [],
        regionHeights: aiRegion ? regionColumnHeights(aiRegion, framePhase) : [],
        regionRadii: aiRegion ? regionJunctionRadii(aiRegion, framePhase) : [],
        load: regionInsight?.load ?? insight.groundwaterValue,
        maxHeight: aiRegion ? MUSSAFAH_MAX_HEIGHT_M : COLUMN_MAX_HEIGHT_M,
      })
      setAreaEffect(effect)
      relabelFilters(AREA_FILTER_LABELS)
      const snapshot: StoryAiSnapshot = {
        cards: aiFocus?.cards ?? null,
        region: aiRegion !== null,
        areaEffect: effect,
        filterLabels: { ...aiFilterLabels, ...AREA_FILTER_LABELS },
      }
      const reply = areaFilterReply(stats)
      const stateId = `map-state-${Date.now()}`
      const mapChanged = Boolean(onMapCapture) && (stats.columns > 0 || stats.junctions > 0)
      onSelectionPrompt?.({
        prompt,
        reply: mapChanged
          ? withMapState(reply, {
              stateId,
              snapshot,
              title: `${Object.values(AREA_FILTER_LABELS).join(' · ')} in the selected area`,
              tag: aiRegion ? aiRegion.label : 'Abu Dhabi',
              meta: `${stats.columns} columns / ${stats.junctions} disks`,
            })
          : reply,
        snapshot,
      })
      if (mapChanged) captureMapState(stateId, AREA_CAPTURE_DELAY_MS)
    } else {
      const picked = selection.targets.map((target) => target.id).filter(isChartCardId)
      const cards = picked.length > 0 ? picked : DEFAULT_FOCUS_CARDS
      const labels = { loc: MUSSAFAH_LABEL, year: MUSSAFAH_PERIOD }
      setAiFocus({ cards, key: Date.now() })
      setAiRegion(MUSSAFAH_REGION)
      setAreaEffect(null)
      setRegeneratingSlideId(slide.id)
      relabelFilters(labels)
      const snapshot: StoryAiSnapshot = {
        cards,
        region: true,
        areaEffect: null,
        filterLabels: { ...aiFilterLabels, ...labels },
      }
      const stateId = `map-state-${Date.now()}`
      const reply = mussafahReply(cards.map((id) => INSIGHT_CARD_LABELS[id]))
      onSelectionPrompt?.({
        prompt,
        reply: onMapCapture
          ? withMapState(reply, {
              stateId,
              snapshot,
              title: `${MUSSAFAH_LABEL} · ${MUSSAFAH_PERIOD}`,
              tag: MUSSAFAH_LABEL,
              meta: `${MUSSAFAH_REGION.columns.length} columns / ${MUSSAFAH_REGION.junctions.length} junctions`,
            })
          : reply,
        snapshot,
      })
      if (onMapCapture) captureMapState(stateId, REGION_CAPTURE_DELAY_MS)
    }
    onSelectModeChange?.(false)
  }

  const captureMapState = (stateId: string, delay: number) => {
    window.setTimeout(() => {
      void mapHandleRef.current?.capture().then((capture) => onMapCapture?.(stateId, capture))
    }, delay)
  }

  return (
    <div
      ref={rootRef}
      className={`${styles.root}${splitDragging ? ` ${styles.rootSplitDragging}` : ''}`}
      style={{ '--comparison-split': comparisonSplit } as CSSProperties}
      aria-label={`${story.storyTitle} story`}
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
          flat={mapStyle.dimension === '2d' || annotationDrawing !== null || annotationEditing !== null}
          cameraLink={viewLayout === 'comparison' && mapsLinked ? cameraLink : undefined}
          region={aiRegion}
          cameraRequest={cameraRequest}
          areaEffect={areaEffect}
          annotation={mapAnnotation}
          annotations={{
            items: mapAnnotationItems,
            validity: annotationStates,
            selectedId: editingAnnotations ? selectedAnnotationId : null,
            onSelect: editingAnnotations
              ? (id) => {
                  setSelectedAnnotationId(id)
                  if (!id) return
                  setMapDataTab('annotations')
                  setLegendOpen(true)
                }
              : undefined,
            drawing: annotationDrawing?.tool ?? null,
            onDrawn: onAnnotationDrawn,
            onDrawProgress: (points) =>
              setAnnotationDrawing((current) => (current && current.points !== points ? { ...current, points } : current)),
            onDrawCancel: () => setAnnotationDrawing(null),
            editing: editingAnnotation,
            onEdited: onAnnotationEdited,
          }}
          onHandle={onMapHandle}
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
            styleUrl={mapStyle.url}
            flat={mapStyle.dimension === '2d'}
            controlsClassName={styles.comparisonControls}
            cameraLink={mapsLinked ? cameraLink : undefined}
            flyToScene={false}
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
          <div className={`${styles.titleRow}${pagesNav ? ` ${styles.titleRowPages}` : ''}`}>
            <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Back to home">
              <ArrowLeft size={20} weight="regular" aria-hidden />
            </button>
            <div className={styles.titleGroup}>
              <div className={styles.storyTitleRow}>
                <h1 className={styles.storyTitle}>{storyTitle}</h1>
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
                      aria-expanded={infoOpen}
                      aria-describedby={infoOpen ? 'slide-description' : undefined}
                      onClick={() => setInfoOpen((open) => !open)}
                    >
                      <Info size={18} weight="regular" aria-hidden />
                    </button>
                  )}
                </div>
              )}
              {storyMode === 'view' && infoOpen ? (
                <div id="slide-description" className={styles.infoPopover} role="tooltip">
                  {slide.finding || 'No description added.'}
                </div>
              ) : null}
            </div>
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
            <>
              {viewLayout === 'comparison' ? (
                <button
                  type="button"
                  className={`${styles.filterAddBtn} ${styles.insightToggle}${comparisonInsightOpen ? ` ${styles.filterAddBtnActive}` : ''}`}
                  aria-expanded={comparisonInsightOpen}
                  aria-controls="story-insight"
                  onClick={() => setComparisonInsightOpen((open) => !open)}
                >
                  <Sidebar size={16} weight="regular" aria-hidden />
                  {comparisonInsightOpen ? 'Hide insights' : 'Show insights'}
                </button>
              ) : null}
              {viewLayout !== 'comparison' || comparisonInsightOpen ? (
                <aside
                  id="story-insight"
                  className={[
                    styles.insight,
                    viewLayout === 'comparison' ? styles.insightBelowToggle : '',
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
              ) : null}
            </>
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
            mapStyleId={mapStyle.id}
            mapDimension={mapStyle.dimension}
            background={background}
            onBackgroundChange={(next) => {
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

        {storyMode === 'edit' && viewLayout === 'grid' ? (
          <ColumnsControl
            label="Grid width"
            options={GRID_COLUMN_OPTIONS}
            value={gridColumns}
            onChange={(columns) => setGridColumnsBySlide((current) => ({ ...current, [slide.id]: columns }))}
          />
        ) : null}
        {storyMode === 'edit' && viewLayout === 'sidebar' ? (
          <ColumnsControl
            label="Sidebar width"
            options={SIDEBAR_COLUMN_OPTIONS}
            value={sidebarColumns}
            onChange={(columns) => setSidebarColumnsBySlide((current) => ({ ...current, [slide.id]: columns }))}
          />
        ) : null}

        {viewLayout === 'comparison' ? (
          <>
            <div className={`${styles.mapStack} ${styles.mapStackComparisonUpper}`}>
              {linkMapsToggle}
              {timeSeries}
              {comparisonMapData('upper', scene.legend, layers, toggleLayer)}
            </div>
            <div className={styles.mapStack}>
              {mapsLinked ? null : lowerTimeSeries}
              {comparisonMapData('lower', comparisonScene.legend, comparison.layers, toggleComparisonLayer)}
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
                    onStartDrawing={startAnnotationDrawing}
                    onFinishDrawing={() => mapHandleRef.current?.finishDrawing()}
                    onUndoDrawing={() => mapHandleRef.current?.undoDrawing()}
                    onCancelDrawing={() => setAnnotationDrawing(null)}
                    onSelect={setSelectedAnnotationId}
                    onChange={updateAnnotation}
                    onDelete={(id) => {
                      setMapAnnotations((items) => items.filter((item) => item.id !== id))
                      setSelectedAnnotationId(null)
                      if (editingAnnotationId === id) setAnnotationEditing(null)
                    }}
                    onEdit={editAnnotationShape}
                    onFinishEditing={() => setAnnotationEditing(null)}
                    onCancelEditing={cancelAnnotationEditing}
                    onReorder={reorderAnnotations}
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

        <div className={styles.lowerNav} aria-label="Story navigation">
          {!agentOpen && onAsk ? (
            <button
              type="button"
              className={styles.askBtn}
              aria-label="Ask about this story"
              onClick={(event) => {
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
          ) : null}

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

          <div
            className={`${styles.modeSwitch}${storyMode === 'edit' ? ` ${styles.modeSwitchEdit}` : ''}`}
            role="group"
            aria-label="Story mode"
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
                setInfoOpen(false)
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
                setInfoOpen(false)
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
                    className={`${styles.modeAction}${editSection === 'assets' ? ` ${styles.modeActionActive}` : ''}`}
                    onClick={() => toggleSection('assets')}
                  >
                    <Plus size={18} weight="bold" aria-hidden />
                    Assets
                  </button>
                  <button
                    type="button"
                    className={`${styles.modeAction}${editSection === 'tools' ? ` ${styles.modeActionActive}` : ''}`}
                    onClick={() => toggleSection('tools')}
                  >
                    <Toolbox size={18} weight="regular" aria-hidden />
                    Tools
                  </button>
                  <button
                    ref={layoutMenuRef}
                    type="button"
                    className={`${styles.modeAction}${layoutMenuOpen ? ` ${styles.modeActionActive}` : ''}`}
                    aria-label="Layout"
                    aria-haspopup="menu"
                    aria-expanded={layoutMenuOpen}
                    aria-controls="story-layout-menu"
                    onClick={toggleLayoutMenu}
                  >
                    <Layout size={18} weight="regular" aria-hidden />
                    Layout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
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
                    if (option.id === 'comparison') setComparisonPickerOpen(true)
                    else setLayoutBySlide((current) => ({ ...current, [slide.id]: option.id }))
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
    {comparisonPickerOpen ? (
      <StoryComparisonModal
        options={comparisonMapOptions}
        initialOptionId={comparison.option.id}
        framePhase={framePhase}
        styleUrl={mapStyle.url}
        flat={mapStyle.dimension === '2d'}
        onClose={() => setComparisonPickerOpen(false)}
        onApply={(option) => {
          setComparisonBySlide((current) => ({
            ...current,
            [slide.id]: {
              option,
              layers: option.layers,
              filters: lowerFiltersFor(option),
              timeline: mapsLinked ? undefined : (current[slide.id]?.timeline ?? { ...timeline }),
              charts: current[slide.id]?.charts,
            },
          }))
          setLayoutBySlide((current) => ({ ...current, [slide.id]: 'comparison' }))
          setComparisonLegendOpen({ upper: false, lower: false })
          setComparisonPickerOpen(false)
        }}
      />
    ) : null}
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
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                updateCard(openCardMenu.cardId, { hidden: !openCardPrefs.hidden })
                setCardMenu(null)
              }}
            >
              <IdentificationCard size={16} weight="regular" aria-hidden />
              {openCardPrefs.hidden ? 'Show Card' : 'Hide Card'}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                updateCard(openCardMenu.cardId, { border: !openCardPrefs.border })
                setCardMenu(null)
              }}
            >
              <BoundingBox size={16} weight="regular" aria-hidden />
              {openCardPrefs.border ? 'Hide Border' : 'Show Border'}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                updateCard(openCardMenu.cardId, { outline: !openCardPrefs.outline })
                setCardMenu(null)
              }}
            >
              <Selection size={16} weight="regular" aria-hidden />
              {openCardPrefs.outline ? 'Hide Outline' : 'Show Outline'}
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
              Delete
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
      ) : openCardConfig ? (
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
      {selectMode ? (
        <StorySelectLayer
          rootRef={rootRef}
          onExit={exitSelectMode}
          suggestPrompt={suggestSelectionPrompt}
          describeArea={describeArea}
          onSubmit={submitSelection}
        />
      ) : (
        aiModeBar
      )}
      <ShareModal
        open={shareOpen}
        title={`Share “${storyTitle}”`}
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
