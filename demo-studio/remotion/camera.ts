import type { DemoTrack, TrackEvent } from '../track.ts'

export type FrameState = {
  /** Cursor in CSS px of the replay viewport. */
  x: number
  y: number
  /** Camera centre in CSS px and zoom level. */
  cx: number
  cy: number
  zoom: number
}

const DEFAULT_ZOOM = 1.5
/** How long the camera stays in after a click or keystroke, and how early it starts moving. */
const LEAD = 0.6
const HOLD = 1.8
/** Zoom windows closer than this merge, so a run of clicks stays zoomed instead of pumping. */
const MERGE_GAP = 1.2

type Move = Extract<TrackEvent, { type: 'move' }>

function cursorAt(moves: Move[], t: number) {
  if (!moves.length) return { x: 0, y: 0 }
  let lo = 0
  let hi = moves.length - 1
  if (t <= moves[0].t) return moves[0]
  if (t >= moves[hi].t) return moves[hi]
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (moves[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = moves[lo]
  const b = moves[hi]
  const k = (t - a.t) / (b.t - a.t || 1)
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
}

function zoomWindows(track: DemoTrack) {
  const fallback = track.render.zoom ?? DEFAULT_ZOOM
  const windows: { from: number; to: number; zoom: number }[] = []
  for (const event of track.events) {
    if (event.type !== 'focus') continue
    const zoom = event.zoom ?? fallback
    if (zoom === false || zoom <= 1) continue
    const from = event.t - LEAD
    const to = event.t + HOLD
    const last = windows[windows.length - 1]
    if (last && from - last.to < MERGE_GAP) {
      last.to = Math.max(last.to, to)
      last.zoom = Math.max(last.zoom, zoom)
    } else windows.push({ from, to, zoom })
  }
  return windows
}

/**
 * The whole camera path, one entry per frame. Zoom and centre chase their targets with critically damped springs, so
 * moves ease in and out without overshoot and the result is identical however Remotion splits the render.
 */
export function buildTimeline(track: DemoTrack, fps: number, frames: number): FrameState[] {
  const { width, height } = track.format
  const moves = track.events.filter((event): event is Move => event.type === 'move')
  const windows = zoomWindows(track)
  const out: FrameState[] = []
  const zoomSpring = { x: 1, v: 0, omega: 5 }
  const cxSpring = { x: width / 2, v: 0, omega: 3.5 }
  const cySpring = { x: height / 2, v: 0, omega: 3.5 }
  const substeps = 4
  const dt = 1 / fps / substeps
  const stepSpring = (spring: { x: number; v: number; omega: number }, target: number) => {
    const accel = spring.omega * spring.omega * (target - spring.x) - 2 * spring.omega * spring.v
    spring.v += accel * dt
    spring.x += spring.v * dt
  }

  let windowIndex = 0
  for (let frame = 0; frame < frames; frame++) {
    const t = frame / fps
    const cursor = cursorAt(moves, t)
    while (windowIndex < windows.length && windows[windowIndex].to < t) windowIndex++
    const active = windows[windowIndex] && windows[windowIndex].from <= t ? windows[windowIndex] : null
    const targetZoom = active ? active.zoom : 1
    const targetX = active ? cursor.x : width / 2
    const targetY = active ? cursor.y : height / 2
    for (let i = 0; i < substeps; i++) {
      stepSpring(zoomSpring, targetZoom)
      stepSpring(cxSpring, targetX)
      stepSpring(cySpring, targetY)
    }
    const zoom = Math.max(1, zoomSpring.x)
    const halfW = width / 2 / zoom
    const halfH = height / 2 / zoom
    out.push({
      x: cursor.x,
      y: cursor.y,
      zoom,
      cx: Math.min(width - halfW, Math.max(halfW, cxSpring.x)),
      cy: Math.min(height - halfH, Math.max(halfH, cySpring.x)),
    })
  }
  return out
}
