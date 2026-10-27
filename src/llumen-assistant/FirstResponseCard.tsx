import { useEffect, useState, type ReactNode } from 'react'
import { ArrowsOutSimple, X } from '@phosphor-icons/react'
import type { FirstResponse } from './firstResponseDemo'
import { InteractiveMap } from './InteractiveMap'
import { AssetCard } from './landing/BriefingAssets'
import type { BriefingAsset } from './landing/briefingAssetData'
import { StoryReplyChart } from './story/StoryReplyChart'
import type { WorkflowProposal } from './assistantReplyTypes'
import { WorkflowProposalCard } from './WorkflowProposalCard'
import cardStyles from './WorkflowProposalCard.module.css'
import timelineStyles from './AssistantTimelineReply.module.css'
import styles from './FirstResponseCard.module.css'

const LOADER_STEP_MS = 1100

/** Holds the container's place while the answer is worked out, running through the reply's steps like the chat does. */
export function FirstResponseLoader({ steps, onDone }: { steps: string[]; onDone: () => void }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const timer = window.setTimeout(() => (index < steps.length - 1 ? setIndex(index + 1) : onDone()), LOADER_STEP_MS)
    return () => window.clearTimeout(timer)
  }, [index, steps.length, onDone])
  return (
    <div className={`${cardStyles.wrap} ${styles.wrap}`} data-size="compact">
      <article className={cardStyles.card} aria-busy="true">
        <div className={styles.loader} aria-live="polite">
          <div key={index} className={timelineStyles.statusLine}>
            <span className={`${timelineStyles.stepTitle} ${timelineStyles.stepTitleShimmer} ${styles.loaderText}`}>
              {steps[index] ?? 'Working on it…'}
            </span>
          </div>
        </div>
      </article>
    </div>
  )
}

/** A My Board asset card, playing in as the container lands. */
function BoardAsset({ asset }: { asset: BriefingAsset }) {
  const [play, setPlay] = useState(false)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPlay(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])
  return <AssetCard asset={asset} play={play} delay={0} spark={false} />
}

function Visual({ response, map }: { response: FirstResponse; map?: ReactNode }) {
  const preview = response.component?.preview
  if (response.kind === 'chart' && preview?.kind === 'story-chart') {
    return (
      <div className={styles.visual}>
        <StoryReplyChart chart={preview.chart} />
      </div>
    )
  }
  if (response.kind === 'kpi' && response.asset) {
    return (
      <div className={`${styles.visual} ${styles.kpiAsset}`}>
        <BoardAsset asset={response.asset} />
      </div>
    )
  }
  if (response.kind === 'map') {
    return (
      <div className={`${styles.visual} ${styles.visualMap}`}>
        {map ? (
          <div className={styles.map}>{map}</div>
        ) : (
          <InteractiveMap className={styles.map} showControls={false} scrollZoom={false} />
        )}
      </div>
    )
  }
  return null
}

/** The first answer to a prompt sent from the AI bar, floating over it until it opens full screen. */
export function FirstResponseCard({
  response,
  onExpand,
  onClose,
  onOpenWorkflow,
  onRunFailed,
  map,
}: {
  response: FirstResponse
  /** The map answer's own map, with what the reply annotated on it; a plain map otherwise. */
  map?: ReactNode
  /** Opens the full-screen conversation behind the container. */
  onExpand: () => void
  onClose: () => void
  onOpenWorkflow?: (proposal: WorkflowProposal) => void
  onRunFailed?: (proposal: WorkflowProposal) => void
}) {
  if (response.kind === 'workflow' && response.proposal) {
    return (
      <WorkflowProposalCard
        compact
        proposal={response.proposal}
        onRunFailed={onRunFailed}
        onExpand={onOpenWorkflow}
        onOpenConversation={onExpand}
        onClose={onClose}
      />
    )
  }

  return (
    <div className={`${cardStyles.wrap} ${styles.wrap}`} data-size="compact" data-kind={response.kind}>
      <article className={cardStyles.card} aria-label={response.headline}>
        <div className={cardStyles.body}>
          <div className={cardStyles.titleRow}>
            <h3 className={cardStyles.title}>{response.headline}</h3>
            <div className={cardStyles.titleMeta}>
              <button
                type="button"
                className={cardStyles.expandBtn}
                aria-label="Open in full screen"
                title="Open in full screen"
                onClick={onExpand}
              >
                <ArrowsOutSimple size={20} weight="regular" aria-hidden />
              </button>
              <button type="button" className={cardStyles.expandBtn} aria-label="Dismiss" onClick={onClose}>
                <X size={20} weight="regular" aria-hidden />
              </button>
            </div>
          </div>
          <Visual response={response} map={map} />
          <p className={response.kind === 'text' ? styles.answer : cardStyles.summary}>{response.text}</p>
        </div>
      </article>
    </div>
  )
}
