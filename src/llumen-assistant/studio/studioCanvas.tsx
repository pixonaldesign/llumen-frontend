import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from 'react'
import {
  ArrowRight,
  CornersOut,
  Cursor,
  Hand,
  MagnifyingGlass,
  Minus,
  PencilSimple,
  Plus,
  SquaresFour,
  X,
} from '@phosphor-icons/react'
import { STUDIO_ASSETS, type StudioAsset, type StudioPage } from './studioData'
import { ASSET_CATEGORIES, ASSET_STATUSES, CATEGORY_COLOR, STATUS_COLOR, ownerOf } from './studioAssetMeta'
import { Avatar, ChartFrame } from './studioExperiences'
import { NAV, isGroup } from './studioNavItems'
import { StatusChip } from './studioUi'
import c from './StudioCanvas.module.css'

/* World units: a card is drawn at this size at 100% zoom. */
const CARD_W = 320
const CARD_H = 200
const GAP = 16
const FRAME_PAD = 20
const FRAME_HEAD = 20
const FRAME_GAP = 96
const ROW_LIMIT = 2200
const MIN_ZOOM = 0.2
const MAX_ZOOM = 2

type GroupBy = 'category' | 'status'
type Tool = 'select' | 'hand'
type View = { x: number; y: number; k: number }
type Box = { x: number; y: number; w: number; h: number }
type Frame = Box & { name: string; color: string; count: number }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Frames flow left to right and wrap; each holds its cards in a small grid. */
function layout(groupBy: GroupBy) {
  const groups =
    groupBy === 'category'
      ? ASSET_CATEGORIES.map((name) => ({ name, color: CATEGORY_COLOR[name] ?? '#fff', items: STUDIO_ASSETS.filter((a) => a.category === name) }))
      : ASSET_STATUSES.map((name) => ({ name, color: STATUS_COLOR[name], items: STUDIO_ASSETS.filter((a) => a.status === name) }))
  const frames: Frame[] = []
  const cards = new Map<string, Box>()
  let x = 0
  let y = 0
  let rowHeight = 0
  for (const group of groups) {
    const cols = Math.min(group.items.length, groupBy === 'status' ? 3 : 2)
    const rows = Math.ceil(group.items.length / cols)
    const w = cols * CARD_W + (cols - 1) * GAP + FRAME_PAD * 2
    const h = FRAME_HEAD + rows * CARD_H + (rows - 1) * GAP + FRAME_PAD * 2
    if (x > 0 && x + w > ROW_LIMIT) {
      x = 0
      y += rowHeight + FRAME_GAP
      rowHeight = 0
    }
    frames.push({ name: group.name, color: group.color, count: group.items.length, x, y, w, h })
    group.items.forEach((asset, index) => {
      cards.set(asset.id, {
        x: x + FRAME_PAD + (index % cols) * (CARD_W + GAP),
        y: y + FRAME_PAD + FRAME_HEAD + Math.floor(index / cols) * (CARD_H + GAP),
        w: CARD_W,
        h: CARD_H,
      })
    })
    x += w + FRAME_GAP
    rowHeight = Math.max(rowHeight, h)
  }
  const bounds = frames.reduce(
    (box, frame) => ({ w: Math.max(box.w, frame.x + frame.w), h: Math.max(box.h, frame.y + frame.h) }),
    { w: 0, h: 0 },
  )
  return { frames, cards, bounds: { x: 0, y: -32, w: bounds.w, h: bounds.h + 32 } }
}

type Layout = ReturnType<typeof layout>
type Area = { w: number; h: number }

/** The view that centres `target` in the viewport, leaving room for the floating chrome. */
function fitView(area: Area, target: Box, cap = 1): View {
  const k = clamp(Math.min((area.w - 120) / target.w, (area.h - 220) / target.h), MIN_ZOOM, cap)
  return { k, x: (area.w - target.w * k) / 2 - target.x * k, y: (area.h - target.h * k) / 2 - target.y * k + 10 }
}

function focusView(area: Area, world: Layout, id: string): View | null {
  const box = world.cards.get(id)
  if (!box) return null
  return fitView(area, { x: box.x - 60, y: box.y - 60, w: box.w + 120, h: box.h + 120 }, 1.35)
}

export type CanvasHandle = { focus: (id: string) => void }

/** Every asset on one pannable, zoomable board, clustered into frames by category or status. */
export function CanvasAssets({
  ref,
  initialFocus,
  onCreate,
}: {
  ref?: Ref<CanvasHandle>
  initialFocus?: string
  onCreate: () => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null)
  const pendingFocus = useRef(initialFocus)
  const measured = useRef(false)
  const [size, setSize] = useState<Area | null>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 0.6 })
  const [smooth, setSmooth] = useState(false)
  const [groupBy, setGroupBy] = useState<GroupBy>('category')
  const [tool, setTool] = useState<Tool>('select')
  const [selected, setSelected] = useState<string | null>(initialFocus ?? null)
  const [panning, setPanning] = useState(false)
  const world = useMemo(() => layout(groupBy), [groupBy])

  const focusCard = useCallback(
    (id: string) => {
      if (!size) return
      const next = focusView(size, world, id)
      if (!next) return
      setSmooth(true)
      setView(next)
      setSelected(id)
    },
    [size, world],
  )

  useImperativeHandle(ref, () => ({ focus: focusCard }), [focusCard])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const area = { w: entry.contentRect.width, h: entry.contentRect.height }
      setSize(area)
      if (measured.current) return
      measured.current = true
      const first = layout('category')
      const focusId = pendingFocus.current
      setView((focusId && focusView(area, first, focusId)) || fitView(area, first.bounds))
    })
    observer.observe(el)
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest('[data-chrome]')) return
      event.preventDefault()
      setSmooth(false)
      const rect = el.getBoundingClientRect()
      const cx = event.clientX - rect.left
      const cy = event.clientY - rect.top
      setView((prev) => {
        if (event.ctrlKey || event.metaKey) {
          const k = clamp(prev.k * Math.exp(-event.deltaY * 0.01), MIN_ZOOM, MAX_ZOOM)
          return { k, x: cx - ((cx - prev.x) * k) / prev.k, y: cy - ((cy - prev.y) * k) / prev.k }
        }
        return { ...prev, x: prev.x - event.deltaX, y: prev.y - event.deltaY }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      observer.disconnect()
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  const zoomBy = (factor: number) => {
    if (!size) return
    setSmooth(true)
    setView((prev) => {
      const k = clamp(prev.k * factor, MIN_ZOOM, MAX_ZOOM)
      const cx = size.w / 2
      const cy = size.h / 2
      return { k, x: cx - ((cx - prev.x) * k) / prev.k, y: cy - ((cy - prev.y) * k) / prev.k }
    })
  }

  const fit = (next: Layout = world) => {
    if (!size) return
    setSmooth(true)
    setView(fitView(size, next.bounds))
  }

  const regroup = (next: GroupBy) => {
    setGroupBy(next)
    fit(layout(next))
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('[data-chrome]')) return
    if (target.closest('[data-card]') && tool === 'select') return
    dragRef.current = { px: event.clientX, py: event.clientY, x: view.x, y: view.y, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
    setSmooth(false)
    setPanning(true)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.px
    const dy = event.clientY - drag.py
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true
    setView((prev) => ({ ...prev, x: drag.x + dx, y: drag.y + dy }))
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null
    setPanning(false)
    if (drag && !drag.moved && tool === 'select') setSelected(null)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('input, [data-chrome]')) return
    const pan = (dx: number, dy: number) => {
      event.preventDefault()
      setSmooth(true)
      setView((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    }
    switch (event.key) {
      case '=':
      case '+':
        zoomBy(1.25)
        break
      case '-':
        zoomBy(0.8)
        break
      case '0':
      case '!':
        fit()
        break
      case 'v':
        setTool('select')
        break
      case 'h':
        setTool('hand')
        break
      case 'Escape':
        setSelected(null)
        break
      case 'ArrowLeft':
        pan(80, 0)
        break
      case 'ArrowRight':
        pan(-80, 0)
        break
      case 'ArrowUp':
        pan(0, 80)
        break
      case 'ArrowDown':
        pan(0, -80)
        break
    }
  }

  const selectedAsset = selected ? STUDIO_ASSETS.find((asset) => asset.id === selected) : undefined
  const dots = 24 * view.k

  return (
    <div
      ref={viewportRef}
      className={c.viewport}
      data-tool={tool}
      data-panning={panning || undefined}
      tabIndex={0}
      aria-label="Asset canvas. Drag to pan, Ctrl and scroll to zoom, 0 to fit."
      style={{ backgroundSize: `${dots}px ${dots}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <div
        className={c.world}
        data-smooth={smooth || undefined}
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
        onTransitionEnd={() => setSmooth(false)}
      >
        <CanvasWorld world={world} selected={selected} onSelect={setSelected} onFocus={focusCard} />
      </div>

      <div className={c.toolbar} data-chrome role="toolbar" aria-label="Canvas tools">
        <div className={c.toolGroup} role="radiogroup" aria-label="Tool">
          <ToolButton label="Select (V)" active={tool === 'select'} onClick={() => setTool('select')}>
            <Cursor size={18} aria-hidden />
          </ToolButton>
          <ToolButton label="Pan (H)" active={tool === 'hand'} onClick={() => setTool('hand')}>
            <Hand size={18} aria-hidden />
          </ToolButton>
        </div>
        <span className={c.toolRule} aria-hidden />
        <span className={c.toolLabel}>Group by</span>
        <div className={c.toolGroup} role="radiogroup" aria-label="Group by">
          {(['category', 'status'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={groupBy === option}
              className={c.toolText}
              onClick={() => regroup(option)}
            >
              {option === 'category' ? 'Category' : 'Status'}
            </button>
          ))}
        </div>
        <span className={c.toolRule} aria-hidden />
        <button type="button" className={c.toolText} onClick={onCreate}>
          <Plus size={16} aria-hidden />
          Asset
        </button>
      </div>

      <div className={c.zoom} data-chrome>
        <button type="button" className={c.zoomButton} aria-label="Zoom out" onClick={() => zoomBy(0.8)}>
          <Minus size={16} aria-hidden />
        </button>
        <button type="button" className={c.zoomValue} aria-label="Zoom to 100%" onClick={() => {
          if (!size) return
          setSmooth(true)
          setView((prev) => {
            const cx = size.w / 2
            const cy = size.h / 2
            return { k: 1, x: cx - (cx - prev.x) / prev.k, y: cy - (cy - prev.y) / prev.k }
          })
        }}>
          {Math.round(view.k * 100)}%
        </button>
        <button type="button" className={c.zoomButton} aria-label="Zoom in" onClick={() => zoomBy(1.25)}>
          <Plus size={16} aria-hidden />
        </button>
        <span className={c.toolRule} aria-hidden />
        <button type="button" className={c.zoomButton} aria-label="Fit everything (0)" onClick={() => fit()}>
          <CornersOut size={16} aria-hidden />
        </button>
      </div>

      {size ? (
        <Minimap
          world={world}
          view={view}
          size={size}
          selected={selected}
          onJump={(wx, wy) => {
            setSmooth(true)
            setView((prev) => ({ ...prev, x: size.w / 2 - wx * prev.k, y: size.h / 2 - wy * prev.k }))
          }}
        />
      ) : null}

      {selectedAsset ? (
        <CanvasInspector
          key={selectedAsset.id}
          asset={selectedAsset}
          onClose={() => setSelected(null)}
          onZoom={() => focusCard(selectedAsset.id)}
          onEdit={onCreate}
        />
      ) : null}
    </div>
  )
}

function ToolButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={active} aria-label={label} title={label} className={c.toolIcon} onClick={onClick}>
      {children}
    </button>
  )
}

/** The frames and cards; memoised so panning only moves the transform above it. */
const CanvasWorld = memo(function CanvasWorld({
  world,
  selected,
  onSelect,
  onFocus,
}: {
  world: Layout
  selected: string | null
  onSelect: (id: string) => void
  onFocus: (id: string) => void
}) {
  return (
    <>
      {world.frames.map((frame) => (
        <section
          key={frame.name}
          className={c.frame}
          aria-label={frame.name}
          style={{ transform: `translate(${frame.x}px, ${frame.y}px)`, width: frame.w, height: frame.h, ['--frame' as string]: frame.color }}
        >
          <span className={c.frameLabel}>
            <span className={c.frameDot} aria-hidden />
            {frame.name}
            <span className={c.frameCount}>{frame.count}</span>
          </span>
        </section>
      ))}
      {STUDIO_ASSETS.map((asset, index) => {
        const box = world.cards.get(asset.id)
        if (!box) return null
        return (
          <CanvasCard
            key={asset.id}
            asset={asset}
            box={box}
            delay={index * 50}
            selected={selected === asset.id}
            onSelect={() => onSelect(asset.id)}
            onFocus={() => onFocus(asset.id)}
          />
        )
      })}
    </>
  )
})

function CanvasCard({
  asset,
  box,
  delay,
  selected,
  onSelect,
  onFocus,
}: {
  asset: StudioAsset
  box: Box
  delay: number
  selected: boolean
  onSelect: () => void
  onFocus: () => void
}) {
  return (
    <article
      className={c.card}
      data-card
      data-selected={selected || undefined}
      style={{ transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h }}
      onClick={onSelect}
      onDoubleClick={onFocus}
    >
      <ChartFrame asset={asset} delay={delay} className={c.cardChart} />
      <div className={c.cardMeta}>
        <span className={c.cardStatus} style={{ background: STATUS_COLOR[asset.status] }} aria-hidden />
        <button
          type="button"
          className={c.cardTitle}
          aria-pressed={selected}
          onClick={(event) => {
            event.stopPropagation()
            onSelect()
          }}
        >
          {asset.title}
        </button>
        <span className={c.cardType}>{asset.type}</span>
      </div>
    </article>
  )
}

const MAP_W = 200
const MAP_H = 120

function Minimap({
  world,
  view,
  size,
  selected,
  onJump,
}: {
  world: Layout
  view: View
  size: { w: number; h: number }
  selected: string | null
  onJump: (wx: number, wy: number) => void
}) {
  const { bounds } = world
  const m = Math.min((MAP_W - 16) / bounds.w, (MAP_H - 16) / bounds.h)
  const ox = (MAP_W - bounds.w * m) / 2 - bounds.x * m
  const oy = (MAP_H - bounds.h * m) / 2 - bounds.y * m
  const vx = (-view.x / view.k) * m + ox
  const vy = (-view.y / view.k) * m + oy
  const vw = (size.w / view.k) * m
  const vh = (size.h / view.k) * m
  return (
    <svg
      className={c.minimap}
      data-chrome
      width={MAP_W}
      height={MAP_H}
      role="img"
      aria-label="Minimap. Click to jump."
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        onJump((event.clientX - rect.left - ox) / m, (event.clientY - rect.top - oy) / m)
      }}
    >
      {world.frames.map((frame) => (
        <rect
          key={frame.name}
          x={frame.x * m + ox}
          y={frame.y * m + oy}
          width={frame.w * m}
          height={frame.h * m}
          rx={2}
          fill={frame.color}
          fillOpacity={0.16}
          stroke={frame.color}
          strokeOpacity={0.5}
        />
      ))}
      {[...world.cards.entries()].map(([id, box]) => (
        <rect
          key={id}
          x={box.x * m + ox}
          y={box.y * m + oy}
          width={box.w * m}
          height={box.h * m}
          rx={1}
          fill={id === selected ? '#70aeff' : 'rgba(255,255,255,0.35)'}
        />
      ))}
      <rect className={c.minimapView} x={vx} y={vy} width={vw} height={vh} rx={3} />
    </svg>
  )
}

function CanvasInspector({
  asset,
  onClose,
  onZoom,
  onEdit,
}: {
  asset: StudioAsset
  onClose: () => void
  onZoom: () => void
  onEdit: () => void
}) {
  const owner = ownerOf(asset)
  return (
    <aside className={c.inspector} data-chrome aria-label={`${asset.title} details`}>
      <div className={c.inspectorHead}>
        <span className={c.inspectorEyebrow}>
          <span className={c.frameDot} style={{ ['--frame' as string]: CATEGORY_COLOR[asset.category] }} aria-hidden />
          {asset.category}
        </span>
        <button type="button" className={c.zoomButton} aria-label="Close details" onClick={onClose}>
          <X size={16} aria-hidden />
        </button>
      </div>
      <h2 className={c.inspectorTitle}>{asset.title}</h2>
      <p className={c.inspectorLede}>{asset.description}</p>
      <ChartFrame asset={asset} className={c.inspectorChart} />
      <dl className={c.inspectorFacts}>
        <div>
          <dt>Status</dt>
          <dd>
            <StatusChip label={asset.status} />
          </dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{asset.type}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>
            <Avatar name={owner.name} />
            {owner.name}
          </dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{asset.updated}</dd>
        </div>
      </dl>
      <div className={c.inspectorActions}>
        <button type="button" className={c.primary} onClick={onEdit}>
          <PencilSimple size={16} aria-hidden />
          Edit asset
        </button>
        <button type="button" className={c.secondary} onClick={onZoom}>
          <CornersOut size={16} aria-hidden />
          Zoom to it
        </button>
      </div>
    </aside>
  )
}

/* ── Command palette ───────────────────────────────────────────────────── */

type Command = { id: string; section: 'Actions' | 'Pages' | 'Assets'; label: string; hint: string; icon: ReactNode; run: () => void }

const PAGES: { page: StudioPage; label: string; hint: string; icon: ReactNode }[] = NAV.flatMap((entry) =>
  isGroup(entry)
    ? entry.items.map((item) => ({ page: item.page, label: item.label, hint: entry.label, icon: entry.icon }))
    : [{ page: entry.page, label: entry.label, hint: 'Studio', icon: entry.icon }],
)

/** One box to reach every page, find any asset or start something new. */
export function CommandPalette({
  onClose,
  onPage,
  onAsset,
  onCreate,
  onSettings,
}: {
  onClose: () => void
  onPage: (page: StudioPage) => void
  onAsset: (id: string) => void
  onCreate: () => void
  onSettings: () => void
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const needle = query.trim().toLowerCase()
  const all: Command[] = [
    { id: 'new', section: 'Actions', label: 'Create a new asset', hint: 'Chart, KPI or map', icon: <Plus size={16} aria-hidden />, run: onCreate },
    { id: 'settings', section: 'Actions', label: 'Workspace settings', hint: 'Name, permissions, sharing', icon: <SquaresFour size={16} aria-hidden />, run: onSettings },
    ...PAGES.map((page) => ({ id: `page-${page.page}`, section: 'Pages' as const, label: page.label, hint: page.hint, icon: page.icon, run: () => onPage(page.page) })),
    ...STUDIO_ASSETS.map((asset) => ({
      id: `asset-${asset.id}`,
      section: 'Assets' as const,
      label: asset.title,
      hint: `${asset.category} · ${asset.type}`,
      icon: <span className={c.paletteDot} style={{ background: CATEGORY_COLOR[asset.category] }} aria-hidden />,
      run: () => onAsset(asset.id),
    })),
  ]
  const results = all.filter((command) => !needle || `${command.label} ${command.hint}`.toLowerCase().includes(needle))
  const current = Math.min(active, Math.max(results.length - 1, 0))

  const run = (command: Command | undefined) => {
    if (!command) return
    onClose()
    command.run()
  }

  const move = (delta: number) => {
    if (!results.length) return
    const next = (current + delta + results.length) % results.length
    setActive(next)
    listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  return (
    <div className={c.paletteScrim} onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={c.palette} role="dialog" aria-modal="true" aria-label="Command palette">
        <label className={c.paletteSearch}>
          <MagnifyingGlass size={18} aria-hidden />
          <input
            autoFocus
            value={query}
            placeholder="Search pages and assets, or type a command…"
            aria-label="Search commands"
            aria-controls="palette-results"
            aria-activedescendant={results[current] ? `palette-${results[current].id}` : undefined}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                move(1)
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                move(-1)
              } else if (event.key === 'Enter') {
                event.preventDefault()
                run(results[current])
              } else if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              }
            }}
          />
          <kbd className={c.kbd}>Esc</kbd>
        </label>
        <div ref={listRef} id="palette-results" className={c.paletteList} role="listbox" aria-label="Results">
          {results.length === 0 ? <p className={c.paletteEmpty}>Nothing matches “{query}”.</p> : null}
          {results.map((command, index) => (
            <div key={command.id}>
              {index === 0 || results[index - 1].section !== command.section ? (
                <span className={c.paletteSection}>{command.section}</span>
              ) : null}
              <div
                id={`palette-${command.id}`}
                role="option"
                aria-selected={index === current}
                data-index={index}
                className={c.paletteItem}
                onPointerMove={() => setActive(index)}
                onClick={() => run(command)}
              >
                <span className={c.paletteIcon}>{command.icon}</span>
                <span className={c.paletteLabel}>{command.label}</span>
                <span className={c.paletteHint}>{command.hint}</span>
                <ArrowRight className={c.paletteGo} size={14} aria-hidden />
              </div>
            </div>
          ))}
        </div>
        <div className={c.paletteFoot}>
          <span>
            <kbd className={c.kbd}>↑</kbd>
            <kbd className={c.kbd}>↓</kbd>
            to move
          </span>
          <span>
            <kbd className={c.kbd}>↵</kbd>
            to open
          </span>
        </div>
      </div>
    </div>
  )
}
