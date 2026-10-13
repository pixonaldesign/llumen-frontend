/**
 * Ocean blues from the finding-cue border before the alert palette
 * (`OCEAN_AURORA_STOPS` in ee1bdc8, and the `--orb-shimmer-*` fallbacks).
 * Toast borders and the story-orb cue use these. The alert aurora does not.
 */
export const OCEAN_AURORA_STOPS = ['#3c78ff', '#2a4098', '#6beeff'] as const

/** Tuned alert ramp: left, middle, and right stops from the aurora panel. */
export const ALERT_AURORA_STOPS = ['#4110c6', '#ff2344', '#5e77b0'] as const

export type FindingAuroraSettings = {
  /** Left, middle, and right stops of the React Bits aurora ramp. */
  colorStop1: string
  colorStop2: string
  colorStop3: string
  amplitude: number
  blend: number
  speed: number
  /** Vertical curtain strength. */
  streaks: number
  /** Bright cores inside the curtains. */
  highlights: number
  showCopy: boolean
  copyDelayMs: number
  wordStaggerMs: number
  /** Backdrop blur radius, in pixels, through the solid region. */
  blurStrength: number
  /** How far the blur fades out above the domain label, in pixels. */
  blurFade: number
  /** Extra solid blur above the domain label before the fade begins. */
  blurLift: number
}

export const DEFAULT_FINDING_AURORA: FindingAuroraSettings = {
  colorStop1: ALERT_AURORA_STOPS[0],
  colorStop2: ALERT_AURORA_STOPS[1],
  colorStop3: ALERT_AURORA_STOPS[2],
  amplitude: 1.44,
  blend: 0.5,
  speed: 0.4,
  streaks: 0.24,
  highlights: 0.04,
  showCopy: true,
  copyDelayMs: 280,
  wordStaggerMs: 42,
  blurStrength: 63,
  blurFade: 178,
  blurLift: 12,
}

/** Toast stack auto-dismiss. The alert aurora stays until the user closes it. */
export const FINDING_DISMISS_MS = 10_000
export const FINDING_EXIT_MS = 480
/**
 * Shortcut mask length. Phase 1 still ends at 1392ms.
 * The phase 1 → phase 2 expand is 600ms slower than the original 1008ms.
 */
export const STAGED_AURORA_REVEAL_MS = 3000
/** End of the phase 1 hold. Copy and the story orb handoff wait for this. */
export const STAGED_AURORA_PHASE1_MS = 1392
