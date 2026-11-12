import type { ReactNode } from 'react'
import { ArrowClockwise, ChatCircleDots, CheckCircle, CircleNotch, Code, Copy, Prohibit, WarningCircle } from '@phosphor-icons/react'
import { formatDuration, type NodeRun } from './nodeCatalog'
import styles from './ExecutionsList.module.css'

export type ExecutionStatus = 'running' | 'waiting' | 'success' | 'error' | 'canceled'

/** One run of the published agent; builder tests aren't executions. */
export type Execution = {
  id: string
  startedAt: number
  /** The trigger it started from, for Retry. */
  triggerId: string
  status: ExecutionStatus
  /** What the steps took, as the runtime reports it; a canceled run counts until it was stopped. */
  durationMs: number
  /** Each step's result, so Copy to Builder can show this run on the canvas. */
  runs: Readonly<Record<string, NodeRun>>
}

const STATUS: Record<ExecutionStatus, { label: string; icon: ReactNode }> = {
  running: { label: 'Running', icon: <CircleNotch className={styles.spin} size={12} weight="bold" aria-hidden /> },
  waiting: { label: 'Waiting for a reply', icon: <ChatCircleDots size={12} weight="fill" aria-hidden /> },
  success: { label: 'Succeeded', icon: <CheckCircle size={12} weight="fill" aria-hidden /> },
  error: { label: 'Failed', icon: <WarningCircle size={12} weight="fill" aria-hidden /> },
  canceled: { label: 'Canceled', icon: <Prohibit size={12} weight="fill" aria-hidden /> },
}

const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' })

/** Hundredths under a minute ("2.59s"), so short runs can be told apart. */
const duration = (ms: number) => (ms < 60_000 ? `${(ms / 1000).toFixed(2)}s` : formatDuration(ms))

type ExecutionsListProps = {
  executions: readonly Execution[]
  published: boolean
  /** A run is playing, so another can't start yet. */
  running: boolean
  /** Whether the execution's trigger is still on the canvas. */
  canRetry: (execution: Execution) => boolean
  onRetry: (execution: Execution) => void
  onCopy: (execution: Execution) => void
  onDebug: (execution: Execution) => void
}

/** Runs of the published agent, newest first, updating as they play. */
export function ExecutionsList({ executions, published, running, canRetry, onRetry, onCopy, onDebug }: ExecutionsListProps) {
  const retryBlock = (execution: Execution) =>
    !published
      ? 'Publish the agent to retry'
      : running
        ? 'Wait for the current run to finish'
        : !canRetry(execution)
          ? 'Its trigger is no longer on the canvas'
          : null

  const actions = (execution: Execution) => {
    if (execution.status === 'running' || execution.status === 'waiting') return null
    const retry = (
      <button
        type="button"
        className={styles.action}
        disabled={retryBlock(execution) !== null}
        data-tooltip={retryBlock(execution) ?? undefined}
        onClick={() => onRetry(execution)}
      >
        <ArrowClockwise size={14} aria-hidden />
        Retry
      </button>
    )
    if (execution.status === 'error') {
      return (
        <>
          {retry}
          <button type="button" className={styles.action} onClick={() => onDebug(execution)}>
            <Code size={14} aria-hidden />
            Debug in Builder
          </button>
        </>
      )
    }
    return (
      <>
        {execution.status === 'canceled' ? retry : null}
        <button type="button" className={styles.action} onClick={() => onCopy(execution)}>
          <Copy size={14} aria-hidden />
          Copy to Builder
        </button>
      </>
    )
  }

  return (
    <section className={styles.page} aria-label="Executions" data-native-scroll>
      {executions.length ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Date & Time</th>
              <th scope="col">Status</th>
              <th scope="col">Duration</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {executions.map((execution) => {
              const status = STATUS[execution.status]
              return (
                <tr key={execution.id}>
                  <td className={styles.date}>{dateTime.format(execution.startedAt)}</td>
                  <td>
                    <span className={styles.status} data-status={execution.status}>
                      {status.icon}
                      {status.label}
                    </span>
                  </td>
                  <td className={styles.duration}>{execution.status === 'running' ? '—' : duration(execution.durationMs)}</td>
                  <td>
                    <div className={styles.actions}>{actions(execution)}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No executions yet</p>
          <p className={styles.emptyText}>
            {published
              ? 'Runs of the published agent show up here as they happen. Test runs from the builder aren’t listed.'
              : 'Publish the agent, then run it with Execute. Test runs from the builder aren’t listed.'}
          </p>
        </div>
      )}
    </section>
  )
}
