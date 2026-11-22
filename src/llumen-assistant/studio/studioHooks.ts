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

const NONE: string[] = []

export const SORTS = ['Default', 'Last Updated', 'Name (A-Z)', 'Name (Z-A)'] as const
export type Sort = (typeof SORTS)[number]

/** A list ordered by one of its columns, from a click on that column's header. */
export type Order<O extends string = string> = { key: O; desc: boolean }

/**
 * Search, column filters and sort over a list: every filter offers the values its column holds, any
 * number of which can be picked (none means all), and Last Updated sorts newest first. Lists with sortable
 * column headers pass `orders`; a header order and the sort menu replace each other.
 */
export function useRefine<T, K extends string, O extends string = never>(
  items: readonly T[],
  {
    text,
    name,
    updated,
    fields,
    orders,
  }: {
    text: (item: T) => string
    name: (item: T) => string
    updated: (item: T) => string
    fields: Record<K, (item: T) => string>
    /** Each sortable column's value; ascending numbers or A–Z text first. */
    orders?: Record<O, (item: T) => string | number>
  },
) {
  const [query, setQuery] = useState('')
  const [sort, setSortState] = useState<Sort>('Default')
  const [order, setOrderState] = useState<Order | null>(null)
  const [filters, setFilters] = useState<Partial<Record<K, string[]>>>({})
  const setSort = (next: Sort) => {
    setSortState(next)
    setOrderState(null)
  }
  const setOrder = (next: Order | null) => {
    setOrderState(next)
    setSortState('Default')
  }
  const keys = Object.keys(fields) as K[]
  const options = {} as Record<K, string[]>
  for (const key of keys) options[key] = [...new Set(items.map((item) => fields[key](item)))]
  const needle = query.trim().toLowerCase()
  const rows = items.filter(
    (item) =>
      (!needle || text(item).toLowerCase().includes(needle)) &&
      keys.every((key) => !filters[key]?.length || filters[key].includes(fields[key](item))),
  )
  if (sort === 'Last Updated') rows.sort((a, b) => ageMinutes(updated(a)) - ageMinutes(updated(b)))
  if (sort === 'Name (A-Z)') rows.sort((a, b) => name(a).localeCompare(name(b)))
  if (sort === 'Name (Z-A)') rows.sort((a, b) => name(b).localeCompare(name(a)))
  const by = order && orders && order.key in orders ? orders[order.key as O] : null
  if (order && by) {
    rows.sort((a, b) => {
      const x = by(a)
      const y = by(b)
      const ascending = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return order.desc ? -ascending : ascending
    })
  }
  return {
    query,
    setQuery,
    sort,
    setSort,
    order,
    setOrder,
    options,
    filter: (key: K) => filters[key] ?? NONE,
    setFilter: (key: K, values: string[]) => setFilters((prev) => ({ ...prev, [key]: values })),
    filtered: keys.some((key) => filters[key]?.length),
    clearFilters: () => setFilters({}),
    rows,
  }
}
