/**
 * A view's background from the map: `top` and `bottom` stops from its dark ground (the deep blue water and
 * background), and `accent`, its brighter land colour, for faint glows over them. All CSS colours.
 */
export type MapPalette = { top: string; bottom: string; accent: string }

/** The share of pixels, darkest first, that make the ground. */
const GROUND_SHARE = 0.55
/**
 * The accent: the brightest share of the brighter half in the commonest hue that stands apart from the
 * ground's (the land against the water), so haze in the ground's own hue doesn't wash it back; else just
 * the brightest. Hues group in bins of ACCENT_MIN_TURN degrees.
 */
const ACCENT_SHARE = 0.15
const ACCENT_MIN_TURN = 15
const ACCENT_MIN_CHROMA = 0.06
/** The ground keeps the map's own darkness within these bounds (HSL lightness, %); the bottom lifts a little. */
const GROUND_LIGHTNESS = [11, 19] as const
const GROUND_LIFT = 5
const GROUND_MAX_SATURATION = 55
const ACCENT_LIGHTNESS = [30, 42] as const
const ACCENT_MAX_SATURATION = 42

type Pixel = { r: number; g: number; b: number; lightness: number; chroma: number; hue: number }

function hsl({ r, g, b }: { r: number; g: number; b: number }) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  const lightness = (max + min) / 2
  if (!chroma) return { hue: 0, saturation: 0, lightness }
  const saturation = chroma / (1 - Math.abs(2 * lightness - 1))
  const hue = max === r ? ((g - b) / chroma + 6) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4
  return { hue: hue * 60, saturation, lightness }
}

/** Mean colour of `pixels`, coloured ones weighing more so a hue reads through the greys. */
function mean(pixels: readonly Pixel[]) {
  let r = 0
  let g = 0
  let b = 0
  let total = 0
  for (const pixel of pixels) {
    const weight = 0.2 + pixel.chroma
    r += pixel.r * weight
    g += pixel.g * weight
    b += pixel.b * weight
    total += weight
  }
  return hsl({ r: r / total, g: g / total, b: b / total })
}

const clamp = (value: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, value))
const css = (hue: number, saturation: number, lightness: number) =>
  `hsl(${hue.toFixed(1)} ${saturation.toFixed(1)}% ${lightness.toFixed(1)}%)`

export function paletteFromPixels({ data }: ImageData): MapPalette | null {
  const pixels: Pixel[] = []
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const { hue, lightness } = hsl({ r, g, b })
    pixels.push({ r, g, b, lightness, chroma: Math.max(r, g, b) - Math.min(r, g, b), hue })
  }
  if (pixels.length < 8) return null
  pixels.sort((a, b) => a.lightness - b.lightness)

  const ground = mean(pixels.slice(0, Math.ceil(pixels.length * GROUND_SHARE)))
  const turn = (pixel: Pixel) => {
    const degrees = Math.abs(pixel.hue - ground.hue) % 360
    return Math.min(degrees, 360 - degrees)
  }
  const bright = pixels.slice(Math.floor(pixels.length / 2))
  const apart = bright.filter((pixel) => pixel.chroma >= ACCENT_MIN_CHROMA && turn(pixel) >= ACCENT_MIN_TURN)
  /* The commonest hue among them, so a few stray pixels on the ground's other side don't pull it back. */
  const bins = new Map<number, number>()
  for (const pixel of apart) {
    const bin = Math.round(pixel.hue / ACCENT_MIN_TURN) % (360 / ACCENT_MIN_TURN)
    bins.set(bin, (bins.get(bin) ?? 0) + pixel.chroma)
  }
  const top = [...bins].sort((a, b) => b[1] - a[1])[0]?.[0]
  const cluster = apart.filter((pixel) => {
    const degrees = Math.abs(pixel.hue - (top ?? 0) * ACCENT_MIN_TURN) % 360
    return Math.min(degrees, 360 - degrees) <= ACCENT_MIN_TURN
  })
  const accent = cluster.length
    ? mean(cluster.sort((a, b) => b.lightness - a.lightness).slice(0, Math.ceil(pixels.length * ACCENT_SHARE)))
    : mean(bright.slice(-Math.ceil(pixels.length * ACCENT_SHARE)))
  const groundSaturation = Math.min(GROUND_MAX_SATURATION, ground.saturation * 100)
  const groundLightness = clamp(ground.lightness * 100, GROUND_LIGHTNESS)
  return {
    top: css(ground.hue, groundSaturation, groundLightness),
    bottom: css(ground.hue, groundSaturation, groundLightness + GROUND_LIFT),
    accent: css(
      accent.hue,
      Math.min(ACCENT_MAX_SATURATION, accent.saturation * 100),
      clamp(accent.lightness * 100, ACCENT_LIGHTNESS),
    ),
  }
}
