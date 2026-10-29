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
 * beside an Assets panel that expands into Assets and Apps, 8 style 6 with Assets and Apps as a glass
 * modal over the map.
 */
export type FindingsStyle = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export const DEFAULT_FINDINGS_STYLE: FindingsStyle = 8

/**
 * Studio experiences: 1 the sidebar and asset grid, 2 an icon rail and a home hub, 3 top tabs over a list
 * and inspector, 4 a bento overview with a floating dock, 5 a status board beside saved views, 6 a gallery
 * library with shelves and a lightbox, 7 a home command centre with pinned assets, 8 a spatial canvas with a
 * command palette, 9 an overview home with Apps and Workflows beside a sidebar, 10 the
 * same under a pill ribbon that holds the workspace.
 */
export type StudioStyle = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

/** Where the Briefing's AI bar centres over a Studio page: beside UX 9's sidebar, or across UX 10's full width. */
export type StudioAskBar = 'beside-sidebar' | 'full-width'

export const DEFAULT_STUDIO_STYLE: StudioStyle = 10

/** A story's Comparison layout: the maps one above the other (horizontal split) or side by side (vertical). */
export type ComparisonSplit = 'horizontal' | 'vertical'

export const DEFAULT_COMPARISON_SPLIT: ComparisonSplit = 'horizontal'

export const COMPARISON_SPLIT_OPTIONS: readonly { split: ComparisonSplit; label: string; hint: string }[] = [
  { split: 'horizontal', label: 'Horizontal comparison', hint: 'Story map on top, compared map below' },
  { split: 'vertical', label: 'Vertical comparison', hint: 'Story map on the left, compared map on the right' },
]

export type StyleOption<T extends number> = { style: T; label: string; hint: string }

export const FINDINGS_STYLE_OPTIONS: readonly StyleOption<FindingsStyle>[] = [
  { style: 1, label: 'Findings style 1', hint: 'Centred over the chat bar' },
  { style: 2, label: 'Findings style 2', hint: 'Chat bar on the left' },
  { style: 3, label: 'Findings style 3', hint: 'Chat bar above compact findings' },
  { style: 4, label: 'Findings style 4', hint: 'Chat bar above the findings' },
  { style: 5, label: 'Findings style 5', hint: 'Chat bar on the left' },
  { style: 6, label: 'Findings style 6', hint: 'Assets and Apps slide in from the right' },
  { style: 7, label: 'Findings style 7', hint: 'Assets panel on the right' },
  { style: 8, label: 'Findings style 8', hint: 'Assets and Apps open over the map' },
]

export const STUDIO_STYLE_OPTIONS: readonly StyleOption<StudioStyle>[] = [
  { style: 1, label: 'Studio UX 1', hint: 'Classic sidebar and asset grid' },
  { style: 2, label: 'Studio UX 2', hint: 'Icon rail and a home hub' },
  { style: 3, label: 'Studio UX 3', hint: 'Top tabs, list and inspector' },
  { style: 4, label: 'Studio UX 4', hint: 'Bento overview with a floating dock' },
  { style: 5, label: 'Studio UX 5', hint: 'Status board beside saved views' },
  { style: 6, label: 'Studio UX 6', hint: 'Gallery shelves and a lightbox' },
  { style: 7, label: 'Studio UX 7', hint: 'Home command centre with pinned assets' },
  { style: 8, label: 'Studio UX 8', hint: 'Spatial canvas with a command palette' },
  { style: 9, label: 'Studio UX 9', hint: 'Overview home with Apps and Flows' },
  { style: 10, label: 'Studio UX 10', hint: 'Overview home under a pill ribbon' },
]

const LANDING_KEY = 'llumen.landingVariant'
const TOP_BAR_KEY = 'llumen.topBarVariant'
const FINDINGS_STYLE_KEY = 'llumen.findingsStyle'
const STUDIO_STYLE_KEY = 'llumen.studioStyle'
const COMPARISON_SPLIT_KEY = 'llumen.comparisonSplit'

function isComparisonSplit(value: string | null): value is ComparisonSplit {
  return value === 'horizontal' || value === 'vertical'
}

function toFindingsStyle(value: string | null): FindingsStyle | null {
  return value !== null && /^[1-8]$/.test(value) ? (Number(value) as FindingsStyle) : null
}

function toStudioStyle(value: string | null): StudioStyle | null {
  return value !== null && /^([1-9]|10)$/.test(value) ? (Number(value) as StudioStyle) : null
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

export function readStudioStyle(): StudioStyle {
  if (typeof window === 'undefined') return DEFAULT_STUDIO_STYLE
  const fromUrl = toStudioStyle(new URLSearchParams(window.location.search).get('studio'))
  if (fromUrl) return fromUrl
  try {
    return toStudioStyle(window.sessionStorage.getItem(STUDIO_STYLE_KEY)) ?? DEFAULT_STUDIO_STYLE
  } catch {
    return DEFAULT_STUDIO_STYLE
  }
}

export function persistStudioStyle(style: StudioStyle) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STUDIO_STYLE_KEY, String(style))
  } catch {
    /* private mode */
  }
  writeParam('studio', String(style), String(DEFAULT_STUDIO_STYLE))
}

export function readComparisonSplit(): ComparisonSplit {
  if (typeof window === 'undefined') return DEFAULT_COMPARISON_SPLIT
  const fromUrl = new URLSearchParams(window.location.search).get('comparison')
  if (isComparisonSplit(fromUrl)) return fromUrl
  try {
    const stored = window.sessionStorage.getItem(COMPARISON_SPLIT_KEY)
    return isComparisonSplit(stored) ? stored : DEFAULT_COMPARISON_SPLIT
  } catch {
    return DEFAULT_COMPARISON_SPLIT
  }
}

export function persistComparisonSplit(split: ComparisonSplit) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(COMPARISON_SPLIT_KEY, split)
  } catch {
    /* private mode */
  }
  writeParam('comparison', split, DEFAULT_COMPARISON_SPLIT)
}
