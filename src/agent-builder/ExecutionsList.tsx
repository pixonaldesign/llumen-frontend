import type { ReactNode } from 'react'
import { ChatCircleDots, CheckCircle, CircleNotch, Copy, MinusCircle, WarningCircle } from '@phosphor-icons/react'
import { buttonClass } from './configStyles'
import { formatDuration, type NodeRun } from './nodeCatalog'
import styles from './ExecutionsList.module.css'

export type ExecutionStatus = 'running' | 'waiting' | 'success' | 'error' | 'stopped'

/** One run of the published agent; builder tests aren't executions. */
export type Execution = {
  id: string
  startedAt: number
  trigger: string
  status: ExecutionStatus
  /** What the steps took, as the runtime reports it. */
  durationMs: number
  /** Each step's result, so Copy to Builder can show this run on the canvas. */
  runs: Readonly<Record<string, NodeRun>>
}

const STATUS: Record<ExecutionStatus, { label: string; icon: ReactNode }> = {
  running: { label: 'Running', icon: <CircleNotch className={styles.spin} size={12} weight="bold" aria-hidden /> },
  waiting: { label: 'Waiting for a reply', icon: <ChatCircleDots size={12} weight="fill" aria-hidden /> },
  success: { label: 'Succeeded', icon: <CheckCircle size={12} weight="fill" aria-hidden /> },
  error: { label: 'Failed', icon: <WarningCircle size={12} weight="fill" aria-hidden /> },
  stopped: { label: 'Stopped', icon: <MinusCircle size={12} weight="fill" aria-hidden /> },
}

const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' })

type ExecutionsListProps = {
  executions: readonly Execution[]
  published: boolean
  onCopy: (execution: Execution) => void
}

/** Runs of the published agent, newest first, updating as they play. */
export function ExecutionsList({ executions, published, onCopy }: ExecutionsListProps) {
  return (
    <section className={styles.page} aria-labelledby="executions-title" data-native-scroll>
      <div className={styles.inner}>
        <h2 id="executions-title" className={styles.title}>
          Executions
        </h2>
        {executions.length ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Date & time</th>
                <th scope="col">Trigger</th>
                <th scope="col">Status</th>
                <th scope="col">Duration</th>
                <th scope="col">
                  <span className={styles.hidden}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution) => {
                const status = STATUS[execution.status]
                const live = execution.status === 'running'
                return (
                  <tr key={execution.id}>
                    <td className={styles.date}>{dateTime.format(execution.startedAt)}</td>
                    <td className={styles.muted}>{execution.trigger}</td>
                    <td>
                      <span className={styles.status} data-status={execution.status}>
                        {status.icon}
                        {status.label}
                      </span>
                    </td>
                    <td className={styles.muted}>{live ? '—' : formatDuration(execution.durationMs)}</td>
                    <td className={styles.actions}>
                      <button type="button" className={buttonClass(undefined, 'small')} disabled={live} onClick={() => onCopy(execution)}>
                        <Copy size={14} aria-hidden />
                        Copy to Builder
                      </button>
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
                : 'Publish the agent, then run it with Execute Agent. Test runs from the builder aren’t listed.'}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
