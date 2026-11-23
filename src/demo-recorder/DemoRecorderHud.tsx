import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DemoSetupDialog } from './DemoSetupDialog'
import {
  dismissRecorder,
  isReplaying,
  openInRemotion,
  renderDemo,
  revealOutput,
  saveRecording,
  stopRecording,
  toggleZoomMark,
  useRecorderState,
  type RecorderState,
} from './recorderStore'
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
  const edit = script.after === 'edit'
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        void saveRecording(name, edit ? 'edit' : 'render')
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
      <button type="button" className={styles.ghost} onClick={() => void saveRecording(name, 'save')}>
        Save
      </button>
      <button type="button" className={styles.ghost} onClick={() => void saveRecording(name, edit ? 'render' : 'edit')}>
        {edit ? 'Render as is' : 'Edit in Remotion'}
      </button>
      <button type="submit" className={styles.primary}>
        {edit ? 'Edit in Remotion' : 'Render'}
      </button>
    </form>
  )
}

function RecordingBar({ state }: { state: Extract<RecorderState, { phase: 'recording' }> }) {
  const { format, steps } = state.script
  const mode = state.settings.render.zoomMode
  return (
    <>
      <span className={styles.dot} aria-hidden />
      <span className={styles.label}>Recording</span>
      <Elapsed since={state.startedAt} />
      <span className={styles.muted}>
        {steps.length} {steps.length === 1 ? 'step' : 'steps'} · {format.id}
      </span>
      {mode !== 'off' ? (
        <button
          type="button"
          className={state.zoomArmed ? styles.armed : styles.ghost}
          onClick={toggleZoomMark}
          title={mode === 'auto' ? 'Skip the zoom on the next action' : 'Zoom on the next action'}
        >
          {state.zoomArmed ? (mode === 'auto' ? 'No zoom next' : 'Zoom next') : mode === 'auto' ? '⌥Z skip zoom' : '⌥Z zoom'}
        </button>
      ) : null}
      <button type="button" className={styles.primary} onClick={stopRecording}>
        Stop
      </button>
    </>
  )
}

/** Floating recorder controls. Marked `data-demo-ignore` so clicking them is never captured as a step. */
export function DemoRecorderHud() {
  const state = useRecorderState()

  if (state.phase === 'idle' || isReplaying()) return null
  if (state.phase === 'setup') return <DemoSetupDialog />

  let body: ReactNode
  if (state.phase === 'recording') {
    body = <RecordingBar state={state} />
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
    const { name, studio, rendered, editable } = state
    body = (
      <>
        <span className={styles.label}>{studio === 'open' ? 'Open in Remotion' : 'Ready'}</span>
        <span className={`${styles.muted} ${styles.mono}`}>{state.output}</span>
        {!rendered ? (
          <button type="button" className={styles.ghost} onClick={() => void renderDemo(name)}>
            Render
          </button>
        ) : null}
        <button type="button" className={styles.ghost} onClick={() => revealOutput(name)}>
          Show in Finder
        </button>
        {editable || !rendered ? (
          <button
            type="button"
            className={styles.ghost}
            disabled={studio === 'opening'}
            onClick={() => (editable ? void openInRemotion(name) : void renderDemo(name, 'edit'))}
          >
            {studio === 'opening' ? 'Opening…' : 'Open in Remotion'}
          </button>
        ) : null}
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
