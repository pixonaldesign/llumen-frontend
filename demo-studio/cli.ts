import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import type { DemoScript } from '../src/demo-recorder/types.ts'
import { encode } from './encode.ts'
import { entryFor, writeEntry } from './entry.ts'
import { DEMOS_DIR, OUT_DIR, ROOT, isDemoName } from './paths.ts'
import { render } from './render.ts'
import { replay } from './replay.ts'
import { writeStatus } from './status.ts'
import { launchStudio } from './studio.ts'
import type { DemoTrack } from './track.ts'

const USAGE = `Usage: npm run demo -- <command> <name> [options]

Commands
  replay <name>   Replay demos/<name>.json into demo-out/<name>/ (raw.mp4, track.json, Remotion project)
  render <name>   Composite raw.mp4 into demo-out/<name>/final.mp4, with any edits saved in Remotion Studio
  make <name>     replay, then render
  studio <name>   Open the take in Remotion Studio to adjust zooms, cursor, keycaps and framing

Options
  --url <origin>  Dev server to replay against; starts its own when omitted
  --headed        Show the browser while replaying
  --keep-frames   Keep the raw screencast frames after encoding`

function parse(argv: string[]) {
  const [command, name, ...rest] = argv
  const flags = new Map<string, string | true>()
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (!arg.startsWith('--')) continue
    const next = rest[i + 1]
    if (next && !next.startsWith('--')) {
      flags.set(arg.slice(2), next)
      i++
    } else flags.set(arg.slice(2), true)
  }
  return { command, name, flags }
}

function loadScript(name: string): DemoScript {
  const file = path.join(DEMOS_DIR, `${name}.json`)
  if (!existsSync(file)) throw new Error(`No demo at demos/${name}.json`)
  return JSON.parse(readFileSync(file, 'utf8')) as DemoScript
}

async function withOrigin<T>(url: string | true | undefined, run: (origin: string) => Promise<T>) {
  if (typeof url === 'string') return run(new URL(url).origin)
  const { createServer } = await import('vite')
  const server = await createServer({ root: ROOT, logLevel: 'warn', server: { port: 5199, strictPort: false } })
  await server.listen()
  try {
    return await run(new URL(server.resolvedUrls?.local[0] ?? 'http://localhost:5199').origin)
  } finally {
    await server.close()
  }
}

async function replayCommand(name: string, flags: Map<string, string | true>) {
  const script = loadScript(name)
  const outDir = path.join(OUT_DIR, name)
  mkdirSync(outDir, { recursive: true })
  const result = await withOrigin(flags.get('url'), (origin) => replay(script, { origin, outDir, headed: flags.has('headed') }))
  await encode(name, result.frames, result.duration, script.format.fps, path.join(outDir, 'raw.mp4'))
  if (!flags.has('keep-frames')) rmSync(path.join(outDir, 'frames'), { recursive: true, force: true })
  const track: DemoTrack = {
    name,
    format: script.format,
    render: script.render ?? {},
    duration: result.duration,
    events: result.events,
  }
  writeFileSync(path.join(outDir, 'track.json'), JSON.stringify(track))
  writeEntry(track)
  console.log(`Wrote ${path.relative(ROOT, outDir)}/raw.mp4 (${result.duration.toFixed(1)} s, ${result.frames.length} captured frames)`)
}

function loadTrack(name: string): DemoTrack {
  const file = path.join(OUT_DIR, name, 'track.json')
  if (!existsSync(file)) throw new Error(`Replay ${name} first: npm run demo -- replay ${name}`)
  return JSON.parse(readFileSync(file, 'utf8')) as DemoTrack
}

async function main() {
  const { command, name, flags } = parse(process.argv.slice(2))
  if (!command || !isDemoName(name)) {
    console.log(USAGE)
    process.exit(command ? 1 : 0)
  }
  try {
    if (command === 'replay' || command === 'make') await replayCommand(name, flags)
    if (command === 'render' || command === 'make') {
      const output = await render(loadTrack(name), path.join(OUT_DIR, name))
      writeStatus(name, { phase: 'done', message: 'Rendered', output: path.relative(ROOT, output) }, true)
      console.log(`Wrote ${path.relative(ROOT, output)}`)
    } else if (command === 'replay') {
      writeStatus(name, { phase: 'done', message: 'Replayed', output: `demo-out/${name}/raw.mp4` }, true)
    } else if (command === 'studio') {
      if (!existsSync(entryFor(name))) writeEntry(loadTrack(name))
      launchStudio(name, { open: true, stdio: 'inherit' }).on('exit', (code) => process.exit(code ?? 0))
    } else if (command !== 'make') {
      console.log(USAGE)
      process.exit(1)
    }
  } catch (error) {
    writeStatus(name, { phase: 'error', message: (error as Error).message }, true)
    console.error(error)
    process.exit(1)
  }
}

void main()
