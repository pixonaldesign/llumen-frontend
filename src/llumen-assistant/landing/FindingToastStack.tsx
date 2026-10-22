import { useEffect, useMemo, useRef, useState } from 'react'
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
import type { LandingTellMeMorePayload } from './LandingHomeDefault'
import { relatedStoryId, type FindingToastInstance } from './findingDemoData'
import { FINDING_DISMISS_MS } from './findingAuroraSettings'
import styles from './FindingToastStack.module.css'

/** Cards behind the front in the preview stack. Front + this = 3 visible. */
const MAX_VISIBLE_BEHIND = 2
const STACK_CARD_HEIGHT = 168

export type FindingToastStackProps = {
  items: FindingToastInstance[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  /** Clears the entire finding stack (not just the front card). */
  onDismiss: () => void
  onTellMeMore?: (item: LandingTellMeMorePayload) => void
  onMonitor?: (item: FindingToastInstance) => void
  onOpenRelated?: (item: FindingToastInstance) => void
  /** Float the stack over the chat. Notices never spawn an aurora. */
  overlay?: boolean
}

export function FindingToastStack({
  items,
  activeIndex,
  onActiveIndexChange,
  onDismiss,
  onTellMeMore,
  onMonitor,
  onOpenRelated,
  overlay = false,
}: FindingToastStackProps) {
  const [votes, setVotes] = useState<Record<string, 'up' | 'down' | null>>({})
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  const stackKey = items.map((item) => item.instanceId).join('|')

  useEffect(() => {
    if (items.length === 0) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => onDismissRef.current(), reduce ? 0 : FINDING_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [items.length, stackKey])

  const safeIndex = items.length === 0 ? 0 : Math.min(Math.max(activeIndex, 0), items.length - 1)
  const active = items[safeIndex]

  const stackOrder = useMemo(() => {
    if (items.length === 0) return []
    const remaining = Math.max(0, items.length - 1 - safeIndex)
    const visibleBehind = Math.min(MAX_VISIBLE_BEHIND, remaining)
    return items
      .map((item, index) => ({ item, index, depth: index - safeIndex }))
      .filter(({ depth }) => depth >= 0 && depth <= visibleBehind)
  }, [items, safeIndex])

  if (!active) return null

  const atStart = safeIndex <= 0
  const atEnd = safeIndex >= items.length - 1

  const goPrev = () => {
    if (atStart) return
    onActiveIndexChange(safeIndex - 1)
  }

  const goNext = () => {
    if (atEnd) return
    onActiveIndexChange(safeIndex + 1)
  }

  const vote = votes[active.instanceId] ?? null

  return (
    <div
      className={`${styles.root}${overlay ? ` ${styles.overChat}` : ''}`}
      data-finding-toasts=""
      data-auto-dismiss="true"
      role="region"
      aria-label="Finding notifications"
    >
      <button
        type="button"
        className={styles.navBtn}
        aria-label="Previous finding"
        disabled={atStart}
        onClick={goPrev}
      >
        <CaretLeft size={18} weight="bold" aria-hidden />
      </button>

      <div className={styles.stackWrap}>
        {stackOrder
          .filter(({ depth }) => depth <= MAX_VISIBLE_BEHIND)
          .sort((a, b) => b.depth - a.depth)
          .map(({ item, depth }) => {
            const isFront = depth === 0
            // Stack upward away from the chatbox: behind cards rise + shrink.
            // Box geometry (not transform) so peek backdrop-filter can sample the landing.
            const scale = 1 - depth * 0.06
            const lift = depth * 28
            const insetPct = ((1 - scale) / 2) * 100
            return (
              <article
                key={item.instanceId}
                className={`${styles.card}${isFront ? ` ${styles.cardFront}` : ` ${styles.cardBehind}`}`}
                style={{
                  zIndex: MAX_VISIBLE_BEHIND - depth + 1,
                  bottom: lift,
                  height: scale * STACK_CARD_HEIGHT,
                  left: `${insetPct}%`,
                  right: `${insetPct}%`,
                }}
                aria-hidden={!isFront}
                aria-label={isFront ? `${item.domain}. ${item.title}` : undefined}
              >
                {isFront ? (
                  <>
                    <div className={styles.body}>
                      <div className={styles.content}>
                        <div className={styles.topRow}>
                          <p className={styles.domain}>{item.domain}</p>
                          <button
                            type="button"
                            className={styles.dismiss}
                            aria-label="Dismiss findings"
                            onClick={onDismiss}
                            style={{ ['--toast-dismiss' as string]: `${FINDING_DISMISS_MS}ms` }}
                          >
                            <X size={12} weight="bold" aria-hidden />
                            <svg key={stackKey} className={styles.dismissRing} viewBox="0 0 24 24" overflow="visible" aria-hidden>
                              <circle
                                className={styles.dismissRingTrack}
                                cx="12"
                                cy="12"
                                r="9"
                                fill="none"
                                stroke="rgba(255,255,255,0.22)"
                                strokeWidth="1.5"
                              />
                              <circle
                                className={styles.dismissRingProgress}
                                cx="12"
                                cy="12"
                                r="9"
                                fill="none"
                                stroke="rgba(255,255,255,0.92)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                pathLength="100"
                              />
                            </svg>
                          </button>
                        </div>

                        <p className={styles.finding}>
                          {item.before}
                          <span className={styles.findingHighlight}>{item.highlight}</span>
                          {item.after}
                        </p>
                      </div>

                      <div className={styles.actions}>
                        <div className={styles.actionGroup}>
                          <button type="button" className={styles.actionBtn} onClick={() => onMonitor?.(item)}>
                            <Broadcast size={16} weight="regular" aria-hidden />
                            Keep monitoring
                          </button>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() =>
                              onTellMeMore?.({
                                id: item.id,
                                title: item.title,
                                domain: item.domain,
                                finding: `${item.before}${item.highlight}${item.after}`.trim(),
                              })
                            }
                          >
                            <ChatText size={16} weight="regular" aria-hidden />
                            Tell me more
                          </button>
                          <div className={styles.voteGroup}>
                          <button
                            type="button"
                            className={`${styles.voteBtn}${vote === 'up' ? ` ${styles.voteBtnActive}` : ''}`}
                            aria-label="Show more like this"
                            aria-pressed={vote === 'up'}
                            onClick={() =>
                              setVotes((prev) => ({
                                ...prev,
                                [item.instanceId]: prev[item.instanceId] === 'up' ? null : 'up',
                              }))
                            }
                          >
                            <ThumbsUp size={16} weight={vote === 'up' ? 'fill' : 'regular'} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={`${styles.voteBtn}${vote === 'down' ? ` ${styles.voteBtnActive}` : ''}`}
                            aria-label="Not interested"
                            aria-pressed={vote === 'down'}
                            onClick={() =>
                              setVotes((prev) => ({
                                ...prev,
                                [item.instanceId]: prev[item.instanceId] === 'down' ? null : 'down',
                              }))
                            }
                          >
                            <ThumbsDown
                              size={16}
                              weight={vote === 'down' ? 'fill' : 'regular'}
                              aria-hidden
                            />
                          </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={styles.linkBtn}
                          onClick={() => onOpenRelated?.(item)}
                          disabled={!relatedStoryId(item)}
                        >
                          <ArrowUpRight size={16} weight="regular" aria-hidden />
                          View
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div
                    className={styles.cardBehindScrim}
                    aria-hidden
                    style={{ background: `rgba(0, 0, 0, ${0.1 + depth * 0.12})` }}
                  />
                )}
              </article>
            )
          })}
      </div>

      <button
        type="button"
        className={styles.navBtn}
        aria-label="Next finding"
        disabled={atEnd}
        onClick={goNext}
      >
        <CaretRight size={18} weight="bold" aria-hidden />
      </button>
    </div>
  )
}
