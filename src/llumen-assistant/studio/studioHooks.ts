import { useEffect, useState, type RefObject } from 'react'
import { ageMinutes } from './studioData'

/** Closes a popover on an outside press or Escape; `portal` is a popover rendered outside `ref`. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
  portal?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (ref.current?.contains(target) || portal?.current?.contains(target)) return
      close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [ref, open, close, portal])
}

export const SORTS = ['Default', 'Last Updated', 'Name (A-Z)', 'Name (Z-A)'] as const
export type Sort = (typeof SORTS)[number]

/**
 * Search, column filters and sort over a list: every filter offers All plus the values its column
 * holds, and Last Updated sorts newest first.
 */
export function useRefine<T, K extends string>(
  items: readonly T[],
  {
    text,
    name,
    updated,
    fields,
  }: {
    text: (item: T) => string
    name: (item: T) => string
    updated: (item: T) => string
    fields: Record<K, (item: T) => string>
  },
) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('Default')
  const [filters, setFilters] = useState<Partial<Record<K, string>>>({})
  const keys = Object.keys(fields) as K[]
  const options = {} as Record<K, string[]>
  for (const key of keys) options[key] = ['All', ...new Set(items.map((item) => fields[key](item)))]
  const needle = query.trim().toLowerCase()
  const rows = items.filter(
    (item) =>
      (!needle || text(item).toLowerCase().includes(needle)) &&
      keys.every((key) => !filters[key] || filters[key] === 'All' || fields[key](item) === filters[key]),
  )
  if (sort === 'Last Updated') rows.sort((a, b) => ageMinutes(updated(a)) - ageMinutes(updated(b)))
  if (sort === 'Name (A-Z)') rows.sort((a, b) => name(a).localeCompare(name(b)))
  if (sort === 'Name (Z-A)') rows.sort((a, b) => name(b).localeCompare(name(a)))
  return {
    query,
    setQuery,
    sort,
    setSort,
    options,
    filter: (key: K) => filters[key] ?? 'All',
    setFilter: (key: K, value: string) => setFilters((prev) => ({ ...prev, [key]: value })),
    rows,
  }
}
