import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { OUT_DIR, ROOT } from './paths.ts'
import { normalizeProps, propsFor, type DemoProps } from './remotion/schema.ts'
import type { DemoTrack } from './track.ts'

/** Remotion composition ids allow letters, digits and dashes only. */
export const compositionId = (name: string) => name.replace(/[^a-zA-Z0-9-]/g, '-')

export const entryFor = (name: string) => path.join(OUT_DIR, name, 'index.tsx')

/** Identifies the take's steps, so edits carry over a replay of the same take but not to a new recording. */
function stepsSignature(track: DemoTrack) {
  const labels = track.events.flatMap((event) => (event.type === 'moment' ? [`${event.step}:${event.label}`] : []))
  return createHash('sha1').update(labels.join('\n')).digest('hex').slice(0, 12)
}

/** The `defaultProps={...}` literal as last saved by Studio, if the file is for the same steps. */
function savedProps(file: string, signature: string): Record<string, unknown> | null {
  if (!existsSync(file)) return null
  const source = readFileSync(file, 'utf8')
  if (!source.includes(`steps: ${signature}`)) return null
  const start = source.indexOf('defaultProps={')
  if (start === -1) return null
  let depth = 0
  let quote: string | null = null
  const open = start + 'defaultProps='.length
  for (let i = open; i < source.length; i++) {
    const char = source[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
    } else if (char === '"' || char === "'" || char === '`') quote = char
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) {
      try {
        /* Studio may reformat the literal as JS rather than JSON; it is our own generated file. */
        return new Function(`return (${source.slice(open + 1, i)})`)() as Record<string, unknown>
      } catch {
        return null
      }
    }
  }
  return null
}

/**
 * Writes the take's own Remotion project. Its `defaultProps` are a plain literal so that "Save" in Remotion Studio's
 * props panel writes edits straight back into this file. A replay of the same steps keeps those edits; zooms anchored
 * to a step follow it to its new time.
 */
export function writeEntry(track: DemoTrack) {
  const file = entryFor(track.name)
  const signature = stepsSignature(track)
  const fresh = propsFor(track.events, track.render)
  const saved = savedProps(file, signature)
  const props: DemoProps = saved ? normalizeProps(saved, fresh) : fresh
  const component = path.relative(path.dirname(file), path.join(ROOT, 'demo-studio/remotion/DemoVideo.tsx'))
  const schema = path.relative(path.dirname(file), path.join(ROOT, 'demo-studio/remotion/schema.ts'))
  const literal = JSON.stringify(props, null, 2).replace(/\n/g, '\n        ')
  const { width, height, scale, fps } = track.format
  writeFileSync(
    file,
    `// steps: ${signature}
import { Composition, registerRoot } from 'remotion'
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
      defaultProps={${literal}}
    />
  )
}

registerRoot(Root)
`,
  )
  return { file, kept: Boolean(saved) }
}
