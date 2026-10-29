import { useId, useRef, useState, type ReactNode } from 'react'
import { BracketsCurly, CheckCircle, Eye, EyeSlash, Info, Plus, Warning, WarningCircle, X } from '@phosphor-icons/react'
import { Field, Menu, Select, type SelectOption } from './ConfigControls'
import { inputClass } from './configStyles'
import type { Column } from './createAsset'
import { ColumnKindIcon } from './DataViews'
import type { References } from './kindEditor'
import styles from './KindConfig.module.css'

/* ---------- Segmented ---------- */

type SegmentedProps<T extends string> = {
  label: string
  value: T
  options: readonly { id: T; label: string }[]
  onChange: (value: T) => void
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          className={styles.segment}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Notice ---------- */

const NOTICE_ICONS = {
  info: <Info size={14} weight="fill" aria-hidden />,
  warn: <Warning size={14} weight="fill" aria-hidden />,
  error: <WarningCircle size={14} weight="fill" aria-hidden />,
  success: <CheckCircle size={14} weight="fill" aria-hidden />,
}

export function Notice({ tone = 'info', children }: { tone?: keyof typeof NOTICE_ICONS; children: ReactNode }) {
  return (
    <p className={`${styles.notice} ${tone === 'info' ? '' : styles[`notice_${tone}`]}`} role={tone === 'error' ? 'alert' : undefined}>
      {NOTICE_ICONS[tone]}
      <span>{children}</span>
    </p>
  )
}

/* ---------- Small buttons ---------- */

export function RemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={styles.iconButton} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <X size={14} weight="bold" aria-hidden />
    </button>
  )
}

export function AddButton({ children, onClick, disabled, title }: { children: ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button type="button" className={styles.addButton} disabled={disabled} title={title} onClick={onClick}>
      <Plus size={12} weight="bold" aria-hidden />
      {children}
    </button>
  )
}

/* ---------- Columns ---------- */

type ColumnSelectProps = {
  label: string
  value: string | undefined
  columns: readonly Column[]
  onChange: (column: string) => void
  placeholder?: string
  /** Adds a first option that clears the choice. */
  noneLabel?: string
  invalid?: boolean
}

const NONE = '__none__'

/** Picks a column of the input; a saved column the input no longer has stays listed, marked. */
export function ColumnSelect({ label, value, columns, onChange, placeholder, noneLabel, invalid }: ColumnSelectProps) {
  const options: SelectOption<string>[] = [
    ...(noneLabel ? [{ id: NONE, label: noneLabel }] : []),
    ...columns.map((column) => ({ id: column.name, label: column.name, icon: <ColumnKindIcon kind={column.kind} size={12} /> })),
    ...(value && !columns.some((column) => column.name === value) ? [{ id: value, label: value, meta: columns.length ? 'Not in input' : undefined }] : []),
  ]
  return (
    <Select
      label={label}
      value={value || (noneLabel ? NONE : undefined)}
      options={options}
      placeholder={placeholder ?? (columns.length ? 'Choose a column' : 'No columns yet')}
      disabled={options.length === 0}
      invalid={invalid}
      onChange={(id) => onChange(id === NONE ? '' : id)}
    />
  )
}

type ColumnChipsProps = {
  label: string
  value: readonly string[]
  columns: readonly Column[]
  onChange: (value: string[]) => void
  addLabel?: string
}

/** Several columns, as removable chips with an add menu. */
export function ColumnChips({ label, value, columns, onChange, addLabel = 'Add column' }: ColumnChipsProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const available = columns.filter((column) => !value.includes(column.name))
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {value.map((name) => (
        <span key={name} className={styles.chip}>
          {name}
          <button type="button" className={styles.chipRemove} aria-label={`Remove ${name}`} onClick={() => onChange(value.filter((item) => item !== name))}>
            <X size={10} weight="bold" aria-hidden />
          </button>
        </span>
      ))}
      <button
        ref={ref}
        type="button"
        className={styles.chipAdd}
        disabled={available.length === 0}
        title={columns.length === 0 ? 'Run the step before this one to list its columns.' : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Plus size={10} weight="bold" aria-hidden />
        {addLabel}
      </button>
      {open ? (
        <Menu
          anchorRef={ref}
          label={addLabel}
          items={available.map((column) => ({ id: column.name, label: column.name, icon: <ColumnKindIcon kind={column.kind} size={12} /> }))}
          onPick={(name) => {
            onChange([...value, name])
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  )
}

/* ---------- Template fields ---------- */

type TemplateFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  references: References
  required?: boolean
  hint?: ReactNode
  error?: string
  placeholder?: string
  multiline?: boolean
  mono?: boolean
  rows?: number
  maxLength?: number
  disabled?: boolean
}

/** The Insert menu's state, and the menu itself, which puts a reference at the field's caret. */
function useReferenceMenu(value: string, onChange: (value: string) => void, references: References, maxLength?: number) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const insert = (token: string) => {
    const element = inputRef.current
    const start = element?.selectionStart ?? value.length
    const end = element?.selectionEnd ?? value.length
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`
    onChange(maxLength ? next.slice(0, maxLength) : next)
    setOpen(false)
    requestAnimationFrame(() => {
      element?.focus()
      element?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const menu = open ? (
    <Menu
      anchorRef={buttonRef}
      align="end"
      label="Insert a reference"
      items={
        references.length
          ? references.map((reference) => ({ id: reference.token, label: reference.label, meta: reference.meta }))
          : [{ id: '{{rows.count}}', label: 'rows.count', meta: 'Rows in' }]
      }
      onPick={insert}
      onClose={() => setOpen(false)}
    />
  ) : null
  return { inputRef, buttonRef, open, toggle: () => setOpen((current) => !current), menu }
}

type ReferenceInputProps = {
  label: string
  value: string
  onChange: (value: string) => void
  references: References
  placeholder?: string
  mono?: boolean
  /** Masks the value until it's shown, for credentials. */
  secret?: boolean
}

/**
 * A one-line input for a row of fields, followed by its Insert button and, for a secret, a show/hide
 * button; an empty cell stands in for that one otherwise, so rows line up.
 */
export function ReferenceInput({ label, value, onChange, references, placeholder, mono, secret }: ReferenceInputProps) {
  const [revealed, setRevealed] = useState(false)
  const { inputRef, buttonRef, open, toggle, menu } = useReferenceMenu(value, onChange, references)
  return (
    <>
      <input
        ref={inputRef}
        className={`${inputClass} ${mono ? styles.mono : ''}`}
        type={secret && !revealed ? 'password' : 'text'}
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
      <button ref={buttonRef} type="button" className={styles.iconButton} aria-label="Insert a reference" title="Insert a reference" aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
        <BracketsCurly size={14} aria-hidden />
      </button>
      {secret ? (
        <button
          type="button"
          className={styles.iconButton}
          aria-label={revealed ? 'Hide value' : 'Show value'}
          title={revealed ? 'Hide value' : 'Show value'}
          aria-pressed={revealed}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? <EyeSlash size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
        </button>
      ) : (
        <span aria-hidden />
      )}
      {menu}
    </>
  )
}

/** A text field that takes `{{…}}` references, with a menu that inserts one at the caret. */
export function TemplateField(props: TemplateFieldProps) {
  const { label, value, onChange, references, multiline, mono, maxLength } = props
  const id = useId()
  const { inputRef, buttonRef, open, toggle, menu } = useReferenceMenu(value, onChange, references, maxLength)

  const className = [inputClass, multiline ? styles.textarea : null, mono ? styles.mono : null].filter(Boolean).join(' ')
  const shared = {
    id,
    className,
    value,
    placeholder: props.placeholder,
    maxLength,
    disabled: props.disabled,
    spellCheck: !mono,
    'aria-invalid': Boolean(props.error) || undefined,
  }
  const meta = (
    <>
      {maxLength ? (
        <span className={styles.count}>
          {value.length}/{maxLength}
        </span>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        className={styles.refButton}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={props.disabled}
        onClick={toggle}
      >
        <BracketsCurly size={12} aria-hidden />
        Insert
      </button>
    </>
  )

  return (
    <Field label={label} htmlFor={id} required={props.required} meta={meta} hint={props.hint} error={props.error}>
      {multiline ? (
        <textarea ref={inputRef} rows={props.rows ?? 4} {...shared} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input ref={inputRef} {...shared} onChange={(event) => onChange(event.target.value)} />
      )}
      {menu}
    </Field>
  )
}

/** A plain multi-line field. */
export function TextAreaField({
  label,
  value,
  onChange,
  required,
  hint,
  error,
  placeholder,
  mono,
  rows = 4,
  maxLength,
}: Omit<TemplateFieldProps, 'references' | 'multiline' | 'disabled'>) {
  const id = useId()
  return (
    <Field
      label={label}
      htmlFor={id}
      required={required}
      hint={hint}
      error={error}
      meta={maxLength ? <span className={styles.count}>{`${value.length.toLocaleString()}/${maxLength.toLocaleString()}`}</span> : undefined}
    >
      <textarea
        id={id}
        className={[inputClass, styles.textarea, mono ? styles.mono : null].filter(Boolean).join(' ')}
        rows={rows}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        spellCheck={!mono}
        aria-invalid={Boolean(error) || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}

/** A single-line text field. */
export function TextField({
  label,
  value,
  onChange,
  required,
  hint,
  error,
  placeholder,
  mono,
  maxLength,
}: Omit<TemplateFieldProps, 'references' | 'multiline' | 'disabled' | 'rows'>) {
  const id = useId()
  return (
    <Field label={label} htmlFor={id} required={required} hint={hint} error={error}>
      <input
        id={id}
        className={[inputClass, mono ? styles.mono : null].filter(Boolean).join(' ')}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        spellCheck={!mono}
        aria-invalid={Boolean(error) || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  )
}
