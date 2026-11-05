/**
 * A real-estate story over the night Dubai map, built from the landing story's own parts: its header,
 * page pills, filters, insight cards with their hover actions, Map Data, edit mode and modals. The
 * map lights the page's towers; clicking one opens its details panel from the right.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  CalendarBlank,
  CaretDown,
  ChatCircleText,
  Check,
  Compass,
  Copy,
  DotsSixVertical,
  DotsThree,
  DotsThreeVertical,
  Export,
  Eye,
  EyeSlash,
  GearSix,
  GridFour,
  Info,
  Layout,
  List,
  MapPin,
  MapTrifold,
  Pause,
  PencilSimple,
  Play,
  Plus,
  Pulse,
  Sidebar,
  SquaresFour,
  Toolbox,
  Trash,
} from '@phosphor-icons/react'
import { llumenAssets } from '../assets'
import { ShareModal } from '../ShareModal'
import type { WorkflowProposal } from '../assistantReplyTypes'
import { useAnchoredTooltip } from '../landing/useAnchoredTooltip'
import { StoryBackgroundLayer } from '../story/StoryBackgroundLayer'
import { BackgroundSettings } from '../story/StoryBackgroundSettings'
import {
  StoryEditPanel,
  type StoryEditChart,
  type StoryEditSection,
  type StoryPresentationSettings,
} from '../story/StoryEditPanel'
import { StoryLayerConfigModal } from '../story/StoryLayerConfigModal'
import { STORY_CAMERA_PADDING, type StoryMapView } from '../story/StoryMap'
import { StoryMonitorModal } from '../story/StoryMonitorModal'
import { StorySummaryConfigModal } from '../story/StorySummaryConfigModal'
import { BASEMAP_DIMENSIONS, type BackgroundBasemap, type StoryBackground } from '../story/storyBackground'
import type { ChatComponent } from '../story/storyChartPeriod'
import type { StoryFilter, StorySlide } from '../story/storyDemoData'
import { defaultMonitorConfig, monitorPrompt, monitorWorkflowProposal, type MonitorConfig } from '../story/storyMonitor'
import { SUMMARY_REGENERATE_MS, defaultSummaryConfig, gradientVars, type SummaryConfig } from '../story/storySummary'
import gradientStyles from '../story/storyGradientBorder.module.css'
import styles from '../story/StoryView.module.css'
import { EstateBuildingPanel } from './EstateBuildingPanel'
import { EstateCardBody } from './EstateCharts'
import { EstateMap, type EstateMapFocus, type EstateMapHandle } from './EstateMap'
import { cardClass, cardFootprint } from './estateCardLayout'
import { ESTATE_MAP_STYLE } from './estateMapLayers'
import { ESTATE_BUILDINGS, ESTATE_STORIES, isBuildingId } from './estateScenario'
import type { BuildingId, EstateCard, EstatePage, MapDataLayer } from './estateTypes'
import cardCss from './EstateCards.module.css'
import css from './EstateStory.module.css'

export type EstateAskContext = { storyId: string; title: string; pageTitle: string; sourceRect: DOMRect }

type Props = {
  storyId: string
  onBack: (from?: StoryMapView) => void
  onAsk?: (context: EstateAskContext) => void
  agentOpen?: boolean
  onCloseAsk?: () => void
  /** Shows "Add to chat" in a hovered card's toolbar; `sourceRect` is the clicked button. */
  onAddToChat?: (component: ChatComponent, sourceRect: DOMRect) => void
  /** A card's "Monitor this" form was confirmed; `prompt` is the request the workflow answers. */
  onMonitorConfirm?: (proposal: WorkflowProposal, prompt: string) => void
  entrance?: 'wait' | 'play' | 'leave' | 'gone'
  mapHidden?: boolean
  onMapReady?: (stage: 'loaded' | 'painted') => void
  onSlideIndexChange?: (index: number) => void
}

const NO_GROUPS: ReadonlySet<string> = new Set()

/** The Assets picker's categories for each chart kind. */
const CHART_CATEGORY: Record<EstateCard['kind'], string> = {
  summary: 'Trends',
  section: 'Distribution',
  note: 'Distribution',
  specs: 'Distribution',
  line: 'Trends',
  progress: 'Comparison',
  vbars: 'Comparison',
  hbars: 'Comparison',
  grouped: 'Comparison',
  kpis: 'Distribution',
  cell: 'Distribution',
  split: 'Distribution',
  donut: 'Distribution',
  table: 'Distribution',
}
const CHAPTER = 'estate'
const FILTER_IDS = ['loc', 'year', 'domain']
const SIDEBAR_COLUMN_OPTIONS = [2, 3, 4] as const
type SidebarColumns = (typeof SIDEBAR_COLUMN_OPTIONS)[number]
const EMPTY_GRID_ROWS = 3
const MENU_WIDTH = 200
const CARD_MENU_HEIGHT = 136
const SMALL_MENU_HEIGHT = 88
/** Matches `.infoPopover`'s width. */
const INFO_POPOVER_W = 340
const SUMMARY_SEEDED_AGO_MS = 12 * 60_000
const DIVE_ZOOM = 16.45
const DIVE_PITCH = 56
const DIVE_MS = 2600
const SUMMARY_TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** Width of a card's hover toolbar with `buttons` icons; the summary pill slides left by it. */
const cardActionsWidth = (buttons: number) => buttons * 26 + (buttons - 1) * 2 + 6

/** Keep in step with `EstateStory.module.css` `--estate-panel-w`: the panel's width, the 24px it sits in from the edge, and a gap. */
function panelInset() {
  return Math.min(1200, Math.max(720, window.innerWidth - 640)) + 48
}

/** Dive: the tower close up in the room the cards leave, its base low enough that the top stays in view. */
function diveFocus(id: BuildingId): EstateMapFocus {
  return {
    id,
    padding: { top: Math.round(window.innerHeight * 0.5), right: panelInset(), bottom: 0, left: 24 },
    zoom: DIVE_ZOOM,
    pitch: DIVE_PITCH,
    duration: DIVE_MS,
  }
}

const BUILDING_BY_NAME = new Map(Object.values(ESTATE_BUILDINGS).map((building) => [building.name, building.id]))

function toSlide(page: EstatePage): StorySlide {
  return {
    id: page.id,
    chapterId: CHAPTER,
    title: page.title,
    finding: page.finding,
    body: '',
    layout: 'sidebar',
    focusLayout: false,
    sidebarWidth: 'large',
    aqi: 0,
    aqiLabel: '',
    pollutants: [],
  }
}

function toFilters(page: EstatePage): StoryFilter[] {
  return page.filters.map((label, index) => ({ id: FILTER_IDS[index] ?? `filter-${index}`, label }))
}

function filterIcon(id: string) {
  if (id === 'loc') return <MapPin size={18} weight="regular" aria-hidden />
  if (id === 'year') return <CalendarBlank size={18} weight="regular" aria-hidden />
  return <SquaresFour size={18} weight="regular" aria-hidden />
}

function makePresentationSettings(): StoryPresentationSettings {
  return { darkLogoName: '', lightLogoName: '', textDirection: 'ltr', autoplay: false, multiSlide: true, pagesMode: true }
}

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
        aria-controls={menu?.open ? 'estate-card-menu' : undefined}
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

/** The mark a legend row ends with: a lit tower, or the heat swatch. */
function LegendGlyph({ layer, color }: { layer: MapDataLayer; color: string }) {
  if (layer.mark === 'tower') return <i className={css.towerGlyph} style={{ background: color }} aria-hidden />
  return <i className={css.heatGlyph} style={{ background: `${color}66` }} aria-hidden />
}

type MenuAt = { top: number; left: number }

/** Below the button, or above it when the menu would run off the bottom. */
function menuAt(button: HTMLElement, height: number, alignRight = false): MenuAt {
  const rect = button.getBoundingClientRect()
  const below = rect.bottom + 6
  return {
    top: below + height > window.innerHeight - 8 ? Math.max(8, rect.top - 6 - height) : below,
    left: Math.max(8, Math.min(alignRight ? rect.right - MENU_WIDTH : rect.left, window.innerWidth - MENU_WIDTH - 8)),
  }
}

/** Closes a portalled menu on a pointerdown outside it and its trigger, or on Escape. */
function useDismiss(open: boolean, keep: string, close: () => void) {
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as Element).closest(keep)) return
      closeRef.current()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, keep])
}

/** The tower a card is about, which its Explore opens. */
function cardTower(card: EstateCard): BuildingId | null {
  if (card.id.includes('dreamscape')) return 'dreamscape'
  if (card.id.includes('opera')) return 'opera-crest'
  return null
}

export function EstateStoryView({
  storyId,
  onBack,
  onAsk,
  agentOpen,
  onCloseAsk,
  onAddToChat,
  onMonitorConfirm,
  entrance,
  mapHidden,
  onMapReady,
  onSlideIndexChange,
}: Props) {
  const story = ESTATE_STORIES[storyId]
  const [storyTitle, setStoryTitle] = useState(story.title)
  const [storyDescription, setStoryDescription] = useState(story.description)
  const [presentationSettings, setPresentationSettings] = useState(makePresentationSettings)
  const [autoplaying, setAutoplaying] = useState(false)
  const [slides, setSlides] = useState<StorySlide[]>(() => story.pages.map(toSlide))
  /** The page each slide shows; added and duplicated slides show their source's. */
  const [pageOf, setPageOf] = useState<Record<string, EstatePage>>(() =>
    Object.fromEntries(story.pages.map((page) => [page.id, page])),
  )
  const [filtersBySlide, setFiltersBySlide] = useState<Record<string, StoryFilter[]>>(() =>
    Object.fromEntries(story.pages.map((page) => [page.id, toFilters(page)])),
  )
  const [slideIndex, setSlideIndex] = useState(0)
  const [storyMode, setStoryMode] = useState<'view' | 'edit'>('view')
  const [editSection, setEditSection] = useState<StoryEditSection | null>(null)
  const [directSlideEditor, setDirectSlideEditor] = useState(false)
  const [info, setInfo] = useState<{ kind: 'story' | 'slide'; left: number; top: number } | null>(null)
  const [legendOpen, setLegendOpen] = useState(true)
  const [hidden, setHidden] = useState<ReadonlySet<string>>(NO_GROUPS)
  /** The tower whose details panel is open. */
  const [building, setBuilding] = useState<BuildingId | null>(null)
  const [focus, setFocus] = useState<EstateMapFocus | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [pageRename, setPageRename] = useState<{ slideId: string; title: string } | null>(null)
  const [columnsBySlide, setColumnsBySlide] = useState<Record<string, SidebarColumns>>({})
  const [removedCards, setRemovedCards] = useState<Record<string, string[]>>({})
  const [addedCards, setAddedCards] = useState<Record<string, EstateCard[]>>({})
  const [layerOrder, setLayerOrder] = useState<Record<string, string[]>>({})
  const [layerTitles, setLayerTitles] = useState<Record<string, string>>({})
  const [draggingLayer, setDraggingLayer] = useState<string | null>(null)
  const [summaryConfigs, setSummaryConfigs] = useState<Record<string, SummaryConfig>>({})
  const [summaryUpdatedAt, setSummaryUpdatedAt] = useState<Record<string, number>>({})
  const [storyOpenedAt] = useState(() => Date.now() - SUMMARY_SEEDED_AGO_MS)
  const [regeneratingSlideId, setRegeneratingSlideId] = useState<string | null>(null)
  const [monitorCard, setMonitorCard] = useState<{ key: string; title: string } | null>(null)
  const [monitors, setMonitors] = useState<Record<string, MonitorConfig>>({})
  const [summaryConfigOpen, setSummaryConfigOpen] = useState(false)
  const [layerConfig, setLayerConfig] = useState<{ group: string; title: string } | null>(null)
  const [mapStyle, setMapStyle] = useState<BackgroundBasemap>({
    kind: 'basemap',
    id: 'aimsun-teal',
    url: ESTATE_MAP_STYLE,
    dimension: '3d',
  })
  const [background, setBackground] = useState<StoryBackground>(mapStyle)

  const [storyMenu, setStoryMenu] = useState<MenuAt | null>(null)
  const [slideMenu, setSlideMenu] = useState<MenuAt | null>(null)
  const [layoutMenu, setLayoutMenu] = useState<MenuAt | null>(null)
  const [cardMenu, setCardMenu] = useState<(MenuAt & { card: EstateCard }) | null>(null)
  const [filterMenu, setFilterMenu] = useState<(MenuAt & { filter: StoryFilter }) | null>(null)
  const [layerMenu, setLayerMenu] = useState<(MenuAt & { group: string; title: string }) | null>(null)

  const mapRef = useRef<EstateMapHandle>(null)
  const titleGroupRef = useRef<HTMLDivElement>(null)

  const activeSlideIndex = Math.min(slideIndex, slides.length - 1)
  const slide = slides[activeSlideIndex]
  const page = pageOf[slide.id]
  const filters = filtersBySlide[slide.id] ?? []
  const columns = columnsBySlide[slide.id] ?? 2
  const editing = storyMode === 'edit'
  const removed = removedCards[slide.id]
  const added = addedCards[slide.id]
  const pageCards = page.cards
  const cards = useMemo(
    () => [...pageCards, ...(added ?? [])].filter((card) => !removed?.includes(card.id)),
    [added, pageCards, removed],
  )
  const pickerCharts = useMemo<StoryEditChart[]>(
    () =>
      story.pages.flatMap((source) =>
        source.cards
          .filter((card) => card.kind !== 'summary' && card.kind !== 'section')
          .map((card) => ({
            id: `${source.id}:${card.id}`,
            title: card.title,
            category: CHART_CATEGORY[card.kind],
            preview: <EstateCardBody card={card} />,
          })),
      ),
    [story],
  )
  const addCharts = (ids: string[]) => {
    const picked = story.pages.flatMap((source) =>
      source.cards.filter((card) => ids.includes(`${source.id}:${card.id}`)),
    )
    const pickedIds = new Set(picked.map((card) => card.id))
    setRemovedCards((current) => ({ ...current, [slide.id]: (current[slide.id] ?? []).filter((id) => !pickedIds.has(id)) }))
    const present = new Set([...page.cards, ...(added ?? [])].map((card) => card.id))
    const fresh = picked.filter((card, index) => !present.has(card.id) && picked.findIndex((item) => item.id === card.id) === index)
    if (fresh.length) setAddedCards((current) => ({ ...current, [slide.id]: [...(current[slide.id] ?? []), ...fresh] }))
  }
  const layers = useMemo(() => {
    const order = layerOrder[slide.id]
    if (!order) return page.layers
    return order.flatMap((group) => page.layers.filter((layer) => layer.group === group))
  }, [layerOrder, page, slide.id])
  /** Layers deleted from Map Data leave the map too. */
  const mapHiddenGroups = useMemo(() => {
    const gone = page.layers.filter((layer) => !layers.includes(layer)).map((layer) => layer.group)
    return gone.length ? new Set([...hidden, ...gone]) : hidden
  }, [hidden, layers, page.layers])
  const summaryConfig = summaryConfigs[slide.id] ?? defaultSummaryConfig(slide.id)
  const summaryRegenerating = regeneratingSlideId === slide.id
  const canAddToChat = Boolean(onAddToChat)
  const pagesMode = presentationSettings.multiSlide && presentationSettings.pagesMode
  const slidesConfigOpen = editSection === 'slide' && !directSlideEditor
  const flat = mapStyle.dimension === '2d'

  useEffect(() => {
    onSlideIndexChange?.(activeSlideIndex)
  }, [onSlideIndexChange, activeSlideIndex])

  useEffect(() => {
    if (!info) return
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest('[data-estate-info]')) setInfo(null)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [info])

  useEffect(() => {
    if (!regeneratingSlideId) return
    const timer = window.setTimeout(() => {
      setSummaryUpdatedAt((current) => ({ ...current, [regeneratingSlideId]: Date.now() }))
      setRegeneratingSlideId(null)
    }, SUMMARY_REGENERATE_MS)
    return () => window.clearTimeout(timer)
  }, [regeneratingSlideId])

  useEffect(() => {
    if (!autoplaying || !presentationSettings.autoplay || pagesMode || !presentationSettings.multiSlide) return
    const timer = window.setInterval(() => setSlideIndex((index) => (index + 1) % slides.length), 4000)
    return () => window.clearInterval(timer)
  }, [autoplaying, pagesMode, presentationSettings.autoplay, presentationSettings.multiSlide, slides.length])

  useDismiss(Boolean(storyMenu), '#estate-story-menu, [data-story-menu-trigger]', () => setStoryMenu(null))
  useDismiss(Boolean(slideMenu), '#estate-slide-menu, [data-slide-menu-trigger]', () => setSlideMenu(null))
  useDismiss(Boolean(layoutMenu), '#estate-layout-menu, [data-layout-menu-trigger]', () => setLayoutMenu(null))
  useDismiss(Boolean(cardMenu), '#estate-card-menu, [data-card-menu-trigger]', () => setCardMenu(null))
  useDismiss(Boolean(filterMenu), '#estate-filter-menu, [data-filter-menu-trigger]', () => setFilterMenu(null))
  useDismiss(Boolean(layerMenu), '#estate-layer-menu, [data-layer-menu-trigger]', () => setLayerMenu(null))

  const closeMenus = () => {
    setStoryMenu(null)
    setSlideMenu(null)
    setLayoutMenu(null)
    setCardMenu(null)
    setFilterMenu(null)
    setLayerMenu(null)
  }

  /**
   * Dives into a tower: its details open on the right in place of an open edit panel, the cards and Map
   * Data step aside, and the map closes in on it in the room they leave.
   */
  const openBuilding = (id: BuildingId) => {
    setEditSection(null)
    setDirectSlideEditor(false)
    closeMenus()
    setInfo(null)
    setFocus(diveFocus(id))
    setBuilding(id)
  }

  const closeBuilding = () => {
    setFocus(null)
    setBuilding(null)
  }

  const goTo = (index: number) => {
    setSlideIndex(index)
    setInfo(null)
  }

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

  const toggleSection = (section: StoryEditSection) => {
    closeBuilding()
    setDirectSlideEditor(false)
    setEditSection((current) => (current === section ? null : section))
  }

  const toggleGroup = (group: string) =>
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })

  const addSlide = (insertAt = slides.length, title?: string) => {
    const id = `${story.id}-slide-${Date.now()}`
    setSlides((items) => [
      ...items.slice(0, insertAt),
      { ...slide, id, title: title ?? `Untitled slide ${items.length + 1}` },
      ...items.slice(insertAt),
    ])
    setPageOf((current) => ({ ...current, [id]: page }))
    setFiltersBySlide((current) => ({ ...current, [id]: filters.map((filter) => ({ ...filter })) }))
    setSlideIndex(insertAt)
  }

  const duplicateSlide = (slideId = slide.id) => {
    const source = slides.find((item) => item.id === slideId) ?? slide
    const id = `${story.id}-slide-${Date.now()}`
    setSlides((items) => [...items, { ...source, id, title: `${source.title} copy` }])
    setPageOf((current) => ({ ...current, [id]: current[source.id] }))
    setFiltersBySlide((current) => ({
      ...current,
      [id]: (current[source.id] ?? []).map((filter) => ({ ...filter })),
    }))
    setSlideIndex(slides.length)
  }

  const deleteSlide = (slideId: string) => {
    if (slides.length === 1) return
    const deletedIndex = slides.findIndex((item) => item.id === slideId)
    if (deletedIndex === -1) return
    setSlides((items) => items.filter((item) => item.id !== slideId))
    setSlideIndex((current) => (current > deletedIndex ? current - 1 : Math.min(current, slides.length - 2)))
  }

  const commitPageRename = () => {
    if (!pageRename) return
    const title = pageRename.title.trim()
    if (title) setSlides((items) => items.map((item) => (item.id === pageRename.slideId ? { ...item, title } : item)))
    setPageRename(null)
  }

  const removeCard = (cardId: string) =>
    setRemovedCards((current) => ({ ...current, [slide.id]: [...(current[slide.id] ?? []), cardId] }))

  const setLayerGroups = (groups: string[]) => setLayerOrder((current) => ({ ...current, [slide.id]: groups }))
  const moveLayer = (group: string, index: number) => {
    const order = layers.map((layer) => layer.group)
    const rest = order.filter((item) => item !== group)
    const next = [...rest.slice(0, index), group, ...rest.slice(index)]
    if (next.some((item, i) => item !== order[i])) setLayerGroups(next)
  }
  const startLayerDrag = (group: string, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const list = event.currentTarget.closest<HTMLElement>('[data-map-layers]')
    if (!list) return
    event.preventDefault()
    setDraggingLayer(group)
    setLayerMenu(null)
    const onMove = (move: PointerEvent) => {
      const others = [...list.querySelectorAll<HTMLElement>('[data-map-layer]')].filter(
        (item) => item.dataset.mapLayer !== group,
      )
      moveLayer(
        group,
        others.filter((item) => {
          const rect = item.getBoundingClientRect()
          return move.clientY > rect.top + rect.height / 2
        }).length,
      )
    }
    const onEnd = () => {
      setDraggingLayer(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
  }
  const layerTitle = (layer: MapDataLayer) => layerTitles[`${slide.id}:${layer.group}`] ?? layer.title

  const setDimension = (dimension: '2d' | '3d') => {
    setMapStyle((current) => ({ ...current, dimension }))
    setBackground((current) => (current.kind === 'basemap' ? { ...current, dimension } : current))
  }

  /* —— Cards —— */

  const summaryStatusStyle = { '--actions-w': `${cardActionsWidth(canAddToChat ? 2 : 1)}px` } as CSSProperties
  const summaryUpdated = (
    <span className={styles.summaryUpdated} data-busy={summaryRegenerating || undefined} role="status">
      {summaryRegenerating ? <ArrowsClockwise size={12} className={styles.summaryStatusIcon} aria-hidden /> : null}
      {summaryRegenerating
        ? 'Updating…'
        : `Last updated ${SUMMARY_TIME.format(summaryUpdatedAt[slide.id] ?? storyOpenedAt)}`}
    </span>
  )

  const insightCard = (card: EstateCard) => {
    if (card.kind === 'section')
      return (
        <header key={card.id} className={cardClass(card)}>
          <EstateCardBody card={card} />
        </header>
      )
    const summary = card.kind === 'summary'
    const menuOpen = cardMenu?.card.id === card.id
    const style = summary
      ? ({ ...gradientVars(summaryConfig.gradient), '--summary-accent': summaryConfig.accent } as CSSProperties)
      : undefined
    return (
      <section
        key={card.id}
        className={[cardClass(card), summary ? gradientStyles.gradientBorder : '', styles.insightCard].filter(Boolean).join(' ')}
        style={style}
      >
        <EstateCardBody
          card={card}
          summaryStatus={summary ? summaryUpdated : undefined}
          summaryTyping={summary && summaryRegenerating}
        />
        {summary && editing ? (
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
        ) : null}
        <div
          className={`${styles.cardActions}${menuOpen ? ` ${styles.cardActionsOpen}` : ''}`}
          role="toolbar"
          aria-label={`${card.title} actions`}
        >
          {canAddToChat ? (
            <CardActionButton
              label="Add to chat"
              ariaLabel={`Add ${card.title} to chat`}
              onClick={(button) => {
                onAddToChat?.(
                  { id: `${slide.id}-${card.id}`, label: card.title } as unknown as ChatComponent,
                  button.getBoundingClientRect(),
                )
                button.blur()
              }}
            >
              <ChatCircleText size={16} aria-hidden />
            </CardActionButton>
          ) : null}
          {summary ? null : (
            <CardActionButton
              label="Monitor this"
              ariaLabel={`Monitor ${card.title}`}
              onClick={() => {
                setCardMenu(null)
                setMonitorCard({ key: `${slide.id}:${card.id}`, title: card.title })
              }}
            >
              <Pulse size={16} weight="regular" aria-hidden />
            </CardActionButton>
          )}
          <CardActionButton
            label="More options"
            ariaLabel={`More options for ${card.title}`}
            active={menuOpen}
            menu={{ open: menuOpen }}
            onClick={(button) => {
              if (menuOpen) return setCardMenu(null)
              closeMenus()
              setCardMenu({ card, ...menuAt(button, CARD_MENU_HEIGHT) })
            }}
          >
            <DotsThreeVertical size={16} weight="bold" aria-hidden />
          </CardActionButton>
        </div>
      </section>
    )
  }

  const usedCells = cards.reduce((sum, card) => sum + cardFootprint(card, columns), 0)
  const emptyCells = editing ? (Math.ceil(usedCells / columns) + EMPTY_GRID_ROWS) * columns - usedCells : 0

  /* —— Header —— */

  const pagesNav = pagesMode ? (
    <nav className={styles.pages} aria-label="Story pages">
      {slides.map((item, index) => {
        const active = index === activeSlideIndex
        const pillClass = `${styles.pagePill}${active ? ` ${styles.pagePillActive}` : ''}`
        if (pageRename?.slideId === item.id) {
          return (
            <span key={item.id} className={pillClass}>
              <input
                className={styles.pageRenameInput}
                aria-label="Page name"
                value={pageRename.title}
                size={Math.max(pageRename.title.length, 6)}
                autoFocus
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setPageRename({ slideId: item.id, title: event.target.value })}
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
          <span key={item.id} className={pillClass}>
            <button
              type="button"
              className={styles.pageSelect}
              aria-current={active ? 'page' : undefined}
              onClick={() => goTo(index)}
            >
              {item.title}
            </button>
            {editing ? (
              <button
                type="button"
                className={`${styles.slideMenuBtn} ${styles.pageMenuBtn}${active && slideMenu ? ` ${styles.slideMenuBtnOpen}` : ''}`}
                aria-label={`${item.title} actions`}
                aria-haspopup="menu"
                aria-expanded={active && Boolean(slideMenu)}
                data-slide-menu-trigger
                onClick={(event) => {
                  if (active && slideMenu) return setSlideMenu(null)
                  closeMenus()
                  setSlideIndex(index)
                  setSlideMenu(menuAt(event.currentTarget, 176))
                }}
              >
                <DotsThreeVertical size={14} weight="bold" aria-hidden />
              </button>
            ) : null}
          </span>
        )
      })}
      {editing ? (
        <button type="button" className={styles.pageAddBtn} onClick={() => addSlide(slides.length, `Page ${slides.length + 1}`)}>
          <Plus size={16} weight="bold" aria-hidden />
          Add Page
        </button>
      ) : (
        <button
          type="button"
          className={styles.infoBtn}
          aria-label="Show page description"
          aria-expanded={info?.kind === 'slide'}
          data-estate-info
          onClick={(event) => toggleInfo('slide', event.currentTarget)}
        >
          <Info size={22} weight="regular" aria-hidden />
        </button>
      )}
    </nav>
  ) : null

  const filterRow = (
    <div className={styles.filters}>
      {editing ? (
        <>
          <button
            type="button"
            className={`${styles.filterAddBtn}${editSection === 'filters' ? ` ${styles.filterAddBtnActive}` : ''}`}
            aria-pressed={editSection === 'filters'}
            onClick={() => toggleSection('filters')}
          >
            <Plus size={16} weight="bold" aria-hidden />
            Filters
          </button>
          {filters.length > 0 ? <span className={styles.filterDivider} aria-hidden /> : null}
        </>
      ) : null}
      {filters.map((filter) => (
        <span key={filter.id} className={`${styles.filterPill}${editing ? ` ${styles.filterPillEditing}` : ''}`}>
          {filterIcon(filter.id)}
          <span>{filter.label}</span>
          {editing ? (
            <>
              <CaretDown className={styles.filterCaret} size={14} weight="bold" aria-hidden />
              <button
                type="button"
                className={`${styles.filterMenuBtn}${filterMenu?.filter.id === filter.id ? ` ${styles.filterMenuBtnOpen}` : ''}`}
                data-filter-menu-trigger
                aria-label={`${filter.label} filter options`}
                aria-haspopup="menu"
                aria-expanded={filterMenu?.filter.id === filter.id}
                onClick={(event) => {
                  if (filterMenu?.filter.id === filter.id) return setFilterMenu(null)
                  closeMenus()
                  setFilterMenu({ filter, ...menuAt(event.currentTarget, SMALL_MENU_HEIGHT) })
                }}
              >
                <DotsThreeVertical size={16} weight="bold" aria-hidden />
              </button>
            </>
          ) : null}
        </span>
      ))}
    </div>
  )

  /* —— Map Data —— */

  const layerAttrs = (layer: MapDataLayer) => (
    <div className={styles.mapLayerAttrs}>
      <div className={styles.mapLayerAttr}>
        <p className={styles.mapLayerAttrLabel}>Color</p>
        {'ramp' in layer.color ? (
          <div className={styles.legendScale}>
            <span>{layer.color.low ?? 'Low'}</span>
            <span
              className={styles.colorRamp}
              style={{ backgroundImage: `linear-gradient(to right, ${layer.color.ramp.join(', ')})` }}
              aria-hidden
            />
            <span>{layer.color.high ?? 'High'}</span>
          </div>
        ) : (
          layer.color.items.map((item) => (
            <div key={item.label} className={styles.legendRow}>
              {layer.mark === 'tower' && BUILDING_BY_NAME.has(item.label) ? (
                <button
                  type="button"
                  className={`${styles.legendMark} ${css.legendLabel} ${css.legendButton}`}
                  aria-label={`Open ${item.label} details`}
                  onClick={() => openBuilding(BUILDING_BY_NAME.get(item.label)!)}
                >
                  {item.label}
                </button>
              ) : (
                <span className={`${styles.legendMark} ${css.legendLabel}`}>{item.label}</span>
              )}
              <span className={styles.legendMark}>
                {item.count ? <span className={styles.legendCount}>{item.count}</span> : null}
                <LegendGlyph layer={layer} color={item.color} />
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )

  const mapLayers = (
    <>
      <div className={`${styles.mapLayers} ${css.mapLayers}`} data-map-layers>
        {layers.length === 0 ? <p className={styles.mapLayersEmpty}>No map layers</p> : null}
        {layers.map((layer, index) => {
          const title = layerTitle(layer)
          const off = hidden.has(layer.group)
          const menuOpen = layerMenu?.group === layer.group
          return (
            <section
              key={layer.group}
              className={`${styles.mapLayer}${draggingLayer === layer.group ? ` ${styles.mapLayerDragging}` : ''}`}
              data-map-layer={layer.group}
            >
              <div className={styles.mapLayerHead}>
                {editing ? (
                  <button
                    type="button"
                    className={styles.mapLayerGrip}
                    aria-label={`Reorder ${title}`}
                    onPointerDown={(event) => startLayerDrag(layer.group, event)}
                    onKeyDown={(event) => {
                      const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
                      if (!step) return
                      event.preventDefault()
                      moveLayer(layer.group, Math.max(0, Math.min(layers.length - 1, index + step)))
                    }}
                  >
                    <DotsSixVertical size={16} weight="bold" aria-hidden />
                  </button>
                ) : null}
                <p className={styles.mapLayerTitle}>{title}</p>
                <span className={styles.legendActions}>
                  <button
                    type="button"
                    className={`${styles.legendIconBtn}${off ? ` ${styles.legendIconOff}` : ''}`}
                    aria-label={`Toggle ${title}`}
                    aria-pressed={!off}
                    onClick={() => toggleGroup(layer.group)}
                  >
                    {off ? <EyeSlash size={16} weight="regular" aria-hidden /> : <Eye size={16} weight="regular" aria-hidden />}
                  </button>
                  {editing ? (
                    <button
                      type="button"
                      className={`${styles.legendIconBtn}${menuOpen ? ` ${styles.legendIconBtnOpen}` : ''}`}
                      aria-label={`More options for ${title}`}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      data-layer-menu-trigger
                      onClick={(event) => {
                        if (menuOpen) return setLayerMenu(null)
                        closeMenus()
                        setLayerMenu({ group: layer.group, title, ...menuAt(event.currentTarget, SMALL_MENU_HEIGHT, true) })
                      }}
                    >
                      <DotsThree size={16} weight="bold" aria-hidden />
                    </button>
                  ) : null}
                </span>
              </div>
              {layerAttrs(layer)}
            </section>
          )
        })}
      </div>
      {editing ? (
        <div className={styles.mapDataFooter}>
          <button
            type="button"
            className={`${styles.addMapLayerBtn}${editSection === 'layers' ? ` ${styles.addMapLayerBtnActive}` : ''}`}
            aria-pressed={editSection === 'layers'}
            onClick={() => toggleSection('layers')}
          >
            <Plus size={16} weight="bold" aria-hidden />
            Map layer
          </button>
        </div>
      ) : null}
    </>
  )

  const backgroundTitle =
    background.kind === 'basemap'
      ? 'Map Data'
      : background.kind === 'color'
        ? 'Color Background'
        : background.mediaType === 'video'
          ? 'Video Background'
          : 'Image Background'

  const mapData =
    background.kind === 'basemap' || editing ? (
      <div className={styles.mapData}>
        {editing ? (
          <div className={`${styles.mapDataHeader} ${styles.mapDataHeaderEdit}`}>
            <span>{backgroundTitle}</span>
            <button
              type="button"
              className={`${styles.mapDataBackgroundBtn}${editSection === 'map' ? ` ${styles.mapDataBackgroundBtnActive}` : ''}`}
              aria-pressed={editSection === 'map'}
              onClick={() => toggleSection('map')}
            >
              <MapTrifold size={16} weight="regular" aria-hidden />
              Background
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.mapDataHeader}
            onClick={() => setLegendOpen((open) => !open)}
            aria-expanded={legendOpen}
          >
            <span>Map Data</span>
            <CaretDown size={18} weight="regular" className={legendOpen ? undefined : styles.caretClosed} aria-hidden />
          </button>
        )}
        {background.kind !== 'basemap' ? (
          <BackgroundSettings background={background} onChange={setBackground} onReplace={() => toggleSection('map')} />
        ) : legendOpen || editing ? (
          <>
            {editing ? (
              <div className={styles.mapDataProjection}>
                <span>Projection</span>
                <div className={styles.mapDataProjectionControl} role="radiogroup" aria-label="Map projection">
                  {BASEMAP_DIMENSIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={mapStyle.dimension === item.id}
                      className={`${styles.mapDataProjectionBtn}${
                        mapStyle.dimension === item.id ? ` ${styles.mapDataProjectionBtnActive}` : ''
                      }`}
                      onClick={() => setDimension(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {mapLayers}
          </>
        ) : null}
      </div>
    ) : null

  /* —— Toolbar —— */

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
        onAsk({ storyId, title: storyTitle, pageTitle: slide.title, sourceRect: event.currentTarget.getBoundingClientRect() })
      }}
    >
      <img className={styles.askIcon} src={llumenAssets.launcherOrb} alt="" width={24} height={24} />
    </button>
  ) : null

  const modeSwitch = (
    <div className={`${styles.modeSwitch}${editing ? ` ${styles.modeSwitchEdit}` : ''}`} role="group" aria-label="Story mode">
      <button
        type="button"
        className={`${styles.modeBtn}${editing ? '' : ` ${styles.modeBtnActive}`}`}
        aria-label="View mode"
        aria-pressed={!editing}
        onClick={() => {
          setStoryMode('view')
          setDirectSlideEditor(false)
          setEditSection(null)
          setPageRename(null)
          closeMenus()
          setInfo(null)
        }}
      >
        <Eye size={20} weight="regular" aria-hidden />
      </button>
      <button
        type="button"
        className={`${styles.modeBtn}${editing ? ` ${styles.modeBtnActive}` : ''}`}
        aria-label="Edit mode"
        aria-pressed={editing}
        onClick={() => {
          setStoryMode('edit')
          setInfo(null)
        }}
      >
        <PencilSimple size={20} weight="regular" aria-hidden />
      </button>
      <div className={styles.modeActions} aria-hidden={!editing} inert={!editing}>
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
          </div>
        </div>
      </div>
    </div>
  )

  const canPrev = activeSlideIndex > 0
  const canNext = activeSlideIndex < slides.length - 1

  return (
    <div
      className={`${styles.root} ${css.root}`}
      style={{ '--sidebar-columns': columns } as CSSProperties}
      aria-label={`${storyTitle} story`}
      data-entrance={entrance}
      data-map-hidden={mapHidden || undefined}
      data-dive={building ? true : undefined}
      inert={entrance === 'leave' || entrance === 'gone'}
    >
      <div className={styles.mapPane}>
        <EstateMap
          camera={page.camera}
          scene={page.scene}
          hidden={mapHiddenGroups}
          padding={STORY_CAMERA_PADDING}
          flat={flat}
          styleUrl={mapStyle.url}
          focus={focus}
          onTowerClick={(id) => {
            if (isBuildingId(id)) openBuilding(id)
          }}
          onReady={onMapReady}
          handleRef={mapRef}
        />
      </div>
      {background.kind !== 'basemap' ? (
        <StoryBackgroundLayer
          background={background}
          onDuration={(duration) =>
            setBackground((current) =>
              current.kind === 'media' && current.duration !== duration ? { ...current, duration } : current,
            )
          }
        />
      ) : null}

      <div className={styles.overlay}>
        <header className={styles.header} dir={presentationSettings.textDirection}>
          <div className={styles.titleRow}>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => onBack(mapRef.current?.view())}
              aria-label="Back to home"
            >
              <ArrowLeft size={20} weight="regular" aria-hidden />
            </button>
            <div ref={titleGroupRef} className={styles.titleGroup}>
              <div className={styles.storyTitleRow}>
                <h1 className={styles.storyTitle}>{storyTitle}</h1>
                {editing ? (
                  <button
                    type="button"
                    className={`${styles.storyMenuBtn}${storyMenu ? ` ${styles.storyMenuBtnOpen}` : ''}`}
                    aria-label="Story actions"
                    aria-haspopup="menu"
                    aria-expanded={Boolean(storyMenu)}
                    data-story-menu-trigger
                    onClick={(event) => {
                      if (storyMenu) return setStoryMenu(null)
                      closeMenus()
                      setStoryMenu(menuAt(event.currentTarget, 132))
                    }}
                  >
                    <DotsThreeVertical size={16} weight="bold" aria-hidden />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`${styles.infoBtn} ${styles.infoBtnSmall}`}
                      aria-label="Show story description"
                      aria-expanded={info?.kind === 'story'}
                      data-estate-info
                      onClick={(event) => toggleInfo('story', event.currentTarget)}
                    >
                      <Info size={22} weight="regular" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={`${styles.infoBtn} ${styles.infoBtnSmall}`}
                      aria-label="Share story"
                      aria-haspopup="dialog"
                      onClick={() => setShareOpen(true)}
                    >
                      <Export size={22} weight="regular" aria-hidden />
                    </button>
                  </>
                )}
              </div>
              {pagesNav ?? (
                <div className={styles.slideTitleRow}>
                  <h2 className={styles.slideTitle}>{slide.title}</h2>
                  {editing ? (
                    <button
                      type="button"
                      className={`${styles.slideMenuBtn}${slideMenu ? ` ${styles.slideMenuBtnOpen}` : ''}`}
                      aria-label="Slide actions"
                      aria-haspopup="menu"
                      aria-expanded={Boolean(slideMenu)}
                      data-slide-menu-trigger
                      onClick={(event) => {
                        if (slideMenu) return setSlideMenu(null)
                        closeMenus()
                        setSlideMenu(menuAt(event.currentTarget, 132))
                      }}
                    >
                      <DotsThreeVertical size={16} weight="bold" aria-hidden />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.infoBtn}
                      aria-label="Show slide description"
                      aria-expanded={info?.kind === 'slide'}
                      data-estate-info
                      onClick={(event) => toggleInfo('slide', event.currentTarget)}
                    >
                      <Info size={22} weight="regular" aria-hidden />
                    </button>
                  )}
                </div>
              )}
              {!editing && info ? (
                <div className={styles.infoPopover} style={{ left: info.left, top: info.top }} role="tooltip" data-estate-info>
                  {(info.kind === 'story' ? storyDescription : slide.finding) || 'No description added.'}
                </div>
              ) : null}
            </div>
          </div>
          <div className={styles.paneBar}>{filterRow}</div>
          <div className={styles.headerRule} aria-hidden />
        </header>

        <div className={styles.body} dir={presentationSettings.textDirection}>
          {editing ? (
            <div className={styles.layoutBar}>
              <button
                type="button"
                className={`${styles.layoutBtn}${layoutMenu ? ` ${styles.layoutBtnOpen}` : ''}`}
                aria-label="Layout"
                aria-haspopup="menu"
                aria-expanded={Boolean(layoutMenu)}
                data-layout-menu-trigger
                onClick={(event) => {
                  if (layoutMenu) return setLayoutMenu(null)
                  closeMenus()
                  setLayoutMenu(menuAt(event.currentTarget, 52))
                }}
              >
                <Layout size={18} weight="regular" aria-hidden />
                Layout
                <CaretDown className={styles.layoutBtnCaret} size={14} weight="bold" aria-hidden />
              </button>
              <ColumnsControl
                label="Sidebar width"
                options={SIDEBAR_COLUMN_OPTIONS}
                value={columns}
                onChange={(next) => setColumnsBySlide((current) => ({ ...current, [slide.id]: next }))}
              />
            </div>
          ) : null}
          <aside
            key={slide.id}
            className={`${styles.insight} ${cardCss.grid} ${css.diveLeft}`}
            aria-label="Story insight"
            inert={Boolean(building)}
          >
            {cards.map(insightCard)}
            {Array.from({ length: emptyCells }, (_, index) => (
              <div key={`cell-${index}`} className={styles.gridCell} aria-hidden />
            ))}
          </aside>
        </div>

        {editSection ? (
          <StoryEditPanel
            section={editSection}
            storyTitle={storyTitle}
            storyDescription={storyDescription}
            presentationSettings={presentationSettings}
            slides={slides}
            activeSlideIndex={activeSlideIndex}
            filters={filters}
            onStoryTitleChange={setStoryTitle}
            onStoryDescriptionChange={setStoryDescription}
            onPresentationSettingsChange={(settings) => {
              setPresentationSettings(settings)
              if (!settings.autoplay || !settings.multiSlide || settings.pagesMode) setAutoplaying(false)
            }}
            onSelectSlide={goTo}
            onSlideChange={(next) => setSlides((items) => items.map((item) => (item.id === next.id ? next : item)))}
            onFiltersChange={(next) => setFiltersBySlide((current) => ({ ...current, [slide.id]: next }))}
            onAddSlide={() => addSlide()}
            onDuplicateSlide={duplicateSlide}
            onDeleteSlide={deleteSlide}
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
            charts={pickerCharts}
            onAddCharts={addCharts}
            onAddMapLayer={() => setLayerGroups(page.layers.map((layer) => layer.group))}
          />
        ) : null}

        <div className={`${styles.mapStack} ${css.diveRight}`} inert={Boolean(building)}>
          {mapData}
        </div>

        {building ? <EstateBuildingPanel key={building} buildingId={building} onClose={closeBuilding} /> : null}

        <div className={`${styles.lowerNav} ${css.diveNav}`} aria-label="Story navigation">
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
                  {autoplaying ? <Pause size={18} weight="fill" aria-hidden /> : <Play size={18} weight="fill" aria-hidden />}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.navArrow}
                aria-label="Previous slide"
                disabled={!canPrev}
                onClick={() => canPrev && goTo(activeSlideIndex - 1)}
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
              {editing ? (
                <button
                  type="button"
                  className={`${styles.navCount} ${styles.navAddSlide}`}
                  aria-label="Add slide"
                  title="Add slide"
                  onClick={() => addSlide(activeSlideIndex + 1)}
                >
                  <Plus size={16} weight="bold" aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                className={styles.navArrow}
                aria-label="Next slide"
                disabled={!canNext}
                onClick={() => canNext && goTo(activeSlideIndex + 1)}
              >
                <ArrowRight size={20} weight="regular" aria-hidden />
              </button>
            </div>
          ) : null}
          {modeSwitch}
        </div>
      </div>

      {storyMenu
        ? createPortal(
            <div id="estate-story-menu" className={styles.storyMenu} role="menu" aria-label="Story actions" style={storyMenu}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDirectSlideEditor(false)
                  setEditSection('story')
                  setStoryMenu(null)
                }}
              >
                <GearSix size={16} weight="regular" aria-hidden />
                Configure
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setStoryMenu(null)
                  setShareOpen(true)
                }}
              >
                <Export size={16} weight="regular" aria-hidden />
                Share story
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.storyMenuDanger}
                onClick={() => {
                  setStoryMenu(null)
                  setEditSection(null)
                  onBack()
                }}
              >
                <Trash size={16} weight="regular" aria-hidden />
                Delete story
              </button>
            </div>,
            document.body,
          )
        : null}
      {slideMenu
        ? createPortal(
            <div id="estate-slide-menu" className={styles.storyMenu} role="menu" aria-label="Slide actions" style={slideMenu}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDirectSlideEditor(true)
                  setEditSection('slide')
                  setSlideMenu(null)
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
                    setSlideMenu(null)
                  }}
                >
                  <PencilSimple size={16} weight="regular" aria-hidden />
                  Rename page
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  duplicateSlide()
                  setSlideMenu(null)
                }}
              >
                <Copy size={16} weight="regular" aria-hidden />
                Duplicate slide
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.storyMenuDanger}
                disabled={slides.length === 1}
                onClick={() => {
                  deleteSlide(slide.id)
                  setSlideMenu(null)
                  setDirectSlideEditor(false)
                  setEditSection(null)
                }}
              >
                <Trash size={16} weight="regular" aria-hidden />
                Delete slide
              </button>
            </div>,
            document.body,
          )
        : null}
      {layoutMenu
        ? createPortal(
            <div
              id="estate-layout-menu"
              className={`${styles.storyMenu} ${styles.layoutMenu}`}
              role="menu"
              aria-label="Layout"
              style={layoutMenu}
            >
              <button
                type="button"
                role="menuitemradio"
                aria-checked
                className={styles.storyMenuSelected}
                onClick={() => setLayoutMenu(null)}
              >
                <Sidebar size={16} weight="regular" aria-hidden />
                Sidebar
                <Check className={styles.storyMenuCheck} size={14} weight="bold" aria-hidden />
              </button>
            </div>,
            document.body,
          )
        : null}
      {cardMenu
        ? createPortal(
            <div id="estate-card-menu" className={styles.storyMenu} role="menu" aria-label="Card actions" style={{ top: cardMenu.top, left: cardMenu.left }}>
              <button
                type="button"
                role="menuitem"
                disabled={cardMenu.card.kind !== 'summary'}
                onClick={() => {
                  setCardMenu(null)
                  setSummaryConfigOpen(true)
                }}
              >
                <GearSix size={16} weight="regular" aria-hidden />
                Configure
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!cardTower(cardMenu.card)}
                onClick={() => {
                  const tower = cardTower(cardMenu.card)
                  setCardMenu(null)
                  if (tower) openBuilding(tower)
                }}
              >
                <Compass size={16} weight="regular" aria-hidden />
                Explore
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.storyMenuDanger}
                onClick={() => {
                  removeCard(cardMenu.card.id)
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
      {filterMenu
        ? createPortal(
            <div
              id="estate-filter-menu"
              className={styles.storyMenu}
              role="menu"
              aria-label={`${filterMenu.filter.label} filter`}
              style={{ top: filterMenu.top, left: filterMenu.left }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setFilterMenu(null)
                  setDirectSlideEditor(false)
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
                  const id = filterMenu.filter.id
                  setFiltersBySlide((current) => ({ ...current, [slide.id]: filters.filter((item) => item.id !== id) }))
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
      {layerMenu
        ? createPortal(
            <div id="estate-layer-menu" className={styles.storyMenu} role="menu" aria-label="Map layer actions" style={{ top: layerMenu.top, left: layerMenu.left }}>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setLayerConfig({ group: layerMenu.group, title: layerMenu.title })
                  setLayerMenu(null)
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
                  setLayerGroups(layers.map((layer) => layer.group).filter((group) => group !== layerMenu.group))
                  setLayerMenu(null)
                }}
              >
                <Trash size={16} weight="regular" aria-hidden />
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}

      {summaryConfigOpen ? (
        <StorySummaryConfigModal
          key={`${slide.id}-summary`}
          initial={summaryConfig}
          slides={slides}
          currentSlideId={slide.id}
          onSave={(config) => {
            setSummaryConfigs((current) => ({ ...current, [slide.id]: config }))
            if (config.autoRegenerate) setRegeneratingSlideId(slide.id)
            setSummaryConfigOpen(false)
          }}
          onClose={() => setSummaryConfigOpen(false)}
        />
      ) : null}
      {layerConfig ? (
        <StoryLayerConfigModal
          key={layerConfig.group}
          initial={{ title: layerConfig.title, opacity: 1 }}
          onSave={(config) => {
            setLayerTitles((current) => ({ ...current, [`${slide.id}:${layerConfig.group}`]: config.title }))
            setLayerConfig(null)
          }}
          onClose={() => setLayerConfig(null)}
        />
      ) : null}
      {monitorCard ? (
        <StoryMonitorModal
          key={monitorCard.key}
          cardTitle={monitorCard.title}
          initial={monitors[monitorCard.key] ?? defaultMonitorConfig()}
          onConfirm={(config) => {
            setMonitors((current) => ({ ...current, [monitorCard.key]: config }))
            setMonitorCard(null)
            onMonitorConfirm?.(
              monitorWorkflowProposal(`monitor-${monitorCard.key}-${Date.now()}`, monitorCard.title, config),
              monitorPrompt(monitorCard.title, config),
            )
          }}
          onClose={() => setMonitorCard(null)}
        />
      ) : null}
      <ShareModal
        open={shareOpen}
        title={`Share “${storyTitle}”`}
        note="Recipients get a link to this story, with its pages, filters and map views. Your edits reach them as you make them."
        onClose={() => setShareOpen(false)}
      />
    </div>
  )
}
