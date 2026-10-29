import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  At,
  CaretDown,
  ChartLineUp,
  DotsSixVertical,
  LinkSimple,
  Paperclip,
  Plus,
  Trash,
  X,
} from '@phosphor-icons/react'
import assistant from '../compact-assistant.module.css'
import { ConfigSelect } from './StoryConfigSelect'
import {
  MONITOR_EVERY_MAX,
  MONITOR_NOTIFY_BY,
  MONITOR_OPERATORS,
  MONITOR_TIMEZONES,
  MONITOR_UNITS,
  MONITOR_WEEKDAYS,
  describeMonitorSchedule,
  newMonitorCondition,
  type MonitorConfig,
} from './storyMonitor'
import edit from './StoryEditPanel.module.css'
import styles from './StoryMonitorModal.module.css'

function clampInt(raw: string, min: number, max: number, fallback: number) {
  const value = Number.parseInt(raw, 10)
  return Number.isNaN(value) ? fallback : Math.min(max, Math.max(min, value))
}

function FieldHead({ label, hint, htmlFor }: { label: string; hint?: string; htmlFor?: string }) {
  return (
    <div className={styles.fieldHead}>
      {htmlFor ? (
        <label className={edit.label} htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className={edit.label} aria-hidden>
          {label}
        </span>
      )}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  )
}

const DROPDOWN_WIDTH = 400
const DROPDOWN_GAP = 6
const DROPDOWN_EDGE = 8

/** A setting behind a select-style trigger. Its menu applies on Apply; Cancel, Escape or a press outside discard. */
function MonitorSection({
  id,
  title,
  summary,
  open,
  onOpen,
  onCancel,
  onApply,
  children,
}: {
  id: string
  title: string
  summary: string
  open: boolean
  onOpen: () => void
  onCancel: () => void
  onApply: () => void
  children: ReactNode
}) {
  const headRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, width: DROPDOWN_WIDTH })
  const menuOpen = open

  const place = useCallback(() => {
    const rect = headRef.current?.getBoundingClientRect()
    if (rect)
      setPosition({ top: rect.bottom + DROPDOWN_GAP, left: rect.left, width: Math.min(DROPDOWN_WIDTH, rect.width) })
  }, [])

  // Flips above the row once the menu's height is known, if it would run off the bottom.
  useLayoutEffect(() => {
    const menu = menuRef.current
    const rect = headRef.current?.getBoundingClientRect()
    if (!menuOpen || !menu || !rect) return
    const below = rect.bottom + DROPDOWN_GAP
    const fits = below + menu.offsetHeight <= window.innerHeight - DROPDOWN_EDGE
    menu.style.top = `${fits ? below : Math.max(DROPDOWN_EDGE, rect.top - DROPDOWN_GAP - menu.offsetHeight)}px`
  })

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element
      if (headRef.current?.contains(target) || menuRef.current?.contains(target)) return
      // Selects inside the menu list their options in a portal of their own.
      if (target.closest('[role="listbox"]')) return
      onCancel()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('[role="listbox"]')) return
      event.stopImmediatePropagation()
      onCancel()
      headRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [menuOpen, onCancel, place])

  return (
    <section className={`${styles.section} ${edit.field} ${styles.trigger}`}>
      <span id={`${id}-label`} className={styles.sectionTitle}>
        {title}
      </span>
      <button
        ref={headRef}
        type="button"
        className={`${edit.logoSelect}${open ? ` ${edit.logoSelectOpen}` : ''}`}
        aria-labelledby={`${id}-label ${id}-summary`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? `${id}-body` : undefined}
        onClick={() => {
          if (open) {
            onCancel()
            return
          }
          place()
          onOpen()
        }}
      >
        <span id={`${id}-summary`}>{summary}</span>
        <CaretDown className={edit.logoSelectCaret} size={16} weight="bold" aria-hidden />
      </button>
      {menuOpen
        ? createPortal(
            <div
              ref={menuRef}
              id={`${id}-body`}
              className={styles.dropdown}
              role="dialog"
              aria-label={`${title} settings`}
              style={{ top: position.top, left: position.left, width: position.width }}
            >
              {children}
              <div className={styles.dropdownActions}>
                <button
                  type="button"
                  className={edit.secondaryBtn}
                  onClick={() => {
                    onCancel()
                    headRef.current?.focus()
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={edit.assetsNext}
                  onClick={() => {
                    onApply()
                    headRef.current?.focus()
                  }}
                >
                  Apply
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}

export function StoryMonitorModal({
  cardTitle,
  initial,
  onConfirm,
  onClose,
}: {
  cardTitle: string
  initial: MonitorConfig
  onConfirm: (config: MonitorConfig) => void
  onClose: () => void
}) {
  const fieldId = useId()
  const [draft, setDraft] = useState(initial)
  const [every, setEvery] = useState(String(initial.every))
  const [minute, setMinute] = useState(String(initial.minute))
  const [monthDay, setMonthDay] = useState(String(initial.monthDay))
  /** Each condition's value as typed, by condition id. */
  const [thresholds, setThresholds] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.conditions.map(({ id, value }) => [id, value == null ? '' : String(value)])),
  )
  const [dragId, setDragId] = useState<string | null>(null)
  /** The handle to refocus once a keyboard move re-renders the list. */
  const focusHandle = useRef<string | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const revealLast = useRef(false)
  /** The schedule as it was when the trigger menu opened, for Cancel to restore; `null` while it is closed. */
  const [triggerSaved, setTriggerSaved] = useState<{
    draft: MonitorConfig
    every: string
    minute: string
    monthDay: string
  } | null>(null)
  const triggerOpen = triggerSaved !== null

  const patch = <K extends keyof MonitorConfig>(key: K, value: MonitorConfig[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))
  const settled = (): MonitorConfig => ({
    ...draft,
    every: clampInt(every, 1, MONITOR_EVERY_MAX, draft.every),
    minute: clampInt(minute, 0, 59, draft.minute),
    monthDay: clampInt(monthDay, 1, 28, draft.monthDay),
    conditions: draft.conditions.map((condition) => {
      const raw = thresholds[condition.id]?.trim() ?? ''
      return { ...condition, value: raw && Number.isFinite(+raw) ? +raw : null }
    }),
    instructions: draft.instructions.trim(),
  })
  const preview = settled()
  /** Conditions are optional, but once any input has something in it, every field and value needs one. */
  const conditionInputs = draft.conditions.flatMap(({ id, field }) => [field.trim(), thresholds[id]?.trim() ?? ''])
  const conditionsIncomplete =
    draft.notifyBy === 'condition' && conditionInputs.some(Boolean) && !conditionInputs.every(Boolean)

  const patchCondition = (id: string, change: Partial<MonitorConfig['conditions'][number]>) =>
    setDraft((current) => ({
      ...current,
      conditions: current.conditions.map((condition) =>
        condition.id === id ? { ...condition, ...change } : condition,
      ),
    }))
  const addCondition = () => {
    revealLast.current = true
    setDraft((current) => ({ ...current, conditions: [...current.conditions, newMonitorCondition()] }))
  }
  const removeCondition = (id: string) =>
    setDraft((current) => ({ ...current, conditions: current.conditions.filter((condition) => condition.id !== id) }))
  const moveCondition = (id: string, to: number) =>
    setDraft((current) => {
      const from = current.conditions.findIndex((condition) => condition.id === id)
      if (from < 0 || to < 0 || to >= current.conditions.length || from === to) return current
      const conditions = [...current.conditions]
      conditions.splice(to, 0, ...conditions.splice(from, 1))
      return { ...current, conditions }
    })

  useEffect(() => {
    const list = listRef.current
    if (revealLast.current && list) {
      revealLast.current = false
      list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
    }
    const id = focusHandle.current
    if (!id) return
    focusHandle.current = null
    const handle = list?.querySelector<HTMLElement>(`[data-handle="${id}"]`)
    handle?.focus()
    handle?.closest('li')?.scrollIntoView({ block: 'nearest' })
  }, [draft.conditions])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const timeField = (
    <div className={edit.field}>
      <FieldHead label="Runs At" htmlFor={`${fieldId}-time`} />
      <input
        id={`${fieldId}-time`}
        className={`${edit.input} ${styles.timeInput}`}
        type="time"
        value={draft.time}
        required
        onChange={(event) => {
          if (event.target.value) patch('time', event.target.value)
        }}
      />
    </div>
  )
  const timezoneField = (
    <div className={edit.field}>
      <FieldHead label="Timezone" />
      <ConfigSelect
        label="Timezone"
        hideLabel
        className={styles.control}
        value={draft.timezone}
        options={MONITOR_TIMEZONES}
        onChange={(value) => patch('timezone', value)}
      />
    </div>
  )
  return createPortal(
    <div className={edit.modalRoot}>
      <button type="button" className={edit.modalBackdrop} aria-label="Close monitoring workflow" onClick={onClose} />
      <div
        id="monitor-modal"
        className={`${edit.panel} ${edit.modal} ${edit.monitorModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="monitor-modal-title"
        dir="ltr"
      >
        <header className={`${edit.header} ${styles.header}`}>
          <div className={edit.headerIdentity}>
            <div className={edit.headerCopy}>
              <h2 id="monitor-modal-title" className={edit.title}>
                Schedule Monitoring Workflow
              </h2>
            </div>
          </div>
          <div className={edit.headerActions}>
            <button type="button" className={edit.closeBtn} onClick={onClose} aria-label="Close monitoring workflow">
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
        </header>

        <div className={edit.scroll}>
          <div className={styles.body}>
            <div className={styles.context}>
              <span className={assistant.inlineMention} aria-label={`Card: ${cardTitle}`}>
                <span className={assistant.inlineMentionIcon} aria-hidden>
                  <ChartLineUp size={12} weight="bold" />
                </span>
                <span className={assistant.inlineMentionLabel}>{cardTitle}</span>
              </span>
            </div>
            <MonitorSection
              id={`${fieldId}-trigger`}
              title="Schedule Trigger"
              summary={describeMonitorSchedule(preview)}
              open={triggerOpen}
              onOpen={() => setTriggerSaved({ draft, every, minute, monthDay })}
              onCancel={() => {
                if (!triggerSaved) return
                setDraft(triggerSaved.draft)
                setEvery(triggerSaved.every)
                setMinute(triggerSaved.minute)
                setMonthDay(triggerSaved.monthDay)
                setTriggerSaved(null)
              }}
              onApply={() => {
                const applied = settled()
                setDraft((current) => ({
                  ...current,
                  every: applied.every,
                  minute: applied.minute,
                  monthDay: applied.monthDay,
                }))
                setEvery(String(applied.every))
                setMinute(String(applied.minute))
                setMonthDay(String(applied.monthDay))
                setTriggerSaved(null)
              }}
            >
              <div className={styles.grid}>
                <div className={edit.field}>
                  <FieldHead label="Every" htmlFor={`${fieldId}-every`} />
                  <input
                    id={`${fieldId}-every`}
                    className={edit.input}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MONITOR_EVERY_MAX}
                    value={every}
                    onChange={(event) => setEvery(event.target.value)}
                    onBlur={() => setEvery(String(clampInt(every, 1, MONITOR_EVERY_MAX, draft.every)))}
                  />
                </div>
                <div className={edit.field}>
                  <FieldHead label="Unit" />
                  <ConfigSelect
                    label="Unit"
                    hideLabel
                    className={styles.control}
                    value={draft.unit}
                    options={MONITOR_UNITS}
                    onChange={(value) => patch('unit', value)}
                  />
                </div>

                {draft.unit === 'hours' ? (
                  <div className={edit.field}>
                    <FieldHead label="Minute of the hour" hint="0–59" htmlFor={`${fieldId}-minute`} />
                    <input
                      id={`${fieldId}-minute`}
                      className={edit.input}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={59}
                      value={minute}
                      onChange={(event) => setMinute(event.target.value)}
                      onBlur={() => setMinute(String(clampInt(minute, 0, 59, draft.minute)))}
                    />
                  </div>
                ) : null}
                {draft.unit === 'weeks' ? (
                  <div className={`${edit.field} ${styles.wide}`}>
                    <FieldHead label="Day of the week" />
                    <ConfigSelect
                      label="Day of the week"
                      hideLabel
                      className={styles.control}
                      value={draft.weekday}
                      options={MONITOR_WEEKDAYS}
                      onChange={(value) => patch('weekday', value)}
                    />
                  </div>
                ) : null}
                {draft.unit === 'months' ? (
                  <div className={`${edit.field} ${styles.wide}`}>
                    <FieldHead
                      label="Day of the month"
                      hint="1–28 (29–31 not supported)"
                      htmlFor={`${fieldId}-month-day`}
                    />
                    <input
                      id={`${fieldId}-month-day`}
                      className={edit.input}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={28}
                      value={monthDay}
                      onChange={(event) => setMonthDay(event.target.value)}
                      onBlur={() => setMonthDay(String(clampInt(monthDay, 1, 28, draft.monthDay)))}
                    />
                  </div>
                ) : null}
                {draft.unit === 'days' || draft.unit === 'weeks' || draft.unit === 'months' ? timeField : null}
                {timezoneField}
              </div>
            </MonitorSection>

            <section className={`${styles.section} ${edit.field} ${styles.notify}`}>
              <FieldHead label="Notify me based on" hint="Optional" />
              <ConfigSelect
                label="Notify me based on"
                hideLabel
                className={styles.control}
                value={draft.notifyBy}
                options={MONITOR_NOTIFY_BY}
                onChange={(notifyBy) => patch('notifyBy', notifyBy)}
              />
              {draft.notifyBy === 'condition' ? (
                <div className={styles.conditions}>
                  {draft.conditions.length > 1 ? (
                    <div className={styles.match}>
                      <span id={`${fieldId}-match`} className={styles.matchLabel}>
                        Match
                      </span>
                      <div
                        className={`${edit.segmentedControl} ${styles.matchToggle}`}
                        role="group"
                        aria-labelledby={`${fieldId}-match`}
                      >
                        {(['all', 'any'] as const).map((match) => (
                          <button
                            key={match}
                            type="button"
                            className={`${edit.segmentedBtn}${draft.match === match ? ` ${edit.segmentedBtnActive}` : ''}`}
                            aria-pressed={draft.match === match}
                            aria-label={match === 'all' ? 'All conditions (AND)' : 'Any condition (OR)'}
                            onClick={() => patch('match', match)}
                          >
                            {match === 'all' ? 'AND' : 'OR'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <ol
                    ref={listRef}
                    className={styles.conditionList}
                    data-scrolls={draft.conditions.length > 2 || undefined}
                  >
                    {draft.conditions.map((condition, index) => {
                      const name = `Condition ${index + 1}`
                      return (
                        <li
                          key={condition.id}
                          className={styles.conditionCard}
                          aria-label={name}
                          data-dragging={dragId === condition.id || undefined}
                          onDragOver={(event) => {
                            if (!dragId) return
                            event.preventDefault()
                            event.dataTransfer.dropEffect = 'move'
                            if (dragId !== condition.id) moveCondition(dragId, index)
                          }}
                          onDrop={(event) => {
                            event.preventDefault()
                            setDragId(null)
                          }}
                        >
                          <div className={styles.conditionHead}>
                            <span className={styles.conditionTitle}>{name}</span>
                            {draft.conditions.length > 1 ? (
                              <div className={styles.conditionActions}>
                                <button
                                  type="button"
                                  className={`${styles.conditionAction} ${styles.conditionHandle}`}
                                  aria-label={`Reorder ${name}`}
                                  aria-description="Drag, or press the up and down arrow keys, to reorder"
                                  data-handle={condition.id}
                                  draggable
                                  onDragStart={(event) => {
                                    const card = event.currentTarget.closest('li')
                                    if (card) event.dataTransfer.setDragImage(card, 24, 16)
                                    event.dataTransfer.effectAllowed = 'move'
                                    event.dataTransfer.setData('text/plain', condition.id)
                                    setDragId(condition.id)
                                  }}
                                  onDragEnd={() => setDragId(null)}
                                  onKeyDown={(event) => {
                                    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                                    event.preventDefault()
                                    focusHandle.current = condition.id
                                    moveCondition(condition.id, index + (event.key === 'ArrowUp' ? -1 : 1))
                                  }}
                                >
                                  <DotsSixVertical size={16} weight="bold" aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.conditionAction} ${styles.conditionRemove}`}
                                  aria-label={`Remove ${name}`}
                                  onClick={() => removeCondition(condition.id)}
                                >
                                  <Trash size={16} weight="regular" aria-hidden />
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <div className={styles.condition}>
                            <div className={styles.conditionField}>
                              <input
                                className={edit.input}
                                type="text"
                                aria-label="Field"
                                placeholder="Field name or {{ Node.field }}"
                                value={condition.field}
                                onChange={(event) => patchCondition(condition.id, { field: event.target.value })}
                              />
                              <button
                                type="button"
                                className={styles.conditionFieldRef}
                                aria-label="Insert a field reference"
                                onClick={(event) => {
                                  const input = event.currentTarget.previousElementSibling as HTMLInputElement
                                  const start = input.selectionStart ?? condition.field.length
                                  const end = input.selectionEnd ?? start
                                  const field = `${condition.field.slice(0, start)}{{  }}${condition.field.slice(end)}`
                                  patchCondition(condition.id, { field })
                                  requestAnimationFrame(() => {
                                    input.focus()
                                    input.setSelectionRange(start + 3, start + 3)
                                  })
                                }}
                              >
                                <LinkSimple size={16} weight="regular" aria-hidden />
                              </button>
                            </div>
                            <ConfigSelect
                              label="Operator"
                              hideLabel
                              className={styles.control}
                              value={condition.operator}
                              options={MONITOR_OPERATORS}
                              onChange={(operator) => patchCondition(condition.id, { operator })}
                            />
                            <input
                              className={edit.input}
                              type="number"
                              inputMode="decimal"
                              aria-label="Value"
                              placeholder="Value"
                              value={thresholds[condition.id] ?? ''}
                              onChange={(event) =>
                                setThresholds((current) => ({ ...current, [condition.id]: event.target.value }))
                              }
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                  <button type="button" className={styles.addCondition} onClick={addCondition}>
                    <Plus size={14} weight="bold" aria-hidden />
                    Add condition
                  </button>
                </div>
              ) : (
                <div className={`${edit.textarea} ${styles.promptBox}`}>
                  <textarea
                    className={styles.prompt}
                    aria-label="Instructions"
                    value={draft.instructions}
                    placeholder="Type your prompt"
                    onChange={(event) => patch('instructions', event.target.value)}
                  />
                  <div className={styles.promptTools}>
                    <button type="button" className={styles.promptIcon} aria-label="Attach file">
                      <Paperclip size={18} weight="regular" aria-hidden />
                    </button>
                    <button type="button" className={styles.promptLabel}>
                      <At size={16} weight="regular" aria-hidden />
                      Add context
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className={edit.mapStyleFooter}>
          <button type="button" className={edit.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={edit.assetsNext}
            disabled={conditionsIncomplete}
            onClick={() => onConfirm(settled())}
          >
            Send request
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
