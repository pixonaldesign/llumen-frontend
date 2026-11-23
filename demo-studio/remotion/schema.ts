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
        moment: z
          .number()
          .int()
          .min(0)
          .describe('Step number to anchor to (shown in the preview and on the timeline); 0 means from/to are seconds into the video'),
        from: z.number().describe('Seconds where the camera starts moving in, relative to the moment (e.g. -0.6)'),
        to: z.number().describe('Seconds where it starts moving back out, relative to the moment (e.g. 1.8)'),
        level: z.number().min(1).max(3),
        focus: z.enum(['cursor', 'moment', 'point']).describe('Follow the cursor, hold where the moment happened, or look at x/y'),
        x: z.number().min(0).max(1).describe('Focus point for "point", 0 is the left edge and 1 the right'),
        y: z.number().min(0).max(1).describe('Focus point for "point", 0 is the top edge and 1 the bottom'),
      }),
    )
    .describe('Camera zooms. Anchored to a moment, they stay on that step if the take is replayed at another pace'),
  guides: z.boolean().describe('Label each step in the Studio preview; never drawn into a render'),
  cursor: z.boolean(),
  cursorScale: z.number().min(0.5).max(2.5),
  ripple: z.boolean().describe('Ring that expands from each click'),
  keycaps: z.boolean().describe('Show shortcuts like ⌘K and Esc'),
  inset: z.number().min(0).max(240).describe('Padding around the UI in CSS px; 0 is full-bleed'),
  background: z.string().describe('CSS background behind an inset UI'),
})

export type DemoProps = z.infer<typeof demoSchema>
export type Zoom = DemoProps['zooms'][number]

/** How early the camera starts moving in before a step, and how long it stays after. */
const LEAD = 0.6
const HOLD = 1.8
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
    const anchored = event.step !== undefined
    zooms.push({
      moment: event.step ?? 0,
      from: anchored ? -LEAD : round(Math.max(0, event.t - LEAD)),
      to: anchored ? HOLD : round(event.t + HOLD),
      level: round(zoom),
      focus: 'cursor',
      x: 0.5,
      y: 0.5,
    })
  }
  return zooms
}

/** Fills in fields that older saved props predate, so a project edited before an upgrade still renders. */
export function normalizeProps(saved: Record<string, unknown>, fallback: DemoProps): DemoProps {
  const zooms = Array.isArray(saved.zooms)
    ? (saved.zooms as Partial<Zoom>[]).map((zoom): Zoom => ({ moment: 0, from: 0, to: 0, level: 1.5, focus: 'cursor', x: 0.5, y: 0.5, ...zoom }))
    : fallback.zooms
  return { ...fallback, ...saved, zooms }
}

export function propsFor(events: TrackEvent[], render: DemoRenderOptions): DemoProps {
  return {
    zooms: deriveZooms(events, render),
    guides: true,
    cursor: render.cursor !== 'none',
    cursorScale: render.cursorScale ?? 1,
    ripple: render.ripple ?? true,
    keycaps: render.keys ?? true,
    inset: render.inset ?? 0,
    background: render.background ?? 'linear-gradient(135deg, #1b2340 0%, #0a0e16 55%, #10233a 100%)',
  }
}
