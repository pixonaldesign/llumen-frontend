import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { CaretDown, Check } from '@phosphor-icons/react'
import { PopoverLayer } from './configStyles'
import styles from './ConfigControls.module.css'

const POPOVER_GAP = 4
const POPOVER_MAX_HEIGHT = 340
const POPOVER_MIN_ROOM = 160

type PopoverProps = {
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  /** Matches the anchor's width when true; otherwise sizes to its content from the anchor's edge. */
  matchWidth?: boolean
  align?: 'start' | 'end'
  label: string
  children: ReactNode
}

/**
 * Anchored glass popover. Closes on an outside press, Escape, or when anything around it scrolls;
 * carries `data-config-popover` so the window leaves Escape to it.
 */
/** Gives popovers inside `children` a layer over the nearest positioned ancestor, e.g. a side panel. */
export function PopoverHost({ children }: { children: ReactNode }) {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null)
  return (
    <PopoverLayer.Provider value={layer}>
      {children}
      <div ref={setLayer} className={styles.layer} />
    </PopoverLayer.Provider>
  )
}

export function Popover({ anchorRef, onClose, matchWidth = false, align = 'start', label, children }: PopoverProps) {
  const layer = useContext(PopoverLayer)
  const ref = useRef<HTMLDivElement>(null)

  /** Placed before paint, straight on the element; it only moves when it reopens. */
  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const popover = ref.current
    if (!anchor || !popover || !layer) return
    const box = anchor.getBoundingClientRect()
    const bounds = layer.getBoundingClientRect()
    const below = bounds.bottom - box.bottom - POPOVER_GAP * 3
    const above = box.top - bounds.top - POPOVER_GAP * 3
    const flip = below < POPOVER_MIN_ROOM && above > below
    const room = Math.min(POPOVER_MAX_HEIGHT, flip ? above : below)
    const px = (value: number) => `${value}px`
    const place: Partial<Record<keyof CSSProperties, string>> = {
      ...(flip ? { bottom: px(bounds.bottom - box.top + POPOVER_GAP) } : { top: px(box.bottom - bounds.top + POPOVER_GAP) }),
      ...(align === 'end' ? { right: px(bounds.right - box.right) } : { left: px(box.left - bounds.left) }),
      ...(matchWidth ? { width: px(box.width) } : { maxWidth: px(Math.min(360, bounds.width - POPOVER_GAP * 4)) }),
      maxHeight: px(Math.max(120, room)),
    }
    Object.assign(popover.style, place)
  }, [align, anchorRef, layer, matchWidth])

  useEffect(() => {
    const outside = (target: EventTarget | null) =>
      !ref.current?.contains(target as Node) && !anchorRef.current?.contains(target as Node)
    const onPointer = (event: PointerEvent) => {
      if (outside(event.target)) onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
      anchorRef.current?.focus()
    }
    const onScroll = (event: Event) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [anchorRef, onClose])

  if (!layer) return null
  return createPortal(
    <div ref={ref} className={styles.popover} role="dialog" aria-label={label} data-config-popover data-native-scroll>
      {children}
    </div>,
    layer,
  )
}

/** Up/Down move between the popover's enabled options. */
function moveFocus(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
  if (!options.length) return
  event.preventDefault()
  const index = options.indexOf(document.activeElement as HTMLButtonElement)
  const step = event.key === 'ArrowDown' ? 1 : -1
  options[(index + step + options.length) % options.length].focus()
}

/* ---------- Select ---------- */

export type SelectOption<T extends string> = {
  id: T
  label: string
  description?: string
  group?: string
  icon?: ReactNode
  /** Trailing text in the trigger and the option, e.g. an item count. */
  meta?: string
  disabled?: boolean
}

type SelectProps<T extends string> = {
  id?: string
  value: T | undefined
  options: readonly SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  label: string
  invalid?: boolean
  disabled?: boolean
}

export function Select<T extends string>({ id, value, options, onChange, placeholder = 'Select…', label, invalid, disabled }: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.id === value)
  const groups = [...new Set(options.map((option) => option.group ?? ''))]

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const list = listRef.current
      const current = list?.querySelector<HTMLButtonElement>('[aria-selected="true"]') ?? list?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      current?.focus({ preventScroll: true })
      current?.scrollIntoView({ block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  const pick = (next: T) => {
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={styles.selectTrigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-label={selected ? undefined : label}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span className={styles.selectValue}>
          {selected ? (
            <>
              {selected.icon ? <span className={styles.optionIcon}>{selected.icon}</span> : null}
              <span className={styles.selectLabel}>{selected.label}</span>
            </>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </span>
        {selected?.meta ? <span className={styles.selectMeta}>{selected.meta}</span> : null}
        <CaretDown className={styles.caret} size={12} weight="bold" aria-hidden />
      </button>
      {open ? (
        <Popover anchorRef={triggerRef} onClose={() => setOpen(false)} matchWidth label={label}>
          <div ref={listRef} role="listbox" aria-label={label} onKeyDown={moveFocus}>
            {groups.map((group) => (
              <div key={group} className={styles.group} role="group" aria-label={group || undefined}>
                {group ? <p className={styles.groupLabel}>{group}</p> : null}
                {options
                  .filter((option) => (option.group ?? '') === group)
                  .map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={option.id === value}
                      className={styles.option}
                      disabled={option.disabled}
                      onClick={() => pick(option.id)}
                    >
                      {option.icon ? <span className={styles.optionIcon}>{option.icon}</span> : null}
                      <span className={styles.optionText}>
                        <span className={styles.optionLabel}>{option.label}</span>
                        {option.description ? <span className={styles.optionDescription}>{option.description}</span> : null}
                      </span>
                      {option.meta ? <span className={styles.selectMeta}>{option.meta}</span> : null}
                      {option.id === value ? <Check className={styles.optionCheck} size={14} weight="bold" aria-hidden /> : null}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </Popover>
      ) : null}
    </>
  )
}

/* ---------- Menu ---------- */

export type MenuItem = { id: string; label: string; icon?: ReactNode; meta?: string }

type MenuProps = {
  anchorRef: RefObject<HTMLElement | null>
  items: readonly MenuItem[]
  label: string
  align?: 'start' | 'end'
  onPick: (id: string) => void
  onClose: () => void
}

/** A plain list of actions under an anchor, e.g. the neighbouring nodes in the window header. */
export function Menu({ anchorRef, items, label, align, onPick, onClose }: MenuProps) {
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const frame = requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>('button')?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <Popover anchorRef={anchorRef} onClose={onClose} align={align} label={label}>
      <div ref={listRef} role="menu" aria-label={label} onKeyDown={moveFocus}>
        {items.map((item) => (
          <button key={item.id} type="button" role="menuitem" className={styles.option} onClick={() => onPick(item.id)}>
            {item.icon ? <span className={styles.optionIcon}>{item.icon}</span> : null}
            <span className={styles.optionText}>
              <span className={styles.optionLabel}>{item.label}</span>
            </span>
            {item.meta ? <span className={styles.selectMeta}>{item.meta}</span> : null}
          </button>
        ))}
      </div>
    </Popover>
  )
}

/* ---------- Layout ---------- */

type CardProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  children?: ReactNode
}

export function Card({ icon, title, description, action, children }: CardProps) {
  const titleId = useId()
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <header className={styles.cardHead}>
        {icon ? <span className={styles.cardIcon}>{icon}</span> : null}
        <div className={styles.cardText}>
          <h3 id={titleId} className={styles.cardTitle}>
            {title}
          </h3>
          {description ? <p className={styles.cardDescription}>{description}</p> : null}
        </div>
        {action ? <div className={styles.cardAction}>{action}</div> : null}
      </header>
      {children}
    </section>
  )
}

type FieldProps = {
  label: string
  htmlFor?: string
  required?: boolean
  meta?: ReactNode
  hint?: ReactNode
  error?: string
  children: ReactNode
}

export function Field({ label, htmlFor, required, meta, hint, error, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldHead}>
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
          {required ? <span className={styles.required}> (required)</span> : null}
        </label>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </div>
      {children}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint}>{hint}</p>
      ) : null}
    </div>
  )
}

type NumberInputProps = {
  id?: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  min: number
  max: number
  unit?: string
  placeholder?: string
  /** Allows clearing the box; otherwise an empty entry restores the last value. */
  optional?: boolean
}

/** Commits on blur or Enter, clamping into range rather than discarding an out-of-range entry. */
export function NumberInput({ id, value, onChange, min, max, unit, placeholder, optional }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const text = draft.trim()
    setDraft(null)
    if (!text) {
      if (optional) onChange(undefined)
      return
    }
    const number = Math.round(Number(text))
    if (Number.isFinite(number)) onChange(Math.min(max, Math.max(min, number)))
  }
  return (
    <div className={styles.numberWrap}>
      <input
        id={id}
        className={styles.input}
        inputMode="numeric"
        value={draft ?? (value === undefined ? '' : String(value))}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
        }}
      />
      {unit ? <span className={styles.unit}>{unit}</span> : null}
    </div>
  )
}

type SwitchRowProps = {
  label: string
  description?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
}

export function SwitchRow({ label, description, checked, onChange }: SwitchRowProps) {
  const labelId = useId()
  return (
    <div className={styles.switchRow}>
      <div className={styles.switchText}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {description ? <p className={styles.hint}>{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      />
    </div>
  )
}