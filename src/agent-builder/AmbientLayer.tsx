import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createAmbientRenderer, MAX_MESH_POINTS, supportsWebGL2, type AmbientRenderer } from './ambientShader'
import { hexToRgb } from './canvasLook'
import { AMBIENT_MAX_STOPS, type AmbientStop, type AmbientStyle, type CanvasAmbient } from './canvasAmbient'
import styles from './AmbientLayer.module.css'

/** At least this many blobs, so a short palette still fills the screen. */
const MIN_BLOBS = 6
/** Blobs render at this size and are scaled per frame, so resizing never triggers layout. */
const BLOB_BASE = 1000
/** Corner radius of the run path, as a fraction of the viewport's shorter side. */
const EDGE_CORNER = 0.2
/** Samples along each blob's fade; enough that the eased curve shows no steps. */
const FADE_SAMPLES = 12

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
const lerp = (from: number, to: number, t: number) => from + (to - from) * t
/** Per-blob wander frequency, spread by the golden ratio so the blobs never fall into step. */
const wanderRate = (index: number) => 0.7 + ((index * 0.618) % 1) * 0.6

/** Extra size on each side of the blurred content, so the blur never pulls in transparency at the screen edges. */
const overscan = (blur: number) => Math.ceil(blur * 2)

/** Every stop appears the same number of times, and there are never fewer than MIN_BLOBS. */
const blobCount = (stops: number) => stops * Math.ceil(MIN_BLOBS / stops)

/**
 * Point at `progress` (0–1) along a rounded rectangle covering the viewport, by distance travelled,
 * so a blob moving at a steady rate also moves at a steady speed. Starts top-left and runs clockwise.
 */
function edgePoint(progress: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  const across = width - 2 * r
  const down = height - 2 * r
  const arc = (Math.PI * r) / 2
  let d = (((progress % 1) + 1) % 1) * (2 * across + 2 * down + 4 * arc)
  const corner = (cx: number, cy: number, from: number) => {
    const angle = from + (d / arc) * (Math.PI / 2)
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
  }
  if (d < across) return { x: r + d, y: 0 }
  d -= across
  if (d < arc) return corner(width - r, r, -Math.PI / 2)
  d -= arc
  if (d < down) return { x: width, y: r + d }
  d -= down
  if (d < arc) return corner(width - r, height - r, 0)
  d -= arc
  if (d < across) return { x: width - r - d, y: height }
  d -= across
  if (d < arc) return corner(r, height - r, Math.PI / 2)
  d -= arc
  if (d < down) return { x: 0, y: height - r - d }
  d -= down
  return corner(r, r, Math.PI)
}

/** Solid up to the core, then a fade sampled from a straight ramp blended toward an eased curve. */
function blobGradient({ color, opacity }: AmbientStop, softness: number, smoothness: number) {
  const rgb = hexToRgb(color)
  const core = (1 - softness) * 55
  const stops = Array.from({ length: FADE_SAMPLES + 1 }, (_, index) => {
    const t = index / FADE_SAMPLES
    const alpha = opacity * lerp(1 - t, 1 - smootherstep(t), smoothness)
    return `rgba(${rgb}, ${alpha.toFixed(4)}) ${(core + (100 - core) * t).toFixed(2)}%`
  })
  return `radial-gradient(circle closest-side, ${stops.join(', ')})`
}

/** Stops as packed rgba floats for the shader. */
function stopColors(stops: readonly AmbientStop[]) {
  const colors = new Float32Array(AMBIENT_MAX_STOPS * 4)
  stops.slice(0, AMBIENT_MAX_STOPS).forEach(({ color, opacity }, index) => {
    const value = Number.parseInt(color.slice(1), 16)
    colors.set([((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, opacity], index * 4)
  })
  return colors
}

/**
 * The stops that circle the edges while running. Near-black or near-transparent stops are left out:
 * they shade the idle look, but in the run band they leave a dark stretch with no glow.
 */
function ringStops(stops: readonly AmbientStop[]) {
  const lit = stops.filter(({ color, opacity }) => {
    const value = Number.parseInt(color.slice(1), 16)
    return opacity >= 0.05 && Math.max((value >> 16) & 255, (value >> 8) & 255, value & 255) >= 24
  })
  return lit.length > 0 ? lit : stops
}

const shaderColors = (stops: readonly AmbientStop[]) => {
  const ring = ringStops(stops)
  return { colors: stopColors(stops), ringColors: stopColors(ring), ringCount: Math.min(ring.length, AMBIENT_MAX_STOPS) }
}

type AmbientLayerProps = {
  /** With a style this layer draws; see `ambientDrawStyle`. */
  ambient: CanvasAmbient & { style: AmbientStyle }
  /** Moves the colours out to the screen edges. */
  running: boolean
  /** Holds the current frame; it still redraws when the settings or size change. */
  paused?: boolean
}

/**
 * Ambient colour behind the canvas, drawn as soft blob elements or, for the mesh, flow, and aurora
 * styles, by a WebGL shader. Idle, the colours wander slowly; while running they ease out to the
 * screen edges and circle it, while a mask fades the middle so only a band along the edges glows.
 * Motion is written straight to the DOM or the shader each frame; React only renders the colours.
 */
export function AmbientLayer({ ambient, running, paused = false }: AmbientLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const blobRefs = useRef<(HTMLDivElement | null)[]>([])
  const rendererRef = useRef<AmbientRenderer | null>(null)
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const settingsRef = useRef({ ambient, running, paused, ...shaderColors(ambient.stops) })
  const dirtyRef = useRef(true)
  const shaded = ambient.style !== 'blobs' && supportsWebGL2()

  useEffect(() => {
    settingsRef.current = { ambient, running, paused, ...shaderColors(ambient.stops) }
    dirtyRef.current = true
  }, [ambient, running, paused])

  useEffect(() => {
    if (!canvas) return
    const renderer = createAmbientRenderer(canvas)
    rendererRef.current = renderer
    dirtyRef.current = true
    return () => {
      renderer?.dispose()
      rendererRef.current = null
    }
  }, [canvas])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = root.clientWidth
    let height = root.clientHeight
    const resize = new ResizeObserver(() => {
      width = root.clientWidth
      height = root.clientHeight
      dirtyRef.current = true
    })
    resize.observe(root)

    let frame = 0
    let last = performance.now()
    let time = 0
    /** Shader clock: one unit per second at the default 40s drift cycle. */
    let shaderTime = 0
    let mix = settingsRef.current.running ? 1 : 0
    let shownRun = -1
    const points = new Float32Array(MAX_MESH_POINTS * 2)

    const draw = (now: number) => {
      const { ambient: look, running: isRunning, paused: isPaused, colors, ringColors, ringCount } = settingsRef.current
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
      last = now
      if (isPaused && !dirtyRef.current) {
        frame = requestAnimationFrame(draw)
        return
      }
      dirtyRef.current = false
      const { idle, run } = look
      const renderer = look.style === 'blobs' ? null : rendererRef.current
      const count = Math.min(blobCount(look.stops.length), renderer ? MAX_MESH_POINTS : Infinity)
      const still = reduceMotion.matches || isPaused
      if (!still) {
        time += dt
        shaderTime += (dt * 40) / Math.max(1, idle.cycleSeconds)
      }

      const target = isRunning && run.intensity > 0 ? 1 : 0
      const step = still ? 1 : dt / Math.max(0.05, run.transitionSeconds)
      mix = target > mix ? Math.min(target, mix + step) : Math.max(target, mix - step)
      const t = easeInOut(mix)
      if (t !== shownRun) {
        shownRun = t
        root.style.setProperty('--run', String(t))
      }

      const cx = width / 2
      const cy = height / 2
      const shortSide = Math.min(width, height)
      const longSide = Math.max(width, height)
      const wander = (2 * Math.PI) / Math.max(1, idle.cycleSeconds)
      const runRadius = run.spread * shortSide
      const pulsePhase = (2 * Math.PI * time) / Math.max(0.2, run.pulseSeconds)
      const lap = time / Math.max(1, run.lapSeconds)
      const pad = overscan(look.blur)

      // The edge mask fades the middle out as the blobs reach the edges; the band breathes with the pulse.
      if (t > 0) {
        const band = run.reach * shortSide * (1 + run.pulse * 0.6 * (0.5 + 0.5 * Math.sin(pulsePhase)))
        const far = longSide * 4
        root.dataset.edge = 'true'
        root.style.setProperty('--edge', `${Math.exp(lerp(Math.log(far), Math.log(Math.max(1, band)), t))}px`)
      } else if (root.dataset.edge) {
        delete root.dataset.edge
      }

      for (let index = 0; index < count; index += 1) {
        const blob = renderer ? null : blobRefs.current[index]
        if (!renderer && !blob) continue
        // Idle: anchored on a ring around the centre, each wandering on its own Lissajous path.
        const anchor = (2 * Math.PI * index) / count + 0.4
        const phase = index * 1.7
        const idleX = cx + Math.cos(anchor) * width * 0.26 + idle.drift * width * Math.sin(wander * wanderRate(index) * time + phase)
        const idleY =
          cy + Math.sin(anchor) * height * 0.24 + idle.drift * height * Math.cos(wander * wanderRate(index + 2) * time + phase * 1.3)
        const idleSize = idle.size * longSide * (0.85 + 0.15 * (index % 3))

        // Run: evenly spaced along the screen edges, all travelling at the same steady speed.
        const edge = edgePoint(index / count + lap, width, height, EDGE_CORNER * shortSide)
        const breath = 0.5 + 0.5 * Math.sin(pulsePhase + index * 1.1)
        const runAlpha = run.intensity * (1 - run.pulse * 0.5 * breath)

        // Positions are in viewport space; the blurred content is overscanned by `pad` on every side.
        const x = lerp(idleX, edge.x, t) + pad
        const y = lerp(idleY, edge.y, t) + pad
        if (blob) {
          const size = lerp(idleSize, runRadius * 2, t)
          blob.style.transform = `translate3d(${x - BLOB_BASE / 2}px, ${y - BLOB_BASE / 2}px, 0) scale(${size / BLOB_BASE})`
          blob.style.opacity = String(lerp(idle.intensity, runAlpha, t))
        } else {
          points[index * 2] = x / Math.max(1, width + 2 * pad)
          points[index * 2 + 1] = y / Math.max(1, height + 2 * pad)
        }
      }

      if (renderer && look.style !== 'blobs') {
        const breath = 0.5 + 0.5 * Math.sin(pulsePhase)
        renderer.draw({
          style: look.style,
          width: width + 2 * pad,
          height: height + 2 * pad,
          time: shaderTime,
          run: t,
          lap,
          alpha: lerp(idle.intensity, run.intensity * (1 - run.pulse * 0.5 * breath), t),
          scale: idle.size,
          warp: look.warp,
          blend: look.softness,
          colors,
          colorCount: Math.min(look.stops.length, AMBIENT_MAX_STOPS),
          ringColors,
          ringCount,
          points,
          pointCount: count,
        })
      }

      frame = requestAnimationFrame(draw)
    }

    draw(last)
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
    }
  }, [])

  const { stops, softness, smoothness, dither, blur, grain, vignette } = ambient
  const ring = ringStops(stops)
  const contentStyle = { '--ambient-pad': `${overscan(blur)}px`, filter: blur > 0 ? `blur(${blur}px)` : undefined } as CSSProperties
  return (
    <div className={styles.root} aria-hidden>
      <div className={styles.layer} ref={rootRef}>
        <div className={styles.content} style={contentStyle}>
          {shaded ? (
            <canvas ref={setCanvas} className={styles.canvas} />
          ) : (
            Array.from({ length: blobCount(stops.length) }, (_, index) => {
              const idleStop = stops[index % stops.length]
              const runStop = ring[index % ring.length]
              const idleFill = blobGradient(idleStop, softness, smoothness)
              return (
                <div
                  key={index}
                  ref={(element) => {
                    blobRefs.current[index] = element
                  }}
                  className={styles.blob}
                  style={{ background: runStop === idleStop ? idleFill : undefined }}
                >
                  {runStop !== idleStop && (
                    <>
                      <div className={styles.blobIdle} style={{ background: idleFill }} />
                      <div className={styles.blobRun} style={{ background: blobGradient(runStop, softness, smoothness) }} />
                    </>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
      {vignette > 0 && <div className={styles.vignette} style={{ '--ambient-vignette': vignette } as CSSProperties} />}
      {grain > 0 && <div className={styles.grain} style={{ '--ambient-grain': grain } as CSSProperties} />}
      {dither > 0 && <div className={styles.dither} style={{ '--ambient-dither': dither } as CSSProperties} />}
    </div>
  )
}
