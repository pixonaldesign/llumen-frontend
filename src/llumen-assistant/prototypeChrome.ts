/** Prototype switches opened from the Command-K palette. */

export type LandingVariant = 'briefing' | 'stories' | 'conversations' | 'feed' | 'feed-card' | 'feed-chat'
export type TopBarVariant = 'current' | 'studio'

const LANDING_KEY = 'llumen.landingVariant'
const TOP_BAR_KEY = 'llumen.topBarVariant'

function isLanding(value: string | null): value is LandingVariant {
  return (
    value === 'briefing' ||
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
  if (typeof window === 'undefined') return 'stories'
  const fromUrl = new URLSearchParams(window.location.search).get('landing')
  if (isLanding(fromUrl)) return fromUrl
  try {
    const stored = window.sessionStorage.getItem(LANDING_KEY)
    if (isLanding(stored)) return stored
  } catch {
    /* private mode */
  }
  return 'stories'
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
  writeParam('landing', variant, 'stories')
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
