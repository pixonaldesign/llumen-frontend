import { Check, WarningCircle } from '@phosphor-icons/react'
import { buttonClass } from './configStyles'
import type { NodeRun } from './nodeCatalog'
import { recheckable, runtimeProblem, type ProblemAction } from './nodeProblems'
import styles from './ProblemReport.module.css'

const actionLabel = (action: ProblemAction) =>
  action.kind === 'fixture'
    ? 'Use fixture input'
    : action.kind === 'executePrevious'
      ? 'Execute previous nodes'
      : action.tab === 'settings'
        ? 'Open Settings'
        : `Go to ${action.field}`

type ProblemReportProps = {
  run: NodeRun
  /** Problems the node still has as configured now; the rest of the run's are marked fixed. */
  current: ReadonlySet<string>
  onAction: (action: ProblemAction) => void
}

/** Why the node failed: every problem the run found, each with its fix and a way to make it. */
export function ProblemReport({ run, current, onAction }: ProblemReportProps) {
  const problems = run.problems?.length ? run.problems : [runtimeProblem(run.code ?? 'WF_STEP_FAILED', run.message ?? 'The node failed without a message.')]
  const fixed = (key: string) => recheckable(key) && !current.has(key)
  const open = problems.filter((problem) => !fixed(problem.key)).length
  const blocked = problems.every((problem) => recheckable(problem.key))

  return (
    <div className={styles.report}>
      <div className={styles.head}>
        <span className={styles.headIcon} data-done={!open || undefined} aria-hidden>
          {open ? <WarningCircle size={18} weight="fill" /> : <Check size={16} weight="bold" />}
        </span>
        <div className={styles.headText}>
          <p className={styles.title}>{blocked ? 'This node can’t run yet' : 'Execution failed'}</p>
          <p className={styles.summary} aria-live="polite">
            {!open
              ? 'Everything here is fixed. Execute the node again to check.'
              : open === 1
                ? `Fix ${problems.length > 1 ? 'the last problem' : 'this'}, then execute the node again.`
                : `Fix these ${open} problems, then execute the node again.`}
            {run.ports ? ' On Error is set to continue, so the steps after it still ran.' : null}
          </p>
        </div>
      </div>
      <ol className={styles.list}>
        {problems.map((problem, index) => {
          const done = fixed(problem.key)
          return (
            <li key={problem.key} className={styles.item} data-fixed={done || undefined}>
              <span className={styles.marker} aria-hidden>
                {done ? <Check size={11} weight="bold" /> : index + 1}
              </span>
              <div className={styles.body}>
                <p className={styles.problem}>
                  {problem.title}
                  {done ? <span className={styles.visuallyHidden}> (fixed)</span> : null}
                </p>
                <p className={styles.fix}>{problem.fix}</p>
                <div className={styles.foot}>
                  {done ? (
                    <span className={styles.fixedLabel}>Fixed</span>
                  ) : problem.action ? (
                    <button type="button" className={buttonClass(undefined, 'small')} onClick={() => problem.action && onAction(problem.action)}>
                      {actionLabel(problem.action)}
                    </button>
                  ) : null}
                  <code className={styles.code}>{problem.code}</code>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
