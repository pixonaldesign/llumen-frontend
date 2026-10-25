import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Archive,
  Bell,
  CalendarBlank,
  CaretDown,
  Check,
  CheckCircle,
  Clock,
  CopySimple,
  DotsThreeVertical,
  EyeSlash,
  FileText,
  FunnelSimple,
  ListBullets,
  MagnifyingGlass,
  Prohibit,
  SquaresFour,
  Trash,
  WarningCircle,
  ChatText,
} from '@phosphor-icons/react'
import { STATUS_TONE, type BriefingKind, type StatusTone } from './studioData'
import { SORTS, useDismiss, type Sort } from './studioHooks'
import styles from './StudioView.module.css'

const STATUS_ICON: Record<string, ReactNode> = {
  Active: <CheckCircle size={16} aria-hidden />,
  Published: <CheckCircle size={16} aria-hidden />,
  'Pending Review': <Clock size={16} aria-hidden />,
  Unpublished: <EyeSlash size={16} aria-hidden />,
  Inactive: <Prohibit size={16} aria-hidden />,
  Failed: <WarningCircle size={16} aria-hidden />,
  Draft: <FileText size={16} aria-hidden />,
  Archived: <Archive size={16} aria-hidden />,
  Planned: <CalendarBlank size={16} aria-hidden />,
}

export function StatusChip({ label, tone }: { label: string; tone?: StatusTone }) {
  return (
    <span className={styles.chip} data-tone={tone ?? STATUS_TONE[label] ?? 'neutral'}>
      {STATUS_ICON[label]}
      {label}
    </span>
  )
}

/** A neutral tag: an asset's type or category. */
export function Tag({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={styles.chip} data-tone="neutral">
      {icon}
      {children}
    </span>
  )
}

const BRIEFING_ICON: Record<BriefingKind, ReactNode> = {
  Report: <FileText size={16} aria-hidden />,
  Feedback: <ChatText size={16} aria-hidden />,
  Alert: <WarningCircle size={16} aria-hidden />,
  Update: <Bell size={16} aria-hidden />,
}

/** A briefing's kind: a neutral chip with a coloured icon, or a red one for alerts. */
export function KindChip({ kind }: { kind: BriefingKind }) {
  return (
    <span
      className={`${styles.chip} ${styles.kindChip}`}
      data-tone={kind === 'Alert' ? 'negative' : 'outline'}
      data-kind={kind}
    >
      {BRIEFING_ICON[kind]}
      {kind}
    </span>
  )
}

export function Button({
  icon,
  children,
  variant = 'outline',
  onClick,
}: {
  icon?: ReactNode
  children: ReactNode
  variant?: 'outline' | 'solid' | 'neutral' | 'danger'
  onClick?: () => void
}) {
  return (
    <button type="button" className={styles.button} data-variant={variant} onClick={onClick}>
      {icon}
      {children}
    </button>
  )
}

export function SearchField({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className={styles.search}>
      <MagnifyingGlass size={20} aria-hidden />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder.replace(/\.+$/, '')}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

/** A frosted menu of plain options, as the Figma menu-items-container. */
function MenuList({
  options,
  value,
  onPick,
  align = 'start',
  label,
}: {
  options: readonly string[]
  value?: string
  onPick: (option: string) => void
  align?: 'start' | 'end'
  label: string
}) {
  return (
    <div className={styles.menu} data-align={align} role="listbox" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="option"
          aria-selected={option === value}
          className={styles.menuItem}
          onClick={() => onPick(option)}
        >
          <span>{option}</span>
          {option === value ? <Check size={16} weight="bold" aria-hidden /> : null}
        </button>
      ))}
    </div>
  )
}

export function Dropdown({
  label,
  icon,
  options,
  value,
  onChange,
  align = 'start',
  full = false,
}: {
  label: string
  icon?: ReactNode
  options: readonly string[]
  value: string
  onChange: (value: string) => void
  align?: 'start' | 'end'
  /** Fills its container, as the workspace picker does. */
  full?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useMemo(() => () => setOpen(false), [])
  useDismiss(ref, open, close)
  const chosen = !full && value !== options[0]
  return (
    <div className={`${styles.dropdownWrap}${full ? ` ${styles.dropdownFull}` : ''}`} ref={ref}>
      <button
        type="button"
        className={styles.dropdown}
        data-chosen={chosen || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
        <span className={styles.dropdownLabel}>{chosen || full ? value : label}</span>
        <CaretDown className={styles.dropdownCaret} size={16} aria-hidden />
      </button>
      {open ? (
        <MenuList
          label={label}
          options={options}
          value={value}
          align={align}
          onPick={(option) => {
            onChange(option)
            setOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

export function SortMenu({ value, onChange }: { value: Sort; onChange: (value: Sort) => void }) {
  return (
    <Dropdown
      label="Sort"
      icon={<FunnelSimple size={20} aria-hidden />}
      options={SORTS}
      value={value}
      align="end"
      full
      onChange={(next) => onChange(next as Sort)}
    />
  )
}

export type Layout = 'grid' | 'list'

export function LayoutToggle({ value, onChange }: { value: Layout; onChange: (value: Layout) => void }) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label="Layout">
      <button
        type="button"
        role="radio"
        aria-checked={value === 'grid'}
        aria-label="Grid"
        className={styles.segment}
        onClick={() => onChange('grid')}
      >
        <SquaresFour size={20} aria-hidden />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'list'}
        aria-label="List"
        className={styles.segment}
        onClick={() => onChange('list')}
      >
        <ListBullets size={20} aria-hidden />
      </button>
    </div>
  )
}

/** Text tabs in a segmented frame: Active / Expired, Workflows / Executions. */
export function TextSegments<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={`${styles.segment} ${styles.segmentText}`}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

const ROW_ACTIONS = [
  { label: 'Duplicate', icon: <CopySimple size={20} aria-hidden /> },
  { label: 'Deactivate', icon: <Prohibit size={20} aria-hidden /> },
  { label: 'Delete', icon: <Trash size={20} aria-hidden />, danger: true },
]

/** The three-dot button on a row or card, with Duplicate, Deactivate and Delete. */
export function RowMenu({ label, onDelete }: { label: string; onDelete?: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const close = useMemo(() => () => setOpen(false), [])
  useDismiss(ref, open, close, menuRef)

  /**
   * The menu is portalled and fixed to the viewport: the page's backdrop blur would otherwise become its
   * containing block and its scroll would clip it. It opens upwards near the bottom.
   */
  useLayoutEffect(() => {
    const button = buttonRef.current
    const menu = menuRef.current
    if (!open || !button || !menu) return
    const rect = button.getBoundingClientRect()
    const below = rect.bottom + 4 + menu.offsetHeight <= window.innerHeight - 8
    menu.style.left = `${Math.max(8, rect.right - menu.offsetWidth)}px`
    menu.style.top = `${below ? rect.bottom + 4 : rect.top - 4 - menu.offsetHeight}px`
    const onScroll = () => setOpen(false)
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [open])

  return (
    <div className={styles.rowMenu} ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.kebab}
        aria-label={`More options for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
      >
        <DotsThreeVertical size={16} weight="bold" aria-hidden />
      </button>
      {open
        ? createPortal(
            <div ref={menuRef} className={`${styles.menu} ${styles.menuFixed}`} role="menu" aria-label={label}>
              {ROW_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  data-danger={action.danger || undefined}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (action.label === 'Delete') onDelete?.()
                    setOpen(false)
                  }}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: ReactNode
  title: string
  body: string
  action: string
  onAction?: () => void
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>{icon}</span>
      <h3 className={styles.emptyTitle}>{title}</h3>
      <p className={styles.emptyBody}>{body}</p>
      <Button variant="solid" onClick={onAction}>
        {action}
      </Button>
    </div>
  )
}
