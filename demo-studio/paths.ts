import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** Recorded scripts; committed, since they are the source of each video. */
export const DEMOS_DIR = path.join(ROOT, 'demos')
/** Frames, videos and status per demo; ignored by git. */
export const OUT_DIR = path.join(ROOT, 'demo-out')

export const isDemoName = (name: unknown): name is string => typeof name === 'string' && /^[a-z0-9][a-z0-9-_]*$/.test(name)
