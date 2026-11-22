import { useSyncExternalStore } from 'react'

/**
 * Main's data is local, so cards never really load or fail. This forces those states so they can be reviewed:
 * `loading-list` is the asset list itself still loading; `no-thumbnail` draws every card as if it had no visual. It
 * lives in `?studioState=` so a state can be shared as a link, and the command palette switches it without a reload.
 */
export type StudioPreviewState = 'ready' | 'loading' | 'error' | 'loading-list' | 'no-thumbnail'

const STATES: Record<StudioPreviewState, true> = {
  ready: true,
  loading: true,
  error: true,
  'loading-list': true,
  'no-thumbnail': true,
}

const PARAM = 'studioState'
const listeners = new Set<() => void>()

function read(): StudioPreviewState {
  const value = new URLSearchParams(window.location.search).get(PARAM)
  return value !== null && value in STATES ? (value as StudioPreviewState) : 'ready'
}

let current = read()

export function setStudioPreviewState(next: StudioPreviewState) {
  if (next === current) return
  current = next
  const url = new URL(window.location.href)
  if (next === 'ready') url.searchParams.delete(PARAM)
  else url.searchParams.set(PARAM, next)
  window.history.replaceState(window.history.state, '', url)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useStudioPreviewState() {
  return useSyncExternalStore(subscribe, () => current)
}
