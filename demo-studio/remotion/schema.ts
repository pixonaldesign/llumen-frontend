import { z } from 'zod'
import type { DemoRenderOptions } from '../../src/demo-recorder/types.ts'
import type { TrackEvent } from '../track.ts'

/**
 * Everything editable in Remotion Studio's props panel. The take itself (video and cursor path) is loaded from the
 * demo's public folder, so this stays small enough to edit by hand.
 */
export const demoSchema = z.object({
  zooms: z
    .array(
      z.object({
        from: z.number().min(0).describe('Seconds where the camera starts moving in'),
        to: z.number().min(0).describe('Seconds where it starts moving back out'),
        level: z.number().min(1).max(3),
      }),
    )
    .describe('Camera zooms; the camera follows the cursor while zoomed'),
  cursor: z.boolean(),
  cursorScale: z.number().min(0.5).max(2.5),
  ripple: z.boolean().describe('Ring that expands from each click'),
  keycaps: z.boolean().describe('Show shortcuts like ⌘K and Esc'),
  inset: z.number().min(0).max(240).describe('Padding around the UI in CSS px; 0 is full-bleed'),
  background: z.string().describe('CSS background behind an inset UI'),
})

export type DemoProps = z.infer<typeof demoSchema>
export type Zoom = DemoProps['zooms'][number]

/** How long the camera stays in after a click or keystroke, and how early it starts moving. */
const LEAD = 0.6
const HOLD = 1.8
/** Zoom windows closer than this merge, so a run of clicks stays zoomed instead of pumping. */
const MERGE_GAP = 1.2
const round = (value: number) => Math.round(value * 100) / 100

/** The zooms a take starts with: one per click or keystroke in auto mode, only ⌥Z-marked steps in marked mode. */
export function deriveZooms(events: TrackEvent[], render: DemoRenderOptions): Zoom[] {
  const mode = render.zoomMode ?? (render.zoom === false ? 'off' : 'auto')
  if (mode === 'off') return []
  const level = typeof render.zoom === 'number' ? render.zoom : 1.5
  const zooms: Zoom[] = []
  for (const event of events) {
    if (event.type !== 'focus') continue
    const zoom = mode === 'marked' ? (typeof event.zoom === 'number' ? event.zoom : null) : event.zoom === false ? null : (event.zoom ?? level)
    if (zoom === null || zoom <= 1) continue
    const from = Math.max(0, event.t - LEAD)
    const to = event.t + HOLD
    const last = zooms[zooms.length - 1]
    if (last && from - last.to < MERGE_GAP) {
      last.to = Math.max(last.to, to)
      last.level = Math.max(last.level, zoom)
    } else zooms.push({ from, to, level: zoom })
  }
  return zooms.map((zoom) => ({ from: round(zoom.from), to: round(zoom.to), level: round(zoom.level) }))
}

export function propsFor(events: TrackEvent[], render: DemoRenderOptions): DemoProps {
  return {
    zooms: deriveZooms(events, render),
    cursor: render.cursor !== 'none',
    cursorScale: render.cursorScale ?? 1,
    ripple: render.ripple ?? true,
    keycaps: render.keys ?? true,
    inset: render.inset ?? 0,
    background: render.background ?? 'linear-gradient(135deg, #1b2340 0%, #0a0e16 55%, #10233a 100%)',
  }
}
