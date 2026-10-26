import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CaretDown, ChartLineUp, X } from '@phosphor-icons/react'
import assistant from '../compact-assistant.module.css'
import { ConfigSelect } from './StoryConfigSelect'
import {
  MONITOR_EVERY_MAX,
  MONITOR_METRICS,
  MONITOR_NOTIFY_BY,
  MONITOR_OPERATORS,
  MONITOR_TIMEZONES,
  MONITOR_UNITS,
  MONITOR_WEEKDAYS,
  describeMonitorSchedule,
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

function MonitorSection({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: string
  title: string
  summary: string
  open: boolean
  onToggle: () => void
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
      onToggle()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('[role="listbox"]')) return
      event.stopImmediatePropagation()
      onToggle()
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
  }, [menuOpen, onToggle, place])

  return (
    <section className={`${styles.section}${open ? ` ${styles.sectionOpen}` : ''}`}>
      <button
        ref={headRef}
        type="button"
        className={styles.sectionHead}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? `${id}-body` : undefined}
        onClick={() => {
          if (!open) place()
          onToggle()
        }}
      >
        <span className={styles.sectionCopy}>
          <span className={styles.sectionTitle}>{title}</span>
          <span className={styles.sectionSummary}>{summary}</span>
        </span>
        <CaretDown className={styles.sectionCaret} size={16} weight="bold" aria-hidden />
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
  const [threshold, setThreshold] = useState(initial.condition.value == null ? '' : String(initial.condition.value))
  const [triggerOpen, setTriggerOpen] = useState(false)

  const patch = <K extends keyof MonitorConfig>(key: K, value: MonitorConfig[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))
  const settled = (): MonitorConfig => ({
    ...draft,
    every: clampInt(every, 1, MONITOR_EVERY_MAX, draft.every),
    minute: clampInt(minute, 0, 59, draft.minute),
    monthDay: clampInt(monthDay, 1, 28, draft.monthDay),
    condition: { ...draft.condition, value: threshold.trim() && Number.isFinite(+threshold) ? +threshold : null },
    instructions: draft.instructions.trim(),
  })
  const preview = settled()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const timeField = (
    <div className={edit.field}>
      <FieldHead label="Runs At" hint="Local to selected timezone" htmlFor={`${fieldId}-time`} />
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
      <FieldHead label="Timezone" hint="IANA name (e.g. America/Los_Angeles)" />
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
        <header className={edit.header}>
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
              onToggle={() => setTriggerOpen((current) => !current)}
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
                  <div className={edit.field}>
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
                  <div className={edit.field}>
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
                <div className={styles.condition}>
                  <p className={styles.conditionLead}>What do you want to be notified on?</p>
                  <ConfigSelect
                    label="Metric"
                    hideLabel
                    className={`${styles.control} ${styles.conditionMetric}`}
                    value={draft.condition.metric}
                    options={MONITOR_METRICS}
                    onChange={(metric) => patch('condition', { ...draft.condition, metric })}
                  />
                  <ConfigSelect
                    label="Operator"
                    hideLabel
                    className={styles.control}
                    value={draft.condition.operator}
                    options={MONITOR_OPERATORS}
                    onChange={(operator) => patch('condition', { ...draft.condition, operator })}
                  />
                  <input
                    className={edit.input}
                    type="number"
                    inputMode="decimal"
                    aria-label="Value"
                    placeholder="Value"
                    value={threshold}
                    onChange={(event) => setThreshold(event.target.value)}
                  />
                </div>
              ) : (
                <textarea
                  className={`${edit.textarea} ${styles.prompt}`}
                  aria-label="Instructions"
                  value={draft.instructions}
                  placeholder="Type your prompt"
                  onChange={(event) => patch('instructions', event.target.value)}
                />
              )}
            </section>
          </div>
        </div>

        <footer className={edit.mapStyleFooter}>
          <button type="button" className={edit.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={edit.assetsNext} onClick={() => onConfirm(settled())}>
            Confirm
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
