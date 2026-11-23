import { useSyncExternalStore } from 'react'
import { startCapture } from './capture'
import { DEFAULT_SETTINGS, type DemoAfter, type DemoRenderStatus, type DemoScript, type DemoSettings, type DemoStep } from './types'

export type RecorderState =
  | { phase: 'idle' }
  | { phase: 'setup' }
  | { phase: 'recording'; script: DemoScript; startedAt: number; settings: DemoSettings; zoomArmed: boolean }
  | { phase: 'review'; script: DemoScript }
  | { phase: 'saving'; name: string }
  | { phase: 'rendering'; name: string; after: DemoAfter; status: DemoRenderStatus | null }
  | { phase: 'done'; name: string; output: string; rendered: boolean; editable: boolean; studio: 'idle' | 'opening' | 'open' }
  | { phase: 'error'; message: string }

export type SavedDemo = { name: string; steps: number; format: string; video: string | null; editable: boolean; updatedAt: string }

/** Survives reloads mid-take, so a flow that navigates keeps recording. */
const SESSION_KEY = 'llumen-demo-recorder'
const SETTINGS_KEY = 'llumen-demo-recorder-settings'
const OWN_KEYS = new Set([SESSION_KEY, SETTINGS_KEY])
const API = '/__demo'
/** Steps the camera can zoom on; ⌥Z applies to the next one of these. */
const FOCUS_KINDS = new Set<DemoStep['kind']>(['click', 'hover', 'drag', 'type', 'wheel'])

/** Set by the replayer so the recorder chrome never shows up in a take. */
export const isReplaying = () => (window as { __LLUMEN_DEMO_REPLAY__?: boolean }).__LLUMEN_DEMO_REPLAY__ === true

const listeners = new Set<() => void>()
let state: RecorderState = { phase: 'idle' }
let stopCapture: (() => void) | null = null
let pollTimer = 0

function set(next: RecorderState) {
  state = next
  if (next.phase === 'recording') {
    const { script, startedAt, settings } = next
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ script, startedAt, settings }))
  } else {
    window.sessionStorage.removeItem(SESSION_KEY)
  }
  listeners.forEach((listener) => listener())
}

export function loadSettings(): DemoSettings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<DemoSettings> | null
    if (!saved) return DEFAULT_SETTINGS
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      format: { ...DEFAULT_SETTINGS.format, ...saved.format },
      render: { ...DEFAULT_SETTINGS.render, ...saved.render },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function snapshot(storage: Storage) {
  const out: Record<string, string> = {}
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && !OWN_KEYS.has(key)) out[key] = storage.getItem(key) ?? ''
  }
  return out
}

const currentPath = () => `${window.location.pathname}${window.location.search}${window.location.hash}`

function capture(startedAt: number) {
  stopCapture?.()
  const perfStart = performance.now() - (Date.now() - startedAt)
  stopCapture = startCapture(
    (step: DemoStep) => {
      if (state.phase !== 'recording') return
      let zoomArmed = state.zoomArmed
      let next = step
      if (zoomArmed && FOCUS_KINDS.has(step.kind)) {
        const { zoomMode, zoom } = state.settings.render
        next = { ...step, zoom: zoomMode === 'auto' ? false : zoom }
        zoomArmed = false
      }
      set({ ...state, zoomArmed, script: { ...state.script, steps: [...state.script.steps, next] } })
    },
    perfStart,
    toggleZoomMark,
  )
}

export function toggleZoomMark() {
  if (state.phase !== 'recording' || state.settings.render.zoomMode === 'off') return
  set({ ...state, zoomArmed: !state.zoomArmed })
}

export function openSetup() {
  if (state.phase === 'recording' || isReplaying()) return
  window.clearTimeout(pollTimer)
  set({ phase: 'setup' })
}

export function startRecording(settings: DemoSettings) {
  if (state.phase === 'recording' || isReplaying()) return
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  const startedAt = Date.now()
  const stamp = new Date(startedAt).toISOString().slice(0, 16).replace(/[-:T]/g, '')
  const script: DemoScript = {
    version: 1,
    name: `demo-${stamp}`,
    createdAt: new Date(startedAt).toISOString(),
    format: settings.format,
    start: {
      path: currentPath(),
      sessionStorage: snapshot(window.sessionStorage),
      localStorage: snapshot(window.localStorage),
      clock: startedAt,
      recordedViewport: { width: window.innerWidth, height: window.innerHeight },
    },
    pace: settings.pace,
    typingSpeed: settings.typingSpeed,
    render: settings.render,
    after: settings.after,
    steps: [],
  }
  set({ phase: 'recording', script, startedAt, settings, zoomArmed: false })
  capture(startedAt)
}

export function stopRecording() {
  if (state.phase !== 'recording') return
  stopCapture?.()
  stopCapture = null
  const script = state.script
  set(script.steps.length ? { phase: 'review', script } : { phase: 'idle' })
}

export function dismissRecorder() {
  stopCapture?.()
  stopCapture = null
  window.clearTimeout(pollTimer)
  set({ phase: 'idle' })
}

const slug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'demo'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  const body = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? `${response.status} ${response.statusText}`)
  return body
}

/** `render` replays then renders; `edit` replays then opens Remotion Studio; `save` only writes the script. */
export async function saveRecording(rawName: string, action: DemoAfter | 'save') {
  if (state.phase !== 'review') return
  const name = slug(rawName)
  const script = { ...state.script, name }
  set({ phase: 'saving', name })
  try {
    await request('/save', { method: 'POST', body: JSON.stringify(script) })
  } catch {
    download(script)
    set({ phase: 'error', message: 'Dev server unavailable, so the script was downloaded instead. Move it into demos/.' })
    return
  }
  if (action === 'save') set({ phase: 'done', name, output: `demos/${name}.json`, rendered: false, editable: false, studio: 'idle' })
  else await renderDemo(name, action)
}

export async function renderDemo(name: string, after: DemoAfter = 'render') {
  window.clearTimeout(pollTimer)
  set({ phase: 'rendering', name, after, status: null })
  try {
    await request('/render', { method: 'POST', body: JSON.stringify({ name, mode: after }) })
  } catch (error) {
    set({ phase: 'error', message: (error as Error).message })
    return
  }
  const poll = async () => {
    if (state.phase !== 'rendering' || state.name !== name) return
    try {
      const status = await request<DemoRenderStatus>(`/status?name=${encodeURIComponent(name)}`)
      if (state.phase !== 'rendering' || state.name !== name) return
      if (status.phase === 'done') {
        const rendered = after === 'render'
        set({ phase: 'done', name, output: status.output ?? `demo-out/${name}`, rendered, editable: true, studio: 'idle' })
        if (after === 'edit') void openInRemotion(name)
        return
      }
      if (status.phase === 'error') return set({ phase: 'error', message: status.message })
      set({ phase: 'rendering', name, after, status })
    } catch {
      /* Status file not written yet. */
    }
    pollTimer = window.setTimeout(poll, 1000)
  }
  pollTimer = window.setTimeout(poll, 800)
}

/** Opens the take's Remotion project, where zooms, cursor, keycaps and framing are editable before rendering. */
export async function openInRemotion(name: string) {
  if (state.phase === 'done' && state.name === name) set({ ...state, studio: 'opening' })
  try {
    await request('/studio', { method: 'POST', body: JSON.stringify({ name }) })
    if (state.phase === 'done' && state.name === name) set({ ...state, studio: 'open' })
  } catch (error) {
    set({ phase: 'error', message: (error as Error).message })
  }
}

export function revealOutput(name: string) {
  void request('/reveal', { method: 'POST', body: JSON.stringify({ name }) }).catch(() => {})
}

export function listDemos() {
  return request<SavedDemo[]>('/list')
}

function download(script: DemoScript) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(script, null, 2)], { type: 'application/json' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: `${script.name}.json` })
  link.click()
  URL.revokeObjectURL(url)
}

function resume() {
  const raw = window.sessionStorage.getItem(SESSION_KEY)
  if (!raw || isReplaying()) return
  try {
    const saved = JSON.parse(raw) as { script: DemoScript; startedAt: number; settings?: DemoSettings }
    const step: DemoStep = { kind: 'navigate', t: Date.now() - saved.startedAt, path: currentPath() }
    const script = { ...saved.script, steps: [...saved.script.steps, step] }
    state = { phase: 'recording', script, startedAt: saved.startedAt, settings: saved.settings ?? loadSettings(), zoomArmed: false }
    capture(saved.startedAt)
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY)
  }
}

if (import.meta.env.DEV) resume()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useRecorderState() {
  return useSyncExternalStore(subscribe, () => state)
}
