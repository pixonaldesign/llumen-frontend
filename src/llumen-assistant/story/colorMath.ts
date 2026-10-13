export type HsvColor = { h: number; s: number; v: number }
export type HslColor = { h: number; s: number; l: number }
export type ColorFormat = 'HEX' | 'RGB' | 'HSL'

export const COLOR_FORMATS: ColorFormat[] = ['HEX', 'RGB', 'HSL']

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function validHex(value: string) {
  const trimmed = value.trim()
  if (!/^#?[0-9a-f]{6}$/i.test(trimmed)) return null
  return `#${trimmed.replace('#', '').toLowerCase()}`
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
  if (!Number.isFinite(n)) return [0, 0, 0]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(r: number, g: number, b: number) {
  const c = (n: number) => clampNumber(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function hueOf(rn: number, gn: number, bn: number, max: number, delta: number) {
  if (!delta) return 0
  const h =
    max === rn ? 60 * (((gn - bn) / delta) % 6) : max === gn ? 60 * ((bn - rn) / delta + 2) : 60 * ((rn - gn) / delta + 4)
  return h < 0 ? h + 360 : h
}

function chromaToHex(h: number, c: number, x: number, m: number) {
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

export function rgbToHsv(r: number, g: number, b: number): HsvColor {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const delta = max - Math.min(rn, gn, bn)
  return { h: hueOf(rn, gn, bn, max, delta), s: max === 0 ? 0 : delta / max, v: max }
}

export function hsvToHex({ h, s, v }: HsvColor) {
  const c = v * s
  return chromaToHex(h, c, c * (1 - Math.abs(((h / 60) % 2) - 1)), v - c)
}

export function rgbToHsl(r: number, g: number, b: number): HslColor {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  const l = (max + min) / 2
  return { h: hueOf(rn, gn, bn, max, delta), s: delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1)), l }
}

export function hslToHex({ h, s, l }: HslColor) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  return chromaToHex(h, c, c * (1 - Math.abs(((h / 60) % 2) - 1)), l - c / 2)
}
