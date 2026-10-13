import { useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  Buildings,
  CalendarBlank,
  CaretDown,
  AppWindow,
  ChartLine,
  Check,
  Circle,
  Copy,
  DotsThreeVertical,
  FunnelSimple,
  GenderIntersex,
  Globe,
  Image as ImageIcon,
  MagnifyingGlass,
  MapPin,
  Minus,
  PencilSimple,
  Plus,
  Question,
  Slideshow,
  Sparkle,
  SquaresFour,
  Student,
  Table,
  TextT,
  Play,
  Trash,
  UploadSimple,
  VideoCamera,
  WaveSine,
  X,
} from '@phosphor-icons/react'
import { storyThumbLayers, landingAssets } from '../landing/landingAssets'
import { STORY_CHARTS, StoryChartPreview } from './StoryCharts'
import { STORY_MAP_STYLE } from './StoryMap'
import {
  BACKGROUND_COLOR_GROUPS,
  BACKGROUND_COLORS,
  BACKGROUND_MEDIA_PRESETS,
  BACKGROUND_MEDIA_TYPES,
  BACKGROUND_TABS,
  DEFAULT_BACKGROUND_COLOR,
  colorBackground,
  mediaBackground,
  type BackgroundMediaSource,
  type BackgroundMediaType,
  type BackgroundTab,
  type StoryBackground,
} from './storyBackground'
import { InlineColorPicker } from './StoryCustomColorPicker'
import type { StoryFilter, StorySlide } from './storyDemoData'
import styles from './StoryEditPanel.module.css'

const SLIDE_THUMB_VARIANTS = ['map', 'chart', 'satellite'] as const

export type StoryEditSection = 'story' | 'slide' | 'assets' | 'map' | 'tools' | 'filters' | 'layers'

export type StoryEditPanelProps = {
  storyTitle: string
  storyDescription: string
  presentationSettings: StoryPresentationSettings
  slides: StorySlide[]
  activeSlideIndex: number
  filters: StoryFilter[]
  onStoryTitleChange: (value: string) => void
  onStoryDescriptionChange: (value: string) => void
  onPresentationSettingsChange: (settings: StoryPresentationSettings) => void
  onSelectSlide: (index: number) => void
  onSlideChange: (slide: StorySlide) => void
  onFiltersChange: (filters: StoryFilter[]) => void
  onAddSlide: () => void
  onDuplicateSlide: (slideId?: string) => void
  onDeleteSlide: (slideId: string) => void
  onDeleteSlides: () => void
  onClose: () => void
  /** Opens the slide editor directly, with no return to the slides list. */
  directSlideEditor?: boolean
  mapStyleId: string
  background: StoryBackground
  onBackgroundChange: (background: StoryBackground) => void
  /** Places the picked charts (STORY_CHARTS ids) into the slide's grid. */
  onAddCharts?: (chartIds: string[]) => void
  section: StoryEditSection
}

export type StoryPresentationSettings = {
  darkLogoName: string
  lightLogoName: string
  textDirection: 'ltr' | 'rtl'
  autoplay: boolean
  multiSlide: boolean
  pagesMode: boolean
}

export function StoryEditPanel({
  storyTitle,
  storyDescription,
  presentationSettings,
  slides,
  activeSlideIndex,
  filters,
  onStoryTitleChange,
  onStoryDescriptionChange,
  onPresentationSettingsChange,
  onSelectSlide,
  onSlideChange,
  onFiltersChange,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onClose,
  directSlideEditor = false,
  mapStyleId,
  background,
  onBackgroundChange,
  onAddCharts,
  section,
}: StoryEditPanelProps) {
  const [isEditingSlide, setIsEditingSlide] = useState(directSlideEditor)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setIsEditingSlide(directSlideEditor && section === 'slide')
    setMenuOpen(false)
  }, [section, directSlideEditor])

  const slide = slides[activeSlideIndex]
  const slideHeading = `Slide ${activeSlideIndex + 1}`
  const modalTitle =
    section === 'story'
      ? 'Story Configuration'
      : section === 'assets'
        ? 'Assets & Filters'
        : section === 'filters'
          ? 'Add Filters'
        : section === 'layers'
          ? 'Add Map Layer'
        : section === 'map'
          ? 'Background Configuration'
          : section === 'tools'
          ? 'Tools'
          : isEditingSlide
            ? slideHeading
            : 'Slides Configuration'

  const syncMenuPosition = useCallback(() => {
    const button = menuButtonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    setMenuPosition({
      top: rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 210),
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (menuOpen) {
        setMenuOpen(false)
        return
      }
      if (isEditingSlide && !directSlideEditor) {
        setIsEditingSlide(false)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [directSlideEditor, isEditingSlide, menuOpen, onClose])

  useEffect(() => {
    if (!menuOpen) return
    syncMenuPosition()
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuButtonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    const onLayout = () => syncMenuPosition()
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [menuOpen, syncMenuPosition])

  const patchSlide = <K extends keyof StorySlide>(key: K, value: StorySlide[K]) => {
    onSlideChange({ ...slide, [key]: value })
  }

  return createPortal(
    <div className={styles.modalRoot}>
      <button type="button" className={styles.modalBackdrop} aria-label="Close settings" onClick={onClose} />
      <div
        id="story-edit-modal"
        className={`${styles.panel} ${styles.modal}${
          section === 'assets' || section === 'filters' || section === 'layers' ? ` ${styles.assetsModal}` : ''
        }${section === 'map' ? ` ${styles.mapModal}` : ''}${
          section === 'tools' ? ` ${styles.toolsModal}` : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-edit-modal-title"
        dir="ltr"
      >
      {section === 'assets' || section === 'filters' || section === 'layers' ? (
        <AssetsPicker
          filters={filters}
          onFiltersChange={onFiltersChange}
          onAddCharts={onAddCharts}
          onClose={onClose}
          chartsOnly={section === 'assets'}
          filtersOnly={section === 'filters'}
          layersOnly={section === 'layers'}
        />
      ) : (
      <>
      <header className={styles.header}>
        <div className={styles.headerIdentity}>
          {section === 'slide' && isEditingSlide && !directSlideEditor && (
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => {
                setMenuOpen(false)
                setIsEditingSlide(false)
              }}
              aria-label="Back to slides"
            >
              <ArrowLeft size={18} weight="bold" aria-hidden />
            </button>
          )}
          <div className={styles.headerCopy}>
            <div className={styles.titleLine}>
              <h2 id="story-edit-modal-title" className={styles.title}>
                {modalTitle}
              </h2>
              {section === 'slide' && isEditingSlide && presentationSettings.multiSlide ? (
                <button
                  ref={menuButtonRef}
                  type="button"
                  className={`${styles.titleMenuBtn}${menuOpen ? ` ${styles.titleMenuBtnOpen}` : ''}`}
                  aria-label={isEditingSlide ? 'Slide actions' : 'Edit story menu'}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  onClick={() => {
                    if (!menuOpen) syncMenuPosition()
                    setMenuOpen((open) => !open)
                  }}
                >
                  <CaretDown size={15} weight="bold" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close Story settings"
          >
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>
      </header>

      {section === 'map' ? (
        <BackgroundPicker
          background={background}
          basemapId={mapStyleId}
          onApply={(next) => {
            onBackgroundChange(next)
            onClose()
          }}
          onCancel={onClose}
        />
      ) : section === 'tools' ? (
        <ToolsSection />
      ) : (
      <div
        key={section === 'slide' && isEditingSlide ? `slide-${slide.id}` : section}
        className={styles.scroll}
      >
        {section === 'story' ? (
          <MainContentTab
            storyTitle={storyTitle}
            storyDescription={storyDescription}
            presentationSettings={presentationSettings}
            onStoryTitleChange={onStoryTitleChange}
            onStoryDescriptionChange={onStoryDescriptionChange}
            onPresentationSettingsChange={onPresentationSettingsChange}
          />
        ) : null}
        {section === 'slide' ? (
          isEditingSlide ? (
            <SlideEditor
              part="content"
              slide={slide}
              filters={filters}
              multiSlide={presentationSettings.multiSlide}
              textDirection={presentationSettings.textDirection}
              onTextDirectionChange={(textDirection) =>
                onPresentationSettingsChange({ ...presentationSettings, textDirection })
              }
              onSlideChange={patchSlide}
              onFiltersChange={onFiltersChange}
            />
          ) : (
            <SlidesOverview
              slides={slides}
              activeSlideIndex={activeSlideIndex}
              onEditSlide={(index) => {
                onSelectSlide(index)
                setMenuOpen(false)
                setIsEditingSlide(true)
              }}
              onDuplicateSlide={onDuplicateSlide}
              onDeleteSlide={(slideId) => onDeleteSlide(slideId)}
              onAddSlide={onAddSlide}
              multiSlide={presentationSettings.multiSlide}
            />
          )
        ) : null}
      </div>
      )}
      {menuOpen
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.titleMenu}
              role="menu"
              aria-label={isEditingSlide ? 'Slide actions' : 'Edit story menu'}
              style={
                {
                  top: menuPosition.top,
                  left: menuPosition.left,
                } as CSSProperties
              }
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onDuplicateSlide()
                  setMenuOpen(false)
                }}
              >
                <Copy size={16} aria-hidden />
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.titleMenuDanger}
                disabled={slides.length === 1}
                onClick={() => {
                  onDeleteSlide(slide.id)
                  setMenuOpen(false)
                  setIsEditingSlide(false)
                }}
              >
                <Trash size={16} aria-hidden />
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}
      </>
      )}
      </div>
    </div>,
    document.body,
  )
}

const ASSET_CAPTION = 'Real-Time Permit, EIA & Environmental Risk Intelligence'

const MAP_LAYERS = [
  {
    id: 'layer-permit',
    title: ASSET_CAPTION,
    category: 'Traffic',
    image: landingAssets.assetLayerPermit,
  },
  {
    id: 'layer-terrain',
    title: ASSET_CAPTION,
    category: 'Weather',
    image: landingAssets.assetLayerTerrain,
  },
  {
    id: 'layer-pins',
    title: ASSET_CAPTION,
    category: 'Operations',
    image: landingAssets.assetLayerPins,
  },
] as const

const CHARTS = STORY_CHARTS
const AI_ASSET = {
  id: 'ai-asset',
  title: 'AI Asset',
  detail: 'Generate a component with AI',
} as const

const ASSET_TABS = [
  {
    id: 'layers',
    label: 'Map Layers',
    icon: MapPin,
    all: 'All Map Layers',
    categories: ['Traffic', 'Weather', 'Sales', 'Operations'],
    placeholder: 'Search map layers..',
  },
  {
    id: 'charts',
    label: 'Charts',
    icon: ChartLine,
    all: 'All Charts',
    categories: ['Trends', 'Comparison', 'Distribution'],
    placeholder: 'Search charts..',
  },
  {
    id: 'filters',
    label: 'Filters',
    icon: FunnelSimple,
    all: 'All Filters',
    categories: ['Location', 'Time', 'Demographics'],
    placeholder: 'Search filters..',
  },
] as const

type AssetTabId = (typeof ASSET_TABS)[number]['id']

const FILTER_CATEGORY: Record<string, string> = {
  loc: 'Location',
  year: 'Time',
  ssi: 'Demographics',
  type: 'Demographics',
  gender: 'Demographics',
  level: 'Demographics',
}

const FILTER_DETAILS: Record<string, string> = {
  loc: 'Limits the slide to stations and districts in the selected region.',
  year: 'Shows readings from the selected academic year.',
  ssi: 'Filters schools by their School Sustainability Index score.',
  type: 'Filters by school type, such as public, private or charter.',
  gender: 'Filters by school gender: boys, girls or mixed.',
  level: 'Filters by school level, from kindergarten to secondary.',
}

const FILTER_CATALOG = [
  {
    id: 'filter-airports',
    label: 'Airports',
    category: 'Location',
    icon: 'calendar',
    detail: 'Focuses the map on airport zones and their surroundings.',
  },
  {
    id: 'filter-aqi-timeseries',
    label: 'AQI Timeseries',
    category: 'Time',
    icon: 'calendar',
    detail: 'Steps through air quality readings over time.',
  },
  {
    id: 'filter-area',
    label: 'Area',
    category: 'Location',
    icon: 'pin',
    detail: 'Limits results to a drawn or named area on the map.',
  },
  {
    id: 'filter-calendar-timeseries',
    label: 'CalendarTimeSeries',
    category: 'Time',
    icon: 'calendar',
    detail: 'Picks dates from a calendar to build a time series.',
  },
  {
    id: 'filter-channel',
    label: 'Channel',
    category: 'Demographics',
    icon: 'grid',
    detail: 'Splits results by data source or reporting channel.',
  },
  {
    id: 'filter-comparison',
    label: 'Comparison',
    category: 'Demographics',
    icon: 'grid',
    detail: 'Compares two groups side by side, such as districts.',
  },
  {
    id: 'filter-custom3-time',
    label: 'Custom3Time',
    category: 'Time',
    icon: 'calendar',
    detail: 'Sets three custom time windows to compare.',
  },
  {
    id: 'filter-date',
    label: 'Date',
    category: 'Time',
    icon: 'calendar',
    detail: 'Limits results to a single date or a date range.',
  },
  {
    id: 'filter-day',
    label: 'Day',
    category: 'Time',
    icon: 'calendar',
    detail: 'Filters results by day of the week.',
  },
] as const

function matchesFilter(label: string, detail: string, query: string) {
  return label.toLowerCase().includes(query) || detail.toLowerCase().includes(query)
}

type FilterIcon = (typeof FILTER_CATALOG)[number]['icon'] | 'buildings' | 'gender' | 'student'

const STORY_FILTER_ICON: Record<string, FilterIcon> = {
  loc: 'pin',
  year: 'calendar',
  ssi: 'grid',
  type: 'buildings',
  gender: 'gender',
  level: 'student',
}

function FilterGlyph({ icon }: { icon: FilterIcon }) {
  if (icon === 'pin') return <MapPin size={28} weight="regular" aria-hidden />
  if (icon === 'grid') return <SquaresFour size={28} weight="regular" aria-hidden />
  if (icon === 'buildings') return <Buildings size={28} weight="regular" aria-hidden />
  if (icon === 'gender') return <GenderIntersex size={28} weight="regular" aria-hidden />
  if (icon === 'student') return <Student size={28} weight="regular" aria-hidden />
  return <CalendarBlank size={28} weight="regular" aria-hidden />
}

function AiAssetCard() {
  return (
    <article className={`${styles.assetCard} ${styles.aiAssetCard}`} aria-label={AI_ASSET.title}>
      <span className={styles.assetCardClip}>
        <span className={styles.aiAssetPreview}>
          <span className={styles.aiAssetIcon} aria-hidden>
            <Sparkle size={22} weight="fill" />
          </span>
          <span className={styles.aiAssetTitle}>{AI_ASSET.title}</span>
          <span className={styles.aiAssetDetail}>{AI_ASSET.detail}</span>
        </span>
      </span>
    </article>
  )
}

function AssetsPicker({
  filters,
  onFiltersChange,
  onAddCharts,
  onClose,
  chartsOnly = false,
  filtersOnly = false,
  layersOnly = false,
}: {
  filters: StoryFilter[]
  onFiltersChange: (filters: StoryFilter[]) => void
  onAddCharts?: (chartIds: string[]) => void
  onClose: () => void
  chartsOnly?: boolean
  filtersOnly?: boolean
  layersOnly?: boolean
}) {
  const [tab, setTab] = useState<AssetTabId>(filtersOnly ? 'filters' : chartsOnly ? 'charts' : 'layers')
  const [category, setCategory] = useState(
    filtersOnly ? 'All Filters' : chartsOnly ? 'All Charts' : 'All Map Layers',
  )
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const activeTab = ASSET_TABS.find((item) => item.id === tab) ?? ASSET_TABS[0]
  const normalizedQuery = query.trim().toLowerCase()

  const layerItems = MAP_LAYERS.filter(
    (item) =>
      (category === 'All Map Layers' || item.category === category) &&
      item.title.toLowerCase().includes(normalizedQuery),
  )
  const chartItems = CHARTS.filter(
    (item) =>
      (category === 'All Charts' || item.category === category) &&
      item.title.toLowerCase().includes(normalizedQuery),
  )
  const filterItems = filters.filter((item) => {
    const itemCategory = FILTER_CATEGORY[item.id] ?? 'Location'
    return (
      (category === 'All Filters' || itemCategory === category) &&
      matchesFilter(item.label, FILTER_DETAILS[item.id] ?? '', normalizedQuery)
    )
  })
  const catalogFilterItems = FILTER_CATALOG.filter(
    (item) =>
      !filters.some((filter) => filter.label === item.label) &&
      (category === 'All Filters' || item.category === category) &&
      matchesFilter(item.label, item.detail, normalizedQuery),
  )
  const visibleItems = tab === 'layers' ? layerItems : tab === 'charts' ? chartItems : filterItems
  const showAiAsset =
    tab === 'charts' &&
    category === 'All Charts' &&
    matchesFilter(AI_ASSET.title, AI_ASSET.detail, normalizedQuery)

  const selectedItems = selected.flatMap((id) => {
    const layer = MAP_LAYERS.find((item) => item.id === id)
    if (layer) return [{ id, title: layer.category }]
    const chart = CHARTS.find((item) => item.id === id)
    if (chart) return [{ id, title: chart.title }]
    const filter = filters.find((item) => item.id === id)
    if (filter) return [{ id, title: filter.label }]
    const catalog = FILTER_CATALOG.find((item) => item.id === id)
    return catalog ? [{ id, title: catalog.label }] : []
  })

  const toggleSelected = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const chooseTab = (next: AssetTabId) => {
    const nextTab = ASSET_TABS.find((item) => item.id === next) ?? ASSET_TABS[0]
    setTab(next)
    setCategory(nextTab.all)
    setQuery('')
  }

  return (
    <>
      <header className={styles.assetsHeader}>
        <h2 id="story-edit-modal-title" className={styles.assetsTitle}>
          Add {filtersOnly ? 'Filters' : layersOnly ? 'Map Layer' : 'Assets'}
        </h2>
        {filtersOnly || layersOnly || chartsOnly ? null : (
        <div className={styles.assetsTabs} role="tablist" aria-label="Asset types">
          {ASSET_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              className={`${styles.assetsTab}${tab === id ? ` ${styles.assetsTabActive}` : ''}`}
              aria-selected={tab === id}
              onClick={() => chooseTab(id)}
            >
              <Icon size={20} weight="regular" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        )}
        <div className={styles.assetsHeaderEnd}>
          <label className={styles.assetsSearch}>
            <MagnifyingGlass size={20} aria-hidden />
            <input
              value={query}
              placeholder={activeTab.placeholder}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
      </header>
      <div className={styles.assetsBody}>
        <nav className={styles.assetsNav} aria-label="Asset categories">
          {[activeTab.all, ...activeTab.categories].map((name) => (
            <button
              key={name}
              type="button"
              className={`${styles.assetsNavBtn}${category === name ? ` ${styles.assetsNavBtnActive}` : ''}`}
              aria-pressed={category === name}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </nav>
        <div className={styles.assetsStage}>
          <div className={styles.assetsGrid}>
            {tab === 'filters' ? (
              filterItems.length + catalogFilterItems.length === 0 ? (
              <p className={styles.assetsEmpty}>No assets match.</p>
            ) : (
              <>
              {filterItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.assetFilter}${
                      selected.includes(item.id) ? ` ${styles.assetFilterSelected}` : ''
                    }`}
                    aria-pressed={selected.includes(item.id)}
                    onClick={() => toggleSelected(item.id)}
                  >
                    <span className={styles.assetFilterIcon}>
                      <FilterGlyph icon={STORY_FILTER_ICON[item.id] ?? 'grid'} />
                    </span>
                    <span className={styles.assetFilterText}>
                      <span className={styles.assetFilterLabel}>{item.label}</span>
                      {FILTER_DETAILS[item.id] ? (
                        <span className={styles.assetFilterDetail}>{FILTER_DETAILS[item.id]}</span>
                      ) : null}
                    </span>
                  </button>
                ))}
              {catalogFilterItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.assetFilter}${
                    selected.includes(item.id) ? ` ${styles.assetFilterSelected}` : ''
                  }`}
                  aria-pressed={selected.includes(item.id)}
                  onClick={() => toggleSelected(item.id)}
                >
                  <span className={styles.assetFilterIcon}>
                    <FilterGlyph icon={item.icon} />
                  </span>
                  <span className={styles.assetFilterText}>
                    <span className={styles.assetFilterLabel}>{item.label}</span>
                    <span className={styles.assetFilterDetail}>{item.detail}</span>
                  </span>
                </button>
              ))}
              </>
            )
            ) : visibleItems.length === 0 && !showAiAsset ? (
              <p className={styles.assetsEmpty}>No assets match.</p>
            ) : (
              <>
                {(tab === 'layers' ? layerItems : chartItems).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.assetCard}${tab === 'charts' ? ` ${styles.assetChartCard}` : ''}${
                      selected.includes(item.id) ? ` ${styles.assetCardSelected}` : ''
                    }`}
                    aria-pressed={selected.includes(item.id)}
                    onClick={() => toggleSelected(item.id)}
                  >
                    <span className={styles.assetCardClip}>
                      {tab === 'charts' ? (
                        <span className={styles.assetChartPreview}>
                          <StoryChartPreview id={item.id} />
                        </span>
                      ) : (
                        <>
                          <span className={styles.assetCardImage}>
                            <img src={'image' in item ? item.image : ''} alt="" />
                          </span>
                          <span className={styles.assetCardTitle}>{item.title}</span>
                        </>
                      )}
                    </span>
                  </button>
                ))}
                {showAiAsset ? <AiAssetCard /> : null}
              </>
            )}
          </div>
        </div>
        <aside className={styles.assetsSelected} aria-label="Selected assets">
          <p className={styles.assetsSelectedTitle}>Selected</p>
          {selectedItems.length === 0 ? (
            <p className={styles.assetsSelectedEmpty}>
              {filtersOnly
                ? 'No filter selected'
                : layersOnly
                  ? 'No layer selected'
                  : chartsOnly
                    ? 'No chart selected'
                    : 'No asset selected'}
            </p>
          ) : (
            <div className={styles.assetsSelectedList}>
              {selectedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.assetsSelectedItem}
                  onClick={() => toggleSelected(item.id)}
                >
                  {item.title}
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
      <footer className={styles.assetsFooter}>
        <p className={styles.assetsHint}>You can add components by drag and drop, or select multiple.</p>
        <div className={styles.assetsFooterActions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.assetsNext}
            onClick={() => {
              const selectedFilters = filters.filter((item) => selected.includes(item.id))
              const catalogAdditions = FILTER_CATALOG.filter(
                (item) =>
                  selected.includes(item.id) && !filters.some((filter) => filter.label === item.label),
              ).map((item) => ({ id: item.id, label: item.label, removable: true }))
              if (selectedFilters.length > 0) {
                onFiltersChange([...selectedFilters, ...catalogAdditions])
              } else if (catalogAdditions.length > 0) {
                onFiltersChange([...filters, ...catalogAdditions])
              }
              const selectedCharts = CHARTS.filter((item) => selected.includes(item.id)).map(
                (item) => item.id,
              )
              if (selectedCharts.length > 0) onAddCharts?.(selectedCharts)
              onClose()
            }}
          >
            Add selected
          </button>
        </div>
      </footer>
    </>
  )
}

type ToolIcon = ComponentType<{ size?: number; weight?: 'regular'; 'aria-hidden'?: boolean }>
type ToolGroup = 'text' | 'media' | 'misc'
type ToolTab = 'all' | ToolGroup

const TOOL_TABS: { id: ToolTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'text', label: 'Text' },
  { id: 'media', label: 'Media' },
  { id: 'misc', label: 'Misc' },
]

const STORY_TOOLS: { id: string; label: string; group: ToolGroup; icon: ToolIcon }[] = [
  { id: 'executive-summary', label: 'Executive Summary', group: 'text', icon: Circle },
  { id: 'image', label: 'Image', group: 'media', icon: ImageIcon },
  { id: 'kpi', label: 'KPI', group: 'text', icon: ChartLine },
  { id: 'link-button', label: 'Link Button', group: 'media', icon: Globe },
  { id: 'modal-button', label: 'Modal Button', group: 'media', icon: AppWindow },
  { id: 'recommendation-body', label: 'Recommendation · body', group: 'text', icon: Circle },
  { id: 'separator', label: 'Separator', group: 'misc', icon: Minus },
  { id: 'slides-reference', label: 'Slides Reference', group: 'media', icon: Slideshow },
  { id: 'spacing', label: 'Spacing', group: 'misc', icon: WaveSine },
  { id: 'subtitle-deck', label: 'Subtitle · deck', group: 'text', icon: Circle },
  { id: 'table', label: 'Table', group: 'text', icon: Table },
  { id: 'text', label: 'Text', group: 'text', icon: TextT },
  { id: 'video', label: 'Video', group: 'media', icon: VideoCamera },
  { id: 'weekly-waste-density', label: 'Weekly Waste Density per km² KPI', group: 'text', icon: Circle },
]

function ToolsSection() {
  const [tab, setTab] = useState<ToolTab>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const tools = STORY_TOOLS.filter(
    (tool) =>
      (tab === 'all' || tool.group === tab) && tool.label.toLowerCase().includes(normalizedQuery),
  )

  return (
    <div className={styles.toolsBody}>
      <label className={styles.toolsSearch}>
        <MagnifyingGlass size={18} aria-hidden />
        <input
          value={query}
          placeholder="Search custom assets..."
          aria-label="Search custom assets"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className={styles.toolsTabs} role="tablist" aria-label="Tool groups">
        {TOOL_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className={`${styles.toolsTab}${tab === item.id ? ` ${styles.toolsTabActive}` : ''}`}
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={styles.toolsStage}>
        {tools.length === 0 ? (
          <p className={styles.toolsEmpty}>No matching tools</p>
        ) : (
          tools.map((tool) => {
            const Icon = tool.icon
            const selected = selectedId === tool.id
            return (
              <button
                key={tool.id}
                type="button"
                className={`${styles.toolsRow}${selected ? ` ${styles.toolsRowSelected}` : ''}`}
                aria-pressed={selected}
                onClick={() => setSelectedId(selected ? null : tool.id)}
              >
                <Icon size={18} weight="regular" aria-hidden />
                <span>{tool.label}</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function MainContentTab({
  storyTitle,
  storyDescription,
  presentationSettings,
  onStoryTitleChange,
  onStoryDescriptionChange,
  onPresentationSettingsChange,
}: {
  storyTitle: string
  storyDescription: string
  presentationSettings: StoryPresentationSettings
  onStoryTitleChange: (value: string) => void
  onStoryDescriptionChange: (value: string) => void
  onPresentationSettingsChange: (settings: StoryPresentationSettings) => void
}) {
  const patchSettings = <K extends keyof StoryPresentationSettings>(
    key: K,
    value: StoryPresentationSettings[K],
  ) => onPresentationSettingsChange({ ...presentationSettings, [key]: value })

  return (
    <section className={styles.section}>
      <label className={styles.field}>
        <span className={styles.label}>Story title</span>
        <input
          className={styles.input}
          maxLength={100}
          value={storyTitle}
          onChange={(event) => onStoryTitleChange(event.target.value)}
        />
        <span className={styles.charCount}>{storyTitle.length}/100</span>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Description</span>
        <textarea
          className={styles.textarea}
          rows={3}
          maxLength={300}
          value={storyDescription}
          onChange={(event) => onStoryDescriptionChange(event.target.value)}
        />
        <span className={styles.charCount}>{storyDescription.length}/300</span>
      </label>
      <SettingToggle
        label="Enable Autoplay Button"
        checked={presentationSettings.autoplay}
        onChange={(checked) => patchSettings('autoplay', checked)}
      />
      {presentationSettings.multiSlide ? (
        <div className={styles.inlineSetting}>
          <span className={styles.label}>Slide navigation</span>
          <div
            className={`${styles.segmentedControl} ${styles.segmentedControlCompact}`}
            role="group"
            aria-label="Slide navigation"
          >
            <button
              type="button"
              className={`${styles.segmentedBtn}${!presentationSettings.pagesMode ? ` ${styles.segmentedBtnActive}` : ''}`}
              aria-pressed={!presentationSettings.pagesMode}
              onClick={() => patchSettings('pagesMode', false)}
            >
              Sequential
            </button>
            <button
              type="button"
              className={`${styles.segmentedBtn}${presentationSettings.pagesMode ? ` ${styles.segmentedBtnActive}` : ''}`}
              aria-pressed={presentationSettings.pagesMode}
              onClick={() => patchSettings('pagesMode', true)}
            >
              Tabs
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function TextDirectionField({
  value,
  onChange,
}: {
  value: 'ltr' | 'rtl'
  onChange: (value: 'ltr' | 'rtl') => void
}) {
  return (
    <div className={styles.inlineSetting}>
      <span className={styles.label}>Text Direction</span>
      <div className={`${styles.segmentedControl} ${styles.segmentedControlCompact}`} aria-label="Text direction">
        <button
          type="button"
          className={`${styles.segmentedBtn}${value === 'ltr' ? ` ${styles.segmentedBtnActive}` : ''}`}
          aria-pressed={value === 'ltr'}
          onClick={() => onChange('ltr')}
        >
          Left to Right
        </button>
        <button
          type="button"
          className={`${styles.segmentedBtn}${value === 'rtl' ? ` ${styles.segmentedBtnActive}` : ''}`}
          aria-pressed={value === 'rtl'}
          onClick={() => onChange('rtl')}
        >
          Right to Left
        </button>
      </div>
    </div>
  )
}

function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className={styles.toggleSetting}>
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        role="switch"
        className={`${styles.switch}${checked ? ` ${styles.switchOn}` : ''}`}
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.switchThumb} />
      </button>
    </div>
  )
}

function SlidesOverview({
  slides,
  activeSlideIndex,
  onEditSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onAddSlide,
  multiSlide,
}: {
  slides: StorySlide[]
  activeSlideIndex: number
  onEditSlide: (index: number) => void
  onDuplicateSlide: (slideId?: string) => void
  onDeleteSlide: (slideId: string) => void
  onAddSlide: () => void
  multiSlide: boolean
}) {
  const [menuSlideId, setMenuSlideId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const placeSlideMenu = useCallback((button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect()
    const width = 200
    const height = 92
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    const below = rect.bottom + 8
    const top = below + height > window.innerHeight ? Math.max(8, rect.top - 8 - height) : below
    setMenuPosition({ top, left })
  }, [])

  useEffect(() => {
    if (!menuSlideId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      setMenuSlideId(null)
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuButtonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setMenuSlideId(null)
    }
    const onLayout = () => {
      if (menuButtonRef.current) placeSlideMenu(menuButtonRef.current)
    }
    window.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [menuSlideId, placeSlideMenu])
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <h3 className={`${styles.sectionTitle} ${styles.sectionTitleLarge}`}>Slides</h3>
        </div>
        {multiSlide ? (
          <button type="button" className={styles.addBtn} onClick={onAddSlide}>
            <Plus size={15} weight="bold" aria-hidden />
            Add slide
          </button>
        ) : null}
      </div>
      <div className={styles.slideList}>
        {slides.map((item, index) => {
          const thumbnail = storyThumbLayers(
            SLIDE_THUMB_VARIANTS[index % SLIDE_THUMB_VARIANTS.length],
          )
          return (
            <div
              key={item.id}
              className={`${styles.slideItem}${index === activeSlideIndex ? ` ${styles.slideItemActive}` : ''}`}
            >
              <button
                type="button"
                className={styles.slideItemSelect}
                onClick={() => onEditSlide(index)}
                aria-current={index === activeSlideIndex ? 'true' : undefined}
                aria-label={`Edit slide ${index + 1}: ${item.title}`}
              >
                <span className={styles.slideThumbnail} aria-hidden>
                  <span className={styles.slideThumbnailLayers}>
                    <img src={thumbnail.image} alt="" />
                    {thumbnail.overlay ? <img src={thumbnail.overlay} alt="" /> : null}
                  </span>
                </span>
                <span className={styles.slideItemMeta}>
                  <span className={styles.slideItemCopy}>
                    <span className={styles.slideTitleLine}>
                      <span className={styles.slideNumber}>{index + 1}.</span>
                      <span className={styles.slideItemTitle}>{item.title}</span>
                    </span>
                    <span className={styles.slideItemDetails}>
                      <span>{item.layout === 'sidebar' ? 'Sidebar' : 'Full width'}</span>
                      {item.layout === 'sidebar' ? (
                        <span>{item.sidebarWidth === 'small' ? 'Small sidebar' : 'Large sidebar'}</span>
                      ) : null}
                      <span>{item.focusLayout ? 'Focus on' : 'Focus off'}</span>
                    </span>
                  </span>
                </span>
              </button>
              {multiSlide ? (
                <div className={styles.slideItemActions}>
                  <button
                    type="button"
                    className={`${styles.slideMenuBtn}${menuSlideId === item.id ? ` ${styles.slideMenuBtnOpen}` : ''}`}
                    aria-label={`Actions for ${item.title}`}
                    aria-haspopup="menu"
                    aria-expanded={menuSlideId === item.id}
                    onClick={(event) => {
                      const button = event.currentTarget
                      if (menuSlideId === item.id) {
                        setMenuSlideId(null)
                        return
                      }
                      menuButtonRef.current = button
                      placeSlideMenu(button)
                      setMenuSlideId(item.id)
                    }}
                  >
                    <DotsThreeVertical size={18} weight="bold" aria-hidden />
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      {menuSlideId
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.titleMenu}
              role="menu"
              aria-label="Slide actions"
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onDuplicateSlide(menuSlideId)
                  setMenuSlideId(null)
                }}
              >
                <Copy size={16} aria-hidden />
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.titleMenuDanger}
                disabled={slides.length === 1}
                onClick={() => {
                  onDeleteSlide(menuSlideId)
                  setMenuSlideId(null)
                }}
              >
                <Trash size={16} aria-hidden />
                Remove
              </button>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}

const MAP_STYLE_OPTIONS = [
  {
    id: 'aimsun-teal',
    name: 'Llumen Teal',
    description: 'Llumen teal map style',
    url: STORY_MAP_STYLE,
    image: landingAssets.mapStyleAimsunTeal,
  },
  {
    id: 'aimsun-base',
    name: 'Llumen Base',
    description: 'Llumen base map style',
    url: 'mapbox://styles/mapbox/dark-v11',
    image: landingAssets.mapStyleAimsunBase,
  },
  {
    id: 'aimsun-default',
    name: 'Llumen Default',
    description: 'Llumen default dark map style',
    url: 'mapbox://styles/mapbox/navigation-night-v1',
    image: landingAssets.mapStyleAimsunDefault,
  },
  {
    id: 'aimsun-light',
    name: 'Llumen Light',
    description: 'Llumen light map style',
    url: 'mapbox://styles/mapbox/light-v11',
    image: landingAssets.mapStyleAimsunLight,
  },
  {
    id: 'dubai-dark-blue',
    name: 'Dubai Dark Blue',
    description: 'Style URL missing',
    image: landingAssets.mapStyleDubaiDarkBlue,
  },
  {
    id: 'itc',
    name: 'ITC',
    description: 'Style URL missing',
    image: landingAssets.mapStyleItc,
  },
] as const

function BackgroundPicker({
  background,
  basemapId,
  onApply,
  onCancel,
}: {
  background: StoryBackground
  basemapId: string
  onApply: (background: StoryBackground) => void
  onCancel: () => void
}) {
  const [tab, setTab] = useState<BackgroundTab>(background.kind)
  const [stylesList, setStylesList] = useState<
    { id: string; name: string; description: string; url?: string; image?: string }[]
  >([...MAP_STYLE_OPTIONS])
  const [selectedId, setSelectedId] = useState(basemapId)
  const [customOpen, setCustomOpen] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const [mediaType, setMediaType] = useState<BackgroundMediaType>(
    background.kind === 'media' ? background.mediaType : 'image',
  )
  const [pickedMedia, setPickedMedia] = useState<Partial<Record<BackgroundMediaType, BackgroundMediaSource>>>(
    background.kind === 'media' ? { [background.mediaType]: background } : {},
  )
  const [uploadedMedia, setUploadedMedia] = useState<Partial<Record<BackgroundMediaType, BackgroundMediaSource>>>(
    background.kind === 'media' &&
      !BACKGROUND_MEDIA_PRESETS[background.mediaType].some((preset) => preset.src === background.src)
      ? { [background.mediaType]: background }
      : {},
  )
  const [dragging, setDragging] = useState(false)
  const [color, setColor] = useState(background.kind === 'color' ? background.color : DEFAULT_BACKGROUND_COLOR)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selected = stylesList.find((style) => style.id === selectedId)
  const mediaOption = BACKGROUND_MEDIA_TYPES.find((item) => item.id === mediaType) ?? BACKGROUND_MEDIA_TYPES[0]
  const mediaPresets = BACKGROUND_MEDIA_PRESETS[mediaType]
  const mediaReady = pickedMedia[mediaType] ?? mediaPresets[0]
  const uploaded = uploadedMedia[mediaType]
  const mediaOptions: (BackgroundMediaSource & { thumb?: string })[] = uploaded
    ? [...mediaPresets, uploaded]
    : mediaPresets
  const pickMedia = (source: BackgroundMediaSource) =>
    setPickedMedia((current) => ({ ...current, [source.mediaType]: source }))

  const addCustomStyle = () => {
    const url = customUrl.trim()
    if (!url) return
    const id = `custom-${Date.now()}`
    setStylesList((items) => [
      ...items,
      { id, name: 'Custom style', description: url, url, image: landingAssets.assetLayerTerrain },
    ])
    setSelectedId(id)
    setCustomUrl('')
    setCustomOpen(false)
  }

  const pickFile = (file: File | undefined) => {
    if (!file) return
    const type: BackgroundMediaType | null = file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('image/')
        ? 'image'
        : null
    if (!type) return
    const source = { mediaType: type, src: URL.createObjectURL(file), name: file.name }
    setMediaType(type)
    pickMedia(source)
    setUploadedMedia((current) => ({ ...current, [type]: source }))
  }

  const isCustomColor = !BACKGROUND_COLORS.includes(color)
  const canApply =
    tab === 'basemap' ? Boolean(selected?.url) : tab === 'media' ? true : Boolean(color)

  const apply = () => {
    if (tab === 'basemap') {
      if (!selected?.url) return
      onApply({ kind: 'basemap', id: selected.id, url: selected.url })
    } else if (tab === 'media') {
      onApply(
        background.kind === 'media' && background.src === mediaReady.src
          ? background
          : mediaBackground({ mediaType: mediaReady.mediaType, src: mediaReady.src, name: mediaReady.name }),
      )
    } else {
      onApply(
        background.kind === 'color' && background.color === color
          ? background
          : colorBackground(color, background.kind === 'color' ? background : undefined),
      )
    }
  }

  return (
    <div className={styles.mapStyleBody}>
      <div className={`${styles.toolsTabs} ${styles.backgroundTabs}`} role="tablist" aria-label="Background types">
        {BACKGROUND_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className={`${styles.toolsTab}${tab === item.id ? ` ${styles.toolsTabActive}` : ''}`}
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'media' ? (
        <>
          <div className={styles.mapStyleIntro}>
            <p className={styles.mapStyleHint}>Use an image or a video as your slide&apos;s background</p>
            <div className={`${styles.segmentedControl} ${styles.backgroundMediaSwitch}`} role="radiogroup" aria-label="Media type">
              {BACKGROUND_MEDIA_TYPES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={mediaType === item.id}
                  className={`${styles.segmentedBtn}${mediaType === item.id ? ` ${styles.segmentedBtnActive}` : ''}`}
                  onClick={() => setMediaType(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className={`${styles.mapStyleStage} ${styles.backgroundMediaStage}`}>
            <input
              ref={fileInputRef}
              className={styles.fileInput}
              type="file"
              accept={mediaOption.accept}
              aria-label={`Upload ${mediaOption.label.toLowerCase()}`}
              onChange={(event) => {
                pickFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
            <button
              type="button"
              className={`${styles.backgroundDrop} ${styles.backgroundDropFilled} ${styles.backgroundDropCompact}${
                dragging ? ` ${styles.backgroundDropActive}` : ''
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                pickFile(event.dataTransfer.files?.[0])
              }}
            >
              {mediaReady.mediaType === 'video' ? (
                <video className={styles.backgroundDropMedia} src={mediaReady.src} autoPlay muted loop playsInline />
              ) : (
                <img className={styles.backgroundDropMedia} src={mediaReady.src} alt="" />
              )}
              <span className={styles.backgroundDropCaption}>
                <span className={styles.mapStyleCardName}>{mediaReady.name}</span>
                <span className={styles.mapStyleCardDesc}>Click or drop a file to replace</span>
              </span>
            </button>
            <div
              className={styles.backgroundImageRow}
              role="radiogroup"
              aria-label={mediaType === 'video' ? 'Background videos' : 'Background images'}
            >
              {mediaOptions.map((option) => (
                <button
                  key={option.src}
                  type="button"
                  role="radio"
                  aria-checked={mediaReady.src === option.src}
                  aria-label={option.name}
                  title={option.name}
                  className={`${styles.backgroundImageTile}${
                    mediaReady.src === option.src ? ` ${styles.backgroundImageTileActive}` : ''
                  }`}
                  onClick={() => pickMedia(option)}
                >
                  {option.thumb || option.mediaType === 'image' ? (
                    <img src={option.thumb ?? option.src} alt="" loading="lazy" />
                  ) : (
                    <video src={option.src} muted playsInline preload="metadata" />
                  )}
                  {option.mediaType === 'video' ? (
                    <span className={styles.backgroundImagePlay} aria-hidden>
                      <Play size={10} weight="fill" />
                    </span>
                  ) : null}
                  {mediaReady.src === option.src ? (
                    <span className={styles.backgroundImageCheck} aria-hidden>
                      <Check size={12} weight="bold" />
                    </span>
                  ) : null}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.backgroundImageTile} ${styles.backgroundImageUpload}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadSimple size={18} weight="regular" aria-hidden />
                <span>Upload</span>
              </button>
            </div>
          </div>
        </>
      ) : tab === 'color' ? (
        <>
          <div className={styles.mapStyleIntro}>
            <p className={styles.mapStyleHint}>Pick a solid color for your slide&apos;s background</p>
          </div>
          <div className={styles.mapStyleStage}>
            <div className={styles.backgroundColorLayout}>
              <div className={styles.backgroundSwatchField}>
                {(isCustomColor
                  ? [...BACKGROUND_COLOR_GROUPS, { id: 'custom', label: 'Custom', colors: [color] }]
                  : BACKGROUND_COLOR_GROUPS
                ).map((group) => (
                  <div key={group.id} className={styles.backgroundSwatchGroup} role="group" aria-label={group.label}>
                    <span className={styles.backgroundSwatchGroupLabel}>{group.label}</span>
                    <div className={styles.backgroundColorGrid}>
                      {group.colors.map((swatch) => (
                        <button
                          key={swatch}
                          type="button"
                          className={`${styles.colorDot}${swatch === color ? ` ${styles.colorDotSelected}` : ''}`}
                          style={{ '--swatch': swatch } as CSSProperties}
                          aria-label={`${group.label} ${swatch.toUpperCase()}`}
                          aria-pressed={swatch === color}
                          onClick={() => setColor(swatch)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.backgroundColorCustom}>
                <InlineColorPicker title="Custom color" value={color} onChange={setColor} />
              </div>
            </div>
          </div>
        </>
      ) : (
      <>
      <div className={styles.mapStyleIntro}>
        <p className={styles.mapStyleHint}>Select a map style for your slides&apos;s background</p>
        <button type="button" className={styles.addBtn} onClick={() => setCustomOpen((open) => !open)}>
          <Plus size={15} weight="bold" aria-hidden />
          Custom Style URL
        </button>
      </div>
      {customOpen ? (
        <form
          className={styles.mapStyleCustom}
          onSubmit={(event) => {
            event.preventDefault()
            addCustomStyle()
          }}
        >
          <input
            className={styles.input}
            value={customUrl}
            placeholder="mapbox://styles/..."
            aria-label="Custom style URL"
            onChange={(event) => setCustomUrl(event.target.value)}
          />
          <button type="submit" className={styles.secondaryBtn} disabled={!customUrl.trim()}>
            Add
          </button>
        </form>
      ) : null}
      <div className={styles.mapStyleStage}>
        <div className={styles.mapStyleGrid}>
          {stylesList.map((style) => (
            <button
              key={style.id}
              type="button"
              className={`${styles.assetCard} ${styles.mapStyleCard}${
                selectedId === style.id ? ` ${styles.assetCardSelected}` : ''
              }`}
              aria-pressed={selectedId === style.id}
              onClick={() => setSelectedId(style.id)}
            >
              <span className={styles.assetCardClip}>
                <span className={styles.assetCardImage}>
                  {style.image ? (
                    <img src={style.image} alt="" />
                  ) : (
                    <Question className={styles.mapStyleEmpty} size={42} weight="regular" aria-hidden />
                  )}
                </span>
                <span className={styles.assetCardTitle}>
                  <span className={styles.mapStyleCardName}>{style.name}</span>
                  <span className={styles.mapStyleCardDesc}>{style.description}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
      </>
      )}
      <footer className={styles.mapStyleFooter}>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.assetsNext} disabled={!canApply} onClick={apply}>
          Apply Background
        </button>
      </footer>
    </div>
  )
}

function SlideEditor({
  part,
  slide,
  filters,
  multiSlide,
  textDirection,
  onTextDirectionChange,
  onSlideChange,
  onFiltersChange,
}: {
  part: 'content' | 'assets'
  slide: StorySlide
  filters: StoryFilter[]
  multiSlide: boolean
  textDirection?: 'ltr' | 'rtl'
  onTextDirectionChange?: (value: 'ltr' | 'rtl') => void
  onSlideChange: <K extends keyof StorySlide>(key: K, value: StorySlide[K]) => void
  onFiltersChange: (filters: StoryFilter[]) => void
}) {
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null)

  return (
    <>
      {part === 'content' ? (
      <>
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h3 className={`${styles.sectionTitle} ${styles.sectionTitleLarge}`}>Content</h3>
          </div>
        </div>
        {multiSlide ? (
          <label className={styles.field}>
            <span className={styles.label}>Heading</span>
            <input
              className={styles.input}
              value={slide.title}
              onChange={(event) => onSlideChange('title', event.target.value)}
            />
          </label>
        ) : null}
        <label className={styles.field}>
          <span className={styles.label}>Slide description</span>
          <textarea
            className={styles.textarea}
            rows={4}
            value={slide.finding}
            onChange={(event) => onSlideChange('finding', event.target.value)}
          />
        </label>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h3 className={`${styles.sectionTitle} ${styles.sectionTitleLarge}`}>Layout</h3>
          </div>
        </div>
        {textDirection && onTextDirectionChange ? (
          <TextDirectionField value={textDirection} onChange={onTextDirectionChange} />
        ) : null}
      </section>
      </>
      ) : null}

      {part === 'assets' ? (
      <>
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <h3 className={`${styles.sectionTitle} ${styles.sectionTitleLarge}`}>Filters</h3>
          </div>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() =>
              onFiltersChange([
                ...filters,
                {
                  id: `custom-${Date.now()}`,
                  label: 'New filter',
                  removable: true,
                },
              ])
            }
          >
            <Plus size={15} weight="bold" aria-hidden />
            Add filter
          </button>
        </div>
        <div className={styles.filterList}>
          {filters.map((filter, index) => (
            <div className={styles.filterRow} key={filter.id}>
              <span className={styles.filterNumber}>{index + 1}</span>
              {editingFilterId === filter.id ? (
                <input
                  className={styles.filterInput}
                  aria-label={`Filter ${index + 1}`}
                  value={filter.label}
                  autoFocus
                  onChange={(event) =>
                    onFiltersChange(
                      filters.map((item) =>
                        item.id === filter.id ? { ...item, label: event.target.value } : item,
                      ),
                    )
                  }
                  onBlur={() => setEditingFilterId(null)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.stopPropagation()
                      setEditingFilterId(null)
                      return
                    }
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }
                  }}
                />
              ) : (
                <span className={styles.filterLabel}>{filter.label}</span>
              )}
              <div className={styles.filterActions}>
                <button
                  type="button"
                  className={`${styles.slideActionBtn} ${styles.inlineEditBtn}`}
                  aria-label={`Edit filter ${index + 1}`}
                  title="Edit filter"
                  onClick={() => setEditingFilterId(filter.id)}
                >
                  <PencilSimple size={15} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${styles.slideActionBtn} ${styles.slideActionDanger}`}
                  aria-label={`Remove ${filter.label} filter`}
                  title="Remove filter"
                  onClick={() => {
                    if (editingFilterId === filter.id) setEditingFilterId(null)
                    onFiltersChange(filters.filter((item) => item.id !== filter.id))
                  }}
                >
                  <Trash size={15} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      </>
      ) : null}

    </>
  )
}
