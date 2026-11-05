/** A sparkline's y range and tick labels (top first), on round steps that hold every point. */
export type SparkScale = { lo: number; hi: number; labels: string[] }

/** An x-axis label at `at`% across the plot. */
export type SparkTick = { label: string; at: number }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

function niceStep(raw: number, whole: boolean): number {
  const power = 10 ** Math.floor(Math.log10(raw))
  const f = raw / power
  const step = ([1, 2, 2.5, 3, 4, 5, 6, 8].find((nice) => f <= nice) ?? 10) * power
  return whole && !Number.isInteger(step) ? niceStep(Math.ceil(step), false) : step
}

/**
 * Two steps over the points' range, anchored at 0 when the points sit closer to 0 than their own spread
 * (so counts and shares read from nothing), otherwise hugging the points so small swings still show.
 * A `max` fixes the scale at 0 to that top, so redrawn points keep reading against the same ticks.
 */
export function sparkScale(points: number[], { suffix = '', max }: { suffix?: string; max?: number } = {}): SparkScale {
  const steps = 2
  let top = Math.max(...points, max ?? -Infinity)
  let bottom = Math.min(...points)
  if (max !== undefined || (bottom >= 0 && bottom <= top - bottom)) bottom = Math.min(0, bottom)
  if (top === bottom) {
    if (top > 0) bottom = 0
    else if (top < 0) top = 0
    else top = 1
  }
  const whole = points.every(Number.isInteger)
  let step = niceStep((top - bottom) / steps, whole)
  let lo = Math.floor(bottom / step) * step
  while (lo + step * steps < top) {
    step = niceStep(step * 1.01, whole)
    lo = Math.floor(bottom / step) * step
  }
  const labels = Array.from({ length: steps + 1 }, (_, i) => {
    const value = lo + step * (steps - i)
    return Math.abs(value) < step / 1e6 ? '0' : `${compact.format(value)}${suffix}`
  })
  return { lo, hi: lo + step * steps, labels }
}

/** A smooth line through evenly spaced `points` on `scale`, in a 0–100 box (y grows downwards). */
export function sparkPath(points: number[], scale: SparkScale) {
  const at = (i: number): [number, number] => [
    points.length === 1 ? 50 : (i / (points.length - 1)) * 100,
    100 - ((points[i] - scale.lo) / (scale.hi - scale.lo)) * 100,
  ]
  const f = (n: number) => n.toFixed(2)
  let d = `M${at(0).map(f).join(' ')}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const [p0, p1, p2, p3] = [at(Math.max(0, i - 1)), at(i), at(i + 1), at(Math.min(points.length - 1, i + 2))]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1.map(f).join(' ')} ${c2.map(f).join(' ')} ${p2.map(f).join(' ')}`
  }
  return d
}

/**
 * The x labels to show: all of up to four, else the first, middle and last. Without `labels`, the points
 * are read as months ending this month.
 */
export function sparkX(count: number, labels?: string[], now = new Date()): SparkTick[] {
  const all =
    labels ?? Array.from({ length: count }, (_, i) => MONTHS[(((now.getMonth() - (count - 1 - i)) % 12) + 12) % 12])
  if (all.length < 2) return all.map((label) => ({ label, at: 0 }))
  const last = all.length - 1
  const shown = all.length <= 4 ? all.map((_, i) => i) : [0, Math.floor(last / 2), last]
  return shown.map((i) => ({ label: all[i], at: (i / last) * 100 }))
}
