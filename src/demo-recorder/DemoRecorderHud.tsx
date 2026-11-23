import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { dismissRecorder, isReplaying, renderDemo, revealOutput, saveRecording, stopRecording, useRecorderState } from './recorderStore'
import type { DemoScript } from './types'
import styles from './DemoRecorderHud.module.css'

const PHASE_LABEL = { replaying: 'Replaying', encoding: 'Encoding', compositing: 'Compositing', done: 'Done', error: 'Failed' }

function formatElapsed(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [])
  return <span className={styles.mono}>{formatElapsed(now - since)}</span>
}

function ReviewForm({ script }: { script: DemoScript }) {
  const [name, setName] = useState(script.name)
  const submit = (render: boolean) => void saveRecording(name, render)
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        submit(true)
      }}
    >
      <span className={styles.muted}>
        {script.steps.length} steps · {script.format.width}×{script.format.height} @{script.format.scale}×
      </span>
      <input
        className={styles.input}
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label="Demo name"
        autoFocus
        spellCheck={false}
      />
      <button type="button" className={styles.ghost} onClick={dismissRecorder}>
        Discard
      </button>
      <button type="button" className={styles.ghost} onClick={() => submit(false)}>
        Save
      </button>
      <button type="submit" className={styles.primary}>
        Save & render
      </button>
    </form>
  )
}

/** Floating recorder controls. Marked `data-demo-ignore` so clicking them is never captured as a step. */
export function DemoRecorderHud() {
  const state = useRecorderState()

  if (state.phase === 'idle' || isReplaying()) return null

  let body: ReactNode
  if (state.phase === 'recording') {
    const { format, steps } = state.script
    body = (
      <>
        <span className={styles.dot} aria-hidden />
        <span className={styles.label}>Recording</span>
        <Elapsed since={state.startedAt} />
        <span className={styles.muted}>
          {steps.length} {steps.length === 1 ? 'step' : 'steps'} · {format.id}
        </span>
        <button type="button" className={styles.primary} onClick={stopRecording}>
          Stop
        </button>
      </>
    )
  } else if (state.phase === 'review') {
    body = <ReviewForm key={state.script.createdAt} script={state.script} />
  } else if (state.phase === 'saving') {
    body = <span className={styles.label}>Saving {state.name}…</span>
  } else if (state.phase === 'rendering') {
    const status = state.status
    const progress = status?.progress
    body = (
      <>
        <span className={styles.spinner} aria-hidden />
        <span className={styles.label}>{status ? PHASE_LABEL[status.phase] : 'Starting'}</span>
        <span className={styles.muted}>{status?.message ?? state.name}</span>
        {progress !== undefined ? <span className={styles.mono}>{Math.round(progress * 100)}%</span> : null}
        <button type="button" className={styles.ghost} onClick={dismissRecorder}>
          Hide
        </button>
      </>
    )
  } else if (state.phase === 'done') {
    const { name: doneName } = state
    body = (
      <>
        <span className={styles.label}>Ready</span>
        <span className={`${styles.muted} ${styles.mono}`}>{state.output}</span>
        {state.output.endsWith('.json') ? (
          <button type="button" className={styles.ghost} onClick={() => void renderDemo(doneName)}>
            Render
          </button>
        ) : null}
        <button type="button" className={styles.ghost} onClick={() => revealOutput(doneName)}>
          Show in Finder
        </button>
        <button type="button" className={styles.primary} onClick={dismissRecorder}>
          Close
        </button>
      </>
    )
  } else {
    body = (
      <>
        <span className={styles.label}>Demo failed</span>
        <span className={styles.muted}>{state.message}</span>
        <button type="button" className={styles.primary} onClick={dismissRecorder}>
          Close
        </button>
      </>
    )
  }

  return createPortal(
    <div className={styles.hud} data-demo-ignore role="status" aria-live="polite">
      {body}
    </div>,
    document.body,
  )
}
