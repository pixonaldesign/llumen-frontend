import { useCallback, useEffect, useState } from 'react'
import type { StudioPage } from './studioData'

/**
 * Where the prototype is, kept in the URL so a reload or a shared link lands in the same place and Back and
 * Forward step through it: `view=studio` for the Briefings / Studio switch and `page=` for the Studio's page.
 */
export const VIEW_PARAM = 'view'
export const PAGE_PARAM = 'page'

/** Fired after a push, so every hook reading the URL catches up (pushState fires no event of its own). */
const PUSH_EVENT = 'llumen:location'

const STUDIO_PAGE_KEYS: Record<StudioPage, true> = {
  assets: true,
  filters: true,
  database: true,
  apis: true,
  models: true,
  files: true,
  dataflow: true,
  briefings: true,
  slides: true,
  dashboards: true,
  whiteboards: true,
  rooms: true,
  workflows: true,
  members: true,
  apps: true,
  context: true,
}

export function parseStudioPage(value: string | null): StudioPage | null {
  return value !== null && value in STUDIO_PAGE_KEYS ? (value as StudioPage) : null
}

const CLEAR_NOTHING = () => []

/** Sets the given params (null removes one) as a new history entry; nothing happens when none change. */
export function pushParams(updates: Record<string, string | null>) {
  const url = new URL(window.location.href)
  let changed = false
  for (const [key, value] of Object.entries(updates)) {
    if (url.searchParams.get(key) === value) continue
    changed = true
    if (value === null) url.searchParams.delete(key)
    else url.searchParams.set(key, value)
  }
  if (!changed) return
  window.history.pushState(window.history.state, '', url)
  window.dispatchEvent(new Event(PUSH_EVENT))
}

/**
 * State mirrored to one URL param. The fallback is left out of the URL, `parse` rejects values that don't
 * belong (falling back instead), and `alsoClear` names params a change should drop, such as the Studio's page
 * when leaving the Studio. `parse` must be stable, defined outside the component.
 */
export function useHistoryParam<T extends string>(
  key: string,
  fallback: T,
  parse: (value: string | null) => T | null,
  alsoClear: (next: T) => string[] = CLEAR_NOTHING,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => parse(new URLSearchParams(window.location.search).get(key)) ?? fallback)
  useEffect(() => {
    const sync = () => setValue(parse(new URLSearchParams(window.location.search).get(key)) ?? fallback)
    window.addEventListener('popstate', sync)
    window.addEventListener(PUSH_EVENT, sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener(PUSH_EVENT, sync)
    }
  }, [key, fallback, parse])
  const set = useCallback(
    (next: T) => {
      setValue(next)
      const cleared = Object.fromEntries(alsoClear(next).map((param) => [param, null]))
      pushParams({ ...cleared, [key]: next === fallback ? null : next })
    },
    [key, fallback, alsoClear],
  )
  return [value, set]
}
