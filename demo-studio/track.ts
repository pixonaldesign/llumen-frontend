import type { DemoFormat, DemoRenderOptions } from '../src/demo-recorder/types.ts'

/** Times are seconds from the first video frame; positions are CSS px in the replay viewport. */
export type TrackEvent =
  | { t: number; type: 'move'; x: number; y: number }
  | { t: number; type: 'down' | 'up' }
  /** Where the camera should look: a click, a field being typed into, a drag. */
  | { t: number; type: 'focus'; x: number; y: number; zoom?: number | false; step?: number }
  | { t: number; type: 'key'; key: string }
  /** When a script step lands (1-based `step`). Zooms anchor to these, so they survive a replay at another pace. */
  | { t: number; type: 'moment'; step: number; label: string; x: number; y: number }

export type DemoTrack = {
  name: string
  format: DemoFormat
  render: DemoRenderOptions
  /** Seconds of video in `raw.mp4`. */
  duration: number
  events: TrackEvent[]
}
