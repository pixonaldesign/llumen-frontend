import { useEffect, useSyncExternalStore } from 'react'

/** Full-screen views open over the home page; while any is, the page stops painting and its shader stops. */
let covers = 0
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** For an opaque view that fills the screen, for as long as it's mounted. */
export function useCoverPage() {
  useEffect(() => {
    covers += 1
    emit()
    return () => {
      covers -= 1
      emit()
    }
  }, [])
}

export function usePageCovered() {
  return useSyncExternalStore(subscribe, () => covers > 0)
}
