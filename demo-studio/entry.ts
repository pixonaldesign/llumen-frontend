import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { OUT_DIR, ROOT } from './paths.ts'
import { propsFor } from './remotion/schema.ts'
import type { DemoTrack } from './track.ts'

/** Remotion composition ids allow letters, digits and dashes only. */
export const compositionId = (name: string) => name.replace(/[^a-zA-Z0-9-]/g, '-')

export const entryFor = (name: string) => path.join(OUT_DIR, name, 'index.tsx')

/**
 * Writes the take's own Remotion project. Its `defaultProps` are a plain literal so that "Save" in Remotion Studio's
 * props panel writes edits straight back into this file, and a later `render` picks them up. A new replay rewrites
 * it, since its timings no longer match.
 */
export function writeEntry(track: DemoTrack) {
  const file = entryFor(track.name)
  const component = path.relative(path.dirname(file), path.join(ROOT, 'demo-studio/remotion/DemoVideo.tsx'))
  const schema = path.relative(path.dirname(file), path.join(ROOT, 'demo-studio/remotion/schema.ts'))
  const props = JSON.stringify(propsFor(track.events, track.render), null, 2).replace(/\n/g, '\n        ')
  const { width, height, scale, fps } = track.format
  writeFileSync(
    file,
    `import { Composition, registerRoot } from 'remotion'
import { calculateDemoMetadata, DemoVideo } from '${component}'
import { demoSchema } from '${schema}'

function Root() {
  return (
    <Composition
      id="${compositionId(track.name)}"
      component={DemoVideo}
      schema={demoSchema}
      calculateMetadata={calculateDemoMetadata}
      width={${width * scale}}
      height={${height * scale}}
      fps={${fps}}
      durationInFrames={${Math.max(1, Math.ceil(track.duration * fps))}}
      defaultProps={${props}}
    />
  )
}

registerRoot(Root)
`,
  )
  return file
}
