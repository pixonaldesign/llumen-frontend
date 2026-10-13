import { Crosshair } from '@phosphor-icons/react'
import type { StoryAiSnapshot } from './storyAiScenarios'
import { useStoryMapStates } from './storyMapStates'
import styles from './StoryMapStateCard.module.css'

export type StoryMapStateCardProps = {
  stateId: string
  snapshot: StoryAiSnapshot
  title: string
  tag: string
  meta: string
}

export function StoryMapStateCard({ stateId, snapshot, title, tag, meta }: StoryMapStateCardProps) {
  const states = useStoryMapStates()
  const capture = states?.captures[stateId]
  const active = states?.activeStateId === stateId

  return (
    <button
      type="button"
      className={`${styles.card}${active ? ` ${styles.cardActive}` : ''}`}
      onClick={() => states?.restore(stateId, snapshot)}
      disabled={!states}
      aria-pressed={active}
      aria-label={`Show map view: ${title}`}
      title={title}
    >
      <div className={styles.media}>
        {capture ? (
          <img key={capture.image} className={styles.image} src={capture.image} alt="" />
        ) : (
          <div className={styles.placeholder} aria-hidden />
        )}
        <span className={styles.status}>
          {active ? 'Current view' : (
            <>
              <Crosshair size={12} weight="bold" aria-hidden />
              Snap to this view
            </>
          )}
        </span>
      </div>
      <div className={styles.body}>
        <span className={styles.tag}>{tag}</span>
        <span className={styles.title}>{title}</span>
        <span className={styles.meta}>Map view / {meta}</span>
      </div>
    </button>
  )
}
