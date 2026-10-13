import { useEffect, useRef, useState, type RefObject } from 'react'
import { useRevealScrollbarOnScroll } from './useRevealScrollbarOnScroll'
import { ChatTeardropText, Check, FloppyDisk, Info, SidebarSimple } from '@phosphor-icons/react'
import { AiGeneratedBadge } from './AiGeneratedBadge'
import type { CreatedComponent } from './assistantReplyTypes'
import { ApiResponseTerminal } from './ApiResponseTerminal'
import { DataProfilePanel } from './DataProfilePanel'
import { queryResultsForComponent } from './componentQueryResults'
import { DataSourceSettingsPanel } from './DataSourceSettingsPanel'
import { InteractiveMap, MapControls, type InteractiveMapHandle } from './InteractiveMap'
import { KpiWidget } from './KpiWidgets'
import styles from './compact-assistant.module.css'

export type ComponentDetailPanelProps = {
  component: CreatedComponent
  onClose: () => void
  onShowInConversation?: () => void
}

type DetailTab = 'component' | 'query-results' | 'data-source'
type DataSubTab = 'results' | 'profile'

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'component', label: 'Asset' },
  { id: 'query-results', label: 'Data' },
  { id: 'data-source', label: 'Source' },
]

const DATA_SUB_TABS: { id: DataSubTab; label: string }[] = [
  { id: 'results', label: 'Query Results' },
  { id: 'profile', label: 'Data Profile' },
]

function isMapDetailComponent(component: CreatedComponent) {
  return component.preview?.kind === 'image' && component.preview.detailView === 'map'
}

function SaveToAssetsButton({
  saved,
  onSave,
}: {
  saved: boolean
  onSave: () => void
}) {
  return (
    <button
      type="button"
      className={`${styles.saveToAssetsBtn}${saved ? ` ${styles.saveToAssetsBtnSaved}` : ''}`}
      onClick={() => {
        if (!saved) onSave()
      }}
      aria-pressed={saved}
      aria-label={saved ? 'In asset library' : 'Save to Assets'}
    >
      {saved ? (
        <>
          <Check size={18} weight="regular" aria-hidden />
          In asset library
        </>
      ) : (
        <>
          <FloppyDisk size={18} weight="regular" aria-hidden />
          Save to Assets
        </>
      )}
    </button>
  )
}

function ComponentPreview({ component }: { component: CreatedComponent }) {
  const { preview, title } = component
  const isSquare = component.inlineSize === 'square'

  if (isMapDetailComponent(component)) {
    return <InteractiveMap className={styles.componentDetailInteractiveMap} />
  }

  const frameClass = `${styles.componentDetailPreviewFrame}${
    isSquare ? ` ${styles.componentDetailPreviewFrameSquare}` : ''
  }`

  if (preview?.kind === 'widget') {
    return (
      <div className={frameClass}>
        <KpiWidget component={component} compact={isSquare} />
      </div>
    )
  }

  if (preview?.kind === 'image') {
    return (
      <div className={frameClass}>
        <img
          className={
            preview.fit === 'cover'
              ? styles.componentDetailPreviewImageCover
              : styles.componentDetailPreviewImage
          }
          src={preview.src}
          alt={preview.alt ?? title}
        />
      </div>
    )
  }

  if (preview?.kind === 'kpi') {
    return (
      <div className={frameClass}>
        <p className={styles.componentDetailKpi}>
          {preview.value}
          {preview.unit ? <span className={styles.componentDetailKpiUnit}>{preview.unit}</span> : null}
        </p>
      </div>
    )
  }

  if (preview?.kind === 'text') {
    return (
      <div className={frameClass}>
        <p className={styles.componentDetailText}>{preview.content}</p>
      </div>
    )
  }

  return <p className={styles.componentDetailTextMuted}>Preview not available for this component.</p>
}

function QueryResultsContent({ component }: { component: CreatedComponent }) {
  const scrollRef = useRevealScrollbarOnScroll()

  if (component.id === 'air-quality-index') {
    return <ApiResponseTerminal />
  }

  const table = queryResultsForComponent(component)
  return (
    <div ref={scrollRef} className={styles.componentDetailDataTableWrap}>
      <table className={styles.componentDetailDataTable}>
        <thead>
          <tr>
            {table.columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${component.id}-row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${component.id}-${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DataTabContent({ component }: { component: CreatedComponent }) {
  const [dataSubTab, setDataSubTab] = useState<DataSubTab>('results')

  useEffect(() => {
    setDataSubTab('results')
  }, [component.id])

  return (
    <div className={styles.dataTabRoot}>
      <div className={styles.dataSubTabs} role="tablist" aria-label="Data views">
        {DATA_SUB_TABS.map((tab) => {
          const selected = dataSubTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`component-data-subtab-${tab.id}`}
              className={`${styles.dataSubTab}${selected ? ` ${styles.dataSubTabActive}` : ''}`}
              aria-selected={selected}
              aria-controls={`component-data-panel-${tab.id}`}
              onClick={() => setDataSubTab(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        className={styles.dataSubPanel}
        role="tabpanel"
        id={`component-data-panel-${dataSubTab}`}
        aria-labelledby={`component-data-subtab-${dataSubTab}`}
      >
        {dataSubTab === 'results' ? (
          <QueryResultsContent component={component} />
        ) : (
          <DataProfilePanel component={component} />
        )}
      </div>
    </div>
  )
}

function TabPanelContent({ tab, component }: { tab: DetailTab; component: CreatedComponent }) {
  if (tab === 'component') {
    return <ComponentPreview component={component} />
  }

  if (tab === 'query-results') {
    return <DataTabContent component={component} />
  }

  return (
    <DataSourceSettingsPanel variant={isMapDetailComponent(component) ? 'map' : 'api'} />
  )
}

function MapDescriptionPopover({
  open,
  title,
  caption,
  analysis,
  onClose,
  anchorRef,
  popoverId = 'map-description-popover',
}: {
  open: boolean
  title: string
  caption?: string
  analysis?: string
  onClose: () => void
  anchorRef: RefObject<HTMLButtonElement | null>
  popoverId?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      id={popoverId}
      className={styles.mapDescriptionPopover}
      role="dialog"
      aria-label={`${title} analysis`}
    >
      {caption ? <p className={styles.mapDescriptionCaption}>{caption}</p> : null}
      {analysis ? <p className={styles.mapDescriptionAnalysis}>{analysis}</p> : null}
      {!caption && !analysis ? (
        <p className={styles.mapDescriptionAnalysis}>No analysis available for this component.</p>
      ) : null}
    </div>
  )
}

export function ComponentDetailPanel({ component, onClose, onShowInConversation }: ComponentDetailPanelProps) {
  const { title, description, caption, analysis, aiGenerated } = component
  const [activeTab, setActiveTab] = useState<DetailTab>('component')
  const [descOpen, setDescOpen] = useState(false)
  const [savedToAssets, setSavedToAssets] = useState(false)
  const descBtnRef = useRef<HTMLButtonElement>(null)
  const mapRef = useRef<InteractiveMapHandle>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [controlsTop, setControlsTop] = useState(180)
  const chartCaption = caption ?? description
  const chartAnalysis = analysis
  const isMap = isMapDetailComponent(component)

  useEffect(() => {
    setActiveTab('component')
    setDescOpen(false)
    setSavedToAssets(false)
  }, [component.id])

  useEffect(() => {
    if (!isMap) return
    const el = headerRef.current
    if (!el) return

    const measure = () => {
      const tabs = el.querySelector('[role="tablist"]') as HTMLElement | null
      if (tabs) {
        const headerTop = el.getBoundingClientRect().top
        const tabsBottom = tabs.getBoundingClientRect().bottom
        setControlsTop(Math.max(12, Math.round(tabsBottom - headerTop + 32)))
        return
      }
      setControlsTop(Math.round(el.getBoundingClientRect().height - 28))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [isMap, activeTab, descOpen])

  if (isMap) {
    return (
      <aside className={`${styles.componentDetail} ${styles.componentDetailMapBleed}`} aria-label={`${title} preview`}>
        <div className={styles.mapBleedStage}>
          <InteractiveMap
            ref={mapRef}
            className={styles.componentDetailInteractiveMap}
            showControls={false}
            buildingMinZoom={10}
          />
        </div>

          <div ref={headerRef} className={styles.mapBleedHeader}>
          <div className={styles.mapBleedBlur} aria-hidden />
          <div className={`${styles.mapBleedHeaderInner}${descOpen ? ` ${styles.mapBleedHeaderInnerRaised}` : ''}`}>
            <div className={styles.mapBleedHeaderText}>
              <div className={styles.detailTitleRow}>
                <h2 className={styles.mapBleedTitle}>{title}</h2>
                {aiGenerated ? <AiGeneratedBadge /> : null}
              </div>
              <div className={styles.headerInsightRow}>
                <div className={styles.mapBleedDescWrap}>
                  <button
                    ref={descBtnRef}
                    type="button"
                    className={styles.mapBleedDescBtn}
                    aria-expanded={descOpen}
                    aria-controls="map-description-popover"
                    onClick={() => setDescOpen((v) => !v)}
                  >
                    <Info size={18} weight="regular" aria-hidden />
                    View Insight
                  </button>
                  <MapDescriptionPopover
                    open={descOpen}
                    title={title}
                    caption={chartCaption}
                    analysis={chartAnalysis}
                    onClose={() => setDescOpen(false)}
                    anchorRef={descBtnRef}
                  />
                </div>
                {onShowInConversation ? (
                  <button
                    type="button"
                    className={styles.showInConversationBtn}
                    onClick={onShowInConversation}
                  >
                    <ChatTeardropText size={20} weight="regular" aria-hidden />
                    <span>Show in Conversation</span>
                  </button>
                ) : null}
                {aiGenerated ? (
                  <SaveToAssetsButton
                    saved={savedToAssets}
                    onSave={() => setSavedToAssets(true)}
                  />
                ) : null}
              </div>
            </div>
            <div className={styles.componentDetailHeaderActions}>
              <button
                type="button"
                className={styles.componentDetailClose}
                onClick={onClose}
                aria-label="Collapse preview"
              >
                <SidebarSimple size={20} weight="regular" aria-hidden />
              </button>
            </div>
          </div>

          <div className={styles.mapBleedTabs} role="tablist" aria-label="Component detail views">
            {DETAIL_TABS.map((tab) => {
              const selected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`component-detail-tab-${tab.id}`}
                  className={`${styles.componentDetailTab}${selected ? ` ${styles.componentDetailTabActive}` : ''}`}
                  aria-selected={selected}
                  aria-controls={`component-detail-panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {activeTab === 'component' ? (
          <MapControls
            className={styles.mapBleedControls}
            style={{ top: controlsTop }}
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onResetNorth={() => mapRef.current?.resetNorth()}
          />
        ) : null}

        {activeTab !== 'component' ? (
          <div
            className={styles.mapBleedSecondary}
            role="tabpanel"
            id={`component-detail-panel-${activeTab}`}
            aria-labelledby={`component-detail-tab-${activeTab}`}
          >
            <TabPanelContent tab={activeTab} component={component} />
          </div>
        ) : null}
      </aside>
    )
  }

  return (
    <aside className={styles.componentDetail} aria-label={`${title} preview`}>
      <div className={styles.componentDetailHeader}>
        <div className={styles.componentDetailHeaderText}>
          <div className={styles.detailTitleRow}>
            <h2 className={styles.componentDetailTitle}>{title}</h2>
            {aiGenerated ? <AiGeneratedBadge /> : null}
          </div>
          <div className={styles.headerInsightRow}>
            <div className={styles.mapBleedDescWrap}>
              <button
                ref={descBtnRef}
                type="button"
                className={styles.mapBleedDescBtn}
                aria-expanded={descOpen}
                aria-controls="component-analysis-popover"
                onClick={() => setDescOpen((v) => !v)}
              >
                <Info size={18} weight="regular" aria-hidden />
                View Analysis
              </button>
              <MapDescriptionPopover
                open={descOpen}
                title={title}
                caption={chartCaption}
                analysis={chartAnalysis}
                onClose={() => setDescOpen(false)}
                anchorRef={descBtnRef}
                popoverId="component-analysis-popover"
              />
            </div>
            {onShowInConversation ? (
              <button
                type="button"
                className={styles.showInConversationBtn}
                onClick={onShowInConversation}
              >
                <ChatTeardropText size={20} weight="regular" aria-hidden />
                <span>Show in Conversation</span>
              </button>
            ) : null}
            {aiGenerated ? (
              <SaveToAssetsButton
                saved={savedToAssets}
                onSave={() => setSavedToAssets(true)}
              />
            ) : null}
          </div>
        </div>
        <div className={styles.componentDetailHeaderActions}>
          <button
            type="button"
            className={styles.componentDetailClose}
            onClick={onClose}
            aria-label="Collapse preview"
          >
            <SidebarSimple size={20} weight="regular" aria-hidden />
          </button>
        </div>
      </div>

      <div className={styles.componentDetailTabs} role="tablist" aria-label="Component detail views">
        {DETAIL_TABS.map((tab) => {
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`component-detail-tab-${tab.id}`}
              className={`${styles.componentDetailTab}${selected ? ` ${styles.componentDetailTabActive}` : ''}`}
              aria-selected={selected}
              aria-controls={`component-detail-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        className={`${styles.componentDetailBody}${
          activeTab === 'query-results' || activeTab === 'data-source'
            ? ` ${styles.componentDetailBodyConstrained}`
            : ''
        }`}
        role="tabpanel"
        id={`component-detail-panel-${activeTab}`}
        aria-labelledby={`component-detail-tab-${activeTab}`}
      >
        <div
          className={`${styles.componentDetailStage}${
            activeTab === 'query-results' || activeTab === 'data-source'
              ? ` ${styles.componentDetailStageWide}`
              : ''
          }`}
        >
          <TabPanelContent tab={activeTab} component={component} />
        </div>
      </div>
    </aside>
  )
}
