import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CaretDown,
  CaretRight,
  Check,
  GearSix,
  House,
  Kanban,
  MagnifyingGlass,
  Plus,
  PushPin,
  SquaresFour,
} from '@phosphor-icons/react'
import type { StudioStyle } from '../prototypeChrome'
import { STUDIO_ASSETS, STUDIO_WORKSPACE_NAMES, type StudioPage } from './studioData'
import { ASSET_CATEGORIES, CATEGORY_COLOR, type Go } from './studioAssetMeta'
import { CanvasAssets, CommandPalette, type CanvasHandle } from './studioCanvas'
import { BentoAssets, BoardAssets, GalleryAssets, HomeHub, InspectorAssets } from './studioExperiences'
import { RichHome } from './studioHome'
import { useDismiss } from './studioHooks'
import { PageBody } from './studioNav'
import { NAV, groupOf, isGroup, pageLabel, type NavGroup } from './studioNavItems'
import { Dropdown } from './studioUi'
import view from './StudioView.module.css'
import s from './StudioScenarios.module.css'

type ShellPage = StudioPage | 'home'

type ShellProps = {
  scenario: Exclude<StudioStyle, 1>
  workspace: string
  onWorkspaceChange: (workspace: string) => void
  onSettings: () => void
  onCreateAsset: () => void
}

type Nav = { page: ShellPage; go: Go }

/** Assets pinned to the sidebar and the home's spotlight in experience 7. */
const PINNED = ['emissions-trajectory', 'groundwater-abstraction', 'species-detection', 'water-quality']

/** Studio experiences 2–8: each its own navigation around its own take on Assets; other pages are shared. */
export function ScenarioShell({ scenario, workspace, onWorkspaceChange, onSettings, onCreateAsset }: ShellProps) {
  const [page, setPage] = useState<ShellPage>(scenario === 2 || scenario === 7 ? 'home' : 'assets')
  const [boardView, setBoardView] = useState('All assets')
  const [spotlight, setSpotlight] = useState(PINNED[0])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [canvasFocus, setCanvasFocus] = useState<string | undefined>()
  const canvasRef = useRef<CanvasHandle>(null)
  const go: Go = (next) => {
    setCanvasFocus(undefined)
    setPage(next)
  }
  const nav = { page, go }

  useEffect(() => {
    if (scenario !== 8) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      event.preventDefault()
      setPaletteOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scenario])

  const spotlightAsset = (id: string) => {
    setSpotlight(id)
    setPage('home')
  }

  const assets = (() => {
    switch (scenario) {
      case 2:
      case 7:
        return null
      case 3:
        return <InspectorAssets onCreate={onCreateAsset} />
      case 4:
        return <BentoAssets onCreate={onCreateAsset} workspace={workspace} onWorkspaceChange={onWorkspaceChange} />
      case 5:
        return <BoardAssets view={boardView} onCreate={onCreateAsset} />
      case 6:
        return <GalleryAssets onCreate={onCreateAsset} />
      case 8:
        return <CanvasAssets ref={canvasRef} initialFocus={canvasFocus} onCreate={onCreateAsset} />
    }
  })()

  const body =
    page === 'home' ? (
      scenario === 7 ? (
        <RichHome go={go} onCreate={onCreateAsset} pinned={PINNED} spotlight={spotlight} onSpotlight={setSpotlight} />
      ) : (
        <HomeHub go={go} onCreate={onCreateAsset} workspace={workspace} onWorkspaceChange={onWorkspaceChange} />
      )
    ) : page === 'assets' && assets ? (
      assets
    ) : (
      <PageBody page={page} onCreateAsset={onCreateAsset} />
    )

  /** The inspector and board fill the height and scroll inside; everything else scrolls the page. */
  const fills = page === 'assets' && (scenario === 3 || scenario === 5)
  const main = (
    <main key={page} className={`${view.main}${fills ? ` ${s.mainFill}` : ''}`}>
      {body}
      {scenario === 4 ? <div className={s.dockSpace} aria-hidden /> : null}
    </main>
  )

  switch (scenario) {
    case 2:
      return (
        <div className={s.shellRow}>
          <RailNav nav={nav} onSettings={onSettings} />
          {main}
        </div>
      )
    case 3:
      return (
        <div className={s.shellColumn}>
          <TabsNav nav={nav} workspace={workspace} onWorkspaceChange={onWorkspaceChange} onSettings={onSettings} />
          {main}
        </div>
      )
    case 4:
      return (
        <div className={s.shellColumn}>
          {main}
          <DockNav nav={nav} workspace={workspace} onWorkspaceChange={onWorkspaceChange} onSettings={onSettings} />
        </div>
      )
    case 5:
      return (
        <div className={s.shellRow}>
          <ViewsNav
            nav={nav}
            boardView={boardView}
            onBoardView={(next) => {
              setBoardView(next)
              go('assets')
            }}
            workspace={workspace}
            onWorkspaceChange={onWorkspaceChange}
            onSettings={onSettings}
          />
          {main}
        </div>
      )
    case 6:
      return (
        <div className={s.shellColumn}>
          <PillNav nav={nav} workspace={workspace} onWorkspaceChange={onWorkspaceChange} onSettings={onSettings} />
          {main}
        </div>
      )
    case 7:
      return (
        <div className={s.shellRow}>
          <HomeSidebar
            nav={nav}
            pinned={PINNED}
            spotlight={spotlight}
            onPinned={spotlightAsset}
            workspace={workspace}
            onWorkspaceChange={onWorkspaceChange}
            onSettings={onSettings}
          />
          {main}
        </div>
      )
    case 8: {
      const onCanvas = page === 'assets'
      return (
        <div className={s.shellColumn}>
          <CanvasBar
            nav={nav}
            floating={onCanvas}
            workspace={workspace}
            onWorkspaceChange={onWorkspaceChange}
            onSettings={onSettings}
            onCreate={onCreateAsset}
            onPalette={() => setPaletteOpen(true)}
          />
          {onCanvas ? assets : main}
          {paletteOpen ? (
            <CommandPalette
              onClose={() => setPaletteOpen(false)}
              onPage={go}
              onAsset={(id) => {
                if (onCanvas && canvasRef.current) {
                  canvasRef.current.focus(id)
                } else {
                  setCanvasFocus(id)
                  setPage('assets')
                }
              }}
              onCreate={onCreateAsset}
              onSettings={onSettings}
            />
          ) : null}
        </div>
      )
    }
  }
}

/* ── Shared ────────────────────────────────────────────────────────────── */

function useMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useMemo(() => () => setOpen(false), [])
  useDismiss(ref, open, close)
  return [ref, { open, setOpen, close }] as const
}

/** A group's pages as a menu, opening `side` of its trigger. */
function GroupMenu({
  group,
  page,
  go,
  side,
  onPick,
}: {
  group: NavGroup
  page: ShellPage
  go: Go
  side: 'right' | 'below' | 'above'
  onPick: () => void
}) {
  return (
    <div className={s.groupMenu} data-side={side} role="menu" aria-label={group.label}>
      <span className={s.popLabel}>{group.label}</span>
      {group.items.map((item) => (
        <button
          key={item.page}
          type="button"
          role="menuitemradio"
          aria-checked={page === item.page}
          className={s.popItem}
          onClick={() => {
            go(item.page)
            onPick()
          }}
        >
          <span className={s.popItemLabel}>{item.label}</span>
          {page === item.page ? <Check size={14} weight="bold" aria-hidden /> : null}
        </button>
      ))}
    </div>
  )
}

function holds(group: NavGroup, page: ShellPage) {
  return page !== 'home' && groupOf(page)?.id === group.id
}

function WorkspaceMenu({
  workspace,
  onWorkspaceChange,
  side,
  compact = false,
}: {
  workspace: string
  onWorkspaceChange: (workspace: string) => void
  side: 'right' | 'below' | 'above'
  compact?: boolean
}) {
  const [menuRef, menu] = useMenu()
  return (
    <div className={s.menuAnchor} ref={menuRef}>
      <button
        type="button"
        className={compact ? s.workspaceTile : s.workspaceChip}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label={`Workspace: ${workspace}`}
        title={workspace}
        onClick={() => menu.setOpen((open) => !open)}
      >
        <span className={s.workspaceMark}>{workspace[0]}</span>
        {compact ? null : (
          <>
            <span className={s.workspaceName}>{workspace}</span>
            <CaretDown size={14} aria-hidden />
          </>
        )}
      </button>
      {menu.open ? (
        <div className={s.groupMenu} data-side={side} role="menu" aria-label="Workspace">
          <span className={s.popLabel}>Workspace</span>
          {STUDIO_WORKSPACE_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              role="menuitemradio"
              aria-checked={name === workspace}
              className={s.popItem}
              onClick={() => {
                onWorkspaceChange(name)
                menu.close()
              }}
            >
              <span className={s.popItemLabel}>{name}</span>
              {name === workspace ? <Check size={14} weight="bold" aria-hidden /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* ── 2 · Icon rail ─────────────────────────────────────────────────────── */

function RailNav({ nav, onSettings }: { nav: Nav; onSettings: () => void }) {
  return (
    <nav className={s.rail} aria-label="Studio">
      <RailButton icon={<House size={22} aria-hidden />} label="Home" active={nav.page === 'home'} onClick={() => nav.go('home')} />
      {NAV.map((entry) =>
        isGroup(entry) ? (
          <RailGroup key={entry.id} group={entry} nav={nav} />
        ) : (
          <RailButton
            key={entry.page}
            icon={entry.icon}
            label={entry.label}
            active={nav.page === entry.page}
            onClick={() => nav.go(entry.page)}
          />
        ),
      )}
      <span className={s.railSpacer} />
      <RailButton icon={<GearSix size={22} aria-hidden />} label="Settings" onClick={onSettings} />
    </nav>
  )
}

function RailButton({
  icon,
  label,
  active = false,
  onClick,
  expanded,
}: {
  icon: ReactNode
  label: string
  active?: boolean
  onClick: () => void
  expanded?: boolean
}) {
  return (
    <button
      type="button"
      className={s.railButton}
      aria-current={active ? 'page' : undefined}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <span className={s.railIcon}>{icon}</span>
      <span className={s.railLabel}>{label}</span>
    </button>
  )
}

function RailGroup({ group, nav }: { group: NavGroup; nav: Nav }) {
  const [menuRef, menu] = useMenu()
  return (
    <div className={s.menuAnchor} ref={menuRef}>
      <RailButton
        icon={group.icon}
        label={group.label}
        active={holds(group, nav.page)}
        expanded={menu.open}
        onClick={() => menu.setOpen((open) => !open)}
      />
      {menu.open ? <GroupMenu group={group} page={nav.page} go={nav.go} side="right" onPick={menu.close} /> : null}
    </div>
  )
}

/* ── 3 · Top tabs ──────────────────────────────────────────────────────── */

function TabsNav({
  nav,
  workspace,
  onWorkspaceChange,
  onSettings,
}: {
  nav: Nav
  workspace: string
  onWorkspaceChange: (workspace: string) => void
  onSettings: () => void
}) {
  return (
    <div className={s.tabBar}>
      <div className={s.tabLead}>
        <Dropdown label="Workspace" options={STUDIO_WORKSPACE_NAMES} value={workspace} onChange={onWorkspaceChange} full />
      </div>
      <nav className={s.tabs} aria-label="Studio">
        {NAV.map((entry) =>
          isGroup(entry) ? (
            <TabGroup key={entry.id} group={entry} nav={nav} />
          ) : (
            <button
              key={entry.page}
              type="button"
              className={s.tab}
              aria-current={nav.page === entry.page ? 'page' : undefined}
              onClick={() => nav.go(entry.page)}
            >
              {entry.icon}
              {entry.label}
            </button>
          ),
        )}
      </nav>
      <button type="button" className={s.iconButton} aria-label="Settings" onClick={onSettings}>
        <GearSix size={18} aria-hidden />
      </button>
    </div>
  )
}

function TabGroup({ group, nav }: { group: NavGroup; nav: Nav }) {
  const [menuRef, menu] = useMenu()
  const active = holds(group, nav.page)
  return (
    <div className={s.menuAnchor} ref={menuRef}>
      <button
        type="button"
        className={s.tab}
        aria-current={active ? 'page' : undefined}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        onClick={() => menu.setOpen((open) => !open)}
      >
        {group.icon}
        {group.label}
        {active && nav.page !== 'home' ? <span className={s.tabSub}>{pageLabel(nav.page)}</span> : null}
        <CaretDown className={s.tabCaret} size={14} aria-hidden />
      </button>
      {menu.open ? <GroupMenu group={group} page={nav.page} go={nav.go} side="below" onPick={menu.close} /> : null}
    </div>
  )
}

/* ── 4 · Floating dock ─────────────────────────────────────────────────── */

function DockNav({
  nav,
  workspace,
  onWorkspaceChange,
  onSettings,
}: {
  nav: Nav
  workspace: string
  onWorkspaceChange: (workspace: string) => void
  onSettings: () => void
}) {
  return (
    <nav className={s.dock} aria-label="Studio">
      <WorkspaceMenu workspace={workspace} onWorkspaceChange={onWorkspaceChange} side="above" compact />
      <span className={s.dockRule} aria-hidden />
      {NAV.map((entry) =>
        isGroup(entry) ? (
          <DockGroup key={entry.id} group={entry} nav={nav} />
        ) : (
          <button
            key={entry.page}
            type="button"
            className={s.dockButton}
            aria-current={nav.page === entry.page ? 'page' : undefined}
            onClick={() => nav.go(entry.page)}
          >
            {entry.icon}
            <span className={s.dockLabel}>{entry.label}</span>
          </button>
        ),
      )}
      <span className={s.dockRule} aria-hidden />
      <button type="button" className={s.dockButton} aria-label="Settings" onClick={onSettings}>
        <GearSix size={20} aria-hidden />
      </button>
    </nav>
  )
}

function DockGroup({ group, nav }: { group: NavGroup; nav: Nav }) {
  const [menuRef, menu] = useMenu()
  return (
    <div className={s.menuAnchor} ref={menuRef}>
      <button
        type="button"
        className={s.dockButton}
        aria-current={holds(group, nav.page) ? 'page' : undefined}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        onClick={() => menu.setOpen((open) => !open)}
      >
        {group.icon}
        <span className={s.dockLabel}>{holds(group, nav.page) ? pageLabel(nav.page as StudioPage) : group.label}</span>
        <CaretDown className={s.tabCaret} size={12} aria-hidden />
      </button>
      {menu.open ? <GroupMenu group={group} page={nav.page} go={nav.go} side="above" onPick={menu.close} /> : null}
    </div>
  )
}

/* ── 5 · Saved views ───────────────────────────────────────────────────── */

function ViewsNav({
  nav,
  boardView,
  onBoardView,
  workspace,
  onWorkspaceChange,
  onSettings,
}: {
  nav: Nav
  boardView: string
  onBoardView: (view: string) => void
  workspace: string
  onWorkspaceChange: (workspace: string) => void
  onSettings: () => void
}) {
  const views = [
    { name: 'All assets', count: STUDIO_ASSETS.length, color: null },
    ...ASSET_CATEGORIES.map((name) => ({
      name,
      count: STUDIO_ASSETS.filter((asset) => asset.category === name).length,
      color: CATEGORY_COLOR[name] ?? '#fff',
    })),
  ]
  return (
    <aside className={s.views} aria-label="Studio">
      <div className={s.viewsHead}>
        <WorkspaceMenu workspace={workspace} onWorkspaceChange={onWorkspaceChange} side="below" />
      </div>
      <div className={s.viewsScroll}>
        <div className={s.viewsSection}>
          <span className={s.viewsLabel}>
            <Kanban size={14} aria-hidden />
            Board views
          </span>
          {views.map((item) => (
            <button
              key={item.name}
              type="button"
              className={s.viewItem}
              aria-current={nav.page === 'assets' && boardView === item.name ? 'page' : undefined}
              onClick={() => onBoardView(item.name)}
            >
              {item.color ? (
                <span className={s.viewDot} style={{ background: item.color }} aria-hidden />
              ) : (
                <SquaresFour size={16} aria-hidden />
              )}
              <span className={s.viewName}>{item.name}</span>
              <span className={s.viewCount}>{item.count}</span>
            </button>
          ))}
        </div>
        <div className={s.viewsSection}>
          <span className={s.viewsLabel}>Workspace</span>
          <LibraryLinks nav={nav} includeAssets={false} />
        </div>
      </div>
      <div className={s.viewsFoot}>
        <button type="button" className={s.viewItem} onClick={onSettings}>
          <GearSix size={20} aria-hidden />
          <span className={s.viewName}>Settings</span>
        </button>
      </div>
    </aside>
  )
}

/* ── 6 · Pill nav ──────────────────────────────────────────────────────── */

function PillNav({
  nav,
  workspace,
  onWorkspaceChange,
  onSettings,
}: {
  nav: Nav
  workspace: string
  onWorkspaceChange: (workspace: string) => void
  onSettings: () => void
}) {
  return (
    <div className={s.pillBar}>
      <WorkspaceMenu workspace={workspace} onWorkspaceChange={onWorkspaceChange} side="below" />
      <nav className={s.pills} aria-label="Studio">
        {NAV.map((entry) =>
          isGroup(entry) ? (
            <PillGroup key={entry.id} group={entry} nav={nav} />
          ) : (
            <button
              key={entry.page}
              type="button"
              className={s.pill}
              aria-current={nav.page === entry.page ? 'page' : undefined}
              onClick={() => nav.go(entry.page)}
            >
              {entry.label === 'Assets' ? 'Library' : entry.label}
            </button>
          ),
        )}
      </nav>
      <button type="button" className={s.iconButton} aria-label="Settings" onClick={onSettings}>
        <GearSix size={18} aria-hidden />
      </button>
    </div>
  )
}

function PillGroup({ group, nav }: { group: NavGroup; nav: Nav }) {
  const [menuRef, menu] = useMenu()
  const active = holds(group, nav.page)
  return (
    <div className={s.menuAnchor} ref={menuRef}>
      <button
        type="button"
        className={s.pill}
        aria-current={active ? 'page' : undefined}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        onClick={() => menu.setOpen((open) => !open)}
      >
        {active ? pageLabel(nav.page as StudioPage) : group.label}
        <CaretDown className={s.tabCaret} size={12} aria-hidden />
      </button>
      {menu.open ? <GroupMenu group={group} page={nav.page} go={nav.go} side="below" onPick={menu.close} /> : null}
    </div>
  )
}

/** The workspace's pages as a vertical list, with Sources and Content expanding in place. */
function LibraryLinks({ nav, includeAssets = true }: { nav: Nav; includeAssets?: boolean }) {
  const [open, setOpen] = useState<Record<NavGroup['id'], boolean>>({ sources: false, content: false })
  return NAV.filter((entry) => includeAssets || isGroup(entry) || entry.page !== 'assets').map((entry) => {
    if (!isGroup(entry)) {
      return (
        <button
          key={entry.page}
          type="button"
          className={s.viewItem}
          aria-current={nav.page === entry.page ? 'page' : undefined}
          onClick={() => nav.go(entry.page)}
        >
          {entry.icon}
          <span className={s.viewName}>{entry.label}</span>
        </button>
      )
    }
    const expanded = open[entry.id] || holds(entry, nav.page)
    return (
      <div key={entry.id}>
        <button
          type="button"
          className={s.viewItem}
          aria-expanded={expanded}
          onClick={() => setOpen((prev) => ({ ...prev, [entry.id]: !expanded }))}
        >
          {entry.icon}
          <span className={s.viewName}>{entry.label}</span>
          <CaretRight className={s.viewCaret} size={14} aria-hidden />
        </button>
        {expanded ? (
          <div className={s.viewSub}>
            {entry.items.map((item) => (
              <button
                key={item.page}
                type="button"
                className={`${s.viewItem} ${s.viewSubItem}`}
                aria-current={nav.page === item.page ? 'page' : undefined}
                onClick={() => nav.go(item.page)}
              >
                <span className={s.viewName}>{item.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    )
  })
}

/* ── 7 · Home command centre ───────────────────────────────────────────── */

const ASSET_LIMIT = 50

function HomeSidebar({
  nav,
  pinned,
  spotlight,
  onPinned,
  workspace,
  onWorkspaceChange,
  onSettings,
}: {
  nav: Nav
  pinned: string[]
  spotlight: string
  onPinned: (id: string) => void
  workspace: string
  onWorkspaceChange: (workspace: string) => void
  onSettings: () => void
}) {
  const used = STUDIO_ASSETS.length / ASSET_LIMIT
  return (
    <aside className={s.views} aria-label="Studio">
      <div className={s.viewsHead}>
        <WorkspaceMenu workspace={workspace} onWorkspaceChange={onWorkspaceChange} side="below" />
      </div>
      <div className={s.viewsScroll}>
        <div className={s.viewsSection}>
          <button
            type="button"
            className={s.viewItem}
            aria-current={nav.page === 'home' ? 'page' : undefined}
            onClick={() => nav.go('home')}
          >
            <House size={20} aria-hidden />
            <span className={s.viewName}>Home</span>
          </button>
          <LibraryLinks nav={nav} />
        </div>
        <div className={s.viewsSection}>
          <span className={s.viewsLabel}>
            <PushPin size={14} aria-hidden />
            Pinned
          </span>
          {pinned.map((id) => {
            const asset = STUDIO_ASSETS.find((candidate) => candidate.id === id)
            if (!asset) return null
            return (
              <button
                key={id}
                type="button"
                className={s.viewItem}
                aria-current={nav.page === 'home' && spotlight === id ? 'true' : undefined}
                title={asset.title}
                onClick={() => onPinned(id)}
              >
                <span className={s.viewDot} style={{ background: CATEGORY_COLOR[asset.category] ?? '#fff' }} aria-hidden />
                <span className={s.viewName}>{asset.title}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className={s.usage}>
        <span className={s.usageHead}>
          <span>Assets used</span>
          <span className={s.usageValue}>
            {STUDIO_ASSETS.length} of {ASSET_LIMIT}
          </span>
        </span>
        <span className={s.usageBar} role="meter" aria-valuenow={STUDIO_ASSETS.length} aria-valuemin={0} aria-valuemax={ASSET_LIMIT} aria-label="Assets used">
          <span style={{ width: `${used * 100}%` }} />
        </span>
      </div>
      <div className={s.viewsFoot}>
        <button type="button" className={s.viewItem} onClick={onSettings}>
          <GearSix size={20} aria-hidden />
          <span className={s.viewName}>Settings</span>
        </button>
      </div>
    </aside>
  )
}

/* ── 8 · Canvas bar ────────────────────────────────────────────────────── */

function CanvasBar({
  nav,
  floating,
  workspace,
  onWorkspaceChange,
  onSettings,
  onCreate,
  onPalette,
}: {
  nav: Nav
  floating: boolean
  workspace: string
  onWorkspaceChange: (workspace: string) => void
  onSettings: () => void
  onCreate: () => void
  onPalette: () => void
}) {
  return (
    <div className={s.canvasBar} data-floating={floating || undefined}>
      <div className={s.canvasLead}>
        <WorkspaceMenu workspace={workspace} onWorkspaceChange={onWorkspaceChange} side="below" />
        <span className={s.crumbRule} aria-hidden>
          /
        </span>
        <PageMenu nav={nav} />
      </div>
      <button type="button" className={s.commandButton} onClick={onPalette} aria-keyshortcuts="/">
        <MagnifyingGlass size={16} aria-hidden />
        <span className={s.commandText}>Search or jump to…</span>
        <kbd className={s.commandKbd}>/</kbd>
      </button>
      <div className={s.canvasTools}>
        <button type="button" className={s.iconButton} aria-label="Settings" onClick={onSettings}>
          <GearSix size={18} aria-hidden />
        </button>
        <button type="button" className={s.heroCreate} onClick={onCreate}>
          <Plus size={16} aria-hidden />
          New asset
        </button>
      </div>
    </div>
  )
}

/** The current page as a breadcrumb that opens every page in the workspace. */
function PageMenu({ nav }: { nav: Nav }) {
  const [menuRef, menu] = useMenu()
  const label = nav.page === 'home' ? 'Home' : nav.page === 'assets' ? 'Asset canvas' : pageLabel(nav.page)
  const pick = (page: StudioPage) => {
    nav.go(page)
    menu.close()
  }
  const item = (page: StudioPage, text: string) => (
    <button
      key={page}
      type="button"
      role="menuitemradio"
      aria-checked={nav.page === page}
      className={s.popItem}
      onClick={() => pick(page)}
    >
      <span className={s.popItemLabel}>{text}</span>
      {nav.page === page ? <Check size={14} weight="bold" aria-hidden /> : null}
    </button>
  )
  return (
    <div className={s.menuAnchor} ref={menuRef}>
      <button
        type="button"
        className={s.crumb}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        onClick={() => menu.setOpen((open) => !open)}
      >
        {label}
        <CaretDown className={s.tabCaret} size={14} aria-hidden />
      </button>
      {menu.open ? (
        <div className={`${s.groupMenu} ${s.pageMenu}`} data-side="below" role="menu" aria-label="Pages">
          {NAV.map((entry) =>
            isGroup(entry) ? (
              <div key={entry.id} className={s.pageMenuGroup}>
                <span className={s.popLabel}>{entry.label}</span>
                {entry.items.map((sub) => item(sub.page, sub.label))}
              </div>
            ) : (
              item(entry.page, entry.page === 'assets' ? 'Asset canvas' : entry.label)
            ),
          )}
        </div>
      ) : null}
    </div>
  )
}
