import { mkdirSync, rmSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium, type Locator, type Page } from 'playwright'
import type { DemoLocator, DemoScript, DemoStep, DemoTarget } from '../src/demo-recorder/types.ts'
import { writeStatus } from './status.ts'
import type { TrackEvent } from './track.ts'

export type Frame = { file: string; t: number }

export type ReplayResult = { frames: Frame[]; events: TrackEvent[]; duration: number }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

/** Deterministic noise so typing rhythm and paths are identical on every render. */
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Runs in the page before any app code: restores the recorded storage once, pins the clock and Math.random. */
function prepareReplay(init: { session: Record<string, string>; local: Record<string, string>; clock: number; seed: number }) {
  const w = window as unknown as { __LLUMEN_DEMO_REPLAY__: boolean }
  w.__LLUMEN_DEMO_REPLAY__ = true
  const MARK = '__llumen_demo_replay_start'
  let realStart = Number(sessionStorage.getItem(MARK))
  if (!realStart) {
    sessionStorage.clear()
    localStorage.clear()
    Object.entries(init.session).forEach(([key, value]) => sessionStorage.setItem(key, value))
    Object.entries(init.local).forEach(([key, value]) => localStorage.setItem(key, value))
    realStart = Date.now()
    sessionStorage.setItem(MARK, String(realStart))
  }
  const offset = init.clock - realStart
  const RealDate = Date
  class DemoDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(RealDate.now() + offset)
      else super(...(args as [string]))
    }
    static now() {
      return RealDate.now() + offset
    }
  }
  window.Date = DemoDate as DateConstructor
  let s = init.seed >>> 0
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function toLocator(page: Page, locator: DemoLocator): Locator {
  switch (locator.kind) {
    case 'testid':
      return page.locator(`[data-demo="${locator.value}"], [data-testid="${locator.value}"]`)
    case 'css':
      return page.locator(locator.value)
    case 'role':
      return page.getByRole(locator.role as Parameters<Page['getByRole']>[0], { name: locator.name, exact: true })
    case 'text':
      return page.getByText(locator.value, { exact: true })
    case 'placeholder':
      return page.getByPlaceholder(locator.value, { exact: true })
  }
}

export async function replay(
  script: DemoScript,
  options: { origin: string; outDir: string; headed?: boolean },
): Promise<ReplayResult> {
  const { format } = script
  const pace = script.pace ?? 1
  const typingSpeed = script.typingSpeed ?? 14
  const random = seeded(script.name.length * 7919 + script.steps.length)
  const framesDir = path.join(options.outDir, 'frames')
  rmSync(framesDir, { recursive: true, force: true })
  mkdirSync(framesDir, { recursive: true })

  const browser = await chromium.launch({
    headless: !options.headed,
    channel: options.headed ? undefined : 'chromium',
    args: [
      /* Without this the screencast is captured at CSS px, ignoring the context's deviceScaleFactor. */
      `--force-device-scale-factor=${format.scale}`,
      '--force-color-profile=srgb',
      '--disable-features=Translate',
      '--autoplay-policy=no-user-gesture-required',
    ],
  })
  const context = await browser.newContext({
    viewport: { width: format.width, height: format.height },
    deviceScaleFactor: format.scale,
    colorScheme: 'dark',
    locale: 'en-US',
  })
  await context.addInitScript(prepareReplay, {
    session: script.start.sessionStorage,
    local: script.start.localStorage,
    clock: script.start.clock,
    seed: 42,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)

  const baseUrl = new URL(script.start.path, options.origin).href
  writeStatus(script.name, { phase: 'replaying', message: 'Loading the app' }, true)
  await page.goto(baseUrl, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await sleep(1500)

  /* Frames arrive whenever the page repaints; encode.ts resamples them to a constant frame rate. */
  const cdp = await context.newCDPSession(page)
  const frames: Frame[] = []
  const writes: Promise<void>[] = []
  let t0 = 0
  cdp.on('Page.screencastFrame', (frame) => {
    void cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {})
    const t = frame.metadata.timestamp ?? Date.now() / 1000
    if (!t0) t0 = t
    const file = path.join(framesDir, `${String(frames.length).padStart(6, '0')}.jpg`)
    frames.push({ file, t: t - t0 })
    writes.push(writeFile(file, Buffer.from(frame.data, 'base64')))
  })
  const startedAt = Date.now() / 1000
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: format.width * format.scale,
    maxHeight: format.height * format.scale,
    everyNthFrame: 1,
  })

  const events: TrackEvent[] = []
  const clock = () => Date.now() / 1000 - (t0 || startedAt)
  const cursor = { x: format.width * 0.62, y: format.height * 0.7 }
  events.push({ t: 0, type: 'move', ...cursor })

  async function moveTo(x: number, y: number) {
    const from = { ...cursor }
    const distance = Math.hypot(x - from.x, y - from.y)
    if (distance < 2) return
    const duration = clamp(280 + distance * 0.45, 380, 1000)
    /* A slight arc reads as a hand, a straight line as a robot. */
    const bend = (random() > 0.5 ? 1 : -1) * Math.min(80, distance * 0.12)
    const cx = (from.x + x) / 2 + (-(y - from.y) / distance) * bend
    const cy = (from.y + y) / 2 + ((x - from.x) / distance) * bend
    const start = Date.now()
    for (;;) {
      const p = Math.min(1, (Date.now() - start) / duration)
      const e = easeInOut(p)
      const px = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * cx + e * e * x
      const py = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * cy + e * e * y
      await page.mouse.move(px, py)
      cursor.x = px
      cursor.y = py
      events.push({ t: clock(), type: 'move', x: px, y: py })
      if (p >= 1) break
      await sleep(12)
    }
  }

  async function resolve(target: DemoTarget): Promise<Locator | null> {
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      for (const candidate of target.locators) {
        try {
          const base = toLocator(page, candidate)
          const count = await base.count()
          if (!count) continue
          const nth = 'nth' in candidate ? candidate.nth : undefined
          const pick = nth !== undefined && nth < count ? base.nth(nth) : count === 1 ? base : base.first()
          if (await pick.isVisible()) return pick
        } catch {
          /* Invalid or stale selector; try the next one. */
        }
      }
      await sleep(150)
    }
    console.warn(`Could not find ${target.label}; using its recorded position`)
    return null
  }

  async function pointFor(target: DemoTarget, at: [number, number] = [0.5, 0.5]): Promise<{ x: number; y: number; locator: Locator | null }> {
    const locator = await resolve(target)
    const { width, height } = script.start.recordedViewport
    if (!locator) return { x: (target.viewport[0] / width) * format.width, y: (target.viewport[1] / height) * format.height, locator }
    let box = await locator.boundingBox()
    const offscreen = box && (box.y < 0 || box.y + box.height > format.height || box.x < 0 || box.x + box.width > format.width)
    if (offscreen) {
      await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }))
      await sleep(700)
      box = await locator.boundingBox()
    }
    if (!box) return { x: cursor.x, y: cursor.y, locator }
    /* Small controls are hit near their middle; big surfaces (the map) keep the exact spot. */
    const small = box.width < 240 && box.height < 120
    const fx = small ? 0.5 + (at[0] - 0.5) * 0.35 : at[0]
    const fy = small ? 0.5 + (at[1] - 0.5) * 0.35 : at[1]
    return { x: box.x + box.width * fx, y: box.y + box.height * fy, locator }
  }

  const focus = (step: DemoStep, x: number, y: number) =>
    events.push({ t: clock(), type: 'focus', x, y, ...(step.zoom !== undefined ? { zoom: step.zoom } : {}) })

  async function press(button: 'left' | 'right', clickCount = 1) {
    events.push({ t: clock(), type: 'down' })
    await page.mouse.down({ button, clickCount })
    await sleep(70)
    await page.mouse.up({ button, clickCount })
    events.push({ t: clock(), type: 'up' })
  }

  async function run(step: DemoStep) {
    switch (step.kind) {
      case 'click': {
        const { x, y } = await pointFor(step.target, step.at)
        await moveTo(x, y)
        await sleep(90)
        focus(step, x, y)
        await press(step.button ?? 'left')
        if (step.clicks === 2) {
          await sleep(60)
          await press('left', 2)
        }
        return
      }
      case 'hover': {
        const { x, y } = await pointFor(step.target, step.at)
        await moveTo(x, y)
        if (typeof step.zoom === 'number') focus(step, x, y)
        await sleep(700)
        return
      }
      case 'drag': {
        const { x, y } = await pointFor(step.target, step.at)
        await moveTo(x, y)
        focus(step, x, y)
        events.push({ t: clock(), type: 'down' })
        await page.mouse.down()
        const recorded = step.path[step.path.length - 1]?.[2] ?? 0
        const duration = clamp(recorded, 500, 2500)
        const start = Date.now()
        for (;;) {
          const elapsed = Date.now() - start
          const at = (Math.min(elapsed, duration) / duration) * recorded
          const next = step.path.findIndex((point) => point[2] >= at)
          const b = step.path[next === -1 ? step.path.length - 1 : next]
          const a = step.path[Math.max(0, next - 1)] ?? b
          const span = b[2] - a[2] || 1
          const k = clamp((at - a[2]) / span, 0, 1)
          const px = x + a[0] + (b[0] - a[0]) * k
          const py = y + a[1] + (b[1] - a[1]) * k
          await page.mouse.move(px, py)
          cursor.x = px
          cursor.y = py
          events.push({ t: clock(), type: 'move', x: px, y: py })
          if (elapsed >= duration) break
          await sleep(12)
        }
        await page.mouse.up()
        events.push({ t: clock(), type: 'up' })
        return
      }
      case 'type': {
        const { x, y, locator } = await pointFor(step.target)
        const focused = locator ? await locator.evaluate((el) => el === document.activeElement || el.contains(document.activeElement)) : true
        if (!focused) {
          await moveTo(x, y)
          await sleep(90)
          await press('left')
          await sleep(200)
        }
        focus(step, x, y)
        if (step.replace) await page.keyboard.press('ControlOrMeta+A')
        const fieldText = () =>
          page.evaluate(() => {
            const el = document.activeElement
            return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : (el?.textContent ?? '')
          })
        const start = step.replace ? 0 : (await fieldText()).length
        let typed = 0
        for (const char of step.text) {
          await page.keyboard.type(char)
          typed++
          const base = 1000 / typingSpeed
          await sleep(char === ' ' ? base * 1.4 : base * (0.6 + random() * 0.8))
          /* Some fields type for you (the landing bar's demo prompt); let them finish instead of typing over them. */
          if ((await fieldText()).length > start + typed + 1) {
            let last = ''
            const deadline = Date.now() + 15000
            while (Date.now() < deadline) {
              await sleep(400)
              const now = await fieldText()
              if (now === last) break
              last = now
            }
            break
          }
        }
        return
      }
      case 'key': {
        events.push({ t: clock(), type: 'key', key: step.key })
        await page.keyboard.press(step.key)
        return
      }
      case 'scroll': {
        const locator = await resolve(step.target)
        const box = locator ? await locator.boundingBox() : null
        if (box) {
          const inside = cursor.x >= box.x && cursor.x <= box.x + box.width && cursor.y >= box.y && cursor.y <= box.y + box.height
          if (!inside) await moveTo(box.x + box.width / 2, clamp(box.y + box.height / 2, 0, format.height))
        }
        const target = locator ?? page.locator('html')
        await target.evaluate(
          (el, to) =>
            new Promise<void>((done) => {
              const root = el === document.documentElement || el === document.body
              const scroller = (root ? document.scrollingElement : el) as HTMLElement
              const behavior = scroller.style.scrollBehavior
              scroller.style.scrollBehavior = 'auto'
              const fromTop = scroller.scrollTop
              const fromLeft = scroller.scrollLeft
              const distance = Math.max(Math.abs(to.top - fromTop), Math.abs(to.left - fromLeft))
              const duration = Math.min(1800, Math.max(600, 400 + distance * 0.6))
              const start = performance.now()
              const frame = (now: number) => {
                const p = Math.min(1, (now - start) / duration)
                const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
                scroller.scrollTop = fromTop + (to.top - fromTop) * e
                scroller.scrollLeft = fromLeft + (to.left - fromLeft) * e
                if (p < 1) requestAnimationFrame(frame)
                else {
                  scroller.style.scrollBehavior = behavior
                  done()
                }
              }
              requestAnimationFrame(frame)
            }),
          { top: step.top, left: step.left },
        )
        return
      }
      case 'wheel': {
        const { x, y } = await pointFor(step.target, step.at)
        await moveTo(x, y)
        focus(step, x, y)
        const ticks = clamp(Math.round(Math.max(Math.abs(step.deltaX), Math.abs(step.deltaY)) / 40), 6, 30)
        for (let i = 0; i < ticks; i++) {
          await page.mouse.wheel(step.deltaX / ticks, step.deltaY / ticks)
          await sleep(24)
        }
        return
      }
      case 'navigate': {
        const wanted = new URL(step.path, options.origin)
        const same = () => {
          const current = new URL(page.url())
          return current.pathname === wanted.pathname && current.search === wanted.search
        }
        const deadline = Date.now() + 2000
        while (!same() && Date.now() < deadline) await sleep(100)
        if (!same()) await page.goto(wanted.href, { waitUntil: 'load' })
        await sleep(800)
        return
      }
      case 'wait':
        await sleep(step.ms)
        return
    }
  }

  for (let i = 0; i < script.steps.length; i++) {
    const step = script.steps[i]
    const gap = i === 0 ? 0 : step.t - script.steps[i - 1].t
    const pause = (i === 0 ? 900 : clamp(gap * 0.45, 250, 1600)) * pace + (step.pause ?? 0)
    await sleep(pause)
    const label = 'target' in step ? step.target.label : step.kind === 'key' ? step.key : step.kind
    writeStatus(script.name, { phase: 'replaying', message: `${step.kind} ${label}`, progress: i / script.steps.length })
    try {
      await run(step)
    } catch (error) {
      console.warn(`Step ${i + 1} (${step.kind}) failed: ${(error as Error).message}`)
    }
  }

  await sleep(1600 * pace)
  const duration = clock()
  await cdp.send('Page.stopScreencast')
  await Promise.all(writes)
  await browser.close()

  if (!frames.length) throw new Error('No frames were captured')
  return { frames, events, duration }
}
