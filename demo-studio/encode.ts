import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import type { Frame } from './replay.ts'
import { writeStatus } from './status.ts'

/** Remotion ships ffmpeg per platform, so nothing needs installing system-wide. */
function ffmpegBinary() {
  const require = createRequire(import.meta.url)
  try {
    const pkg = require.resolve(`@remotion/compositor-${process.platform}-${process.arch}/package.json`)
    const bin = path.join(path.dirname(pkg), process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
    if (existsSync(bin)) return { bin, dir: path.dirname(bin) }
  } catch {
    /* Fall back to ffmpeg on PATH. */
  }
  return { bin: 'ffmpeg', dir: '' }
}

/**
 * Screencast frames arrive only when the page repaints, at uneven times. This holds each one until the next, sampled
 * at a constant frame rate, and pipes them into an H.264 file.
 */
export async function encode(name: string, frames: Frame[], duration: number, fps: number, output: string) {
  const { bin, dir } = ffmpegBinary()
  const total = Math.ceil(duration * fps)
  const env = dir ? { ...process.env, DYLD_LIBRARY_PATH: dir, LD_LIBRARY_PATH: dir } : process.env
  const ffmpeg = spawn(
    bin,
    [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'image2pipe',
      '-framerate', String(fps),
      '-c:v', 'mjpeg',
      '-i', '-',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '12',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      output,
    ],
    { env, stdio: ['pipe', 'inherit', 'inherit'] },
  )
  const exited = new Promise<void>((resolve, reject) => {
    ffmpeg.on('error', reject)
    ffmpeg.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))))
  })

  let index = 0
  let current: { index: number; data: Buffer } | null = null
  for (let i = 0; i < total; i++) {
    const t = i / fps
    while (index + 1 < frames.length && frames[index + 1].t <= t) index++
    if (!current || current.index !== index) current = { index, data: await readFile(frames[index].file) }
    if (!ffmpeg.stdin.write(current.data)) await new Promise((resolve) => ffmpeg.stdin.once('drain', resolve))
    writeStatus(name, { phase: 'encoding', message: `Frame ${i + 1} of ${total}`, progress: (i + 1) / total })
  }
  ffmpeg.stdin.end()
  await exited
}
