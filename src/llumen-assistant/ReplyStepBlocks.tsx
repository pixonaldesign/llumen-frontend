/**
 * The blocks of an answer told in turn: a step typed out in bold, a ranked list, and a row of
 * highlights with small pictures. Each plays in while it's the block being revealed (`animating`),
 * then calls `onComplete`; otherwise it renders settled.
 */
import { MapPin } from '@phosphor-icons/react'
import { useEffect, useState, type CSSProperties } from 'react'
import type { Highlight, HighlightVisual, RankingRow } from './assistantReplyTypes'
import styles from './ReplyStepBlocks.module.css'

type Play = {
  animating: boolean
  reduceMotion: boolean
  onComplete?: () => void
}

const CHAR_MS = 38
const DETAIL_MS = 700
const ROW_MS = 420
const HIGHLIGHT_MS = 1800

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

/** Calls `onComplete` once the block has played for `ms`, or straight away without motion. */
function useCompleteAfter(ms: number, { reduceMotion, onComplete }: Play) {
  useEffect(() => {
    if (!onComplete) return
    const timer = window.setTimeout(onComplete, reduceMotion ? 0 : ms)
    return () => window.clearTimeout(timer)
  }, [ms, reduceMotion, onComplete])
}

/** `text` typed out a character at a time; words stay whole so the line wraps as it will end up. */
function Typed({ text, play }: { text: string; play: boolean }) {
  if (!play) return <>{text}</>
  let index = 0
  return (
    <>
      {text.split(/(\s+)/).map((part, partIndex) => {
        if (/^\s+$/.test(part)) {
          index += part.length
          return part
        }
        return (
          <span key={partIndex} className={styles.word}>
            {[...part].map((char) => (
              <span key={index} className={styles.char} style={delay(index++ * CHAR_MS)}>
                {char}
              </span>
            ))}
          </span>
        )
      })}
    </>
  )
}

export function ReplyStep({ title, detail, ...play }: { title: string; detail?: string } & Play) {
  const typing = play.animating && !play.reduceMotion
  const typedMs = title.length * CHAR_MS
  useCompleteAfter(typedMs + (detail ? DETAIL_MS : 0), play)
  return (
    <div className={styles.step} data-play={typing || undefined}>
      <p className={styles.stepTitle}>
        <Typed text={title} play={typing} />
      </p>
      {detail ? (
        <p className={styles.stepDetail} style={delay(typedMs)}>
          {detail}
        </p>
      ) : null}
    </div>
  )
}

export function ReplyRanking({
  title,
  rows,
  visible,
  color,
  ...play
}: { title: string; rows: RankingRow[]; visible: number; color: string } & Play) {
  const [all, setAll] = useState(false)
  const playing = play.animating && !play.reduceMotion
  const shown = all ? rows : rows.slice(0, visible)
  useCompleteAfter(600 + visible * ROW_MS + 700, play)
  return (
    <div className={styles.ranking} data-play={playing || undefined} style={{ '--rank': color } as CSSProperties}>
      <p className={styles.rankingTitle}>{title}</p>
      <ol className={styles.rankingList}>
        {shown.map((row, index) => (
          <li key={row.name} className={styles.rankingRow} style={delay(600 + index * ROW_MS)}>
            <span className={styles.rankingBadge}>{row.rank}</span>
            <span className={styles.rankingName}>
              {row.name}
              {row.detail ? <span className={styles.rankingDetail}>{row.detail}</span> : null}
            </span>
            <span className={styles.rankingScore}>
              {row.change ? (
                <span className={styles.rankingChange} data-up={row.change > 0 || undefined}>
                  {row.change > 0 ? `▲ ${row.change}` : `▼ ${-row.change}`}
                </span>
              ) : null}
              <span className={styles.rankingScoreLabel}>score</span>
              <b>{row.score}</b>
            </span>
            <span className={styles.rankingBar}>
              <span style={{ width: `${row.score}%` }} />
            </span>
          </li>
        ))}
      </ol>
      {rows.length > visible ? (
        <button
          type="button"
          className={styles.rankingAll}
          style={delay(600 + visible * ROW_MS)}
          onClick={() => setAll((current) => !current)}
        >
          {all ? `Top ${visible} only` : 'View all'}
        </button>
      ) : null}
    </div>
  )
}

function HighlightPicture({ visual }: { visual: HighlightVisual }) {
  if (visual.kind === 'hours') {
    const max = Math.max(...visual.values)
    return (
      <div className={styles.hours}>
        <div className={styles.hoursBars}>
          {visual.values.map((value, index) => (
            <span
              key={index}
              style={{
                height: `${(value / max) * 100}%`,
                background: visual.peak.includes(index) ? visual.peakColor : visual.color,
                ...delay(index * 45),
              }}
            />
          ))}
        </div>
        <div className={styles.hoursLabels}>
          <span>{visual.labels[0]}</span>
          <span>{visual.labels[1]}</span>
        </div>
      </div>
    )
  }
  if (visual.kind === 'distance') {
    return (
      <div className={styles.distance}>
        <MapPin className={styles.pin} size={22} weight="fill" color={visual.color} aria-hidden />
        <span className={styles.distanceLine}>
          <span>{visual.label}</span>
        </span>
        <span className={styles.rivalDot} style={{ background: visual.rivalColor }} />
      </div>
    )
  }
  return (
    <div className={styles.turnIn}>
      <span className={styles.chevrons} data-side="left" aria-hidden>
        ››
      </span>
      <MapPin className={styles.pin} size={22} weight="fill" color={visual.color} aria-hidden />
      <span className={styles.chevrons} data-side="right" aria-hidden>
        ‹‹
      </span>
    </div>
  )
}

export function ReplyHighlights({ items, ...play }: { items: Highlight[] } & Play) {
  const playing = play.animating && !play.reduceMotion
  useCompleteAfter(items.length * HIGHLIGHT_MS + 600, play)
  return (
    <ul className={styles.highlights} data-play={playing || undefined}>
      {items.map((item, index) => (
        <li key={item.title} className={styles.highlight} style={{ '--item': `${index * HIGHLIGHT_MS}ms` } as CSSProperties}>
          <p className={styles.highlightTitle}>{item.title}</p>
          <p className={styles.highlightDetail}>{item.detail}</p>
          <HighlightPicture visual={item.visual} />
        </li>
      ))}
    </ul>
  )
}
