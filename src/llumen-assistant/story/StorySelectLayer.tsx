import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { ArrowUp, BoundingBox, Selection, SquaresFour, X } from '@phosphor-icons/react'
import styles from './StorySelectLayer.module.css'

export type StorySelectTarget = { id: string; label: string }

/** Rectangle relative to the layer's root. */
export type StorySelectArea = { left: number; top: number; width: number; height: number }

export type StorySelection = { targets: StorySelectTarget[]; area: StorySelectArea | null }

type Rect = { left: number; top: number; width: number; height: number }

type Layout = {
  width: number
  height: number
  hover: Rect | null
  selected: { target: StorySelectTarget; rect: Rect }[]
}

const EMPTY_LAYOUT: Layout = { width: 0, height: 0, hover: null, selected: [] }

type Props = {
  rootRef: RefObject<HTMLElement | null>
  onExit: () => void
  suggestPrompt: (selection: StorySelection) => string
  describeArea?: (area: StorySelectArea) => string
  onSubmit: (selection: StorySelection, prompt: string) => void
}

const DRAG_THRESHOLD_PX = 5
const MIN_AREA_PX = 24
const PROMPT_WIDTH = 340
const PROMPT_GAP = 14
const EDGE = 16
const TYPE_INTERVAL_MS = 14
const TYPE_STEP = 2

function relativeRect(el: Element, root: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  const base = root.getBoundingClientRect()
  return { left: r.left - base.left, top: r.top - base.top, width: r.width, height: r.height }
}

function rectFromPoints(ax: number, ay: number, bx: number, by: number): Rect {
  return { left: Math.min(ax, bx), top: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.abs(by - ay) }
}

function boxStyle(rect: Rect) {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

/**
 * Story "design mode": hover and click insight components, or drag a rectangle on the map,
 * then prompt the assistant about the selection from a floating box.
 */
export function StorySelectLayer({ rootRef, onExit, suggestPrompt, describeArea, onSubmit }: Props) {
  const layerRef = useRef<HTMLDivElement>(null)
  const promptRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dragRef = useRef<{ x: number; y: number; target: StorySelectTarget | null; dragging: boolean } | null>(null)
  const typingRef = useRef<{ timer: number; full: string } | null>(null)
  const autoRef = useRef<{ key: string; text: string } | null>(null)
  const [hover, setHover] = useState<StorySelectTarget | null>(null)
  const [targets, setTargets] = useState<StorySelectTarget[]>([])
  const [area, setArea] = useState<StorySelectArea | null>(null)
  const [draft, setDraft] = useState<Rect | null>(null)
  const [text, setText] = useState('')
  const [promptHeight, setPromptHeight] = useState(132)
  const [layout, setLayout] = useState<Layout>(EMPTY_LAYOUT)

  const selection = useMemo<StorySelection>(() => ({ targets, area }), [targets, area])
  const hasSelection = targets.length > 0 || area !== null
  const selectionKey = `${targets.map((target) => target.id).join('|')}#${
    area ? [area.left, area.top, area.width, area.height].map(Math.round).join(',') : ''
  }`

  const stopTyping = useCallback(() => {
    if (typingRef.current) window.clearInterval(typingRef.current.timer)
    typingRef.current = null
  }, [])

  useEffect(() => stopTyping, [stopTyping])

  const measure = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const rectFor = (id: string) => {
      const el = root.querySelector(`[data-select-id="${id}"]`)
      return el ? relativeRect(el, root) : null
    }
    setLayout({
      width: root.clientWidth,
      height: root.clientHeight,
      hover: hover && !targets.some((item) => item.id === hover.id) ? rectFor(hover.id) : null,
      selected: targets.flatMap((target) => {
        const rect = rectFor(target.id)
        return rect ? [{ target, rect }] : []
      }),
    })
  }, [rootRef, hover, targets])

  useLayoutEffect(measure, [measure])

  useEffect(() => {
    let frame = 0
    const bump = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    window.addEventListener('resize', bump)
    window.addEventListener('scroll', bump, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', bump)
      window.removeEventListener('scroll', bump, true)
    }
  }, [measure])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      onExit()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onExit])

  useEffect(() => {
    const auto = autoRef.current
    if (!auto || auto.key === selectionKey) return
    stopTyping()
    autoRef.current = null
    setText((current) => (current === auto.text || !hasSelection ? '' : current))
  }, [selectionKey, hasSelection, stopTyping])

  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [text, hasSelection])

  useLayoutEffect(() => {
    const el = promptRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setPromptHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasSelection])

  const targetAt = useCallback(
    (clientX: number, clientY: number): StorySelectTarget | null => {
      const root = rootRef.current
      const layer = layerRef.current
      if (!root) return null
      for (const el of document.elementsFromPoint(clientX, clientY)) {
        if (layer?.contains(el)) continue
        const target = el.closest<HTMLElement>('[data-select-id]')
        if (!target || !root.contains(target)) continue
        return { id: target.dataset.selectId ?? '', label: target.dataset.selectLabel ?? 'Component' }
      }
      return null
    },
    [rootRef],
  )

  const toRootPoint = (clientX: number, clientY: number) => {
    const base = rootRef.current?.getBoundingClientRect()
    return { x: clientX - (base?.left ?? 0), y: clientY - (base?.top ?? 0) }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    dragRef.current = { x: event.clientX, y: event.clientY, target: targetAt(event.clientX, event.clientY), dragging: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) {
      const next = targetAt(event.clientX, event.clientY)
      setHover((current) => (current?.id === next?.id ? current : next))
      return
    }
    if (!drag.dragging) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_THRESHOLD_PX) return
      drag.dragging = true
      setHover(null)
    }
    const a = toRootPoint(drag.x, drag.y)
    const b = toRootPoint(event.clientX, event.clientY)
    setDraft(rectFromPoints(a.x, a.y, b.x, b.y))
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!drag) return
    if (drag.dragging) {
      const a = toRootPoint(drag.x, drag.y)
      const b = toRootPoint(event.clientX, event.clientY)
      const rect = rectFromPoints(a.x, a.y, b.x, b.y)
      setDraft(null)
      if (rect.width >= MIN_AREA_PX && rect.height >= MIN_AREA_PX) {
        setTargets([])
        setArea(rect)
      }
      return
    }
    const target = drag.target
    if (!target) {
      setTargets([])
      setArea(null)
      return
    }
    setArea(null)
    setTargets((current) =>
      current.some((item) => item.id === target.id)
        ? current.filter((item) => item.id !== target.id)
        : event.shiftKey || event.metaKey || current.length > 0
          ? [...current, target]
          : [target],
    )
  }

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const scroller = document
      .elementsFromPoint(event.clientX, event.clientY)
      .find((el) => !layerRef.current?.contains(el) && el.closest('#story-insight'))
      ?.closest<HTMLElement>('#story-insight')
    scroller?.scrollBy({ top: event.deltaY })
  }

  const fillSuggestion = () => {
    if (!hasSelection || text.trim() || autoRef.current?.key === selectionKey) return
    const full = suggestPrompt(selection)
    autoRef.current = { key: selectionKey, text: full }
    stopTyping()
    let length = 0
    const timer = window.setInterval(() => {
      length = Math.min(full.length, length + TYPE_STEP)
      setText(full.slice(0, length))
      if (length >= full.length) stopTyping()
    }, TYPE_INTERVAL_MS)
    typingRef.current = { timer, full }
  }

  const submit = () => {
    if (!hasSelection) return
    const prompt = (typingRef.current?.full ?? text).trim() || suggestPrompt(selection)
    stopTyping()
    onSubmit(selection, prompt)
  }

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const removeTarget = (id: string) => setTargets((current) => current.filter((item) => item.id !== id))

  const { width: rootWidth, height: rootHeight, hover: hoverRect, selected: selectedRects } = layout
  const anchor = area ?? selectedRects[selectedRects.length - 1]?.rect ?? null
  let promptPos: { left: number; top: number } | null = null
  if (anchor && hasSelection) {
    const clampLeft = (left: number) => Math.max(EDGE, Math.min(rootWidth - PROMPT_WIDTH - EDGE, left))
    const clampTop = (top: number) => Math.max(EDGE, Math.min(rootHeight - promptHeight - EDGE, top))
    if (area) {
      const below = area.top + area.height + PROMPT_GAP
      const top = below + promptHeight + EDGE <= rootHeight ? below : area.top - PROMPT_GAP - promptHeight
      promptPos = { left: clampLeft(area.left + area.width / 2 - PROMPT_WIDTH / 2), top: clampTop(top) }
    } else {
      const right = anchor.left + anchor.width + PROMPT_GAP
      const left = right + PROMPT_WIDTH + EDGE <= rootWidth ? right : anchor.left - PROMPT_GAP - PROMPT_WIDTH
      promptPos = { left: clampLeft(left), top: clampTop(anchor.top) }
    }
  }

  const areaSummary = area && describeArea ? describeArea(area) : ''

  return (
    <div ref={layerRef} className={styles.layer}>
      <div
        className={[styles.capture, hover ? styles.captureOverTarget : ''].filter(Boolean).join(' ')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragRef.current = null
          setDraft(null)
        }}
        onPointerLeave={() => {
          if (!dragRef.current) setHover(null)
        }}
        onWheel={onWheel}
      />

      {hoverRect && hover ? (
        <div className={`${styles.outline} ${styles.outlineHover}`} style={boxStyle(hoverRect)}>
          <span className={styles.tag}>{hover.label}</span>
        </div>
      ) : null}

      {selectedRects.map(({ target, rect }) => (
        <div key={target.id} className={`${styles.outline} ${styles.outlineSelected}`} style={boxStyle(rect)}>
          <span className={styles.tag}>{target.label}</span>
        </div>
      ))}

      {draft ? <div className={styles.area} style={boxStyle(draft)} /> : null}
      {area ? (
        <div className={`${styles.area} ${styles.areaSet}`} style={boxStyle(area)}>
          <span className={styles.tag}>
            <BoundingBox size={12} weight="bold" aria-hidden />
            Map area{areaSummary ? ` · ${areaSummary}` : ''}
          </span>
          <i className={styles.handle} data-corner="nw" />
          <i className={styles.handle} data-corner="ne" />
          <i className={styles.handle} data-corner="sw" />
          <i className={styles.handle} data-corner="se" />
        </div>
      ) : null}

      <div className={styles.banner} role="status">
        <Selection size={16} weight="bold" aria-hidden />
        <span>Click components or drag on the map to select</span>
        <kbd className={styles.kbd}>Esc</kbd>
        <button type="button" className={styles.bannerDone} onClick={onExit}>
          Done
        </button>
      </div>

      {promptPos ? (
        <div
          ref={promptRef}
          className={styles.prompt}
          style={{ left: promptPos.left, top: promptPos.top, width: PROMPT_WIDTH }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className={styles.chips}>
            {targets.map((target) => (
              <span key={target.id} className={styles.chip}>
                <SquaresFour size={12} weight="bold" aria-hidden />
                <span className={styles.chipLabel}>{target.label}</span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label={`Remove ${target.label}`}
                  onClick={() => removeTarget(target.id)}
                >
                  <X size={10} weight="bold" aria-hidden />
                </button>
              </span>
            ))}
            {area ? (
              <span className={styles.chip}>
                <BoundingBox size={12} weight="bold" aria-hidden />
                <span className={styles.chipLabel}>Map area{areaSummary ? ` · ${areaSummary}` : ''}</span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label="Remove map area"
                  onClick={() => setArea(null)}
                >
                  <X size={10} weight="bold" aria-hidden />
                </button>
              </span>
            ) : null}
          </div>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={text}
            rows={2}
            placeholder="Ask about the selection…"
            onFocus={fillSuggestion}
            onPointerDown={fillSuggestion}
            onChange={(event) => {
              stopTyping()
              setText(event.target.value)
            }}
            onKeyDown={onInputKeyDown}
          />
          <div className={styles.footer}>
            <span className={styles.hint}>
              {targets.length > 0 ? `${targets.length} selected` : 'Area selected'} · Enter to send
            </span>
            <button
              type="button"
              className={[styles.send, text.trim() ? styles.sendReady : ''].filter(Boolean).join(' ')}
              aria-label="Send"
              onClick={submit}
            >
              <ArrowUp size={14} weight="bold" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
