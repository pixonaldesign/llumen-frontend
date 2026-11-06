import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { Rect } from './canvasItems'
import type { NodeTone, Point } from './nodeCatalog'
import tones from './nodeTones.module.css'
import styles from './CanvasMinimap.module.css'

type View = { x: number; y: number; zoom: number }

/** A node as the map draws it: its box, and its category colour or a sticky's own fill. */
export type MinimapNode = Rect & { id: string; tone: NodeTone; fill?: string }

type CanvasMinimapProps = {
  nodes: readonly MinimapNode[]
  sections: readonly (Rect & { id: string })[]
  view: View
  /** The canvas the view is a window onto; its size sets the outline's. */
  canvasRef: RefObject<HTMLElement | null>
  onPan: (view: View) => void
  className?: string
}

/** World room around everything, so boxes at the edge don't touch the frame. */
const PAD = 120
/** Corner radius of a node on the map, in world units. */
const NODE_RADIUS = 16

const union = (rects: readonly Rect[]): Rect | null => {
  if (!rects.length) return null
  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.w))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.h))
  return { x: left - PAD, y: top - PAD, w: right - left + PAD * 2, h: bottom - top + PAD * 2 }
}

const inside = (point: Point, rect: Rect) => point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h

/** The whole canvas in miniature, with what's on screen outlined; press or drag on it to move the view there. */
export function CanvasMinimap({ nodes, sections, view, canvasRef, onPan, className }: CanvasMinimapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const grabRef = useRef<{ pointerId: number; offset: Point } | null>(null)
  const [screen, setScreen] = useState({ w: 0, h: 0 })
  // Held while dragging, so the map doesn't rescale under the pointer as the outline moves.
  const [frozen, setFrozen] = useState<Rect | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => setScreen({ w: canvas.clientWidth, h: canvas.clientHeight }))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [canvasRef])

  const shown: Rect = { x: -view.x / view.zoom, y: -view.y / view.zoom, w: screen.w / view.zoom, h: screen.h / view.zoom }
  const bounds = frozen ?? union([...nodes, ...sections, shown])
  if (!bounds || !screen.w) return null

  const worldAt = (event: ReactPointerEvent): Point | null => {
    const matrix = svgRef.current?.getScreenCTM()
    if (!matrix) return null
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: point.x, y: point.y }
  }
  const centreOn = (point: Point) => onPan({ zoom: view.zoom, x: screen.w / 2 - point.x * view.zoom, y: screen.h / 2 - point.y * view.zoom })

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    const point = worldAt(event)
    if (!point) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const centre = { x: shown.x + shown.w / 2, y: shown.y + shown.h / 2 }
    const offset = inside(point, shown) ? { x: point.x - centre.x, y: point.y - centre.y } : { x: 0, y: 0 }
    grabRef.current = { pointerId: event.pointerId, offset }
    setFrozen(bounds)
    centreOn({ x: point.x - offset.x, y: point.y - offset.y })
  }
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const grab = grabRef.current
    const point = grab?.pointerId === event.pointerId ? worldAt(event) : null
    if (grab && point) centreOn({ x: point.x - grab.offset.x, y: point.y - grab.offset.y })
  }
  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (grabRef.current?.pointerId !== event.pointerId) return
    grabRef.current = null
    setFrozen(null)
  }

  return (
    <div className={`${styles.minimap}${className ? ` ${className}` : ''}`} role="group" aria-label="Canvas overview" data-covers-canvas>
      <svg
        ref={svgRef}
        className={styles.map}
        viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
        preserveAspectRatio="xMidYMid meet"
        data-dragging={frozen ? '' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-hidden
      >
        {sections.map((section) => (
          <rect key={section.id} className={styles.section} x={section.x} y={section.y} width={section.w} height={section.h} rx={NODE_RADIUS} />
        ))}
        {nodes.map((node) => (
          <rect
            key={node.id}
            className={`${styles.node} ${tones[`tone_${node.tone}`]}`}
            x={node.x}
            y={node.y}
            width={node.w}
            height={node.h}
            rx={NODE_RADIUS}
            style={node.fill ? { fill: node.fill } : undefined}
          />
        ))}
        <rect className={styles.shown} x={shown.x} y={shown.y} width={shown.w} height={shown.h} rx={NODE_RADIUS} />
      </svg>
    </div>
  )
}
