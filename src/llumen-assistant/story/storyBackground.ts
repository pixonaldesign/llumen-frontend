import type { CSSProperties } from 'react'
import { llumenAssets } from '../assets'

export type BackgroundTab = 'basemap' | 'media' | 'color'

export type BackgroundMediaType = 'image' | 'video'

export type BackgroundFit = 'cover' | 'contain'

export type BackgroundColorMode = 'solid' | 'gradient' | 'shader'

export type BackgroundGradientType = 'linear' | 'radial'

export type BackgroundShaderPreset = 'aurora' | 'waves' | 'plasma'

export type BackgroundMedia = {
  kind: 'media'
  mediaType: BackgroundMediaType
  src: string
  name: string
  fit: BackgroundFit
  /** 1 = no crop; larger values crop into the frame. */
  zoom: number
  /** Focal point in percent (0–100). */
  focusX: number
  focusY: number
  /** Dark overlay strength (0–0.8) so story cards stay legible. */
  dim: number
  loop: boolean
  muted: boolean
  playbackRate: number
  /** Trim window in seconds; `trimEnd` null plays to the end. */
  trimStart: number
  trimEnd: number | null
  duration: number | null
}

export type BackgroundColor = {
  kind: 'color'
  mode: BackgroundColorMode
  color: string
  gradient: {
    type: BackgroundGradientType
    angle: number
    from: string
    to: string
  }
  shader: {
    preset: BackgroundShaderPreset
    speed: number
    from: string
    to: string
  }
}

export type StoryBackground = { kind: 'basemap'; id: string; url: string } | BackgroundMedia | BackgroundColor

export const BACKGROUND_TABS: { id: BackgroundTab; label: string }[] = [
  { id: 'basemap', label: 'Basemap' },
  { id: 'media', label: 'Media' },
  { id: 'color', label: 'Color' },
]

export const BACKGROUND_MEDIA_TYPES: { id: BackgroundMediaType; label: string; accept: string }[] = [
  { id: 'image', label: 'Image', accept: 'image/*' },
  { id: 'video', label: 'Video', accept: 'video/*' },
]

export const BACKGROUND_FITS: { id: BackgroundFit; label: string }[] = [
  { id: 'cover', label: 'Fill' },
  { id: 'contain', label: 'Fit' },
]

export const BACKGROUND_COLOR_MODES: { id: BackgroundColorMode; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'shader', label: 'Shader' },
]

export const BACKGROUND_GRADIENT_TYPES: { id: BackgroundGradientType; label: string }[] = [
  { id: 'linear', label: 'Linear' },
  { id: 'radial', label: 'Radial' },
]

export const BACKGROUND_SHADER_PRESETS: { id: BackgroundShaderPreset; label: string }[] = [
  { id: 'aurora', label: 'Aurora' },
  { id: 'waves', label: 'Waves' },
  { id: 'plasma', label: 'Plasma' },
]

export const BACKGROUND_PLAYBACK_RATES = [0.5, 1, 1.5, 2]

export type BackgroundColorGroup = { id: string; label: string; colors: string[] }

export const BACKGROUND_COLOR_GROUPS: BackgroundColorGroup[] = [
  {
    id: 'dark',
    label: 'Dark',
    colors: ['#0e1014', '#10191c', '#0b1a2e', '#13233a', '#1b1630', '#24162a', '#1f2a24', '#2a1d16'],
  },
  {
    id: 'neutral',
    label: 'Neutral',
    colors: ['#2b2b2b', '#3d3f44', '#5a5d63', '#80848b', '#a9adb3', '#cfd2d6', '#e6e8eb', '#f4f5f7'],
  },
  {
    id: 'pastel',
    label: 'Pastel',
    colors: ['#f6c6d0', '#f8d4b8', '#f5e6a8', '#cdeacb', '#bde5e1', '#c4dbfa', '#d5ccf6', '#ebcdee'],
  },
  {
    id: 'vibrant',
    label: 'Vibrant',
    colors: ['#ff5a5f', '#ee7b93', '#f7a13b', '#ffd23f', '#2ec27e', '#00b8d4', '#8b7cf6', '#e040a0'],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    colors: ['#0a3d62', '#155e8c', '#2e8bc0', '#3fa7a0', '#4fc3e8', '#70aeff', '#7fc8d6', '#b4e0ec'],
  },
  {
    id: 'earth',
    label: 'Earth',
    colors: ['#4a3426', '#7a5236', '#a0714a', '#c39a6b', '#e3c16f', '#5e6b4e', '#7d8f69', '#a3b18a'],
  },
]

export const BACKGROUND_COLORS = BACKGROUND_COLOR_GROUPS.flatMap((group) => group.colors)

export const DEFAULT_BACKGROUND_COLOR = '#10191c'

export type BackgroundMediaSource = { mediaType: BackgroundMediaType; src: string; name: string }

export type BackgroundMediaPreset = BackgroundMediaSource & { thumb: string }

function mediaPreset(mediaType: BackgroundMediaType, id: string, name: string): BackgroundMediaPreset {
  return {
    mediaType,
    name,
    src: `${llumenAssets.backgrounds}/${id}.${mediaType === 'video' ? 'mp4' : 'jpg'}`,
    thumb: `${llumenAssets.backgrounds}/thumbs/${id}.jpg`,
  }
}

/** The first preset of each type is the default selection. */
export const BACKGROUND_MEDIA_PRESETS: Record<BackgroundMediaType, BackgroundMediaPreset[]> = {
  image: [
    mediaPreset('image', 'default-sky', 'Default sky'),
    mediaPreset('image', 'light-trails', 'Light trails'),
    mediaPreset('image', 'blue-folds', 'Blue folds'),
    mediaPreset('image', 'frosted-slate', 'Frosted slate'),
    mediaPreset('image', 'violet-flow', 'Violet flow'),
  ],
  video: [
    mediaPreset('video', 'night-bridge', 'Night bridge'),
    mediaPreset('video', 'blue-haze', 'Blue haze'),
    mediaPreset('video', 'red-wave', 'Red wave'),
    mediaPreset('video', 'green-swirl', 'Green swirl'),
    mediaPreset('video', 'ember-bloom', 'Ember bloom'),
  ],
}

export function mediaBackground(
  media: Pick<BackgroundMedia, 'mediaType' | 'src' | 'name'>,
): BackgroundMedia {
  return {
    kind: 'media',
    ...media,
    fit: 'cover',
    zoom: 1,
    focusX: 50,
    focusY: 50,
    dim: 0.25,
    loop: true,
    muted: true,
    playbackRate: 1,
    trimStart: 0,
    trimEnd: null,
    duration: null,
  }
}

export function colorBackground(color: string, previous?: BackgroundColor): BackgroundColor {
  return {
    kind: 'color',
    mode: 'solid',
    color,
    gradient: previous?.gradient ?? { type: 'linear', angle: 135, from: color, to: '#3fa7a0' },
    shader: previous?.shader ?? { preset: 'aurora', speed: 1, from: color, to: '#4fc3e8' },
  }
}

export function gradientCss({ gradient }: BackgroundColor) {
  return gradient.type === 'radial'
    ? `radial-gradient(circle at 50% 50%, ${gradient.from}, ${gradient.to})`
    : `linear-gradient(${gradient.angle}deg, ${gradient.from}, ${gradient.to})`
}

/** Places the media like a crop: focal point plus zoom around it. */
export function mediaFrameStyle(media: BackgroundMedia): CSSProperties {
  return {
    objectFit: media.fit,
    objectPosition: `${media.focusX}% ${media.focusY}%`,
    transform: media.zoom === 1 ? undefined : `scale(${media.zoom})`,
    transformOrigin: `${media.focusX}% ${media.focusY}%`,
  }
}

export function formatSeconds(value: number) {
  const total = Math.max(0, Math.round(value))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
