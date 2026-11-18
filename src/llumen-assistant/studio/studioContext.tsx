import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ArrowCounterClockwise, ArrowSquareOut, ArrowsInSimple, ArrowsOutSimple, Crosshair, CornersOut, Minus, Plus, X } from '@phosphor-icons/react'
import type { StudioPage } from './studioData'
import {
  CONTEXT_KINDS,
  KIND_META,
  RELATION_LABEL,
  buildContextGraph,
  type ContextGraph,
  type ContextGroupBy,
  type ContextKind,
  type ContextNode,
} from './studioContextGraph'
import { ContextEngine, type Hit, type View } from './studioContextEngine'
import { PageHead } from './studioPages'
import { StatusChip, TextSegments } from './studioUi'
import c from './StudioContext.module.css'

const PAGE_NAME: Partial<Record<StudioPage, string>> = {
  assets: 'Assets',
  database: 'Sources',
  apis: 'Sources',
  files: 'Sources',
  apps: 'Apps',
  workflows: 'Flows',
  filters: 'Filters',
  members: 'Members',
}

const GROUP_OPTIONS = ['Kind', 'App'] as const
const GROUP_BY: Record<(typeof GROUP_OPTIONS)[number], ContextGroupBy> = { Kind: 'kind', App: 'topic' }

/** The inspector's width plus its 16px inset (.inspector in StudioContext.module.css). */
const INSPECTOR_SPACE = 376

type Point = { x: number; y: number }
/** `lx`/`ly` is the last pointer position, which group drags move by. */
type Drag = { x: number; y: number; lx: number; ly: number; vx: number; vy: number; hit: Hit | null; moved: boolean }
type Pinch = { view: View; mid: Point; distance: number }

const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** The workspace's context: every source, asset, app, flow and AI context as a graph of what feeds what. */
export function ContextGraphView({ onOpen }: { onOpen: (page: StudioPage) => void }) {
  const graph = useMemo(() => buildContextGraph(), [])
  const [engine] = useState(() => new ContextEngine())
  const [groupBy, setGroupBy] = useState<ContextGroupBy>('kind')
  const [hidden, setHidden] = useState<Set<ContextKind>>(() => new Set(['person']))
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<Hit | null>(null)
  const [ui, setUi] = useState({ zoom: 100, anyOpen: false, placed: false })
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const pointersRef = useRef(new Map<number, Point>())
  const pinchRef = useRef<Pinch | null>(null)
  const fittedRef = useRef(false)

  const byId = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph])
  const visible = useMemo(() => graph.nodes.filter((node) => !hidden.has(node.kind)), [graph, hidden])
  const needle = query.trim().toLowerCase()
  const matches = useMemo(
    () => (needle ? visible.filter((node) => `${node.title} ${node.detail}`.toLowerCase().includes(needle)) : []),
    [visible, needle],
  )

  useEffect(() => {
    engine.setData(graph, groupBy, hidden)
  }, [engine, graph, groupBy, hidden])

  useEffect(() => {
    engine.setSelected(selected)
    engine.setInsetRight(selected ? INSPECTOR_SPACE : 0)
  }, [engine, selected])

  useEffect(() => {
    engine.setMatches(needle ? new Set(matches.map((node) => node.id)) : null)
  }, [engine, matches, needle])

  useEffect(() => {
    const viewport = viewportRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!viewport || !canvas || !ctx) return
    engine.configure(getComputedStyle(viewport).fontFamily, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    let dpr = window.devicePixelRatio || 1

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      engine.resize(width, height)
      if (!fittedRef.current && width > 0) {
        fittedRef.current = true
        engine.fit(false)
      }
    })
    observer.observe(viewport)

    const at = (event: { clientX: number; clientY: number }) => {
      const rect = canvas.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    // A mouse wheel zooms; trackpad pinches arrive as ctrl+wheel in Chromium and Firefox, and as gestures in Safari.
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest('[data-chrome]')) return
      event.preventDefault()
      const p = at(event)
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1)
      engine.zoomAt(p.x, p.y, Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0018)))
    }
    type GestureEvent = UIEvent & { scale: number; clientX: number; clientY: number }
    let gesture: Pinch | null = null
    const onGestureStart = (event: Event) => {
      event.preventDefault()
      gesture = { view: engine.view, mid: at(event as GestureEvent), distance: 1 }
    }
    const onGestureChange = (event: Event) => {
      event.preventDefault()
      if (gesture) engine.pinch(gesture.view, gesture.mid, gesture.mid, (event as GestureEvent).scale)
    }
    const onGestureEnd = (event: Event) => {
      event.preventDefault()
      gesture = null
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    viewport.addEventListener('gesturestart', onGestureStart)
    viewport.addEventListener('gesturechange', onGestureChange)
    viewport.addEventListener('gestureend', onGestureEnd)

    let frame = 0
    let last = performance.now()
    let shown = { zoom: 0, anyOpen: false, placed: false }
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      engine.step(dt)
      engine.draw(ctx, dpr)
      const tip = tooltipRef.current
      if (tip && engine.hover) {
        const anchor = engine.anchorOf(engine.hover)
        if (anchor) tip.style.transform = `translate(${anchor.x}px, ${anchor.y}px) translate(-50%, -100%)`
      }
      const next = { zoom: Math.round(engine.view.k * 100), anyOpen: engine.anyOpen(), placed: engine.hasPlacements() }
      if (next.zoom !== shown.zoom || next.anyOpen !== shown.anyOpen || next.placed !== shown.placed) {
        shown = next
        setUi(next)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      viewport.removeEventListener('wheel', onWheel)
      viewport.removeEventListener('gesturestart', onGestureStart)
      viewport.removeEventListener('gesturechange', onGestureChange)
      viewport.removeEventListener('gestureend', onGestureEnd)
    }
  }, [engine])

  const local = (event: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const setHovered = (hit: Hit | null) => {
    engine.setHover(hit)
    const shown = engine.hover
    setHover((prev) => (prev?.id === shown?.id && prev?.type === shown?.type ? prev : shown))
  }

  const startPinch = () => {
    const [a, b] = [...pointersRef.current.values()]
    pinchRef.current = { view: engine.view, mid: midpoint(a, b), distance: Math.hypot(b.x - a.x, b.y - a.y) || 1 }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    viewportRef.current?.focus({ preventScroll: true })
    const p = local(event)
    pointersRef.current.set(event.pointerId, p)
    event.currentTarget.setPointerCapture(event.pointerId)
    if (pointersRef.current.size === 2) {
      const drag = dragRef.current
      if (drag?.hit?.type === 'node') engine.release(drag.hit.id)
      engine.grabGroup(null)
      dragRef.current = null
      setHovered(null)
      startPinch()
      return
    }
    if (pointersRef.current.size > 2) return
    const hit = engine.hit(p.x, p.y)
    dragRef.current = { x: p.x, y: p.y, lx: p.x, ly: p.y, vx: engine.view.x, vy: engine.view.y, hit, moved: false }
    if (hit?.type === 'node') engine.pin(hit.id)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = local(event)
    if (pointersRef.current.has(event.pointerId)) pointersRef.current.set(event.pointerId, p)
    const pinch = pinchRef.current
    if (pinch && pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      engine.pinch(pinch.view, pinch.mid, midpoint(a, b), Math.hypot(b.x - a.x, b.y - a.y) / pinch.distance)
      return
    }
    const drag = dragRef.current
    if (!drag) {
      setHovered(engine.hit(p.x, p.y))
      return
    }
    if (Math.hypot(p.x - drag.x, p.y - drag.y) > 3) drag.moved = true
    if (!drag.moved) return
    if (drag.hit?.type === 'node') {
      const world = engine.toWorld(p.x, p.y)
      engine.dragTo(drag.hit.id, world.x, world.y)
    } else if (drag.hit) {
      engine.grabGroup(drag.hit.id)
      const k = engine.view.k
      engine.moveGroup(drag.hit.id, (p.x - drag.lx) / k, (p.y - drag.ly) / k)
      drag.lx = p.x
      drag.ly = p.y
    } else {
      if (engine.hover) setHovered(null)
      engine.panTo(drag.vx + p.x - drag.x, drag.vy + p.y - drag.y)
    }
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(event.pointerId)
    if (pinchRef.current) {
      // Lifting one finger ends the pinch; the other only pans once it is lifted and put down again.
      if (pointersRef.current.size < 2) pinchRef.current = null
      return
    }
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.hit?.type === 'node') engine.release(drag.hit.id)
    if (drag.moved) {
      if (drag.hit && drag.hit.type !== 'node') {
        engine.grabGroup(null)
        engine.placeGroup(drag.hit.id)
      }
      return
    }
    if (!drag.hit || drag.hit.type === 'halo') setSelected(null)
    else if (drag.hit.type === 'node') {
      engine.setInsetRight(INSPECTOR_SPACE)
      engine.frameNode(drag.hit.id)
      setSelected(drag.hit.id)
    }
    else if (drag.hit.type === 'group') engine.openGroup(drag.hit.id)
    else {
      const group = engine.groupById.get(drag.hit.id)
      if (group && engine.isOpen(group)) engine.closeGroup(drag.hit.id)
      else engine.openGroup(drag.hit.id)
    }
  }

  const focusNode = (id: string) => {
    const node = byId.get(id)
    if (!node) return
    engine.setInsetRight(INSPECTOR_SPACE)
    if (hidden.has(node.kind)) {
      setHidden((prev) => {
        const next = new Set(prev)
        next.delete(node.kind)
        return next
      })
      requestAnimationFrame(() => engine.frameNode(id))
    } else {
      engine.frameNode(id)
    }
    setSelected(id)
  }

  const toggleKind = (kind: ContextKind) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
    if (selected && byId.get(selected)?.kind === kind) setSelected(null)
  }

  const zoomBy = (factor: number) => engine.zoomAt(engine.size.w / 2, engine.size.h / 2, factor, true)

  const point = useCallback((id: string | null) => engine.setPointed(id), [engine])
  const colorOf = (node: ContextNode) => groupColor(engine, node)

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('input, [data-chrome]')) return
    switch (event.key) {
      case '=':
      case '+':
        zoomBy(1.25)
        break
      case '-':
        zoomBy(0.8)
        break
      case '0':
        engine.fit()
        break
      case 'Escape':
        setSelected(null)
        break
    }
  }

  const selectedNode = selected ? byId.get(selected) : undefined
  const reachable =
    !selected || (hover?.type === 'node' && (hover.id === selected || engine.adjacency.get(selected)?.has(hover.id)))
  const shownHover = reachable ? hover : null
  const hoverNode = shownHover?.type === 'node' ? byId.get(shownHover.id) : undefined
  const hoverGroup =
    shownHover?.type === 'group' || shownHover?.type === 'label' ? engine.groupById.get(shownHover.id) : undefined
  const hoverGroupOpen = hoverGroup ? engine.isOpen(hoverGroup) : false
  const groupOption = groupBy === 'kind' ? 'Kind' : 'App'

  return (
    <>
      {/* The head may portal into the ribbon's slot; React still bubbles its key events to here. */}
      <div
        className={c.headEvents}
        onKeyDown={(event) => {
          if (!(event.target as HTMLElement).matches('input')) return
          if (event.key === 'Enter' && matches[0]) focusNode(matches[0].id)
        }}
      >
        <PageHead
          title="Context"
          titleExtra={
            <TextSegments
              label="Group by"
              options={GROUP_OPTIONS}
              value={groupOption}
              onChange={(option) => setGroupBy(GROUP_BY[option])}
            />
          }
          placeholder="Find in context..."
          query={query}
          onQuery={setQuery}
          controls={
            <div className={c.viewBar} role="toolbar" aria-label="Graph view">
              <button type="button" className={c.barIcon} aria-label="Zoom out" onClick={() => zoomBy(0.8)}>
                <Minus size={16} aria-hidden />
              </button>
              <span className={c.zoomValue}>{ui.zoom}%</span>
              <button type="button" className={c.barIcon} aria-label="Zoom in" onClick={() => zoomBy(1.25)}>
                <Plus size={16} aria-hidden />
              </button>
              <button type="button" className={c.barIcon} aria-label="Fit everything (0)" onClick={() => engine.fit()}>
                <CornersOut size={16} aria-hidden />
              </button>
              {ui.placed ? (
                <button
                  type="button"
                  className={c.barIcon}
                  aria-label="Reset group positions"
                  title="Reset group positions"
                  onClick={() => engine.resetPlacements()}
                >
                  <ArrowCounterClockwise size={16} aria-hidden />
                </button>
              ) : null}
              <span className={c.rule} aria-hidden />
              <button type="button" className={c.barText} onClick={() => engine.setAll(ui.anyOpen ? 'auto' : 'open')}>
                {ui.anyOpen ? <ArrowsInSimple size={16} aria-hidden /> : <ArrowsOutSimple size={16} aria-hidden />}
                {ui.anyOpen ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
          }
        />
      </div>

      <div
        ref={viewportRef}
        className={c.viewport}
        data-hovering={shownHover && shownHover.type !== 'halo' ? true : undefined}
        data-inspecting={selectedNode ? true : undefined}
        data-own-wheel
        tabIndex={0}
        aria-label="Context graph. Drag to pan, scroll or pinch to zoom, click a group to open it, click an item for its details."
        onKeyDown={onKeyDown}
      >
        <canvas
          ref={canvasRef}
          className={c.canvas}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => !dragRef.current && setHovered(null)}
          onDoubleClick={() => hover?.type === 'node' && engine.frameNode(hover.id)}
        />

        <div ref={tooltipRef} className={c.tooltip} data-open={hoverNode || hoverGroup ? true : undefined} aria-hidden>
          {hoverNode ? (
            <>
              <span className={c.tooltipTitle}>
                <KindGlyph kind={hoverNode.kind} color={groupColor(engine, hoverNode)} />
                {hoverNode.title}
              </span>
              <span className={c.tooltipMeta}>
                {KIND_META[hoverNode.kind].label} · {hoverNode.detail} · {connectionCount(graph, hoverNode.id)} connections
              </span>
            </>
          ) : hoverGroup ? (
            <>
              <span className={c.tooltipTitle}>
                <span className={c.dot} style={{ background: hoverGroup.color }} aria-hidden />
                {hoverGroup.label}
              </span>
              <span className={c.tooltipMeta}>
                {hoverGroup.members.length} items · {hoverGroupOpen ? 'Click to close' : 'Click to open'}
              </span>
            </>
          ) : null}
        </div>

        <div className={c.legend} data-chrome role="group" aria-label="Show kinds">
          {CONTEXT_KINDS.map((kind) => {
            const count = graph.nodes.filter((node) => node.kind === kind).length
            if (!count) return null
            return (
              <button
                key={kind}
                type="button"
                className={c.legendItem}
                aria-pressed={!hidden.has(kind)}
                onClick={() => toggleKind(kind)}
              >
                <KindGlyph kind={kind} color={hidden.has(kind) ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)'} />
                <span className={c.legendLabel}>{KIND_META[kind].plural}</span>
                <span className={c.legendCount}>{count}</span>
              </button>
            )
          })}
        </div>

        {selectedNode ? (
          <ContextInspector
            key={selectedNode.id}
            node={selectedNode}
            graph={graph}
            byId={byId}
            colorOf={colorOf}
            onClose={() => setSelected(null)}
            onFocus={focusNode}
            onPoint={point}
            onOpen={selectedNode.page ? () => onOpen(selectedNode.page!) : undefined}
          />
        ) : null}
      </div>
    </>
  )
}

function groupColor(engine: ContextEngine, node: ContextNode) {
  return engine.byId.get(node.id)?.group.color ?? KIND_META[node.kind].color
}

function connectionCount(graph: ContextGraph, id: string) {
  return graph.edges.filter((edge) => edge.from === id || edge.to === id).length
}

/** The canvas's shape for a kind, so the legend, tooltip and inspector read the same. */
export function KindGlyph({ kind, color, size = 12 }: { kind: ContextKind; color: string; size?: number }) {
  const shape = KIND_META[kind].shape
  const rounded = { fill: color, stroke: color, strokeWidth: 1.6, strokeLinejoin: 'round' as const }
  return (
    <svg className={c.glyph} width={size} height={size} viewBox="0 0 12 12" aria-hidden>
      {shape === 'circle' ? <circle cx="6" cy="6" r={kind === 'person' ? 3.5 : 4.5} fill={color} /> : null}
      {shape === 'ring' ? <circle cx="6" cy="6" r="3.8" fill="none" stroke={color} strokeWidth="2" /> : null}
      {shape === 'square' ? <rect x="1.8" y="1.8" width="8.4" height="8.4" rx="2.6" fill={color} /> : null}
      {shape === 'page' ? <rect x="2.4" y="1.2" width="7.2" height="9.6" rx="2.2" fill={color} /> : null}
      {shape === 'diamond' ? <path d="M6 1.6 10.4 6 6 10.4 1.6 6Z" {...rounded} /> : null}
      {shape === 'hexagon' ? <path d="M6 1.7 9.9 3.9v4.2L6 10.3 2.1 8.1V3.9Z" {...rounded} /> : null}
      {shape === 'triangle' ? <path d="M6 2.2 10.2 9.6H1.8Z" {...rounded} /> : null}
    </svg>
  )
}

type Linked = { node: ContextNode; via?: string[] }

function ContextInspector({
  node,
  graph,
  byId,
  colorOf,
  onClose,
  onFocus,
  onPoint,
  onOpen,
}: {
  node: ContextNode
  graph: ContextGraph
  byId: Map<string, ContextNode>
  colorOf: (node: ContextNode) => string
  onClose: () => void
  onFocus: (id: string) => void
  onPoint: (id: string | null) => void
  onOpen?: () => void
}) {
  const sections = useMemo(() => {
    const map = new Map<string, Linked[]>()
    for (const edge of graph.edges) {
      let label: string | null = null
      let other: string | null = null
      if (edge.from === node.id) {
        label = RELATION_LABEL[edge.relation].out
        other = edge.to
      } else if (edge.to === node.id) {
        label = RELATION_LABEL[edge.relation].in
        other = edge.from
      }
      const target = other ? byId.get(other) : undefined
      if (!label || !target) continue
      map.set(label, [...(map.get(label) ?? []), { node: target, via: edge.via }])
    }
    // Most recently updated first, matching the order the canvas highlights them in.
    for (const items of map.values()) items.sort((a, b) => (b.node.updatedAt ?? 0) - (a.node.updatedAt ?? 0))
    return [...map]
  }, [graph, byId, node.id])
  const total = sections.reduce((sum, [, items]) => sum + items.length, 0)
  const pageName = node.page ? PAGE_NAME[node.page] : undefined
  const membership =
    node.kind === 'asset' || node.kind === 'source' ? (node.external ? 'Used here, owned elsewhere' : 'This workspace') : null

  useEffect(() => () => onPoint(null), [onPoint])

  return (
    <aside className={c.inspector} data-chrome aria-label={`${node.title} details`}>
      <div className={c.inspectorHead}>
        <span className={c.inspectorEyebrow}>
          <KindGlyph kind={node.kind} color={colorOf(node)} />
          {KIND_META[node.kind].label} · {node.topic}
        </span>
        <button type="button" className={c.zoomButton} aria-label="Close details" onClick={onClose}>
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className={c.inspectorScroll}>
        <div className={c.inspectorBody}>
          <h3 className={c.inspectorTitle}>{node.title}</h3>
          {node.description ? (
            <p className={node.kind === 'context' ? c.inspectorQuote : c.inspectorLede}>{node.description}</p>
          ) : null}
          <dl className={c.facts}>
            <div>
              <dt>Type</dt>
              <dd>{node.detail}</dd>
            </div>
            {membership ? (
              <div>
                <dt>Membership</dt>
                <dd>{membership}</dd>
              </div>
            ) : null}
            {node.where ? (
              <div className={c.factWide}>
                <dt>Managed in</dt>
                <dd>{node.where}</dd>
              </div>
            ) : null}
            {node.status ? (
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusChip label={node.status} />
                </dd>
              </div>
            ) : null}
            {node.updated ? (
              <div>
                <dt>Updated</dt>
                <dd>{node.updated}</dd>
              </div>
            ) : null}
            <div>
              <dt>Connections</dt>
              <dd>{total}</dd>
            </div>
          </dl>
        </div>
        {sections.map(([label, items]) => (
          <section key={label} className={c.relation}>
            <span className={c.relationLabel}>
              {label}
              <span className={c.relationCount}>{items.length}</span>
            </span>
            {items.map(({ node: item, via }) => (
              <button
                key={item.id}
                type="button"
                className={c.relationItem}
                title={via?.join(', ')}
                onPointerEnter={() => onPoint(item.id)}
                onPointerLeave={() => onPoint(null)}
                onFocus={() => onPoint(item.id)}
                onBlur={() => onPoint(null)}
                onClick={() => onFocus(item.id)}
              >
                <KindGlyph kind={item.kind} color={colorOf(item)} />
                <span className={c.relationText}>
                  <span className={c.relationName}>{item.title}</span>
                  {via?.length ? <span className={c.relationVia}>{via.join(' · ')}</span> : null}
                </span>
                <span className={c.relationKind}>{KIND_META[item.kind].label}</span>
                <Crosshair className={c.relationGo} size={14} aria-hidden />
              </button>
            ))}
          </section>
        ))}
      </div>
      <div className={c.inspectorActions}>
        {pageName && onOpen ? (
          <button type="button" className={c.primary} onClick={onOpen}>
            <ArrowSquareOut size={16} aria-hidden />
            Open in {pageName}
          </button>
        ) : null}
        <button type="button" className={c.secondary} onClick={() => onFocus(node.id)}>
          <Crosshair size={16} aria-hidden />
          Center
        </button>
      </div>
    </aside>
  )
}
