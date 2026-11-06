import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

type Drag = { id: string; grabY: number; clientY: number; offset: number }

const SLIDE = { duration: 160, easing: 'cubic-bezier(0.2, 0, 0, 1)' }

/**
 * Drag-to-reorder for a vertical list. A drag starts on an item's handle; the item follows the pointer and its
 * neighbours slide aside as it passes their middles. Arrow keys on the handle move the item by one.
 */
export function useSortable(ids: readonly string[], onMove: (from: number, to: number) => void) {
  const items = useRef(new Map<string, HTMLElement>())
  const tops = useRef(new Map<string, number>())
  const drag = useRef<Drag | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const order = ids.join('\n')

  const follow = (current: Drag, element: HTMLElement) => {
    const naturalTop = element.getBoundingClientRect().top - current.offset
    current.offset = current.clientY - current.grabY - naturalTop
    element.style.transform = `translateY(${current.offset}px)`
  }

  const move = (from: number, to: number) => {
    tops.current = new Map([...items.current].map(([id, element]) => [id, element.offsetTop]))
    onMove(from, to)
  }

  useLayoutEffect(() => {
    for (const [id, element] of items.current) {
      const before = tops.current.get(id)
      if (before === undefined) continue
      if (id === drag.current?.id) follow(drag.current, element)
      else if (before !== element.offsetTop) element.animate([{ transform: `translateY(${before - element.offsetTop}px)` }, { transform: 'none' }], SLIDE)
    }
    tops.current.clear()
  }, [order])

  const end = () => {
    const current = drag.current
    const element = current ? items.current.get(current.id) : undefined
    drag.current = null
    setDragging(null)
    if (!current || !element) return
    element.style.transform = ''
    if (current.offset) element.animate([{ transform: `translateY(${current.offset}px)` }, { transform: 'none' }], SLIDE)
  }

  const itemProps = (id: string) => ({
    ref: (element: HTMLDivElement | null) => {
      if (element) items.current.set(id, element)
      else items.current.delete(id)
    },
    'data-dragging': dragging === id || undefined,
  })

  const handleProps = (id: string) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      const element = items.current.get(id)
      if (event.button !== 0 || !element || ids.length < 2) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = { id, grabY: event.clientY - element.getBoundingClientRect().top, clientY: event.clientY, offset: 0 }
      setDragging(id)
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const current = drag.current
      const element = items.current.get(id)
      if (current?.id !== id || !element) return
      current.clientY = event.clientY
      follow(current, element)
      const center = element.offsetTop + current.offset + element.offsetHeight / 2
      const from = ids.indexOf(id)
      const to = ids.filter((other) => {
        const sibling = other === id ? undefined : items.current.get(other)
        return sibling ? sibling.offsetTop + sibling.offsetHeight / 2 < center : false
      }).length
      if (to !== from) move(from, to)
    },
    onPointerUp: end,
    onPointerCancel: end,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const from = ids.indexOf(id)
      const to = event.key === 'ArrowUp' ? from - 1 : event.key === 'ArrowDown' ? from + 1 : -1
      if (to < 0 || to >= ids.length) return
      event.preventDefault()
      move(from, to)
    },
  })

  return { itemProps, handleProps, dragging }
}
