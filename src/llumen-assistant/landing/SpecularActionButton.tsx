import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import styles from './LandingHome.module.css'

/**
 * Specular rim overlay adapted from React Bits SpecularButton.
 * Highlight: --color-primary-500. Rest-state edge: --lc-text-secondary.
 *
 * WebGL is created once the first time the button is on-stage and kept for
 * the component lifetime (no getContext / loseContext on carousel slides).
 * The drawing buffer is fixed to the expanded-button size so slides never
 * realloc canvas.width. Shine is discarded while the card is in motion.
 */
const PAD = 20
const RADIUS = 18
const INTENSITY = 1
const SHINE_SIZE = 20
const SHINE_FADE = 40
const THICKNESS = 1.4
const SPEED = 0.2
const PROXIMITY = 250
const HIGHLIGHT_FALLBACK = '#73adf5'
const EDGE_FALLBACK = '#d4d5d7'
const IDLE_EPS = 0.02
const MAX_BTN_W = 180
const MAX_BTN_H = 36

const VERT = `#version 300 es
layout(location = 0) in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  float base = 1.0 - smoothstep(0.0, uBaseWidth, abs(d));

  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col * a, a);
}
`

function parseRgb(input: string): [number, number, number] {
  const value = input.trim()
  if (value.startsWith('#')) {
    const hex = value.length === 4
      ? value.slice(1).split('').map((ch) => ch + ch).join('')
      : value.slice(1, 7)
    const n = Number.parseInt(hex, 16)
    if (Number.isNaN(n)) return [1, 1, 1]
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  const match = value.match(/rgba?\(([^)]+)\)/i)
  if (!match) return [1, 1, 1]
  const [r = 255, g = 255, b = 255] = match[1].split(',').map((part) => Number.parseFloat(part))
  return [r / 255, g / 255, b / 255]
}

function readCssColor(el: HTMLElement, customProp: string, fallback: string) {
  const direct = getComputedStyle(el).getPropertyValue(customProp).trim()
  if (direct.startsWith('#') || direct.startsWith('rgb')) return parseRgb(direct)
  const probe = document.createElement('span')
  probe.style.color = `var(${customProp})`
  el.appendChild(probe)
  const computed = getComputedStyle(probe).color
  el.removeChild(probe)
  return parseRgb(computed || fallback)
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export function SpecularActionButton({
  className,
  enabled = true,
  motionKey = '',
  settleMs = 560,
  onClick,
  children,
}: {
  className: string
  enabled?: boolean
  motionKey?: string
  settleMs?: number
  onClick?: () => void
  children: ReactNode
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const fxRef = useRef<HTMLSpanElement>(null)
  const resetRef = useRef<() => void>(() => {})
  const discardRef = useRef<() => void>(() => {})
  const ensureGlRef = useRef<() => boolean>(() => false)
  const skipKeyRef = useRef<string | null>(null)
  const motionKeyRef = useRef(motionKey)
  const enabledRef = useRef(enabled)
  const settleMsRef = useRef(settleMs)
  motionKeyRef.current = motionKey
  enabledRef.current = enabled
  settleMsRef.current = settleMs

  useEffect(() => {
    const btn = btnRef.current
    const fx = fxRef.current
    if (!btn || !fx) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let canvas: HTMLCanvasElement | null = null
    let gl: WebGL2RenderingContext | null = null
    let loc: Record<string, WebGLUniformLocation | null> | null = null
    let frozenUntil = 0
    let settleTimer = 0
    let pointerAngle: number | null = null
    let proximityT = 0
    let angle = 2.4
    let idleAngle = 2.4
    let bright = 0
    let last = performance.now()
    let raf = 0
    const size = { w: 1, h: 1 }
    let edgeRgb: [number, number, number] = parseRgb(EDGE_FALLBACK)
    let highlightRgb: [number, number, number] = parseRgb(HIGHLIGHT_FALLBACK)

    const dpr = () => Math.min(window.devicePixelRatio || 1, 2)

    const setShining = (on: boolean) => {
      if (on) {
        btn.dataset.specular = 'on'
        fx.style.visibility = 'visible'
      } else {
        delete btn.dataset.specular
        fx.style.visibility = 'hidden'
      }
    }

    const stopLoop = () => {
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    }

    const measure = () => {
      const rect = btn.getBoundingClientRect()
      size.w = rect.width
      size.h = rect.height
      return rect
    }

    const discard = () => {
      pointerAngle = null
      proximityT = 0
      bright = 0
      angle = 2.4
      idleAngle = 2.4
      stopLoop()
      setShining(false)
      if (gl && canvas && canvas.width && canvas.height) {
        gl.clear(gl.COLOR_BUFFER_BIT)
      }
    }

    const applyPointer = (clientX: number, clientY: number) => {
      const rect = measure()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = Math.max(rect.left - clientX, 0, clientX - rect.right)
      const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom)
      const dist = Math.hypot(dx, dy)
      if (dist === 0) {
        const nx = (clientX - cx) / (rect.width / 2 || 1)
        const ny = (cy - clientY) / (rect.height / 2 || 1)
        pointerAngle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15
      } else {
        pointerAngle = Math.atan2(cy - clientY, clientX - cx)
      }
      const t = Math.max(0, 1 - dist / PROXIMITY)
      proximityT = t * t * (3 - 2 * t)
    }

    const draw = (now: number) => {
      if (!gl || !loc || !canvas) return
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      idleAngle += SPEED * dt
      const target = pointerAngle ?? idleAngle
      const diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      angle += diff * (1 - Math.exp(-dt * 7))
      bright += (proximityT - bright) * (1 - Math.exp(-dt * 8))

      const shining = bright > IDLE_EPS || proximityT > IDLE_EPS
      setShining(shining)
      if (!shining) {
        stopLoop()
        return
      }

      measure()
      const px = dpr()
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(loc.uCenter, (PAD + size.w / 2) * px, (PAD + size.h / 2) * px)
      gl.uniform2f(loc.uHalfSize, (size.w / 2) * px, (size.h / 2) * px)
      gl.uniform1f(loc.uAngle, angle)
      gl.uniform1f(loc.uRadius, Math.min(RADIUS, Math.min(size.w, size.h) / 2) * px)
      gl.uniform1f(loc.uPx, px)
      gl.uniform3f(loc.uLineColor, highlightRgb[0], highlightRgb[1], highlightRgb[2])
      gl.uniform3f(loc.uBaseColor, edgeRgb[0], edgeRgb[1], edgeRgb[2])
      gl.uniform1f(loc.uIntensity, INTENSITY * bright)
      gl.uniform1f(loc.uShineSize, (SHINE_SIZE * Math.PI) / 180)
      gl.uniform1f(loc.uShineFade, (SHINE_FADE * Math.PI) / 180)
      gl.uniform1f(loc.uThickness, THICKNESS * px)
      gl.uniform1f(loc.uBaseWidth, px)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      draw(now)
    }

    const startLoop = () => {
      if (raf || !gl) return
      last = performance.now()
      raf = requestAnimationFrame(tick)
    }

    const ensureGl = () => {
      if (gl) return true

      canvas = document.createElement('canvas')
      const context = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        preserveDrawingBuffer: false,
        powerPreference: 'low-power',
      })
      if (!context) {
        canvas = null
        return false
      }
      gl = context

      const vert = compile(gl, gl.VERTEX_SHADER, VERT)
      const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG)
      const program = gl.createProgram()
      if (!vert || !frag || !program) {
        gl.getExtension('WEBGL_lose_context')?.loseContext()
        gl = null
        canvas = null
        return false
      }
      gl.attachShader(program, vert)
      gl.attachShader(program, frag)
      gl.bindAttribLocation(program, 0, 'position')
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.getExtension('WEBGL_lose_context')?.loseContext()
        gl = null
        canvas = null
        return false
      }
      gl.useProgram(program)

      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.clearColor(0, 0, 0, 0)

      loc = {
        uCenter: gl.getUniformLocation(program, 'uCenter'),
        uHalfSize: gl.getUniformLocation(program, 'uHalfSize'),
        uRadius: gl.getUniformLocation(program, 'uRadius'),
        uAngle: gl.getUniformLocation(program, 'uAngle'),
        uPx: gl.getUniformLocation(program, 'uPx'),
        uLineColor: gl.getUniformLocation(program, 'uLineColor'),
        uBaseColor: gl.getUniformLocation(program, 'uBaseColor'),
        uIntensity: gl.getUniformLocation(program, 'uIntensity'),
        uShineSize: gl.getUniformLocation(program, 'uShineSize'),
        uShineFade: gl.getUniformLocation(program, 'uShineFade'),
        uThickness: gl.getUniformLocation(program, 'uThickness'),
        uBaseWidth: gl.getUniformLocation(program, 'uBaseWidth'),
      }

      const px = dpr()
      const cssW = MAX_BTN_W + PAD * 2
      const cssH = MAX_BTN_H + PAD * 2
      canvas.width = Math.round(cssW * px)
      canvas.height = Math.round(cssH * px)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      gl.viewport(0, 0, canvas.width, canvas.height)
      fx.appendChild(canvas)
      fx.style.visibility = 'hidden'
      skipKeyRef.current = motionKeyRef.current
      edgeRgb = readCssColor(btn, '--lc-text-secondary', EDGE_FALLBACK)
      highlightRgb = readCssColor(btn, '--color-primary-500', HIGHLIGHT_FALLBACK)
      measure()
      return true
    }

    ensureGlRef.current = ensureGl
    discardRef.current = discard

    resetRef.current = () => {
      frozenUntil = performance.now() + settleMsRef.current
      discard()
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(() => {
        frozenUntil = 0
      }, settleMsRef.current)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!enabledRef.current) return
      if (performance.now() < frozenUntil) return
      if (!ensureGl()) return
      applyPointer(event.clientX, event.clientY)
      if (proximityT > IDLE_EPS) startLoop()
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    if (enabledRef.current) ensureGl()

    return () => {
      resetRef.current = () => {}
      discardRef.current = () => {}
      ensureGlRef.current = () => false
      stopLoop()
      window.clearTimeout(settleTimer)
      window.removeEventListener('pointermove', onPointerMove)
      delete btn.dataset.specular
      fx.style.visibility = ''
      if (canvas && canvas.parentNode === fx) fx.removeChild(canvas)
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  useEffect(() => {
    if (enabled) ensureGlRef.current()
    else discardRef.current()
  }, [enabled])

  useLayoutEffect(() => {
    if (skipKeyRef.current === motionKey) return
    skipKeyRef.current = motionKey
    resetRef.current()
  }, [motionKey])

  return (
    <button
      ref={btnRef}
      type="button"
      className={className}
      aria-label="Tell me more"
      onClick={onClick}
    >
      <span ref={fxRef} className={styles.actionSpecular} aria-hidden />
      <span className={styles.actionInner}>{children}</span>
    </button>
  )
}
