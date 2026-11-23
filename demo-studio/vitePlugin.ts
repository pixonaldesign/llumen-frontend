import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'
import { writeEntry } from './entry.ts'
import { DEMOS_DIR, OUT_DIR, ROOT, isDemoName } from './paths.ts'
import { launchStudio, STUDIO_PORT } from './studio.ts'
import type { DemoTrack } from './track.ts'

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

/**
 * Dev-server endpoints behind the command palette's Demo commands: save a recorded script into `demos/`, list saved
 * ones, and run `demo-studio/cli.ts make` against this same dev server.
 */
export function demoStudio(): Plugin {
  let job: { name: string; child: ChildProcess } | null = null
  let studio: { name: string; child: ChildProcess; url: string } | null = null

  const openStudio = (name: string) => {
    if (studio && studio.name === name && studio.child.exitCode === null) {
      spawn('open', [studio.url], { stdio: 'ignore' })
      return studio.url
    }
    studio?.child.kill()
    const child = launchStudio(name, { open: true, stdio: 'pipe' })
    const current = { name, child, url: `http://localhost:${STUDIO_PORT}` }
    const log = openSync(path.join(OUT_DIR, name, 'studio-log.txt'), 'w')
    const onOutput = (chunk: Buffer) => {
      writeSync(log, chunk)
      const found = chunk.toString().match(/https?:\/\/localhost:\d+/)
      if (found) current.url = found[0]
    }
    child.stdout?.on('data', onOutput)
    child.stderr?.on('data', onOutput)
    child.on('exit', () => {
      if (studio?.child === child) studio = null
    })
    studio = current
    return current.url
  }

  return {
    name: 'llumen-demo-studio',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.on('close', () => studio?.child.kill())
      server.middlewares.use('/__demo', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        try {
          if (req.method === 'POST' && url.pathname === '/save') {
            const script = (await readBody(req)) as { name?: string; steps?: unknown[] }
            if (!isDemoName(script.name) || !Array.isArray(script.steps)) return send(res, 400, { error: 'Invalid demo script' })
            mkdirSync(DEMOS_DIR, { recursive: true })
            writeFileSync(path.join(DEMOS_DIR, `${script.name}.json`), `${JSON.stringify(script, null, 2)}\n`)
            return send(res, 200, { path: `demos/${script.name}.json` })
          }

          if (req.method === 'GET' && url.pathname === '/list') {
            if (!existsSync(DEMOS_DIR)) return send(res, 200, [])
            const demos = readdirSync(DEMOS_DIR)
              .filter((file) => file.endsWith('.json'))
              .map((file) => {
                const name = file.slice(0, -5)
                const full = path.join(DEMOS_DIR, file)
                const script = JSON.parse(readFileSync(full, 'utf8')) as { steps: unknown[]; format: { id: string } }
                const video = path.join(OUT_DIR, name, 'final.mp4')
                return {
                  name,
                  steps: script.steps.length,
                  format: script.format.id,
                  video: existsSync(video) ? path.relative(ROOT, video) : null,
                  editable: existsSync(path.join(OUT_DIR, name, 'track.json')),
                  updatedAt: statSync(full).mtime.toISOString(),
                }
              })
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            return send(res, 200, demos)
          }

          if (req.method === 'POST' && url.pathname === '/render') {
            const { name, mode } = (await readBody(req)) as { name?: string; mode?: 'render' | 'edit' }
            if (!isDemoName(name) || !existsSync(path.join(DEMOS_DIR, `${name}.json`))) return send(res, 404, { error: 'No such demo' })
            if (job) return send(res, 409, { error: `Already rendering ${job.name}` })
            const dir = path.join(OUT_DIR, name)
            const trackFile = path.join(dir, 'track.json')
            /* Footage newer than the script is still that take; only the compositing needs redoing. */
            const current = existsSync(trackFile) && statSync(trackFile).mtimeMs >= statSync(path.join(DEMOS_DIR, `${name}.json`)).mtimeMs
            /* Editing only needs the replay; the final render happens from Remotion Studio or a later Render. */
            const command = mode === 'edit' ? (current ? null : 'replay') : current ? 'render' : 'make'
            mkdirSync(dir, { recursive: true })
            if (!command) {
              writeFileSync(
                path.join(dir, 'status.json'),
                JSON.stringify({ phase: 'done', message: 'Replayed', output: `demo-out/${name}/raw.mp4`, updatedAt: new Date().toISOString() }),
              )
              return send(res, 202, { name })
            }
            const origin = new URL(server.resolvedUrls?.local[0] ?? `http://localhost:${server.config.server.port ?? 5173}`).origin
            writeFileSync(
              path.join(dir, 'status.json'),
              JSON.stringify({ phase: 'replaying', message: 'Starting', updatedAt: new Date().toISOString() }),
            )
            const log = openSync(path.join(dir, 'log.txt'), 'w')
            const child = spawn(process.execPath, [path.join(ROOT, 'demo-studio/cli.ts'), command, name, '--url', origin], {
              cwd: ROOT,
              stdio: ['ignore', log, log],
            })
            job = { name, child }
            child.on('exit', () => {
              job = null
            })
            return send(res, 202, { name })
          }

          if (req.method === 'GET' && url.pathname === '/status') {
            const name = url.searchParams.get('name')
            const file = isDemoName(name) ? path.join(OUT_DIR, name, 'status.json') : ''
            if (!file || !existsSync(file)) return send(res, 404, { error: 'No status yet' })
            return send(res, 200, JSON.parse(readFileSync(file, 'utf8')))
          }

          if (req.method === 'POST' && url.pathname === '/reveal') {
            const { name } = (await readBody(req)) as { name?: string }
            if (!isDemoName(name)) return send(res, 400, { error: 'Invalid name' })
            const candidates = [path.join(OUT_DIR, name, 'final.mp4'), path.join(OUT_DIR, name, 'raw.mp4'), path.join(DEMOS_DIR, `${name}.json`)]
            const target = candidates.find((file) => existsSync(file))
            if (target) spawn('open', ['-R', target], { stdio: 'ignore' })
            return send(res, 200, {})
          }

          if (req.method === 'POST' && url.pathname === '/studio') {
            const { name } = (await readBody(req)) as { name?: string }
            if (!isDemoName(name)) return send(res, 400, { error: 'Invalid name' })
            if (!existsSync(path.join(OUT_DIR, name, 'track.json'))) return send(res, 409, { error: `Replay ${name} before editing it` })
            writeEntry(JSON.parse(readFileSync(path.join(OUT_DIR, name, 'track.json'), 'utf8')) as DemoTrack)
            return send(res, 200, { url: openStudio(name) })
          }

          send(res, 404, { error: 'Not found' })
        } catch (error) {
          send(res, 500, { error: (error as Error).message })
        }
      })
    },
  }
}
