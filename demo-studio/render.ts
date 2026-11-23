import path from 'node:path'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { chromium } from 'playwright'
import { ROOT } from './paths.ts'
import { writeStatus } from './status.ts'
import type { DemoTrack } from './track.ts'

export const REMOTION_ENTRY = path.join(ROOT, 'demo-studio/remotion/index.tsx')

/** Composites `raw.mp4` with the cursor, camera and keycaps into `final.mp4`. */
export async function render(track: DemoTrack, outDir: string) {
  writeStatus(track.name, { phase: 'compositing', message: 'Bundling the composition' }, true)
  const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY, publicDir: outDir })
  const inputProps = { track }
  /* Reuse Playwright's Chromium rather than having Remotion download a second browser. */
  const browser = { browserExecutable: chromium.executablePath(), chromeMode: 'chrome-for-testing' as const }
  const composition = await selectComposition({ serveUrl, id: 'Demo', inputProps, ...browser })
  const output = path.join(outDir, 'final.mp4')
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    ...browser,
    codec: 'h264',
    crf: 16,
    outputLocation: output,
    onProgress: ({ progress }) => writeStatus(track.name, { phase: 'compositing', message: 'Rendering final.mp4', progress }),
  })
  return output
}
