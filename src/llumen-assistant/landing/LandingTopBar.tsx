import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Bell,
  CaretDown,
  ChartDonut,
  ChartPieSlice,
  Check,
  Cube,
  Layout,
  LockSimple,
  MagnifyingGlass,
  Newspaper,
  Plus,
  PresentationChart,
  Sparkle,
  SquaresFour,
  User,
  Users,
} from '@phosphor-icons/react'
import { landingAssets as a } from './landingAssets'
import type { FindingsStyle, TopBarVariant } from '../prototypeChrome'
import { SearchOverlay } from './SearchOverlay'
import home from './LandingHome.module.css'
import styles from './LandingTopBar.module.css'

export type WorkspaceIcon = 'all' | 'private' | 'shared'

export type WorkspaceOption = {
  label: string
  icon: WorkspaceIcon
}

/** Workspace choices shared by the filter rail and the studio top-bar menu. */
export const STUDIO_WORKSPACES: readonly WorkspaceOption[] = [
  { label: 'All', icon: 'all' },
  { label: 'Private', icon: 'private' },
  { label: 'Shared With Me', icon: 'shared' },
]

/** Category choices shared by the filter rail and the studio top-bar menu. */
export const STUDIO_CATEGORIES = [
  'Finance',
  'Operations',
  'HR',
  'Sales',
  'Marketing',
  'IT',
  'Product',
  'Engineering',
  'Customer Success',
] as const

/** Shorter label for the Shared scope tab. The current rail still uses "Shared With Me". */
function studioName(label: string) {
  return label === 'Shared With Me' ? 'Shared' : label
}

const PRIVATE_WORKSPACES = new Set(['Finance', 'HR', 'IT', 'Product'])
const SHARED_WORKSPACES = new Set(['Operations', 'Sales', 'Marketing', 'Engineering', 'Customer Success'])

function workspacesForScope(scope: WorkspaceIcon, all: readonly string[]) {
  if (scope === 'private') return all.filter((label) => PRIVATE_WORKSPACES.has(label))
  if (scope === 'shared') return all.filter((label) => SHARED_WORKSPACES.has(label))
  return [...all]
}

export function WorkspaceGlyph({ name }: { name: WorkspaceIcon }) {
  const icon: Record<WorkspaceIcon, ReactNode> = {
    all: <SquaresFour size={20} weight="regular" aria-hidden />,
    private: <LockSimple size={20} weight="regular" aria-hidden />,
    shared: <Users size={20} weight="regular" aria-hidden />,
  }
  return icon[name]
}

export type TopBarView = 'briefing' | 'assets' | 'studio'

const TOP_BAR_VIEWS: readonly { view: TopBarView; label: string; icon: ReactNode }[] = [
  { view: 'briefing', label: 'Briefing', icon: <Newspaper size={20} weight="regular" aria-hidden /> },
  { view: 'assets', label: 'My Assets', icon: <ChartPieSlice size={20} weight="regular" aria-hidden /> },
  { view: 'studio', label: 'Studio', icon: <ChartDonut size={20} weight="regular" aria-hidden /> },
]

export type LandingTopBarProps = {
  variant: TopBarVariant
  /** Active workspace label. Omit to keep selection inside the studio bar. */
  workspace?: string
  /** Workspace menu entries. Omit to use All, Private, and Shared With Me. */
  workspaces?: readonly WorkspaceOption[]
  /** Category menu entries. Omit to use Finance, Operations, and the rest. */
  categories?: readonly string[]
  onWorkspaceChange?: (workspace: string) => void
  /** Studio bar: show the workspace selector in place of the Llumen wordmark. */
  workspaceInLogo?: boolean
  /** Studio bar: show a Briefing / Studio toggle, starting on Briefing, instead of the Studio button. */
  briefingTab?: boolean
  /** With briefingTab: a My Assets option between Briefing and Studio. */
  myAssetsTab?: boolean
  /** Selected toggle option. Omit to keep the selection inside the studio bar. */
  view?: TopBarView
  onViewChange?: (view: TopBarView) => void
  /** Studio bar with the workspace in the logo: a findings layout menu beside the workspace. */
  findingsStyle?: FindingsStyle
  onFindingsStyleChange?: (style: FindingsStyle) => void
}

export function LandingTopBar({
  variant,
  workspace,
  workspaces,
  categories,
  onWorkspaceChange,
  workspaceInLogo = false,
  briefingTab = false,
  myAssetsTab = false,
  view,
  onViewChange,
  findingsStyle,
  onFindingsStyleChange,
}: LandingTopBarProps) {
  if (variant === 'studio') {
    return (
      <StudioBar
        workspace={workspace}
        workspaces={workspaces}
        categories={categories}
        onWorkspaceChange={onWorkspaceChange}
        workspaceInLogo={workspaceInLogo}
        briefingTab={briefingTab}
        myAssetsTab={myAssetsTab}
        view={view}
        onViewChange={onViewChange}
        findingsStyle={findingsStyle}
        onFindingsStyleChange={onFindingsStyleChange}
      />
    )
  }
  return <CurrentBar />
}

const FINDINGS_STYLES: readonly { style: FindingsStyle; label: string; hint: string }[] = [
  { style: 1, label: 'Findings style 1', hint: 'Centred over the chat bar' },
  { style: 2, label: 'Findings style 2', hint: 'Chat bar on the left' },
  { style: 3, label: 'Findings style 3', hint: 'Chat bar above compact findings' },
  { style: 4, label: 'Findings style 4', hint: 'Chat bar above the findings' },
  { style: 5, label: 'Findings style 5', hint: 'Chat bar on the left' },
  { style: 6, label: 'Findings style 6', hint: 'Assets and Apps slide in from the right' },
  { style: 7, label: 'Findings style 7', hint: 'Assets panel on the right' },
]

function FindingsStyleMenu({ value, onChange }: { value: FindingsStyle; onChange: (style: FindingsStyle) => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <div className={styles.workspaceWrap} ref={menuRef}>
      <button
        type="button"
        className={styles.workspace}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Layout size={18} weight="regular" aria-hidden />
        <span className={styles.workspaceName}>
          Findings style {value}
          <CaretDown size={16} weight="bold" aria-hidden />
        </span>
      </button>
      {menuOpen ? (
        <div className={`${styles.menu} ${styles.stylesMenu}`} role="menu" aria-label="Findings style">
          {FINDINGS_STYLES.map((option) => {
            const selected = option.style === value
            return (
              <button
                key={option.style}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`${styles.menuItem} ${styles.styleItem}${selected ? ` ${styles.menuItemActive}` : ''}`}
                onClick={() => {
                  onChange(option.style)
                  setMenuOpen(false)
                }}
              >
                <span className={styles.styleText}>
                  {option.label}
                  <span className={styles.styleHint}>{option.hint}</span>
                </span>
                {selected ? <Check size={16} weight="bold" aria-hidden /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

const AssetBuilder = lazy(() => import('../../asset-builder/AssetBuilder'))

type CreateKind = 'asset' | 'app' | 'agent'

const CREATE_OPTIONS: readonly { kind: CreateKind; label: string; icon: ReactNode; active: boolean }[] = [
  { kind: 'asset', label: 'Asset', icon: <Cube size={20} weight="regular" aria-hidden />, active: true },
  { kind: 'app', label: 'App', icon: <PresentationChart size={20} weight="regular" aria-hidden />, active: false },
  { kind: 'agent', label: 'Agent', icon: <Sparkle size={20} weight="regular" aria-hidden />, active: false },
]

function CreateMenu({ triggerClassName }: { triggerClassName: string }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [building, setBuilding] = useState<CreateKind | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <div className={styles.workspaceWrap} ref={menuRef}>
      <button
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((value) => !value)}
      >
        <Plus size={20} weight="regular" aria-hidden />
        Create
      </button>
      {menuOpen ? (
        <div className={`${styles.menu} ${styles.createMenu}`} role="menu" aria-label="Create">
          {CREATE_OPTIONS.map((option) => (
            <button
              key={option.kind}
              type="button"
              role="menuitem"
              className={styles.menuItem}
              disabled={!option.active}
              onClick={() => {
                setMenuOpen(false)
                setBuilding(option.kind)
              }}
            >
              {option.icon}
              {option.label}
              {option.active ? null : <span className={styles.soon}>Soon</span>}
            </button>
          ))}
        </div>
      ) : null}
      {building === 'asset' ? (
        <Suspense fallback={null}>
          <AssetBuilder onClose={() => setBuilding(null)} />
        </Suspense>
      ) : null}
    </div>
  )
}

function CurrentBar() {
  return (
    <div className={home.navTop}>
      <a className={home.logo} href="#top" aria-label="Llumen home">
        <img className={home.logoMark} src={a.logoMark} alt="" />
        <img className={home.logoWord} src={a.wordmark} alt="Llumen" />
      </a>
      <label className={home.search}>
        <MagnifyingGlass size={16} weight="regular" aria-hidden />
        <input type="search" placeholder="Search..." aria-label="Search" />
      </label>
      <div className={home.navActions}>
        <button type="button" className={home.pillBtn}>
          <ChartDonut size={20} weight="regular" aria-hidden />
          Studio
        </button>
        <CreateMenu triggerClassName={home.pillBtn} />
        <button type="button" className={home.iconBtn} aria-label="Notifications">
          <Bell size={20} weight="regular" />
        </button>
        <button type="button" className={home.iconBtn} aria-label="Account">
          <User size={20} weight="regular" />
        </button>
      </div>
    </div>
  )
}

function StudioBar({
  workspace,
  workspaces,
  categories,
  onWorkspaceChange,
  workspaceInLogo,
  briefingTab,
  myAssetsTab,
  view,
  onViewChange,
  findingsStyle,
  onFindingsStyleChange,
}: {
  workspace?: string
  workspaces?: readonly WorkspaceOption[]
  categories?: readonly string[]
  onWorkspaceChange?: (workspace: string) => void
  workspaceInLogo: boolean
  briefingTab: boolean
  myAssetsTab: boolean
  view?: TopBarView
  onViewChange?: (view: TopBarView) => void
  findingsStyle?: FindingsStyle
  onFindingsStyleChange?: (style: FindingsStyle) => void
}) {
  const workspaceOptions = workspaces ?? STUDIO_WORKSPACES
  const categoryOptions = categories ?? STUDIO_CATEGORIES
  const [scope, setScope] = useState<WorkspaceIcon>('all')
  const listed = workspacesForScope(scope, categoryOptions)
  const [uncontrolled, setUncontrolled] = useState(categoryOptions[0] ?? 'Finance')
  const selected = workspace ?? uncontrolled
  const committed = categoryOptions.find((label) => label === selected)
  const triggerLabel = committed ?? categoryOptions[0] ?? 'Finance'
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [ownMode, setOwnMode] = useState<TopBarView>('briefing')
  const mode = view ?? ownMode
  const modes = TOP_BAR_VIEWS.filter((option) => myAssetsTab || option.view !== 'assets')
  const setMode = (next: TopBarView) => {
    if (view === undefined) setOwnMode(next)
    onViewChange?.(next)
  }
  const menuRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const segmentRefs = useRef<Partial<Record<WorkspaceIcon, HTMLButtonElement | null>>>({})
  const thumbReady = useRef(false)

  const choose = (label: string) => {
    if (workspace === undefined) setUncontrolled(label)
    onWorkspaceChange?.(label)
    setMenuOpen(false)
  }

  useLayoutEffect(() => {
    if (!menuOpen) {
      thumbReady.current = false
      return
    }
    const button = segmentRefs.current[scope]
    const thumb = thumbRef.current
    if (!button || !thumb) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const place = () => {
      thumb.style.left = `${button.offsetLeft}px`
      thumb.style.top = `${button.offsetTop}px`
      thumb.style.width = `${button.offsetWidth}px`
      thumb.style.height = `${button.offsetHeight}px`
    }
    if (!thumbReady.current || reduce) {
      thumb.style.transition = 'none'
      place()
      thumb.getBoundingClientRect()
      thumb.style.transition = ''
      thumbReady.current = true
      return
    }
    place()
  }, [scope, menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const workspaceSelector = (
    <div className={styles.workspaceWrap} ref={menuRef}>
      <button
        type="button"
        className={styles.workspace}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((value) => !value)}
      >
        <span className={styles.muted}>Workspace</span>
        <span className={styles.muted}>/</span>
        <span className={styles.workspaceName}>
          {triggerLabel}
          <CaretDown size={16} weight="bold" aria-hidden />
        </span>
      </button>
      {menuOpen ? (
        <div className={styles.menu}>
          {workspaceOptions.length > 0 ? (
            <div className={styles.segments} role="radiogroup" aria-label="Workspace scope">
              <div className={styles.thumb} ref={thumbRef} aria-hidden />
              {workspaceOptions.map((item) => {
                const isSelected = scope === item.icon
                const name = studioName(item.label)
                return (
                  <button
                    key={item.label}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={isSelected ? undefined : name}
                    className={`${styles.segment}${isSelected ? ` ${styles.segmentActive}` : ''}`}
                    ref={(node) => {
                      segmentRefs.current[item.icon] = node
                    }}
                    onClick={() => setScope(item.icon)}
                  >
                    <WorkspaceGlyph name={item.icon} />
                    {isSelected ? <span>{name}</span> : null}
                  </button>
                )
              })}
            </div>
          ) : null}
          {workspaceOptions.length > 0 && listed.length > 0 ? (
            <div className={styles.menuRule} role="separator" />
          ) : null}
          <div key={scope} className={styles.workspaceList} role="listbox" aria-label="Workspaces">
            {listed.map((label) => {
              const isSelected = label === committed
              return (
                <button
                  key={label}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.menuItem}${isSelected ? ` ${styles.menuItemActive}` : ''}`}
                  onClick={() => choose(label)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className={styles.row}>
      {workspaceInLogo ? (
        <div className={styles.lead}>
          <a className={styles.logo} href="#top" aria-label="Llumen home">
            <img className={home.logoMark} src={a.logoMark} alt="" />
          </a>
          {workspaceSelector}
          {findingsStyle && onFindingsStyleChange ? (
            <FindingsStyleMenu value={findingsStyle} onChange={onFindingsStyleChange} />
          ) : null}
        </div>
      ) : (
        <a className={styles.logo} href="#top" aria-label="Llumen home">
          <img className={home.logoMark} src={a.logoMark} alt="" />
          <img className={home.logoWord} src={a.wordmark} alt="Llumen" />
        </a>
      )}
      <div className={styles.center}>
        {workspaceInLogo ? null : workspaceSelector}
        {briefingTab ? (
          <div
            className={styles.modeToggle}
            role="radiogroup"
            aria-label="View"
            style={
              {
                '--modes': modes.length,
                '--mode-index': Math.max(0, modes.findIndex((option) => option.view === mode)),
              } as CSSProperties
            }
          >
            <span className={styles.modeThumb} aria-hidden />
            {modes.map((option) => (
              <button
                key={option.view}
                type="button"
                role="radio"
                aria-checked={mode === option.view}
                className={styles.modeOption}
                onClick={() => setMode(option.view)}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className={styles.ghost}>
            <ChartDonut size={20} weight="regular" aria-hidden />
            Studio
          </button>
        )}
      </div>
      <div className={styles.actions}>
        <CreateMenu triggerClassName={styles.create} />
        <button
          type="button"
          className={styles.icon}
          aria-label="Search"
          aria-haspopup="dialog"
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen(true)}
        >
          <MagnifyingGlass size={20} weight="regular" />
        </button>
        {searchOpen ? <SearchOverlay onClose={() => setSearchOpen(false)} /> : null}
        <button type="button" className={styles.icon} aria-label="Notifications">
          <Bell size={20} weight="regular" />
        </button>
        <button type="button" className={styles.icon} aria-label="Account">
          <User size={20} weight="regular" />
        </button>
      </div>
    </div>
  )
}
