/**
 * A demo script: what the user did while recording, replayed later by `demo-studio/` at a fixed size. Kept as plain
 * JSON in `demos/<name>.json` so a take can be edited by hand (retime a wait, drop a step, change the format).
 */

export type DemoFormat = {
  /** Preset the recording started from; informational once saved. */
  id: string
  /** CSS viewport the app is laid out in during replay. */
  width: number
  height: number
  /** Device pixel ratio for replay; the video is `width × scale` by `height × scale`. */
  scale: number
  fps: number
}

/**
 * Ways to find an element again, best first. `role` and `text` resolve through Playwright's accessible queries; `css`
 * is a last resort path. `nth` picks among several matches.
 */
export type DemoLocator =
  | { kind: 'testid'; value: string }
  | { kind: 'css'; value: string; nth?: number }
  | { kind: 'role'; role: string; name: string; nth?: number }
  | { kind: 'text'; value: string; nth?: number }
  | { kind: 'placeholder'; value: string; nth?: number }

export type DemoTarget = {
  /** Human-readable description, e.g. `button "Send"`. */
  label: string
  locators: DemoLocator[]
  /** Pointer position at capture, in the recording viewport; used when no locator resolves. */
  viewport: [x: number, y: number]
}

type StepBase = {
  /** Milliseconds since the recording started. */
  t: number
  /** Extra pause before this step during replay, in ms. Handy for hand-tuning a take. */
  pause?: number
  /** Overrides the automatic camera for this step: `false` keeps it wide, a number zooms to that level. */
  zoom?: number | false
}

export type DemoStep =
  | (StepBase & {
      kind: 'click'
      target: DemoTarget
      /** Pointer position inside the element's box, 0–1 on each axis. */
      at: [number, number]
      button?: 'left' | 'right'
      clicks?: 1 | 2
    })
  | (StepBase & { kind: 'hover'; target: DemoTarget; at: [number, number] })
  | (StepBase & {
      kind: 'drag'
      target: DemoTarget
      at: [number, number]
      /** Pointer offsets from the drag start in CSS px, with ms since the press. */
      path: [dx: number, dy: number, ms: number][]
    })
  | (StepBase & { kind: 'type'; target: DemoTarget; text: string; replace: boolean })
  | (StepBase & { kind: 'key'; key: string })
  | (StepBase & { kind: 'scroll'; target: DemoTarget; top: number; left: number })
  | (StepBase & { kind: 'wheel'; target: DemoTarget; at: [number, number]; deltaX: number; deltaY: number })
  | (StepBase & { kind: 'navigate'; path: string })
  | (StepBase & { kind: 'wait'; ms: number })

export type DemoRenderOptions = {
  /** Auto-zoom level on clicks and typing; `false` keeps the whole UI in frame. */
  zoom?: number | false
  /** Padding around the UI in CSS px; 0 renders the UI full-bleed. */
  inset?: number
  /** CSS background behind an inset UI. */
  background?: string
  cursor?: 'arrow' | 'none'
  cursorScale?: number
  /** Show a keycap overlay for shortcuts (⌘K, Enter, Esc…). */
  keys?: boolean
}

export type DemoScript = {
  version: 1
  name: string
  createdAt: string
  format: DemoFormat
  start: {
    /** Path, search and hash on the dev server, base included. */
    path: string
    sessionStorage: Record<string, string>
    localStorage: Record<string, string>
    /** `Date.now()` when recording began; replay starts its clock here so dates match the take. */
    clock: number
    recordedViewport: { width: number; height: number }
  }
  /** Multiplies every pause; above 1 is slower and calmer. */
  pace?: number
  /** Typing speed in characters per second. */
  typingSpeed?: number
  render?: DemoRenderOptions
  steps: DemoStep[]
}

/** Status the pipeline writes to `demo-out/<name>/status.json` while it runs. */
export type DemoRenderStatus = {
  phase: 'replaying' | 'encoding' | 'compositing' | 'done' | 'error'
  message: string
  /** 0–1 within the phase, when known. */
  progress?: number
  output?: string
  updatedAt: string
}

export const DEMO_FORMATS: DemoFormat[] = [
  { id: '16:9', width: 1920, height: 1080, scale: 2, fps: 60 },
  { id: '16:10', width: 1728, height: 1080, scale: 2, fps: 60 },
]
