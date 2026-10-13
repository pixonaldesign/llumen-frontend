import type { CSSProperties } from 'react'

export type SummaryScope = 'story' | 'slide'

export type SummaryGradient = [string, string, string, string]

export type SummaryConfig = {
  scope: SummaryScope
  slideId: string
  accent: string
  gradient: SummaryGradient
  prompt: string
  autoRegenerate: boolean
}

export const SUMMARY_SCOPES: { value: SummaryScope; label: string }[] = [
  { value: 'story', label: 'Story' },
  { value: 'slide', label: 'Slide' },
]

export const SUMMARY_SWATCHES = [
  '#ffc401',
  '#f7a13b',
  '#ee7b93',
  '#f17474',
  '#c56b3c',
  '#e3c16f',
  '#7dcea0',
  '#6fbf8a',
  '#3fa7a0',
  '#4fc3e8',
  '#70aeff',
  '#8b7cf6',
  '#c084fc',
  '#f0abfc',
  '#ffffff',
  '#9ca3af',
]

export const SUMMARY_REGENERATE_MS = 1400

export function defaultSummaryConfig(slideId: string): SummaryConfig {
  return {
    scope: 'slide',
    slideId,
    accent: '#ffffff',
    gradient: ['#70aeff', '#4fc3e8', '#ffffff', '#9ca3af'],
    prompt: '',
    autoRegenerate: false,
  }
}

export function gradientVars(gradient: SummaryGradient) {
  return {
    '--g1': gradient[0],
    '--g2': gradient[1],
    '--g3': gradient[2],
    '--g4': gradient[3],
  } as CSSProperties
}

/** Accepts `abc`, `#abc`, `aabbcc` or `#aabbcc`; returns lowercase `#aabbcc` or null. */
export function normalizeHex(value: string) {
  const hex = value.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{3}$/.test(hex)) return `#${[...hex].map((char) => char + char).join('')}`
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`
  return null
}
