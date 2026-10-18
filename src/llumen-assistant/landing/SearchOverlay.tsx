import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AppWindow,
  ArrowRight,
  ClockCounterClockwise,
  Cube,
  MagnifyingGlass,
  Newspaper,
  SquaresFour,
} from '@phosphor-icons/react'
import styles from './SearchOverlay.module.css'

type ResultKind = 'finding' | 'asset' | 'app' | 'workspace'

type SearchItem = {
  id: string
  kind: ResultKind
  label: string
  hint: string
}

const GROUPS: readonly { kind: ResultKind; name: string; icon: ReactNode }[] = [
  { kind: 'finding', name: 'Findings', icon: <Newspaper size={18} weight="regular" aria-hidden /> },
  { kind: 'asset', name: 'Assets', icon: <Cube size={18} weight="regular" aria-hidden /> },
  { kind: 'app', name: 'Apps', icon: <AppWindow size={18} weight="regular" aria-hidden /> },
  { kind: 'workspace', name: 'Workspaces', icon: <SquaresFour size={18} weight="regular" aria-hidden /> },
]

const ITEMS: readonly SearchItem[] = [
  { id: 'f-bus', kind: 'finding', label: 'Island Bus Reliability Brief', hint: 'Operations' },
  { id: 'f-risk', kind: 'finding', label: 'Proactive Risk Digest', hint: 'Customer Success' },
  { id: 'f-mussafah', kind: 'finding', label: 'Industrial growth in Al Mussafah', hint: 'Planning' },
  { id: 'f-land', kind: 'finding', label: 'Land use mix', hint: 'Planning' },
  { id: 'f-population', kind: 'finding', label: 'Population composition across the capital', hint: 'Operations' },
  { id: 'f-air', kind: 'finding', label: 'Coastal corridor air quality', hint: 'Operations' },
  { id: 'f-heat', kind: 'finding', label: 'Coastal Heat Stress Advisory', hint: 'Operations' },
  { id: 'f-al-ain', kind: 'finding', label: 'Al Ain station cluster', hint: 'Environment' },
  { id: 'f-water', kind: 'finding', label: 'Water Network Pressure Review', hint: 'Engineering' },
  { id: 'a-permit', kind: 'asset', label: 'Permit limit deviation', hint: 'Compliance' },
  { id: 'a-land', kind: 'asset', label: 'Al Mussafah land use', hint: 'Planning' },
  { id: 'a-population', kind: 'asset', label: 'Population composition', hint: 'Demographics' },
  { id: 'a-pressure', kind: 'asset', label: 'Network pressure', hint: 'Engineering' },
  { id: 'p-groundwater', kind: 'app', label: 'Groundwater Monitoring Network', hint: 'App' },
  { id: 'p-policies', kind: 'app', label: 'Policies & Regulations Dashboard', hint: 'App' },
  { id: 'p-mangrove', kind: 'app', label: 'Mangrove Ecosystem Health Monitoring', hint: 'App' },
  { id: 'p-plastics', kind: 'app', label: 'Single Use Plastics Dashboard', hint: 'App' },
  { id: 'w-finance', kind: 'workspace', label: 'Finance', hint: 'Private workspace' },
  { id: 'w-operations', kind: 'workspace', label: 'Operations', hint: 'Shared workspace' },
  { id: 'w-engineering', kind: 'workspace', label: 'Engineering', hint: 'Shared workspace' },
  { id: 'w-hr', kind: 'workspace', label: 'HR', hint: 'Private workspace' },
]

const RECENT = ['Air quality', 'Al Mussafah', 'Water pressure'] as const
const SUGGESTED = ['f-water', 'a-permit', 'p-groundwater']
const PER_GROUP = 4
const EXIT_MS = 180

type Row = { type: 'recent'; id: string; label: string } | { type: 'item'; id: string; item: SearchItem }

function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <mark className={styles.match}>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  )
}

/** Full-screen blurred search. Mount it only while open; it plays its exit before calling onClose. */
export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [closing, setClosing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  const exitRef = useRef<number | null>(null)
  const closeRef = useRef<() => void>(() => {})

  const q = query.trim()

  const sections = useMemo(() => {
    if (!q) {
      return [
        {
          name: 'Recent',
          icon: <ClockCounterClockwise size={18} weight="regular" aria-hidden />,
          rows: RECENT.map((label): Row => ({ type: 'recent', id: `recent-${label}`, label })),
        },
        {
          name: 'Suggested',
          icon: null,
          rows: SUGGESTED.flatMap((id): Row[] => {
            const item = ITEMS.find((entry) => entry.id === id)
            return item ? [{ type: 'item', id, item }] : []
          }),
        },
      ]
    }
    const needle = q.toLowerCase()
    return GROUPS.map((group) => ({
      name: group.name,
      icon: group.icon,
      rows: ITEMS.filter(
        (item) => item.kind === group.kind && `${item.label} ${item.hint}`.toLowerCase().includes(needle),
      )
        .slice(0, PER_GROUP)
        .map((item): Row => ({ type: 'item', id: item.id, item })),
    })).filter((section) => section.rows.length > 0)
  }, [q])

  const rows = useMemo(() => sections.flatMap((section) => section.rows), [sections])
  const starts = useMemo(
    () => sections.map((_, at) => sections.slice(0, at).reduce((sum, section) => sum + section.rows.length, 0)),
    [sections],
  )
  const active = Math.min(cursor, Math.max(0, rows.length - 1))

  const close = () => {
    if (exitRef.current !== null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose()
      return
    }
    setClosing(true)
    exitRef.current = window.setTimeout(onClose, EXIT_MS)
  }

  useEffect(() => {
    closeRef.current = close
  })

  const choose = (row: Row | undefined) => {
    if (!row) return
    if (row.type === 'recent') {
      setQuery(row.label)
      setCursor(0)
      inputRef.current?.focus()
      return
    }
    close()
  }

  useLayoutEffect(() => {
    const stack = stackRef.current
    if (stack) stack.style.setProperty('--stack-h', `${stack.offsetHeight}px`)
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey)
      if (exitRef.current !== null) window.clearTimeout(exitRef.current)
    }
  }, [])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return createPortal(
    <div className={styles.backdrop} data-closing={closing} onMouseDown={close}>
      <div
        ref={stackRef}
        className={styles.stack}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setCursor(Math.min(rows.length - 1, active + 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setCursor(Math.max(0, active - 1))
          } else if (event.key === 'Enter') {
            event.preventDefault()
            choose(rows[active])
          }
        }}
      >
        <label className={styles.bar}>
          <MagnifyingGlass className={styles.barIcon} size={20} weight="regular" aria-hidden />
          <input
            ref={inputRef}
            className={styles.input}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setCursor(0)
            }}
            placeholder="Search findings, assets, apps, and workspaces…"
            aria-label="Search"
            aria-controls="search-overlay-results"
            aria-activedescendant={rows[active] ? `search-${rows[active].id}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className={styles.kbd}>esc</kbd>
        </label>
        <div id="search-overlay-results" className={styles.results} ref={listRef} role="listbox" aria-label="Results">
          {rows.length === 0 ? (
            <p className={styles.empty}>
              No results for “{q}”. Press <kbd className={styles.kbd}>esc</kbd> and ask Llumen instead.
            </p>
          ) : null}
          {sections.map((section, sectionAt) => (
            <div key={section.name} className={styles.group} role="group" aria-label={section.name}>
              <p className={styles.groupLabel}>{section.name}</p>
              {section.rows.map((row, rowAt) => {
                const rowIndex = starts[sectionAt] + rowAt
                const selected = rowIndex === active
                const icon =
                  row.type === 'recent' ? section.icon : GROUPS.find((group) => group.kind === row.item.kind)?.icon
                return (
                  <button
                    key={row.id}
                    id={`search-${row.id}`}
                    type="button"
                    role="option"
                    data-index={rowIndex}
                    aria-selected={selected}
                    className={styles.item}
                    data-active={selected}
                    onMouseEnter={() => setCursor(rowIndex)}
                    onClick={() => choose(row)}
                  >
                    <span className={styles.itemIcon}>{icon}</span>
                    <span className={styles.itemLabel}>
                      <Highlight text={row.type === 'recent' ? row.label : row.item.label} query={q} />
                    </span>
                    {row.type === 'item' ? <span className={styles.itemHint}>{row.item.hint}</span> : null}
                    <ArrowRight className={styles.itemGo} size={16} weight="regular" aria-hidden />
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
