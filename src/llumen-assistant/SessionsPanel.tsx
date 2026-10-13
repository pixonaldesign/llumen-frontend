import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  DotsThreeVertical,
  Export,
  GearSix,
  PencilSimple,
  Trash,
  User,
  X,
} from '@phosphor-icons/react'
import styles from './SessionsPanel.module.css'

export type SessionSummary = {
  id: string
  title: string
  updatedLabel: string
  preview: string
}

/** Preloaded demo session — turn 1 question + agent reply. */
export const DEMO_SESSION_ID = 'aq-corridor'

export const DEMO_SESSIONS: SessionSummary[] = [
  {
    id: DEMO_SESSION_ID,
    title: 'Air quality corridor review',
    updatedLabel: 'Today · just now',
    preview: 'What is driving the deterioration in air quality, where is it concentrated…',
  },
  {
    id: '1',
    title: 'Marina logistics brief',
    updatedLabel: 'Today · 2:14 PM',
    preview: 'Affirmative. A demo response stream. • Location: Dubai Marina…',
  },
  {
    id: '2',
    title: 'Weekly ops recap',
    updatedLabel: 'Today · 11:02 AM',
    preview: 'Summary of throughput, exceptions, and SLA notes for stakeholders.',
  },
  {
    id: '4',
    title:
      'Aligning color palettes with IBM Carbon design system for industrial ops dashboards',
    updatedLabel: 'Yesterday',
    preview: 'Token naming, component inventory, and Figma library links.',
  },
  {
    id: '5',
    title: 'Port dwell-time anomalies',
    updatedLabel: 'Mon',
    preview: 'Three berths exceeding expected turnaround windows.',
  },
  {
    id: '6',
    title: 'Fleet utilization snapshot',
    updatedLabel: 'Sun',
    preview: 'Idle rate down 4% week over week across northern routes.',
  },
  {
    id: '7',
    title: 'Incident response playbook',
    updatedLabel: 'Mar 30',
    preview: 'Escalation paths for hazardous material alerts.',
  },
  {
    id: '8',
    title: 'Q1 KPI briefing draft',
    updatedLabel: 'Mar 28',
    preview: 'Leadership slides covering throughput and exception rates.',
  },
  {
    id: '9',
    title: 'Sensor coverage gaps',
    updatedLabel: 'Mar 26',
    preview: 'Missing stations along the southern industrial belt.',
  },
  {
    id: '10',
    title: 'Stakeholder FAQ — ops',
    updatedLabel: 'Mar 22',
    preview: 'Common questions on SLA breaches and remediations.',
  },
]

export type SessionsPanelProps = {
  onOpenSession: (id: string) => void
  onShareSession?: (id: string) => void
  variant?: 'dropdown' | 'fullscreen'
  onClose?: () => void
}

const SESSION_MENU_ITEMS = [
  { id: 'rename', label: 'Rename', Icon: PencilSimple },
  { id: 'share', label: 'Share', Icon: Export },
  { id: 'delete', label: 'Delete', Icon: Trash, destructive: true },
] as const

const SETTINGS_MENU_ITEMS = [
  { id: 'personal-context', label: 'Personal context', Icon: User },
  { id: 'account-settings', label: 'Account settings', Icon: GearSix },
] as const

function SessionRowItem({
  session,
  onOpen,
  onShare,
}: {
  session: SessionSummary
  onOpen: (id: string) => void
  onShare?: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [titleScrolling, setTitleScrolling] = useState(false)
  const [titleShiftPx, setTitleShiftPx] = useState(0)
  const [titleScrollMs, setTitleScrollMs] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const titleWrapRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const startTitleScroll = useCallback(() => {
    const wrap = titleWrapRef.current
    const title = titleRef.current
    if (!wrap || !title) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const overflow = Math.ceil(title.scrollWidth - wrap.clientWidth)
    if (overflow <= 1) return
    setTitleScrollMs(Math.max(900, Math.min(7000, overflow * 28)))
    setTitleShiftPx(overflow)
    setTitleScrolling(true)
  }, [])

  const stopTitleScroll = useCallback(() => {
    setTitleScrolling(false)
    setTitleShiftPx(0)
    setTitleScrollMs(380)
  }, [])

  return (
    <li>
      <div className={styles.sessionRow}>
        <button
          type="button"
          className={styles.sessionOpenBtn}
          onClick={() => onOpen(session.id)}
          onMouseEnter={startTitleScroll}
          onMouseLeave={stopTitleScroll}
          onFocus={startTitleScroll}
          onBlur={stopTitleScroll}
        >
          <div className={styles.sessionBody}>
            <div
              ref={titleWrapRef}
              className={`${styles.sessionTitleWrap}${
                titleScrolling ? ` ${styles.sessionTitleWrapScrolling}` : ''
              }`}
            >
              <p
                ref={titleRef}
                className={styles.sessionTitle}
                style={{
                  transform: titleShiftPx > 0 ? `translateX(-${titleShiftPx}px)` : 'translateX(0)',
                  transitionDuration: `${titleScrollMs}ms`,
                }}
              >
                {session.title}
              </p>
            </div>
            <p className={styles.sessionMeta}>{session.updatedLabel}</p>
          </div>
        </button>
        <div className={styles.sessionMenuWrap} ref={menuRef}>
          <button
            type="button"
            className={styles.sessionMenuBtn}
            onClick={(event) => {
              event.stopPropagation()
              setMenuOpen((open) => !open)
            }}
            aria-label={`Options for ${session.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <DotsThreeVertical size={16} weight="bold" aria-hidden />
          </button>
          {menuOpen ? (
            <div className={styles.sessionMenu} role="menu" aria-label={`${session.title} options`}>
              {SESSION_MENU_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className={`${styles.sessionMenuItem}${
                    'destructive' in item && item.destructive ? ` ${styles.sessionMenuItemDanger}` : ''
                  }`}
                  onClick={() => {
                    setMenuOpen(false)
                    if (item.id === 'share') onShare?.(session.id)
                  }}
                >
                  <item.Icon size={16} weight="regular" aria-hidden />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

/** Conversation history — compact dropdown, or full-height sidebar in fullscreen. */
export function SessionsPanel({
  onOpenSession,
  onShareSession,
  variant = 'dropdown',
  onClose,
}: SessionsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const settingsWrapRef = useRef<HTMLDivElement>(null)

  const open = useCallback(
    (id: string) => {
      onOpenSession(id)
    },
    [onOpenSession],
  )

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return DEMO_SESSIONS
    return DEMO_SESSIONS.filter(
      (s) => s.title.toLowerCase().includes(q) || s.preview.toLowerCase().includes(q),
    )
  }, [searchQuery])

  useLayoutEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!settingsOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (settingsWrapRef.current?.contains(event.target as Node)) return
      setSettingsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [settingsOpen])

  return (
    <div
      className={`${styles.dropdownRoot}${variant === 'fullscreen' ? ` ${styles.fullscreenRoot}` : ''}`}
    >
      <div className={styles.panelHeader}>
        <p className={styles.panelTitle}>Conversations</p>
        <div className={styles.headerActions}>
          <div className={styles.settingsWrap} ref={settingsWrapRef}>
            <button
              type="button"
              className={`${styles.headerIconBtn}${settingsOpen ? ` ${styles.headerIconBtnActive}` : ''}`}
              onClick={() => setSettingsOpen((open) => !open)}
              aria-label="Settings"
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
            >
              <GearSix size={20} weight="regular" aria-hidden />
            </button>
            {settingsOpen ? (
              <div className={styles.settingsMenu} role="menu" aria-label="Settings">
                {SETTINGS_MENU_ITEMS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    className={styles.settingsMenuItem}
                    onClick={() => setSettingsOpen(false)}
                  >
                    <Icon size={16} weight="regular" aria-hidden />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              className={styles.headerIconBtn}
              onClick={onClose}
              aria-label="Close conversations"
            >
              <X size={20} weight="regular" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.searchSection}>
        <input
          ref={searchInputRef}
          type="search"
          className={styles.searchInput}
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search conversations"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && searchQuery) {
              e.preventDefault()
              e.stopPropagation()
              setSearchQuery('')
            }
          }}
        />
      </div>

      <ul className={styles.list}>
        {filteredSessions.map((s) => (
          <SessionRowItem key={s.id} session={s} onOpen={open} onShare={onShareSession} />
        ))}
      </ul>
    </div>
  )
}
