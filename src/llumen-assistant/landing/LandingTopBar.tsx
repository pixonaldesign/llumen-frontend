import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Bell, CaretDown, GearSix, LockSimple, MagnifyingGlass, Plus, SquaresFour, User, Users } from '@phosphor-icons/react'
import { landingAssets as a } from './landingAssets'
import type { TopBarVariant } from '../prototypeChrome'
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

export type LandingTopBarProps = {
  variant: TopBarVariant
  /** Active workspace label. Omit to keep selection inside the studio bar. */
  workspace?: string
  /** Workspace menu entries. Omit to use All, Private, and Shared With Me. */
  workspaces?: readonly WorkspaceOption[]
  /** Category menu entries. Omit to use Finance, Operations, and the rest. */
  categories?: readonly string[]
  onWorkspaceChange?: (workspace: string) => void
}

export function LandingTopBar({
  variant,
  workspace,
  workspaces,
  categories,
  onWorkspaceChange,
}: LandingTopBarProps) {
  if (variant === 'studio') {
    return (
      <StudioBar
        workspace={workspace}
        workspaces={workspaces}
        categories={categories}
        onWorkspaceChange={onWorkspaceChange}
      />
    )
  }
  return <CurrentBar />
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
          <GearSix size={20} weight="regular" aria-hidden />
          Studio
        </button>
        <button type="button" className={home.pillBtn}>
          <Plus size={20} weight="regular" aria-hidden />
          Create
        </button>
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
}: {
  workspace?: string
  workspaces?: readonly WorkspaceOption[]
  categories?: readonly string[]
  onWorkspaceChange?: (workspace: string) => void
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

  return (
    <div className={styles.row}>
      <a className={styles.logo} href="#top" aria-label="Llumen home">
        <img className={home.logoMark} src={a.logoMark} alt="" />
        <img className={home.logoWord} src={a.wordmark} alt="Llumen" />
      </a>
      <div className={styles.center}>
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
        <button type="button" className={styles.ghost}>
          <GearSix size={20} weight="regular" aria-hidden />
          Studio
        </button>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.create}>
          <Plus size={20} weight="regular" aria-hidden />
          Create
        </button>
        <button type="button" className={styles.icon} aria-label="Search">
          <MagnifyingGlass size={20} weight="regular" />
        </button>
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
