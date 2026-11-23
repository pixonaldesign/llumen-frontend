import { describeTarget, intendedElement, isInteractive, relativePoint } from './locators'
import type { DemoStep, DemoTarget } from './types'

const DRAG_THRESHOLD = 6
const DOUBLE_CLICK_MS = 400
const HOVER_DWELL_MS = 700
const GESTURE_IDLE_MS = 300
/** Keys worth replaying on their own; printable keys in a field are covered by `type`. */
const NAMED_KEYS = new Set(['Enter', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', ' '])

type TextField = HTMLInputElement | HTMLTextAreaElement | HTMLElement

const isTextField = (el: EventTarget | null): el is TextField =>
  (el instanceof HTMLInputElement && !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file'].includes(el.type)) ||
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLElement && el.isContentEditable)

const fieldValue = (el: TextField) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : (el.textContent ?? '')

const ignored = (node: EventTarget | null) => node instanceof Element && node.closest('[data-demo-ignore]') !== null

function keyName(event: KeyboardEvent) {
  const mods = [event.ctrlKey && 'Control', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta'].filter(Boolean)
  const key = event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key
  return [...mods, key].join('+')
}

/**
 * Listens to the whole document and reports clean, replayable steps. Pointer jitter is dropped on purpose: only the
 * element, where in it, and roughly when are kept, so replay can redo the motion smoothly.
 */
export function startCapture(onStep: (step: DemoStep) => void, startedAt: number) {
  const now = () => Math.round(performance.now() - startedAt)
  const cleanups: (() => void)[] = []
  const listen = <K extends keyof DocumentEventMap>(type: K, handler: (event: DocumentEventMap[K]) => void) => {
    const wrapped = (event: Event) => {
      if (!ignored(event.target)) handler(event as DocumentEventMap[K])
    }
    document.addEventListener(type, wrapped, { capture: true, passive: true })
    cleanups.push(() => document.removeEventListener(type, wrapped, { capture: true }))
  }

  let lastClick: { step: Extract<DemoStep, { kind: 'click' }>; el: Element; at: number } | null = null
  let pendingHover: Extract<DemoStep, { kind: 'hover' }> | null = null
  const emit = (step: DemoStep) => {
    flushTyping()
    flushWheel()
    if (pendingHover && step.kind === 'click' && pendingHover.target.label === step.target.label) pendingHover = null
    if (pendingHover) onStep(pendingHover)
    pendingHover = null
    onStep(step)
  }

  /* Typing: one step per field visit, holding the final text rather than each keystroke. */
  const initialValues = new WeakMap<Element, string>()
  let typing: { el: TextField; target: DemoTarget; t: number } | null = null
  const flushTyping = () => {
    if (!typing) return
    const { el, target, t } = typing
    typing = null
    const initial = initialValues.get(el) ?? ''
    const text = fieldValue(el)
    initialValues.set(el, text)
    if (text === initial) return
    const replace = initial !== '' && !text.startsWith(initial)
    const step: DemoStep = { kind: 'type', t, target, text: replace ? text : text.slice(initial.length), replace }
    if (pendingHover) onStep(pendingHover)
    pendingHover = null
    onStep(step)
  }
  listen('focusin', (event) => {
    if (isTextField(event.target)) initialValues.set(event.target, fieldValue(event.target))
  })
  listen('input', (event) => {
    const el = event.target
    if (!isTextField(el)) return
    if (typing && typing.el !== el) flushTyping()
    if (!typing) {
      if (!initialValues.has(el)) initialValues.set(el, '')
      const box = el.getBoundingClientRect()
      typing = { el, t: now(), target: describeTarget(el, [box.left + box.width / 2, box.top + box.height / 2]) }
    }
  })
  listen('focusout', (event) => {
    if (typing?.el === event.target) flushTyping()
  })

  listen('keydown', (event) => {
    if (event.repeat || event.isComposing) return
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') return
    const inField = isTextField(event.target)
    const modified = event.metaKey || event.ctrlKey || event.altKey
    if (inField && !modified && !['Enter', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    if (!modified && !NAMED_KEYS.has(event.key)) return
    if (inField && modified && ['a', 'c', 'v', 'x', 'z'].includes(event.key.toLowerCase())) return
    emit({ kind: 'key', t: now(), key: keyName(event) })
  })

  /* Pointer: press → release is a click unless it travelled, then it is a drag with its path. */
  let press: {
    el: Element
    target: DemoTarget
    at: [number, number]
    x: number
    y: number
    t: number
    startedAt: number
    button: 'left' | 'right'
    path: [number, number, number][]
    dragging: boolean
    /** Dragging a scrollbar: the scroll step already covers it. */
    scrolled: boolean
  } | null = null
  listen('pointerdown', (event) => {
    if (!event.isPrimary || event.button > 2 || event.button === 1) return
    window.clearTimeout(hoverTimer)
    const el = intendedElement(event.target as Element)
    press = {
      el,
      target: describeTarget(el, [event.clientX, event.clientY]),
      at: relativePoint(el, event.clientX, event.clientY),
      x: event.clientX,
      y: event.clientY,
      t: now(),
      startedAt: performance.now(),
      button: event.button === 2 ? 'right' : 'left',
      path: [],
      dragging: false,
      scrolled: false,
    }
  })
  listen('pointermove', (event) => {
    if (press) {
      const dx = event.clientX - press.x
      const dy = event.clientY - press.y
      if (!press.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) press.dragging = true
      if (press.dragging) press.path.push([Math.round(dx), Math.round(dy), Math.round(performance.now() - press.startedAt)])
      return
    }
    trackHover(event)
  })
  listen('pointerup', (event) => {
    if (!press || !event.isPrimary) return
    const current = press
    press = null
    if (current.scrolled) {
      flushScroll()
      lastClick = null
      return
    }
    if (current.dragging) {
      emit({ kind: 'drag', t: current.t, target: current.target, at: current.at, path: simplify(current.path) })
      lastClick = null
      return
    }
    if (
      lastClick &&
      lastClick.el === current.el &&
      current.button === 'left' &&
      performance.now() - lastClick.at < DOUBLE_CLICK_MS &&
      lastClick.step.clicks !== 2
    ) {
      lastClick.step.clicks = 2
      lastClick.at = performance.now()
      return
    }
    const step: Extract<DemoStep, { kind: 'click' }> = {
      kind: 'click',
      t: current.t,
      target: current.target,
      at: current.at,
      ...(current.button === 'right' ? { button: 'right' as const } : {}),
    }
    lastClick = { step, el: current.el, at: performance.now() }
    emit(step)
  })

  /* Hover: resting on something interactive without clicking it is worth showing. */
  let hoverEl: Element | null = null
  let hoverTimer = 0
  function trackHover(event: PointerEvent) {
    const raw = event.target instanceof Element ? event.target : null
    const el = raw ? intendedElement(raw) : null
    if (el === hoverEl) return
    hoverEl = el
    window.clearTimeout(hoverTimer)
    if (!el || !isInteractive(el) || ignored(el)) return
    const { clientX, clientY } = event
    const t = now()
    hoverTimer = window.setTimeout(() => {
      if (hoverEl !== el) return
      flushTyping()
      if (pendingHover) onStep(pendingHover)
      pendingHover = { kind: 'hover', t, target: describeTarget(el, [clientX, clientY]), at: relativePoint(el, clientX, clientY) }
    }, HOVER_DWELL_MS)
  }
  cleanups.push(() => window.clearTimeout(hoverTimer))

  /* Scrolling: settle on where each scroller ended up. A wheel that scrolled nothing (a map zoom) is kept as a wheel. */
  let wheel: { el: Element; x: number; y: number; deltaX: number; deltaY: number; t: number; scrolled: boolean } | null = null
  let wheelTimer = 0
  const scrolled = new Map<Element, { t: number; target: DemoTarget }>()
  let scrollTimer = 0
  function flushWheel() {
    window.clearTimeout(wheelTimer)
    if (wheel && !wheel.scrolled && (wheel.deltaX || wheel.deltaY)) {
      const el = intendedElement(wheel.el)
      onStep({
        kind: 'wheel',
        t: wheel.t,
        target: describeTarget(el, [wheel.x, wheel.y]),
        at: relativePoint(el, wheel.x, wheel.y),
        deltaX: Math.round(wheel.deltaX),
        deltaY: Math.round(wheel.deltaY),
      })
    }
    wheel = null
    flushScroll()
  }
  function flushScroll() {
    window.clearTimeout(scrollTimer)
    scrolled.forEach(({ t, target }, el) => {
      const scroller = el === document.documentElement ? document.scrollingElement ?? el : el
      onStep({ kind: 'scroll', t, target, top: Math.round(scroller.scrollTop), left: Math.round(scroller.scrollLeft) })
    })
    scrolled.clear()
  }
  listen('wheel', (event) => {
    if (!wheel) wheel = { el: event.target as Element, x: event.clientX, y: event.clientY, deltaX: 0, deltaY: 0, t: now(), scrolled: false }
    wheel.deltaX += event.deltaX
    wheel.deltaY += event.deltaY
    window.clearTimeout(wheelTimer)
    wheelTimer = window.setTimeout(flushWheel, GESTURE_IDLE_MS)
  })
  listen('scroll', (event) => {
    if (!wheel && !press) return
    const raw = event.target === document ? document.documentElement : (event.target as Element)
    if (wheel) wheel.scrolled = true
    if (press?.dragging) press.scrolled = true
    if (!scrolled.has(raw)) {
      const box = raw.getBoundingClientRect()
      const point: [number, number] = wheel ? [wheel.x, wheel.y] : [box.left + box.width / 2, box.top + box.height / 2]
      flushTyping()
      scrolled.set(raw, { t: now(), target: describeTarget(raw, point) })
    }
    window.clearTimeout(scrollTimer)
    scrollTimer = window.setTimeout(flushScroll, GESTURE_IDLE_MS)
  })

  return () => {
    flushTyping()
    flushWheel()
    if (pendingHover) onStep(pendingHover)
    pendingHover = null
    cleanups.forEach((cleanup) => cleanup())
  }
}

/** Keeps a drag's shape with far fewer points: one every ~40 ms, plus the last. */
function simplify(path: [number, number, number][]) {
  const out: [number, number, number][] = []
  for (const point of path) {
    const last = out[out.length - 1]
    if (!last || point[2] - last[2] >= 40) out.push(point)
  }
  const end = path[path.length - 1]
  if (end && out[out.length - 1] !== end) out.push(end)
  return out
}
