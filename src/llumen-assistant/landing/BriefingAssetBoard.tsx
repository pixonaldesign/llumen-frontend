import { ArrowUpRight, PresentationChart } from '@phosphor-icons/react'
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { BOARD_CELL, BOARD_GAP, boardColumnsFor, packBoard, type BoardFit } from './assetBoardLayout'
import { APP_HIGHLIGHTS, useAppMenu, type AppHighlight } from './briefingAppData'
import { AppMenu } from './BriefingApps'
import { AssetCard } from './BriefingAssets'
import assetStyles from './BriefingAssets.module.css'
import { BRIEFING_ASSETS, type BriefingAsset } from './briefingAssetData'
import styles from './BriefingAssetBoard.module.css'

const CARD_STAGGER_MS = 70
/** Pointer travel before a press on a card turns into a drag, so clicks and chart hovers still work. */
const DRAG_START_PX = 6
/** After a swap the cards under the pointer have moved; waiting this long stops them trading straight back. */
const SWAP_COOLDOWN_MS = 160
const SETTLE_MS = 260
const SETTLE_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

type Fit = Omit<BoardFit, 'id'>
/**
 * Apps as assets: `wide` puts the thumbnail on the left, `tall` puts it on top. Each app has a
 * preferred shape, but its card lays out by the slot it gets: one cell tall is `wide`, taller is `tall`.
 */
type AppLayout = 'wide' | 'tall'

type BoardItem =
  | { id: string; kind: 'asset'; asset: BriefingAsset; fit: Fit }
  | { id: string; kind: 'app'; app: AppHighlight; fit: Fit }

/** Preferred width in cells, how narrow and wide each card still reads well, and its height. */
const ASSET_FITS: Record<string, Fit> = {
  'permit-deviation': { cols: 2, min: 2, max: 3, rows: 1 },
  'land-use': { cols: 2, min: 2, max: 3, rows: 1 },
  population: { cols: 2, min: 2, max: 3, rows: 1 },
  'water-pressure': { cols: 1, min: 1, max: 2, rows: 1 },
  'air-quality': { cols: 4, min: 3, max: 5, rows: 2 },
  'bus-delays': { cols: 2, min: 2, max: 3, rows: 2 },
  'heat-visits': { cols: 2, min: 2, max: 4, rows: 2 },
  'station-uptime': { cols: 4, min: 3, max: 4, rows: 2 },
}

const APP_LAYOUTS: Record<string, AppLayout> = {
  'construction-surge': 'tall',
  'rainfall-disruption': 'wide',
  'tourism-peak': 'tall',
  'permit-concentration': 'wide',
}

const APP_FITS: Record<AppLayout, Fit> = {
  wide: { cols: 4, min: 3, max: 5, rows: 1 },
  tall: { cols: 2, min: 2, max: 3, rows: 2 },
}

const ITEMS = new Map<string, BoardItem>([
  ...BRIEFING_ASSETS.map((asset): [string, BoardItem] => [
    asset.id,
    { id: asset.id, kind: 'asset', asset, fit: ASSET_FITS[asset.id] ?? { cols: 2, min: 2, max: 3, rows: 1 } },
  ]),
  ...APP_HIGHLIGHTS.map((app): [string, BoardItem] => [
    app.id,
    { id: app.id, kind: 'app', app, fit: APP_FITS[APP_LAYOUTS[app.id] ?? 'tall'] },
  ]),
])

type Drag = {
  id: string
  el: HTMLElement
  pointerId: number
  startX: number
  startY: number
  /** The press point inside the card, so the card keeps its place under the pointer. */
  grabX: number
  grabY: number
  x: number
  y: number
  active: boolean
  /** The card last swapped with, until the pointer leaves it. */
  target: string | null
  swappedAt: number
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Keeps the dragged card under the pointer, wherever its own slot now is. */
function follow(board: HTMLElement, drag: Drag) {
  const box = board.getBoundingClientRect()
  const dx = drag.x - box.left - drag.grabX - drag.el.offsetLeft
  const dy = drag.y - box.top - drag.grabY - drag.el.offsetTop
  drag.el.style.translate = `${dx}px ${dy}px`
}

/**
 * Assets and dashboard apps on a grid of 184px cells with 12px gaps: `columns` of them, or as many as fit
 * its own width. With `onReorder`, cards drag to new places: the others make room as the dragged card
 * passes over them. A `preview` is a picture of the grid only: nothing in it takes focus or the pointer.
 */
export function BriefingAssetBoard({
  order,
  columns: fixedColumns,
  onReorder,
  play = true,
  preview = false,
}: {
  order: readonly string[]
  columns?: number
  onReorder?: (order: string[]) => void
  play?: boolean
  preview?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const [fitColumns, setFitColumns] = useState(4)
  const columns = fixedColumns ?? fitColumns
  const [mounted, setMounted] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useAppMenu()
  const [reduce] = useState(prefersReducedMotion)

  const orderRef = useRef(order)
  const onReorderRef = useRef(onReorder)
  const dragRef = useRef<Drag | null>(null)
  /** Card positions just before a swap, so the cards that move can glide from where they were. */
  const beforeRef = useRef<Map<string, { x: number; y: number }> | null>(null)
  const stopDragRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    orderRef.current = order
    onReorderRef.current = onReorder
  }, [order, onReorder])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => () => stopDragRef.current?.(), [])

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || fixedColumns) return
    const measure = () => {
      setFitColumns(boardColumnsFor(wrap.clientWidth - parseFloat(getComputedStyle(wrap).paddingInlineEnd || '0')))
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(wrap)
    return () => resize.disconnect()
  }, [fixedColumns])

  const layout = useMemo(
    () =>
      packBoard(
        order.flatMap((id) => {
          const item = ITEMS.get(id)
          return item ? [{ id, ...item.fit }] : []
        }),
        columns,
      ),
    [order, columns],
  )

  useLayoutEffect(() => {
    const before = beforeRef.current
    const board = boardRef.current
    beforeRef.current = null
    if (!before || !board) return
    const drag = dragRef.current
    for (const el of board.querySelectorAll<HTMLElement>('[data-board-item]')) {
      if (drag && el === drag.el) {
        follow(board, drag)
        continue
      }
      const from = before.get(el.dataset.boardItem ?? '')
      if (!from) continue
      const dx = from.x - el.offsetLeft
      const dy = from.y - el.offsetTop
      if (!dx && !dy) continue
      for (const animation of el.getAnimations()) animation.cancel()
      if (reduce) continue
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: SETTLE_MS,
        easing: SETTLE_EASE,
      })
    }
  }, [order, reduce])

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (!onReorder || event.button !== 0 || dragRef.current) return
    if (event.target instanceof Element && event.target.closest('button, a, input, [data-app-menu]')) return
    const board = boardRef.current
    if (!board) return
    const el = event.currentTarget
    const box = board.getBoundingClientRect()
    dragRef.current = {
      id,
      el,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      grabX: event.clientX - box.left - el.offsetLeft,
      grabY: event.clientY - box.top - el.offsetTop,
      x: event.clientX,
      y: event.clientY,
      active: false,
      target: null,
      swappedAt: 0,
    }

    const onMove = (move: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || move.pointerId !== drag.pointerId) return
      drag.x = move.clientX
      drag.y = move.clientY
      if (!drag.active) {
        if (Math.hypot(move.clientX - drag.startX, move.clientY - drag.startY) < DRAG_START_PX) return
        drag.active = true
        setDragging(drag.id)
        setMenuFor(null)
      }
      move.preventDefault()
      follow(board, drag)

      const hit = document
        .elementsFromPoint(move.clientX, move.clientY)
        .map((node) => node.closest<HTMLElement>('[data-board-item]'))
        .find((node) => node && node !== drag.el && board.contains(node))
      const target = hit?.dataset.boardItem ?? null
      if (target === drag.target) return
      if (target && performance.now() - drag.swappedAt < SWAP_COOLDOWN_MS) return
      drag.target = target
      if (!target) return
      const current = orderRef.current
      const from = current.indexOf(drag.id)
      const to = current.indexOf(target)
      if (from < 0 || to < 0) return
      const next = [...current]
      next.splice(from, 1)
      next.splice(to, 0, drag.id)
      beforeRef.current = new Map(
        [...board.querySelectorAll<HTMLElement>('[data-board-item]')].map((node) => [
          node.dataset.boardItem ?? '',
          { x: node.offsetLeft, y: node.offsetTop },
        ]),
      )
      drag.swappedAt = performance.now()
      onReorderRef.current?.(next)
    }

    const stop = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      stopDragRef.current = null
    }

    const onEnd = (end: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || end.pointerId !== drag.pointerId) return
      stop()
      dragRef.current = null
      if (!drag.active) return
      const from = drag.el.style.translate || '0px 0px'
      drag.el.style.translate = ''
      if (!reduce) {
        drag.el.animate([{ translate: from }, { translate: '0px 0px' }], { duration: SETTLE_MS, easing: SETTLE_EASE })
      }
      setDragging(null)
      /* The release after a drag still clicks the card; swallow that one click. */
      const swallow = (click: MouseEvent) => {
        click.preventDefault()
        click.stopPropagation()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    stopDragRef.current = stop
  }

  const template = `repeat(${columns}, ${BOARD_CELL}px)`
  const playing = (play && mounted) || reduce

  return (
    <div ref={wrapRef} className={styles.wrap} inert={preview} aria-hidden={preview || undefined}>
      <div
        ref={boardRef}
        className={styles.board}
        data-asset-board
        data-editable={onReorder ? 'true' : undefined}
        data-dragging={dragging ? 'true' : undefined}
        style={
          {
            gridTemplateColumns: template,
            ['--cell' as string]: `${BOARD_CELL}px`,
            ['--gap' as string]: `${BOARD_GAP}px`,
          } as CSSProperties
        }
      >
        {onReorder ? (
          <div className={styles.cells} style={{ gridTemplateColumns: template }} aria-hidden>
            {Array.from({ length: columns * layout.rows }, (_, index) => (
              <span key={index} className={styles.cell} />
            ))}
          </div>
        ) : null}
        {order.map((id, index) => {
          const item = ITEMS.get(id)
          const slot = layout.slots.get(id)
          if (!item || !slot) return null
          const open = menuFor === id
          return (
            <div
              key={id}
              className={styles.item}
              data-board-item={id}
              data-dragged={dragging === id ? 'true' : undefined}
              style={{
                gridColumn: `${slot.col + 1} / span ${slot.cols}`,
                gridRow: `${slot.row + 1} / span ${slot.rows}`,
              }}
              onPointerDown={onReorder ? (event) => startDrag(event, id) : undefined}
            >
              {item.kind === 'asset' ? (
                <AssetCard asset={item.asset} play={playing} delay={reduce ? 0 : index * CARD_STAGGER_MS} />
              ) : (
                <AppAssetCard
                  app={item.app}
                  layout={slot.rows === 1 ? 'wide' : 'tall'}
                  menuOpen={open}
                  onToggleMenu={() => setMenuFor(open ? null : id)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** A dashboard as an asset: the insight it delivers, with its thumbnail beside (`wide`) or above (`tall`). */
function AppAssetCard({
  app,
  layout,
  menuOpen,
  onToggleMenu,
}: {
  app: AppHighlight
  layout: AppLayout
  menuOpen: boolean
  onToggleMenu: () => void
}) {
  return (
    <article className={`${assetStyles.card} ${styles.app}`} data-layout={layout} aria-label={`App: ${app.title}`}>
      <span className={styles.appShot}>
        <img src={app.image} alt="" draggable={false} style={app.focus ? { objectPosition: app.focus } : undefined} />
      </span>
      <div className={styles.appCopy}>
        <div className={styles.appHead}>
          <span className={`${assetStyles.category} ${styles.appKind}`}>
            <PresentationChart size={13} weight="regular" aria-hidden />
            App
          </span>
          <AppMenu label={app.title} open={menuOpen} below={layout === 'wide'} onToggle={onToggleMenu} />
        </div>
        <h3 className={styles.appTitle}>{app.title}</h3>
        <button type="button" className={styles.appView} aria-label={`View ${app.title}`}>
          <ArrowUpRight size={20} weight="regular" aria-hidden />
          View
        </button>
      </div>
    </article>
  )
}
