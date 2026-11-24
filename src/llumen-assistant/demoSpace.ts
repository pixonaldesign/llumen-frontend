/**
 * Which client demo the prototype runs, from `?space=` (then this tab's last pick). Every space shares the
 * same components; a space only picks its own findings, maps, stories, board and chrome. It is read once per
 * load and switching reloads the page, so data modules pick their space's values as they are imported.
 */
export type DemoSpaceId = 'llumen' | 'dm'

export const DEMO_SPACE_OPTIONS: readonly { space: DemoSpaceId; label: string; hint: string }[] = [
  { space: 'llumen', label: 'Demo space · Llumen', hint: 'Abu Dhabi findings over the column map' },
  { space: 'dm', label: 'Demo space · Dubai Municipality', hint: 'Al Barsha odor and JVC growth, DM Mind intro' },
]

const SPACE_PARAM = 'space'
const SPACE_KEY = 'llumen.demoSpace'
const DEFAULT_SPACE: DemoSpaceId = 'llumen'

function isDemoSpace(value: string | null): value is DemoSpaceId {
  return DEMO_SPACE_OPTIONS.some((option) => option.space === value)
}

function readDemoSpace(): DemoSpaceId {
  if (typeof window === 'undefined') return DEFAULT_SPACE
  const fromUrl = new URLSearchParams(window.location.search).get(SPACE_PARAM)
  if (isDemoSpace(fromUrl)) return fromUrl
  let stored: string | null = null
  try {
    stored = window.sessionStorage.getItem(SPACE_KEY)
  } catch {
    /* private mode */
  }
  if (!isDemoSpace(stored) || stored === DEFAULT_SPACE) return DEFAULT_SPACE
  // Back in the URL, so a shared link or a recorded take opens in the same space.
  const url = new URL(window.location.href)
  url.searchParams.set(SPACE_PARAM, stored)
  window.history.replaceState(window.history.state, '', url)
  return stored
}

export const DEMO_SPACE: DemoSpaceId = readDemoSpace()

/** This space's value; every space must have one, so a new space can't miss any. */
export function bySpace<T>(values: Record<DemoSpaceId, T>): T {
  return values[DEMO_SPACE]
}

export function switchDemoSpace(next: DemoSpaceId) {
  if (next === DEMO_SPACE) return
  try {
    window.sessionStorage.setItem(SPACE_KEY, next)
  } catch {
    /* private mode */
  }
  const url = new URL(window.location.href)
  if (next === DEFAULT_SPACE) url.searchParams.delete(SPACE_PARAM)
  else url.searchParams.set(SPACE_PARAM, next)
  window.location.assign(url)
}
