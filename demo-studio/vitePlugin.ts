import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'
import { DEMOS_DIR, OUT_DIR, ROOT, isDemoName } from './paths.ts'

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

  return {
    name: 'llumen-demo-studio',
    apply: 'serve',
    configureServer(server) {
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
                  updatedAt: statSync(full).mtime.toISOString(),
                }
              })
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            return send(res, 200, demos)
          }

          if (req.method === 'POST' && url.pathname === '/render') {
            const { name } = (await readBody(req)) as { name?: string }
            if (!isDemoName(name) || !existsSync(path.join(DEMOS_DIR, `${name}.json`))) return send(res, 404, { error: 'No such demo' })
            if (job) return send(res, 409, { error: `Already rendering ${job.name}` })
            const origin = new URL(server.resolvedUrls?.local[0] ?? `http://localhost:${server.config.server.port ?? 5173}`).origin
            const dir = path.join(OUT_DIR, name)
            mkdirSync(dir, { recursive: true })
            writeFileSync(
              path.join(dir, 'status.json'),
              JSON.stringify({ phase: 'replaying', message: 'Starting', updatedAt: new Date().toISOString() }),
            )
            const log = openSync(path.join(dir, 'log.txt'), 'w')
            const child = spawn(process.execPath, [path.join(ROOT, 'demo-studio/cli.ts'), 'make', name, '--url', origin], {
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
            const final = path.join(OUT_DIR, name, 'final.mp4')
            const target = existsSync(final) ? final : path.join(DEMOS_DIR, `${name}.json`)
            spawn('open', ['-R', target], { stdio: 'ignore' })
            return send(res, 200, {})
          }

          send(res, 404, { error: 'Not found' })
        } catch (error) {
          send(res, 500, { error: (error as Error).message })
        }
      })
    },
  }
}
