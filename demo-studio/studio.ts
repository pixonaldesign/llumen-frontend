import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { chromium } from 'playwright'
import { entryFor } from './entry.ts'
import { OUT_DIR, ROOT } from './paths.ts'

export const STUDIO_PORT = 3123

/**
 * Remotion Studio on one take: its own project file, its folder as the public dir, and Playwright's Chromium for
 * renders started from the Studio so nothing else needs downloading.
 */
export function launchStudio(name: string, options: { open: boolean; stdio: 'inherit' | 'pipe' }): ChildProcess {
  const args = [
    'studio',
    entryFor(name),
    `--public-dir=${path.join(OUT_DIR, name)}`,
    `--port=${STUDIO_PORT}`,
    `--browser-executable=${chromium.executablePath()}`,
    '--chrome-mode=chrome-for-testing',
    ...(options.open ? [] : ['--no-open']),
  ]
  return spawn(path.join(ROOT, 'node_modules/.bin/remotion'), args, { cwd: ROOT, stdio: ['ignore', options.stdio, options.stdio] })
}
