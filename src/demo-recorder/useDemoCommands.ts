import { useEffect, useMemo, useState } from 'react'
import { listDemos, openInRemotion, openSetup, renderDemo, stopRecording, useRecorderState, type SavedDemo } from './recorderStore'

export type DemoCommand = { id: string; group: 'Demo'; label: string; hint: string; active?: boolean; run: () => void }

/** Recorder entries for the command palette. Dev only: saving and rendering go through the Vite dev server. */
export function useDemoCommands(open: boolean, close: () => void): DemoCommand[] {
  const recorder = useRecorderState()
  const [saved, setSaved] = useState<SavedDemo[]>([])

  useEffect(() => {
    if (!open || !import.meta.env.DEV) return
    let cancelled = false
    listDemos()
      .then((demos) => !cancelled && setSaved(demos))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open])

  return useMemo(() => {
    if (!import.meta.env.DEV) return []
    const choose = (run: () => void) => () => {
      close()
      run()
    }
    if (recorder.phase === 'recording') {
      return [{ id: 'demo-stop', group: 'Demo', label: 'Demo · Stop recording', hint: 'Name it, then save, render or edit', run: choose(stopRecording) }]
    }
    return [
      {
        id: 'demo-new',
        group: 'Demo',
        label: 'Demo · New recording…',
        hint: 'Pick format, camera, overlays and pace, then record',
        run: choose(openSetup),
      },
      ...saved.flatMap((demo): DemoCommand[] => [
        {
          id: `demo-render-${demo.name}`,
          group: 'Demo',
          label: `Demo · Render ${demo.name}`,
          hint: `${demo.steps} steps · ${demo.format}${demo.video ? ' · rendered' : ''}`,
          run: choose(() => void renderDemo(demo.name)),
        },
        {
          id: `demo-edit-${demo.name}`,
          group: 'Demo',
          label: `Demo · Edit ${demo.name} in Remotion`,
          hint: demo.editable ? 'Adjust zooms, cursor, keycaps and framing' : 'Replays first, then opens Remotion Studio',
          run: choose(() => void (demo.editable ? openInRemotion(demo.name) : renderDemo(demo.name, 'edit'))),
        },
      ]),
    ]
  }, [close, recorder.phase, saved])
}
