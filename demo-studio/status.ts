import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { DemoRenderStatus } from '../src/demo-recorder/types.ts'
import { OUT_DIR } from './paths.ts'

let lastWrite = 0

/** Progress for the HUD; throttled so frame-by-frame updates don't hammer the disk. */
export function writeStatus(name: string, status: Omit<DemoRenderStatus, 'updatedAt'>, force = false) {
  const now = Date.now()
  if (!force && status.progress !== undefined && now - lastWrite < 400) return
  lastWrite = now
  const dir = path.join(OUT_DIR, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'status.json'), JSON.stringify({ ...status, updatedAt: new Date(now).toISOString() }))
  const pct = status.progress !== undefined ? ` ${Math.round(status.progress * 100)}%` : ''
  console.log(`[${status.phase}] ${status.message}${pct}`)
}
