/** Prototype switches opened from the Command-K palette. */

export type LandingVariant =
  | 'briefing'
  | 'briefing-2'
  | 'stories'
  | 'conversations'
  | 'feed'
  | 'feed-card'
  | 'feed-chat'
export type TopBarVariant = 'current' | 'studio'
/**
 * Briefing findings layouts: 1 centred over the composer, 2 composer on the left, 3 composer above
 * smaller findings, 4 style 1's findings under the composer, 5 composer beside the finding, 6 findings
 * centred over a bottom composer with Assets and Apps one horizontal slide away, 7 style 6's findings
 * beside an Assets panel that expands into Assets and Apps.
 */
export type FindingsStyle = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const DEFAULT_FINDINGS_STYLE: FindingsStyle = 6

const LANDING_KEY = 'llumen.landingVariant'
const TOP_BAR_KEY = 'llumen.topBarVariant'
const FINDINGS_STYLE_KEY = 'llumen.findingsStyle'

function toFindingsStyle(value: string | null): FindingsStyle | null {
  return value !== null && /^[1-7]$/.test(value) ? (Number(value) as FindingsStyle) : null
}

function isLanding(value: string | null): value is LandingVariant {
  return (
    value === 'briefing' ||
    value === 'briefing-2' ||
    value === 'stories' ||
    value === 'conversations' ||
    value === 'feed' ||
    value === 'feed-card' ||
    value === 'feed-chat'
  )
}

function isTopBar(value: string | null): value is TopBarVariant {
  return value === 'current' || value === 'studio'
}

export function readLandingVariant(): LandingVariant {
  if (typeof window === 'undefined') return 'briefing'
  const fromUrl = new URLSearchParams(window.location.search).get('landing')
  if (isLanding(fromUrl)) return fromUrl
  try {
    const stored = window.sessionStorage.getItem(LANDING_KEY)
    if (isLanding(stored)) return stored
  } catch {
    /* private mode */
  }
  return 'briefing'
}

export function readTopBarVariant(): TopBarVariant {
  if (typeof window === 'undefined') return 'studio'
  const fromUrl = new URLSearchParams(window.location.search).get('bar')
  if (isTopBar(fromUrl)) return fromUrl
  try {
    const stored = window.sessionStorage.getItem(TOP_BAR_KEY)
    if (isTopBar(stored)) return stored
  } catch {
    /* private mode */
  }
  return 'studio'
}

function writeParam(key: string, value: string, omitWhen: string) {
  const url = new URL(window.location.href)
  if (value === omitWhen) url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export function persistLandingVariant(variant: LandingVariant) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(LANDING_KEY, variant)
  } catch {
    /* private mode */
  }
  writeParam('landing', variant, 'briefing')
}

export function persistTopBarVariant(variant: TopBarVariant) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(TOP_BAR_KEY, variant)
  } catch {
    /* private mode */
  }
  writeParam('bar', variant, 'studio')
}

export function readFindingsStyle(): FindingsStyle {
  if (typeof window === 'undefined') return DEFAULT_FINDINGS_STYLE
  const fromUrl = toFindingsStyle(new URLSearchParams(window.location.search).get('findings'))
  if (fromUrl) return fromUrl
  try {
    return toFindingsStyle(window.sessionStorage.getItem(FINDINGS_STYLE_KEY)) ?? DEFAULT_FINDINGS_STYLE
  } catch {
    return DEFAULT_FINDINGS_STYLE
  }
}

export function persistFindingsStyle(style: FindingsStyle) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(FINDINGS_STYLE_KEY, String(style))
  } catch {
    /* private mode */
  }
  writeParam('findings', String(style), String(DEFAULT_FINDINGS_STYLE))
}
