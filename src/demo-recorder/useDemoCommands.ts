import { useEffect, useMemo, useState } from 'react'
import { listDemos, renderDemo, startRecording, stopRecording, useRecorderState, type SavedDemo } from './recorderStore'
import { DEMO_FORMATS } from './types'

export type DemoCommand = { id: string; group: 'Demo'; label: string; hint: string; active?: boolean; run: () => void }

const FORMAT_HINTS: Record<string, string> = {
  '16:9': '1920×1080 viewport, rendered at 4K',
  '16:10': '1728×1080 viewport, MacBook proportions at 2×',
}

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
      return [{ id: 'demo-stop', group: 'Demo', label: 'Demo · Stop recording', hint: 'Name it, then save or render', run: choose(stopRecording) }]
    }
    return [
      ...DEMO_FORMATS.map((format) => ({
        id: `demo-record-${format.id}`,
        group: 'Demo' as const,
        label: `Demo · Record ${format.id}`,
        hint: FORMAT_HINTS[format.id] ?? `${format.width}×${format.height} at ${format.scale}×`,
        run: choose(() => startRecording(format)),
      })),
      ...saved.map((demo) => ({
        id: `demo-render-${demo.name}`,
        group: 'Demo' as const,
        label: `Demo · Render ${demo.name}`,
        hint: `${demo.steps} steps · ${demo.format}${demo.video ? ' · rendered' : ''}`,
        run: choose(() => void renderDemo(demo.name)),
      })),
    ]
  }, [close, recorder.phase, saved])
}
