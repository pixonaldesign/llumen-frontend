import { useSyncExternalStore } from 'react'
import { startCapture } from './capture'
import type { DemoFormat, DemoRenderStatus, DemoScript, DemoStep } from './types'

export type RecorderState =
  | { phase: 'idle' }
  | { phase: 'recording'; script: DemoScript; startedAt: number }
  | { phase: 'review'; script: DemoScript }
  | { phase: 'saving'; name: string }
  | { phase: 'rendering'; name: string; status: DemoRenderStatus | null }
  | { phase: 'done'; name: string; output: string }
  | { phase: 'error'; message: string }

export type SavedDemo = { name: string; steps: number; format: string; video: string | null; updatedAt: string }

/** Survives reloads mid-take, so a flow that navigates keeps recording. */
const SESSION_KEY = 'llumen-demo-recorder'
const API = '/__demo'

/** Set by the replayer so the recorder chrome never shows up in a take. */
export const isReplaying = () => (window as { __LLUMEN_DEMO_REPLAY__?: boolean }).__LLUMEN_DEMO_REPLAY__ === true

const listeners = new Set<() => void>()
let state: RecorderState = { phase: 'idle' }
let stopCapture: (() => void) | null = null
let pollTimer = 0

function set(next: RecorderState) {
  state = next
  if (next.phase === 'recording') {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ script: next.script, startedAt: next.startedAt }))
  } else {
    window.sessionStorage.removeItem(SESSION_KEY)
  }
  listeners.forEach((listener) => listener())
}

function snapshot(storage: Storage) {
  const out: Record<string, string> = {}
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && key !== SESSION_KEY) out[key] = storage.getItem(key) ?? ''
  }
  return out
}

const currentPath = () => `${window.location.pathname}${window.location.search}${window.location.hash}`

function capture(startedAt: number) {
  stopCapture?.()
  const perfStart = performance.now() - (Date.now() - startedAt)
  stopCapture = startCapture((step: DemoStep) => {
    if (state.phase !== 'recording') return
    set({ ...state, script: { ...state.script, steps: [...state.script.steps, step] } })
  }, perfStart)
}

export function startRecording(format: DemoFormat) {
  if (state.phase === 'recording' || isReplaying()) return
  const startedAt = Date.now()
  const stamp = new Date(startedAt).toISOString().slice(0, 16).replace(/[-:T]/g, '')
  const script: DemoScript = {
    version: 1,
    name: `demo-${stamp}`,
    createdAt: new Date(startedAt).toISOString(),
    format,
    start: {
      path: currentPath(),
      sessionStorage: snapshot(window.sessionStorage),
      localStorage: snapshot(window.localStorage),
      clock: startedAt,
      recordedViewport: { width: window.innerWidth, height: window.innerHeight },
    },
    steps: [],
  }
  set({ phase: 'recording', script, startedAt })
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

export async function saveRecording(rawName: string, render: boolean) {
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
  if (render) await renderDemo(name)
  else set({ phase: 'done', name, output: `demos/${name}.json` })
}

export async function renderDemo(name: string) {
  set({ phase: 'rendering', name, status: null })
  try {
    await request('/render', { method: 'POST', body: JSON.stringify({ name }) })
  } catch (error) {
    set({ phase: 'error', message: (error as Error).message })
    return
  }
  const poll = async () => {
    if (state.phase !== 'rendering' || state.name !== name) return
    try {
      const status = await request<DemoRenderStatus>(`/status?name=${encodeURIComponent(name)}`)
      if (state.phase !== 'rendering' || state.name !== name) return
      if (status.phase === 'done') return set({ phase: 'done', name, output: status.output ?? `demo-out/${name}` })
      if (status.phase === 'error') return set({ phase: 'error', message: status.message })
      set({ phase: 'rendering', name, status })
    } catch {
      /* Status file not written yet. */
    }
    pollTimer = window.setTimeout(poll, 1000)
  }
  pollTimer = window.setTimeout(poll, 800)
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
    const saved = JSON.parse(raw) as { script: DemoScript; startedAt: number }
    const step: DemoStep = { kind: 'navigate', t: Date.now() - saved.startedAt, path: currentPath() }
    const script = { ...saved.script, steps: [...saved.script.steps, step] }
    state = { phase: 'recording', script, startedAt: saved.startedAt }
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
