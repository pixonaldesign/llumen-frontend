import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type RefObject } from 'react'
import { CalendarBlank, CaretDown, CaretRight, Check, Function as FunctionIcon, HandTap, MagnifyingGlass } from '@phosphor-icons/react'
import { Popover } from './ConfigControls'
import { OPERATOR_GROUPS, OPERATORS, operatorSpec, resolver, type Operator, type OperatorGroup, type ValueKind } from './conditions'
import { evaluateExpression, expressionParts, referenceToken, singleReference } from './expressions'
import { fieldKind, fieldTree, flattenTree, prefixTree, type FieldKind, type FieldNode } from './fieldPaths'
import { FieldKindIcon } from './FieldTree'
import type { ConditionFields, FieldSource } from './kindEditor'
import tones from './nodeTones.module.css'
import controls from './ConfigControls.module.css'
import styles from './ExpressionEditor.module.css'

/** The field kind each type shows as in the field list; dates are text there, so they keep a calendar. */
const GROUP_KINDS: Record<OperatorGroup, FieldKind | null> = {
  String: 'string',
  Number: 'number',
  'Date & Time': null,
  Boolean: 'boolean',
  Array: 'array',
  Object: 'object',
}

const VALUE_GROUPS: Record<ValueKind, OperatorGroup> = { text: 'String', number: 'Number', date: 'Date & Time' }

/** A type's icon, the same one its fields carry in the field list. */
function TypeIcon({ group, size = 14 }: { group: OperatorGroup; size?: number }) {
  const kind = GROUP_KINDS[group]
  return kind ? <FieldKindIcon kind={kind} size={size} decorative /> : <CalendarBlank size={size} weight="bold" aria-hidden />
}

/** An unfinished reference right before the caret, e.g. `{{ hair.co`. */
const OPEN_REFERENCE = /\{\{\s*([^{}\s]*)$/
const MAX_MATCHES = 100

/** Up/Down between a list's own options; submenus portal elsewhere, so theirs aren't counted. */
function moveWithin(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  if (!event.currentTarget.contains(event.target as Node)) return
  const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-option]')]
  if (!options.length) return
  event.preventDefault()
  const index = options.indexOf(document.activeElement as HTMLButtonElement)
  const step = event.key === 'ArrowDown' ? 1 : -1
  options[index < 0 ? 0 : (index + step + options.length) % options.length].focus()
}

/** Focuses a list's chosen option, else its first, once it's on screen. */
function useFocusOnOpen(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const frame = requestAnimationFrame(() => {
      const list = ref.current
      const option =
        list?.querySelector<HTMLButtonElement>('button[data-option]:is([aria-checked="true"], [data-current], [data-picked])') ??
        list?.querySelector<HTMLButtonElement>('button[data-option]')
      option?.focus({ preventScroll: true })
      option?.scrollIntoView({ block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [active, ref])
}

/** What the editor offers besides an expression: a field of the rows, or a value typed in. */
export type EditorBase = 'select' | 'value'

type ExpressionEditorProps = {
  label: string
  value: string
  expression: boolean
  onChange: (value: string, expression: boolean) => void
  base: EditorBase
  /** What a typed value is; sets the box and the mode icon. */
  valueKind?: ValueKind
  /** The rows, nodes, and globals the fields and the result preview come from. */
  fields: ConditionFields
  placeholder?: string
  invalid?: boolean
}

/**
 * One side of a condition. Select picks exactly one field, at any depth; Value takes a number, text, or date;
 * Expression takes `{{ field }}` references and operations on them, e.g. `{{ price }} * {{ quantity }}`.
 */
export function ExpressionEditor({ label, value, expression, onChange, base, valueKind = 'text', fields, placeholder, invalid }: ExpressionEditorProps) {
  const setMode = (next: boolean) => {
    if (next === expression) return
    if (next) onChange(base === 'select' && value ? referenceToken(value) : value, true)
    else onChange(base === 'select' ? (singleReference(value) ?? '') : value, false)
  }

  return (
    <div className={styles.editor}>
      <div className={styles.row}>
        <ModeButton label={label} base={base} valueKind={valueKind} expression={expression} onChange={setMode} />
        {expression ? (
          <ExpressionInput
            label={label}
            value={value}
            sources={fields.sources}
            placeholder={base === 'select' ? 'e.g. {{ price }} * {{ quantity }}' : 'A value or {{ field }}'}
            invalid={invalid}
            onChange={(text) => onChange(text, true)}
          />
        ) : base === 'select' ? (
          <FieldSelect label={label} value={value} fields={fields} placeholder={placeholder} invalid={invalid} onChange={(path) => onChange(path, false)} />
        ) : (
          <ValueInput
            label={label}
            value={value}
            valueKind={valueKind}
            placeholder={placeholder}
            invalid={invalid}
            onChange={(text) => onChange(text, false)}
          />
        )}
      </div>
      {expression ? <ExpressionPreview value={value} fields={fields} /> : null}
    </div>
  )
}

/* ---------- Mode ---------- */

type ModeButtonProps = { label: string; base: EditorBase; valueKind: ValueKind; expression: boolean; onChange: (expression: boolean) => void }

function ModeButton({ label, base, valueKind, expression, onChange }: ModeButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  useFocusOnOpen(listRef, open)
  const modes = [
    {
      expression: false,
      label: base === 'select' ? 'Select' : 'Value',
      icon: base === 'select' ? <HandTap size={14} weight="bold" aria-hidden /> : <TypeIcon group={VALUE_GROUPS[valueKind]} />,
    },
    { expression: true, label: 'Expression', icon: <FunctionIcon size={14} weight="bold" aria-hidden /> },
  ]
  const current = modes[expression ? 1 : 0]

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={styles.modeButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${current.label}`}
        title={`${current.label} mode`}
        data-expression={expression || undefined}
        onClick={() => setOpen((was) => !was)}
      >
        {current.icon}
        <CaretDown className={styles.modeCaret} size={10} weight="bold" aria-hidden />
      </button>
      {open ? (
        <Popover anchorRef={ref} onClose={() => setOpen(false)} label={`${label} mode`}>
          <div ref={listRef} role="menu" aria-label={`${label} mode`} onKeyDown={moveWithin}>
            {modes.map((mode) => {
              const checked = mode.expression === expression
              return (
                <button
                  key={mode.label}
                  data-option
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  className={controls.option}
                  onClick={() => {
                    onChange(mode.expression)
                    setOpen(false)
                    ref.current?.focus()
                  }}
                >
                  <span className={controls.optionIcon}>{mode.icon}</span>
                  <span className={controls.optionText}>
                    <span className={controls.optionLabel}>{mode.label}</span>
                  </span>
                  {checked ? <Check className={controls.optionCheck} size={14} weight="bold" aria-hidden /> : null}
                </button>
              )
            })}
          </div>
        </Popover>
      ) : null}
    </>
  )
}

/* ---------- Select: one field ---------- */

type FieldSelectProps = {
  label: string
  value: string
  fields: ConditionFields
  placeholder?: string
  invalid?: boolean
  onChange: (path: string) => void
}

function FieldSelect({ label, value, fields, placeholder = 'Choose a field', invalid, onChange }: FieldSelectProps) {
  const [open, setOpen] = useState(false)
  const [dropping, setDropping] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const row = fields.records?.[0]
  const kind = value && row ? fieldKind(resolver(row, fields.scope)(value)) : 'null'

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    setDropping(false)
    const path = singleReference(event.dataTransfer.getData('text/plain'))
    if (!path) return
    event.preventDefault()
    onChange(path)
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={controls.selectTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-label={value ? `${label}: ${value}` : label}
        data-dropping={dropping || undefined}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('text/plain')) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setDropping(true)
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={onDrop}
      >
        <span className={controls.selectValue}>
          {value ? (
            <>
              <FieldKindIcon kind={kind} className={styles.kindIcon} />
              <span className={`${controls.selectLabel} ${styles.mono}`}>{value}</span>
            </>
          ) : (
            <span className={controls.placeholder}>{placeholder}</span>
          )}
        </span>
        <CaretDown className={controls.caret} size={12} weight="bold" aria-hidden />
      </button>
      {open ? (
        <FieldPicker
          anchorRef={ref}
          sources={fields.sources}
          selected={value}
          label={`${label} fields`}
          onPick={(path) => {
            onChange(path)
            setOpen(false)
            ref.current?.focus()
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

type FieldPickerProps = {
  anchorRef: RefObject<HTMLElement | null>
  sources: readonly FieldSource[]
  selected?: string
  /** Filters from outside, e.g. what follows `{{` in an expression; otherwise the picker has its own search. */
  query?: string
  bodyRef?: RefObject<HTMLDivElement | null>
  label: string
  onPick: (path: string) => void
  onClose: () => void
}

/** Whether a path is one of the source's fields; the rows coming straight in own every path no other source's prefix claims. */
const ownsPath = (source: FieldSource, sources: readonly FieldSource[], path: string) =>
  source.prefix ? path === source.prefix || path.startsWith(`${source.prefix}.`) : !sources.some((other) => other.prefix && path.startsWith(`${other.prefix}.`))

/** Each source's fields, one source open at a time; objects and lists open their fields to the side, and search lists full paths. */
function FieldPicker({ anchorRef, sources, selected, query, bodyRef, label, onPick, onClose }: FieldPickerProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(
    () => (sources.find((source) => selected && ownsPath(source, sources, selected)) ?? sources.find((source) => source.open))?.id ?? null,
  )
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const external = query !== undefined
  const needle = (external ? query : search).trim().toLowerCase()
  const trees = useMemo(
    () => sources.map((source) => ({ source, nodes: source.records ? prefixTree(fieldTree(source.records), source.prefix) : [] })),
    [sources],
  )
  const found = needle
    ? trees.flatMap(({ source, nodes }) =>
        flattenTree(nodes).flatMap((node) => (node.path.toLowerCase().includes(needle) ? [{ node, source: source.name }] : [])),
      )
    : null
  const sourceOf = new Map(found?.map((item) => [item.node.path, item.source]))

  useEffect(() => {
    if (external) return
    const frame = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [external])

  const toggle = (id: string) => setOpen((current) => (current === id ? null : id))

  return (
    <Popover anchorRef={anchorRef} onClose={onClose} className={styles.picker} label={label}>
      <div ref={bodyRef} className={styles.pickerBody}>
        {external ? null : (
          <label className={styles.pickerSearch}>
            <MagnifyingGlass size={14} aria-hidden />
            <input
              ref={searchRef}
              className={styles.pickerSearchInput}
              value={search}
              placeholder="Search fields"
              aria-label="Search fields"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  listRef.current?.querySelector<HTMLButtonElement>('button[data-option]')?.focus()
                }
                if (event.key === 'Enter' && found?.length) onPick(found[0].node.path)
              }}
            />
          </label>
        )}
        <div ref={listRef} className={styles.pickerList} data-native-scroll>
          {found ? (
            found.length ? (
              <FieldLevel
                nodes={found.slice(0, MAX_MATCHES).map((item) => item.node)}
                selected={selected}
                flat
                metaOf={(node) => sourceOf.get(node.path)}
                onPick={onPick}
              />
            ) : (
              <p className={styles.pickerNote}>No field matches “{needle}”.</p>
            )
          ) : (
            trees.map(({ source, nodes }) => {
              const SourceIcon = source.icon
              const expanded = open === source.id
              return (
                <div key={source.id} className={styles.source}>
                  <button type="button" className={styles.sourceRow} aria-expanded={expanded} onClick={() => toggle(source.id)}>
                    <CaretRight className={styles.sourceCaret} size={12} weight="bold" aria-hidden />
                    <span
                      className={source.tone ? `${styles.sourceIcon} ${tones[`tone_${source.tone}`]}` : `${styles.sourceIcon} ${styles.sourceIconPlain}`}
                      aria-hidden
                    >
                      <SourceIcon size={16} weight={source.tone ? 'duotone' : 'bold'} />
                    </span>
                    <span className={styles.sourceName}>{source.name}</span>
                    {source.meta ? <span className={styles.sourceMeta}>{source.meta}</span> : null}
                  </button>
                  {!expanded ? null : !source.records ? (
                    <p className={`${styles.pickerNote} ${styles.pickerNoteNested}`}>Not run yet. Execute the previous nodes to see its fields.</p>
                  ) : nodes.length ? (
                    <FieldLevel nodes={nodes} selected={selected} nested onPick={onPick} />
                  ) : (
                    <p className={`${styles.pickerNote} ${styles.pickerNoteNested}`}>{source.empty ?? 'It sent no fields.'}</p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </Popover>
  )
}

type FieldLevelProps = {
  nodes: readonly FieldNode[]
  selected?: string
  /** Search results: full paths, nothing opens. */
  flat?: boolean
  /** Under a source row, lined up with its icon. */
  nested?: boolean
  metaOf?: (node: FieldNode) => string | undefined
  focusFirst?: boolean
  onPick: (path: string) => void
  /** Steps back to the row this level opened from. */
  onBack?: () => void
}

type Flyout = { node: FieldNode; anchor: HTMLElement; focus: boolean }

/** One level of fields. A row's name picks that field; its arrow, apart, opens the fields inside it. */
function FieldLevel({ nodes, selected, flat = false, nested = false, metaOf, focusFirst = false, onPick, onBack }: FieldLevelProps) {
  const [flyout, setFlyout] = useState<Flyout | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  useFocusOnOpen(listRef, focusFirst)

  const show = (node: FieldNode, anchor: HTMLElement, focus: boolean) =>
    setFlyout((current) => (current?.node.path === node.path && !focus ? current : { node, anchor, focus }))

  return (
    <div
      ref={listRef}
      role="menu"
      className={nested ? `${styles.level} ${styles.levelNested}` : styles.level}
      onKeyDown={(event) => {
        moveWithin(event)
        if (event.key === 'ArrowLeft' && onBack && event.currentTarget.contains(event.target as Node)) {
          event.preventDefault()
          onBack()
        }
      }}
    >
      {nodes.map((node) => {
        const opens = !flat && node.children.length > 0
        const opened = flyout?.node.path === node.path
        const picked = node.path === selected || Boolean(selected?.startsWith(`${node.path}.`))
        const meta = metaOf?.(node)
        return (
          <div key={node.path} className={styles.fieldRow} data-open={opened || undefined}>
            <button
              data-option
              type="button"
              role="menuitem"
              className={styles.fieldPick}
              data-picked={picked || undefined}
              title={node.path}
              onPointerEnter={() => {
                if (!opened) setFlyout(null)
              }}
              onClick={() => onPick(node.path)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowRight' || !opens || !event.currentTarget.parentElement) return
                event.preventDefault()
                show(node, event.currentTarget.parentElement, true)
              }}
            >
              <FieldKindIcon kind={node.kind} className={styles.kindIcon} />
              <span className={styles.fieldName}>{flat ? node.path : node.key}</span>
              {meta ? <span className={styles.fieldMeta}>{meta}</span> : null}
              {node.path === selected ? <Check className={controls.optionCheck} size={13} weight="bold" aria-hidden /> : null}
            </button>
            {opens ? (
              <button
                type="button"
                tabIndex={-1}
                className={styles.fieldOpen}
                aria-label={`Fields in ${node.key}`}
                aria-haspopup="menu"
                aria-expanded={opened}
                onPointerEnter={(event) => event.currentTarget.parentElement && show(node, event.currentTarget.parentElement, false)}
                onClick={(event) => event.currentTarget.parentElement && show(node, event.currentTarget.parentElement, true)}
              >
                <CaretRight size={12} weight="bold" aria-hidden />
              </button>
            ) : null}
          </div>
        )
      })}
      {flyout ? <FieldFlyout key={flyout.node.path} flyout={flyout} selected={selected} onPick={onPick} onClose={() => setFlyout(null)} /> : null}
    </div>
  )
}

function FieldFlyout({ flyout, selected, onPick, onClose }: { flyout: Flyout; selected?: string; onPick: (path: string) => void; onClose: () => void }) {
  const anchorRef = useMemo(() => ({ current: flyout.anchor }), [flyout.anchor])
  /** With focus inside the submenu, it goes back to the row the submenu opened from. */
  const close = () => {
    const focused = document.activeElement?.closest('[data-config-popover]')
    const refocus = Boolean(focused) && focused !== flyout.anchor.closest('[data-config-popover]')
    onClose()
    if (refocus) flyout.anchor.querySelector<HTMLElement>('button[data-option]')?.focus()
  }
  return (
    <Popover anchorRef={anchorRef} onClose={close} placement="side" className={styles.flyout} label={`Fields in ${flyout.node.key}`}>
      <FieldLevel nodes={flyout.node.children} selected={selected} focusFirst={flyout.focus} onPick={onPick} onBack={close} />
    </Popover>
  )
}

/* ---------- Expression ---------- */

type ExpressionInputProps = {
  label: string
  value: string
  sources: readonly FieldSource[]
  placeholder: string
  invalid?: boolean
  onChange: (value: string) => void
}

/** Text with `{{ field }}` references picked out; typing `{{` suggests fields, and dropped chips land at the caret. */
function ExpressionInput({ label, value, sources, placeholder, invalid, onChange }: ExpressionInputProps) {
  const [suggest, setSuggest] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const sync = () => {
    if (mirrorRef.current && inputRef.current) mirrorRef.current.scrollLeft = inputRef.current.scrollLeft
  }
  useLayoutEffect(sync)

  const readCaret = (input: HTMLInputElement) => {
    setSuggest(OPEN_REFERENCE.exec(input.value.slice(0, input.selectionStart ?? input.value.length))?.[1] ?? null)
    sync()
  }

  const insert = (path: string) => {
    const input = inputRef.current
    if (!input) return
    const caret = input.selectionStart ?? value.length
    const before = value.slice(0, caret).replace(OPEN_REFERENCE, '')
    const after = value.slice(caret).replace(/^[\w.$-]*\s*\}\}/, '')
    const token = referenceToken(path)
    onChange(before + token + after)
    setSuggest(null)
    requestAnimationFrame(() => {
      const at = before.length + token.length
      input.focus()
      input.setSelectionRange(at, at)
      sync()
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (suggest === null) return
    const first = pickerRef.current?.querySelector<HTMLButtonElement>('button[data-option]')
    if (event.key === 'ArrowDown' && first) {
      event.preventDefault()
      first.focus()
    } else if ((event.key === 'Enter' || event.key === 'Tab') && first && suggest) {
      event.preventDefault()
      first.click()
    }
  }

  return (
    <div ref={wrapRef} className={styles.expression}>
      <div ref={mirrorRef} className={styles.mirror} aria-hidden>
        {expressionParts(value).map((part, index) =>
          part.reference ? (
            <span key={index} className={styles.reference}>
              {part.text}
            </span>
          ) : (
            part.text
          ),
        )}
      </div>
      <input
        ref={inputRef}
        className={`${controls.input} ${styles.expressionInput}`}
        value={value}
        placeholder={placeholder}
        aria-label={`${label} expression`}
        aria-invalid={invalid || undefined}
        spellCheck={false}
        autoComplete="off"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange(event.target.value)
          readCaret(event.target)
        }}
        onSelect={(event) => readCaret(event.currentTarget)}
        onScroll={sync}
        onKeyDown={onKeyDown}
        onDrop={() => setSuggest(null)}
      />
      {suggest !== null && sources.length ? (
        <FieldPicker
          anchorRef={wrapRef}
          sources={sources}
          query={suggest}
          bodyRef={pickerRef}
          label={`${label} fields`}
          onPick={insert}
          onClose={() => setSuggest(null)}
        />
      ) : null}
    </div>
  )
}

const resultText = (value: unknown) => (value === undefined ? 'nothing' : (JSON.stringify(value) ?? String(value)))

/** What the expression gives for the first row, so a typo shows before a run. */
function ExpressionPreview({ value, fields }: { value: string; fields: ConditionFields }) {
  const row = fields.records?.[0]
  if (!row || !value.trim()) return null
  const result = evaluateExpression(value, resolver(row, fields.scope))
  return (
    <p className={styles.preview}>
      Row 1 gives <span className={styles.previewValue}>{resultText(result)}</span>
    </p>
  )
}

/* ---------- Value ---------- */

type ValueInputProps = { label: string; value: string; valueKind: ValueKind; placeholder?: string; invalid?: boolean; onChange: (value: string) => void }

function ValueInput({ label, value, valueKind, placeholder, invalid, onChange }: ValueInputProps) {
  if (valueKind === 'date') {
    return (
      <input
        type="datetime-local"
        className={`${controls.input} ${styles.mono} ${styles.dateInput}`}
        value={/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(0, 16) : ''}
        aria-label={label}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }
  return (
    <input
      className={valueKind === 'number' ? `${controls.input} ${styles.mono}` : controls.input}
      value={value}
      placeholder={placeholder ?? (valueKind === 'number' ? 'A number' : 'A value')}
      aria-label={label}
      aria-invalid={invalid || undefined}
      inputMode={valueKind === 'number' ? 'decimal' : undefined}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

/* ---------- Operator ---------- */

type OperatorSelectProps = {
  value: Operator
  onChange: (operator: Operator) => void
  /** The types offered, e.g. only Number for a count. */
  groups?: readonly OperatorGroup[]
  label?: string
}

type GroupFlyout = { group: OperatorGroup; anchor: HTMLButtonElement; focus: boolean }

/** The comparison, chosen by type first: each type opens its operators beside it. */
export function OperatorSelect({ value, onChange, groups = OPERATOR_GROUPS, label = 'Operator' }: OperatorSelectProps) {
  const [open, setOpen] = useState(false)
  const [flyout, setFlyout] = useState<GroupFlyout | null>(null)
  const ref = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const spec = operatorSpec(value)
  useFocusOnOpen(listRef, open)

  const close = () => {
    setOpen(false)
    setFlyout(null)
  }
  const show = (group: OperatorGroup, anchor: HTMLButtonElement, focus: boolean) =>
    setFlyout((current) => (current?.group === group && !focus ? current : { group, anchor, focus }))

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={styles.operatorTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${spec.group}, ${spec.label}`}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span className={styles.operatorIcon} title={spec.group}>
          <TypeIcon group={spec.group} />
        </span>
        <span className={styles.operatorLabel}>{spec.label}</span>
        <CaretDown className={controls.caret} size={12} weight="bold" aria-hidden />
      </button>
      {open ? (
        <Popover anchorRef={ref} onClose={close} className={styles.operatorMenu} label={label}>
          <div ref={listRef} role="menu" aria-label={label} onKeyDown={moveWithin}>
            {groups.map((group) => {
              return (
                <button
                  key={group}
                  data-option
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={flyout?.group === group}
                  data-current={group === spec.group || undefined}
                  className={`${controls.option} ${styles.groupOption}`}
                  onPointerEnter={(event) => show(group, event.currentTarget, false)}
                  onClick={(event) => show(group, event.currentTarget, true)}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowRight') return
                    event.preventDefault()
                    show(group, event.currentTarget, true)
                  }}
                >
                  <span className={controls.optionIcon}>
                    <TypeIcon group={group} />
                  </span>
                  <span className={controls.optionText}>
                    <span className={controls.optionLabel}>{group}</span>
                  </span>
                  <CaretRight className={styles.groupCaret} size={12} weight="bold" aria-hidden />
                </button>
              )
            })}
          </div>
          {flyout ? (
            <OperatorFlyout
              key={flyout.group}
              flyout={flyout}
              value={value}
              onPick={(operator) => {
                onChange(operator)
                close()
                ref.current?.focus()
              }}
              onClose={(refocus) => {
                setFlyout(null)
                if (refocus) flyout.anchor.focus()
              }}
            />
          ) : null}
        </Popover>
      ) : null}
    </>
  )
}

type OperatorFlyoutProps = { flyout: GroupFlyout; value: Operator; onPick: (operator: Operator) => void; onClose: (refocus: boolean) => void }

function OperatorFlyout({ flyout, value, onPick, onClose }: OperatorFlyoutProps) {
  const anchorRef = useMemo(() => ({ current: flyout.anchor }), [flyout.anchor])
  const listRef = useRef<HTMLDivElement>(null)
  useFocusOnOpen(listRef, flyout.focus)
  return (
    <Popover anchorRef={anchorRef} onClose={() => onClose(false)} placement="side" className={styles.operatorList} label={`${flyout.group} operators`}>
      <div
        ref={listRef}
        role="menu"
        aria-label={`${flyout.group} operators`}
        onKeyDown={(event) => {
          moveWithin(event)
          if (event.key !== 'ArrowLeft') return
          event.preventDefault()
          onClose(true)
        }}
      >
        {OPERATORS.filter((spec) => spec.group === flyout.group).map((spec) => (
          <button
            key={spec.id}
            data-option
            type="button"
            role="menuitemradio"
            aria-checked={spec.id === value}
            className={`${controls.option} ${styles.operatorOption}`}
            onClick={() => onPick(spec.id)}
          >
            <span className={controls.optionText}>
              <span className={controls.optionLabel}>{spec.label}</span>
            </span>
            {spec.id === value ? <Check className={controls.optionCheck} size={14} weight="bold" aria-hidden /> : null}
          </button>
        ))}
      </div>
    </Popover>
  )
}
