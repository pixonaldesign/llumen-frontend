import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Broadcast,
  CaretLeft,
  CaretRight,
  ChatText,
  ThumbsDown,
  ThumbsUp,
  X,
} from '@phosphor-icons/react'
import { Aurora } from './Aurora'
import {
  DEFAULT_FINDING_AURORA,
  FINDING_EXIT_MS,
  STAGED_AURORA_PHASE1_MS,
  type FindingAuroraSettings,
} from './findingAuroraSettings'
import { relatedStoryId, type FindingToastInstance } from './findingDemoData'
import styles from './FindingReveal.module.css'

/** Top of the Briefing findings section, under the top bar; keep in step with FindingReveal.module.css. */
const CENTRE_TOP_PX = 64
/** Centre mode: the line draws and the aurora grows before the copy comes in. */
const CENTRE_COPY_DELAY_MS = 900

function pageColumnInset(): number {
  if (typeof window === 'undefined') return 24
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--space-3xl')
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : 24
}

function blurGeometry(
  labelTop: number | null,
  chatTop: number | null,
  blurFade: number,
  blurLift: number,
  viewportH: number,
  pageColumn: boolean,
) {
  const max = Math.max(0, viewportH - 16)
  const fade = Math.round(Math.min(Math.max(blurFade, 0), max))
  const base = labelTop == null ? viewportH * 0.42 : Math.max(0, viewportH - labelTop)
  const hold = Math.round(Math.min(Math.max(0, base + blurLift), max))
  const anchor =
    chatTop == null
      ? pageColumn
        ? pageColumnInset()
        : 0
      : Math.max(0, Math.round(viewportH - chatTop))
  return { hold, fade, anchor }
}

function initialBlurGeom(settings: FindingAuroraSettings) {
  const viewportH = typeof window === 'undefined' ? 1000 : window.innerHeight
  return blurGeometry(null, null, settings.blurFade, settings.blurLift, viewportH, false)
}

function visibleChatTop(skipRailComposer: boolean): number | null {
  const toasts = document.querySelector('[data-finding-toasts]')
  if (toasts instanceof HTMLElement) {
    const rect = toasts.getBoundingClientRect()
    if (rect.width >= 8 && rect.height >= 8) return rect.top
  }
  const hub = document.querySelector('[data-lc-hub-chat]')
  const rail = skipRailComposer ? null : document.querySelector('[data-lc-composer]')
  for (const node of [hub, rail]) {
    if (!(node instanceof HTMLElement)) continue
    const rect = node.getBoundingClientRect()
    if (rect.width < 8 || rect.height < 8) continue
    const style = getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue
    return rect.top
  }
  return null
}

function splitWordSpaceSegments(text: string): { text: string; isWord: boolean }[] {
  const segments: { text: string; isWord: boolean }[] = []
  const re = /\S+|\s+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    segments.push({ text: m[0], isWord: /\S/.test(m[0]) })
  }
  return segments
}

function FindingSentence({
  item,
  reduceMotion,
  staggerMs,
}: {
  item: FindingToastInstance
  reduceMotion: boolean
  staggerMs: number
}) {
  const parts = [
    { text: item.before, highlight: false },
    { text: item.highlight, highlight: true },
    { text: item.after, highlight: false },
  ]
  const beforeWords = splitWordSpaceSegments(item.before).filter((seg) => seg.isWord).length
  const highlightWords = splitWordSpaceSegments(item.highlight).filter((seg) => seg.isWord).length
  const underlineAt = highlightWords === 0 ? 0 : (beforeWords + highlightWords - 1) * staggerMs + 440
  const [underlined, setUnderlined] = useState(reduceMotion || highlightWords === 0)

  useEffect(() => {
    if (reduceMotion || highlightWords === 0) {
      setUnderlined(true)
      return
    }
    setUnderlined(false)
    const timer = window.setTimeout(() => setUnderlined(true), underlineAt)
    return () => window.clearTimeout(timer)
  }, [item.before, item.highlight, reduceMotion, highlightWords, underlineAt])

  if (reduceMotion) {
    return (
      <p className={styles.finding}>
        {item.before}
        <span className={`${styles.findingHighlight} ${styles.findingHighlightReady}`}>{item.highlight}</span>
        {item.after}
      </p>
    )
  }

  let wordIndex = 0
  return (
    <p className={styles.finding}>
      {parts.map((part, partIndex) => {
        const nodes = splitWordSpaceSegments(part.text).map((seg, segIndex) => {
          if (!seg.isWord) {
            return <span key={`sp-${partIndex}-${segIndex}`}>{seg.text}</span>
          }
          const delay = wordIndex * staggerMs
          wordIndex += 1
          return (
            <span
              key={`w-${partIndex}-${segIndex}`}
              className={styles.wordReveal}
              style={{ animationDelay: `${delay}ms` }}
            >
              {seg.text}
            </span>
          )
        })
        if (!part.highlight) return nodes
        return (
          <span
            key={`h-${partIndex}`}
            className={`${styles.findingHighlight}${underlined ? ` ${styles.findingHighlightReady}` : ''}`}
          >
            {nodes}
          </span>
        )
      })}
    </p>
  )
}

export type FindingRevealProps = {
  items: FindingToastInstance[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  /** Clears every finding and the aurora. */
  onClose: () => void
  onMonitor: (item: FindingToastInstance) => void
  onTellMeMore: (item: FindingToastInstance) => void
  onOpenRelated: (item: FindingToastInstance) => void
  settings?: FindingAuroraSettings
  /** Shift the finding copy out from under the open chat rail. */
  railOpen?: boolean
  /** Thread rail is the conversation. Anchor the copy to the page column, not that composer. */
  pageColumnAnchor?: boolean
  /** Story ribbon sits above the viewport edge. Pad the finding to meet it. */
  storyMode?: boolean
  /**
   * Briefing findings style 5, on the findings section: the aurora grows up and down from a line across
   * the middle of the section, and the copy takes the place of the composer and findings there.
   */
  centre?: boolean
  /** With centre: wait, aurora unmounted, while the composer's border cue plays. */
  held?: boolean
  /** Increment to play the exit, then call onClose. */
  dismissSignal?: number
  /** Shortcut: show a little of the aurora, hold, then open the mask fully. */
  stagedReveal?: boolean
  /** Bumps to replay the staged mask. */
  revealNonce?: number
}

/**
 * React Bits aurora along the viewport base, with the finding copy
 * offset to the top of the chat box.
 */
export function FindingReveal({
  items,
  activeIndex,
  onActiveIndexChange,
  onClose,
  onMonitor,
  onTellMeMore,
  onOpenRelated,
  settings = DEFAULT_FINDING_AURORA,
  railOpen = false,
  pageColumnAnchor = false,
  storyMode = false,
  centre = false,
  held = false,
  dismissSignal = 0,
  stagedReveal = false,
  revealNonce = 0,
}: FindingRevealProps) {
  const domainRef = useRef<HTMLParagraphElement>(null)
  const veilRef = useRef<HTMLDivElement>(null)
  const auroraBoxRef = useRef<HTMLDivElement>(null)
  const [copyVisible, setCopyVisible] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [blurGeom, setBlurGeom] = useState(() => initialBlurGeom(settings))
  const [geomSettled, setGeomSettled] = useState(false)
  const [auroraReady, setAuroraReady] = useState(false)
  const [exiting, setExiting] = useState(false)
  const seenDismiss = useRef(dismissSignal)
  const [votes, setVotes] = useState<Record<string, 'up' | 'down' | null>>({})

  const [viewportH, setViewportH] = useState(() => (typeof window === 'undefined' ? 1000 : window.innerHeight))

  const safeIndex = items.length === 0 ? 0 : Math.min(Math.max(activeIndex, 0), items.length - 1)
  const active = items[safeIndex]
  const waiting = centre && held

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setReduceMotion(reduce)
    if (waiting) {
      setCopyVisible(false)
      return
    }
    if (reduce) {
      setCopyVisible(true)
      return
    }
    setCopyVisible(false)
    const copyDelay = centre ? CENTRE_COPY_DELAY_MS : stagedReveal ? STAGED_AURORA_PHASE1_MS : settings.copyDelayMs
    const copyTimer = window.setTimeout(() => setCopyVisible(true), copyDelay)
    return () => window.clearTimeout(copyTimer)
  }, [settings.copyDelayMs, stagedReveal, revealNonce, centre, waiting])

  useLayoutEffect(() => {
    const measure = () => {
      const viewport = window.innerHeight
      const chatTop = visibleChatTop(pageColumnAnchor)
      const label = domainRef.current
      const next = blurGeometry(
        label ? label.getBoundingClientRect().top : null,
        chatTop,
        settings.blurFade,
        settings.blurLift,
        viewport,
        pageColumnAnchor,
      )
      setBlurGeom((prev) =>
        prev.hold === next.hold && prev.fade === next.fade && prev.anchor === next.anchor ? prev : next,
      )
      setViewportH(viewport)
    }
    measure()
    setGeomSettled(true)
    const observed = document.querySelector('[data-lc-hub-chat], [data-lc-composer]')
    const observer = new ResizeObserver(measure)
    if (observed) observer.observe(observed)
    window.addEventListener('resize', measure)
    const timer = window.setInterval(measure, 180)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.clearInterval(timer)
    }
  }, [active?.instanceId, copyVisible, settings.blurFade, settings.blurLift, settings.showCopy, railOpen, pageColumnAnchor])

  useEffect(() => {
    if (dismissSignal === seenDismiss.current) return
    seenDismiss.current = dismissSignal
    if (!active) return
    if (reduceMotion) {
      onClose()
      return
    }
    setExiting(true)
  }, [dismissSignal, active, reduceMotion, onClose])

  useEffect(() => {
    if (!exiting) return
    const timer = window.setTimeout(onClose, FINDING_EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [exiting, onClose])

  useEffect(() => {
    if (active) return
    setExiting(false)
  }, [active])

  useLayoutEffect(() => {
    if (!stagedReveal || !auroraReady) return
    for (const node of [veilRef.current, auroraBoxRef.current]) {
      if (!node) continue
      node.style.animation = 'none'
      void node.offsetWidth
      node.style.animation = ''
    }
  }, [stagedReveal, auroraReady, revealNonce])

  const canNavigate = items.length > 1

  const veilStyle = {
    ['--aurora-blur' as string]: `${settings.blurStrength}px`,
    ['--aurora-blur-hold' as string]: `${blurGeom.hold}px`,
    ['--aurora-blur-fade' as string]: `${blurGeom.fade}px`,
    ['--aurora-anchor' as string]: `${blurGeom.anchor}px`,
  }
  /** From the centre line to the top bar or the viewport base. */
  const halfSection = Math.max(120, (viewportH - CENTRE_TOP_PX) / 2)

  return (
    <>
      {centre && !waiting ? (
        <div
          className={styles.centreLine}
          data-exiting={exiting ? 'true' : 'false'}
          style={{
            ['--line-1' as string]: settings.colorStop1,
            ['--line-2' as string]: settings.colorStop2,
            ['--line-3' as string]: settings.colorStop3,
          }}
          aria-hidden
        />
      ) : null}
      <div
        ref={veilRef}
        className={styles.veil}
        data-exiting={exiting ? 'true' : 'false'}
        data-ready={auroraReady ? 'true' : 'false'}
        data-staged={stagedReveal ? 'true' : 'false'}
        data-centre={centre ? 'true' : 'false'}
        style={veilStyle}
      >
        <div className={styles.veilBlur} data-level="1" />
        <div className={styles.veilBlur} data-level="2" />
        <div className={styles.veilBlur} data-level="3" />
        <div className={styles.veilBlur} data-level="4" />
      </div>
      <div
        ref={auroraBoxRef}
        className={styles.aurora}
        data-exiting={exiting ? 'true' : 'false'}
        data-ready={auroraReady ? 'true' : 'false'}
        data-staged={stagedReveal ? 'true' : 'false'}
        data-centre={centre ? 'true' : 'false'}
        style={veilStyle}
        aria-hidden
      >
        {geomSettled && !waiting ? (
          <Aurora
            colorStops={[settings.colorStop1, settings.colorStop2, settings.colorStop3]}
            amplitude={settings.amplitude}
            blend={settings.blend}
            speed={settings.speed}
            streaks={settings.streaks ?? 0.24}
            highlights={settings.highlights ?? 0.04}
            fadeHold={centre ? halfSection * 0.3 : blurGeom.hold}
            fadeSpan={centre ? halfSection * 0.28 : blurGeom.fade}
            mirror={centre}
            onReady={() => setAuroraReady(true)}
          />
        ) : null}
      </div>
      {items.length > 0 ? (
        <div
          className={styles.copy}
          data-rail={railOpen ? 'true' : 'false'}
          data-story={storyMode ? 'true' : 'false'}
          data-centre={centre ? 'true' : 'false'}
          data-exiting={exiting ? 'true' : 'false'}
          style={veilStyle}
        >
          {active && settings.showCopy ? (
          <div
            className={`${styles.copyCluster}${copyVisible ? '' : ` ${styles.copyClusterPending}`}`}
            key={active.instanceId}
          >
            <div className={styles.header}>
              <p ref={domainRef} className={styles.domain}>{active.domain}</p>
              <div className={styles.headerEnd}>
                {canNavigate ? (
                  <div className={styles.nav}>
                    <button
                      type="button"
                      className={styles.navBtn}
                      aria-label="Previous finding"
                      onClick={() => onActiveIndexChange((safeIndex - 1 + items.length) % items.length)}
                    >
                      <CaretLeft size={16} weight="bold" aria-hidden />
                    </button>
                    <span className={styles.navCount}>
                      {safeIndex + 1} / {items.length}
                    </span>
                    <button
                      type="button"
                      className={styles.navBtn}
                      aria-label="Next finding"
                      onClick={() => onActiveIndexChange((safeIndex + 1) % items.length)}
                    >
                      <CaretRight size={16} weight="bold" aria-hidden />
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className={styles.close}
                  aria-label="Close findings"
                  onClick={() => {
                    if (reduceMotion) onClose()
                    else setExiting(true)
                  }}
                >
                  <X size={14} weight="bold" aria-hidden />
                </button>
              </div>
            </div>
            <FindingSentence item={active} reduceMotion={reduceMotion} staggerMs={settings.wordStaggerMs} />
            <div className={styles.actions}>
              <div className={styles.actionGroup}>
                <button type="button" className={styles.actionBtn} onClick={() => onMonitor(active)}>
                  <Broadcast size={16} weight="regular" aria-hidden />
                  Keep monitoring
                </button>
                <button type="button" className={styles.actionBtn} onClick={() => onTellMeMore(active)}>
                  <ChatText size={16} weight="regular" aria-hidden />
                  Tell me more
                </button>
                <div className={styles.voteGroup}>
                <button
                  type="button"
                  className={`${styles.voteBtn}${votes[active.instanceId] === 'up' ? ` ${styles.voteBtnActive}` : ''}`}
                  aria-label="Show more like this"
                  aria-pressed={votes[active.instanceId] === 'up'}
                  onClick={() =>
                    setVotes((prev) => ({
                      ...prev,
                      [active.instanceId]: prev[active.instanceId] === 'up' ? null : 'up',
                    }))
                  }
                >
                  <ThumbsUp size={16} weight={votes[active.instanceId] === 'up' ? 'fill' : 'regular'} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${styles.voteBtn}${votes[active.instanceId] === 'down' ? ` ${styles.voteBtnActive}` : ''}`}
                  aria-label="Not interested"
                  aria-pressed={votes[active.instanceId] === 'down'}
                  onClick={() =>
                    setVotes((prev) => ({
                      ...prev,
                      [active.instanceId]: prev[active.instanceId] === 'down' ? null : 'down',
                    }))
                  }
                >
                  <ThumbsDown size={16} weight={votes[active.instanceId] === 'down' ? 'fill' : 'regular'} aria-hidden />
                </button>
                </div>
              </div>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.viewBtn}`}
                onClick={() => onOpenRelated(active)}
                disabled={!relatedStoryId(active)}
              >
                <ArrowUpRight size={20} weight="regular" aria-hidden />
                View
              </button>
            </div>
          </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
