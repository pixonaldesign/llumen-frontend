import { existsSync } from 'node:fs'
import path from 'node:path'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { chromium } from 'playwright'
import { compositionId, entryFor, writeEntry } from './entry.ts'
import { writeStatus } from './status.ts'
import type { DemoTrack } from './track.ts'

/** Reuse Playwright's Chromium rather than having Remotion download a second browser. */
export const remotionBrowser = () => ({ browserExecutable: chromium.executablePath(), chromeMode: 'chrome-for-testing' as const })

/** Composites `raw.mp4` with the cursor, camera and keycaps into `final.mp4`, using any edits saved in Studio. */
export async function render(track: DemoTrack, outDir: string) {
  writeStatus(track.name, { phase: 'compositing', message: 'Bundling the composition' }, true)
  const entry = existsSync(entryFor(track.name)) ? entryFor(track.name) : writeEntry(track)
  const serveUrl = await bundle({ entryPoint: entry, publicDir: outDir })
  const browser = remotionBrowser()
  const composition = await selectComposition({ serveUrl, id: compositionId(track.name), ...browser })
  const output = path.join(outDir, 'final.mp4')
  await renderMedia({
    serveUrl,
    composition,
    inputProps: composition.props,
    ...browser,
    codec: 'h264',
    crf: 16,
    outputLocation: output,
    onProgress: ({ progress }) => writeStatus(track.name, { phase: 'compositing', message: 'Rendering final.mp4', progress }),
  })
  return output
}
