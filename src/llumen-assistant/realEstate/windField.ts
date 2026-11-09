/**
 * A wind field drawn as streamlines: short glowing trails that drift with the wind, swaying gently
 * across the field, fading in where they start and out as they die, like a gridded wind map. A custom
 * WebGL layer, so a thousand trails redraw every frame with the camera.
 */
import mapboxgl from 'mapbox-gl'
import type { LngLat } from './estateGeo'

/** Where the wind blows: `bearing` is where it blows toward, clockwise from north. */
export type EstateWind = {
  center: LngLat
  /** Half the side of the square the trails fill. */
  radiusKm: number
  bearing: number
  color: string
  group: string
}

const PARTICLES = 2400
/** Points kept along each trail, and how often the oldest gives way to a new one. */
const TRAIL = 14
const SAMPLE_S = 0.09
/** How fast the trails drift (km/s) and how far the field sways off the mean bearing (degrees). */
const SPEED_KMS = 0.12
const SWAY_DEG = 24
const LIFE_S = [2.6, 5.4] as const
const FADE_IN_S = 0.5
const FADE_OUT_S = 0.9
/** Half a trail's width in CSS px (its edges soften inside it), and its brightness at the head. */
const WIDTH_PX = 1.1
const HEAD_ALPHA = 0.62

const rad = (deg: number) => (deg * Math.PI) / 180
const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

/** The field's direction at `x`, `y` km from the centre, `t` s in: the mean bearing with a slow sway. */
function heading(bearing: number, x: number, y: number, t: number) {
  const sway =
    Math.sin(0.9 * x + 0.32 * t) * Math.cos(0.7 * y - 0.18 * t) * 0.7 + Math.sin(1.6 * y + 0.5 * x + 0.24 * t) * 0.3
  return rad(bearing + SWAY_DEG * sway)
}

function speed(x: number, y: number, t: number) {
  return SPEED_KMS * (0.7 + 0.45 * (0.5 + 0.5 * Math.sin(1.3 * x + 0.8 * y + 0.3 * t)))
}

const VERTEX = `
attribute vec2 a_corner;
attribute vec4 a_segment;
attribute vec2 a_alpha;
uniform mat4 u_matrix;
uniform vec2 u_viewport;
uniform float u_width;
varying float v_alpha;
varying float v_side;
void main() {
  vec4 a = u_matrix * vec4(a_segment.xy, 0.0, 1.0);
  vec4 b = u_matrix * vec4(a_segment.zw, 0.0, 1.0);
  vec2 sa = a.xy / a.w * u_viewport;
  vec2 sb = b.xy / b.w * u_viewport;
  vec2 dir = sb - sa;
  float len = length(dir);
  dir = len > 0.0001 ? dir / len : vec2(1.0, 0.0);
  vec4 p = mix(a, b, a_corner.x);
  p.xy += vec2(-dir.y, dir.x) * a_corner.y * u_width / u_viewport * p.w;
  gl_Position = p;
  v_alpha = mix(a_alpha.x, a_alpha.y, a_corner.x);
  v_side = a_corner.y;
}`

const FRAGMENT = `
precision mediump float;
uniform vec4 u_color;
varying float v_alpha;
varying float v_side;
void main() {
  float a = u_color.a * v_alpha * (1.0 - smoothstep(0.35, 1.0, abs(v_side)));
  gl_FragColor = vec4(u_color.rgb * a, a);
}`

/** Two triangles across a segment: along it 0 → 1, across it −1 → 1. */
const QUAD = new Float32Array([0, -1, 1, -1, 1, 1, 0, -1, 1, 1, 0, 1])

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}

function parseColor(color: string): [number, number, number, number] {
  const match = color.match(/rgba?\(([^)]+)\)/)
  if (!match) return [1, 1, 1, 1]
  const [r, g, b, a = '1'] = match[1].split(',').map((part) => part.trim())
  return [Number(r) / 255, Number(g) / 255, Number(b) / 255, Number(a)]
}

export class WindField implements mapboxgl.CustomLayerInterface {
  readonly id: string
  readonly type = 'custom' as const
  readonly renderingMode = '3d' as const
  readonly slot = 'middle'
  private map: mapboxgl.Map | null = null
  private wind: EstateWind | null = null
  private grow = 0
  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private quad: WebGLBuffer | null = null
  private segments: WebGLBuffer | null = null
  /** Each trail's points, km east and north of the centre, newest last. */
  private trails = new Float64Array(PARTICLES * TRAIL * 2)
  private ages = new Float64Array(PARTICLES)
  private lives = new Float64Array(PARTICLES)
  private sinceSample = 0
  private clock = 0
  private last = 0
  private seed = 1
  private instances = new Float32Array(PARTICLES * (TRAIL - 1) * 6)

  constructor(id: string) {
    this.id = id
  }

  /** Shows `wind` at `grow` (0 hidden, 1 full), or nothing for null; a new field starts afresh. */
  set(wind: EstateWind | null, grow: number) {
    const fresh = wind !== null && (this.wind === null || this.wind.center !== wind.center || this.wind.radiusKm !== wind.radiusKm)
    this.wind = wind
    this.grow = grow
    if (fresh) this.scatter()
    this.map?.triggerRepaint()
  }

  onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    this.map = map
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    this.program = program
    this.vao = gl.createVertexArray()
    gl.bindVertexArray(this.vao)
    this.quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW)
    const corner = gl.getAttribLocation(program, 'a_corner')
    gl.enableVertexAttribArray(corner)
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0)
    this.segments = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.segments)
    gl.bufferData(gl.ARRAY_BUFFER, this.instances.byteLength, gl.DYNAMIC_DRAW)
    const segment = gl.getAttribLocation(program, 'a_segment')
    const alpha = gl.getAttribLocation(program, 'a_alpha')
    gl.enableVertexAttribArray(segment)
    gl.vertexAttribPointer(segment, 4, gl.FLOAT, false, 24, 0)
    gl.vertexAttribDivisor(segment, 1)
    gl.enableVertexAttribArray(alpha)
    gl.vertexAttribPointer(alpha, 2, gl.FLOAT, false, 24, 16)
    gl.vertexAttribDivisor(alpha, 1)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    this.scatter()
  }

  onRemove(_map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    gl.deleteProgram(this.program)
    gl.deleteVertexArray(this.vao)
    gl.deleteBuffer(this.quad)
    gl.deleteBuffer(this.segments)
    this.map = null
  }

  render(gl: WebGL2RenderingContext, matrix: number[]) {
    const wind = this.wind
    const map = this.map
    if (!wind || !map || this.grow <= 0 || !this.program) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const now = performance.now() / 1000
    const dt = this.last ? Math.min(0.05, now - this.last) : 0
    this.last = now
    if (!reduce) this.step(wind, dt)
    const count = this.fill(reduce)

    const origin = mapboxgl.MercatorCoordinate.fromLngLat(wind.center)
    const km = origin.meterInMercatorCoordinateUnits() * 1000
    const m = Array.from(matrix)
    const local = new Float32Array(16)
    for (let row = 0; row < 4; row += 1) {
      local[row] = m[row] * km
      local[4 + row] = -m[4 + row] * km
      local[8 + row] = m[8 + row]
      local[12 + row] = origin.x * m[row] + origin.y * m[4 + row] + m[12 + row]
    }

    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.segments)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instances, 0, count * 6)
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_matrix'), false, local)
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_viewport'), gl.drawingBufferWidth / 2, gl.drawingBufferHeight / 2)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_width'), WIDTH_PX * window.devicePixelRatio)
    const [r, g, b, a] = parseColor(wind.color)
    gl.uniform4f(gl.getUniformLocation(this.program, 'u_color'), r, g, b, a * this.grow)
    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    if (!reduce) map.triggerRepaint()
  }

  private random() {
    this.seed = (this.seed * 16807) % 2147483647
    return (this.seed - 1) / 2147483646
  }

  /** Starts every trail somewhere new, part way through its life so they don't all fade in at once. */
  private scatter() {
    for (let index = 0; index < PARTICLES; index += 1) this.spawn(index, this.random())
  }

  /** A trail laid out ahead of a fresh point, so even a still field shows streamlines. */
  private spawn(index: number, through = 0) {
    const wind = this.wind
    const radius = wind?.radiusKm ?? 1
    let x = (this.random() * 2 - 1) * radius
    let y = (this.random() * 2 - 1) * radius
    const base = index * TRAIL * 2
    for (let point = 0; point < TRAIL; point += 1) {
      this.trails[base + point * 2] = x
      this.trails[base + point * 2 + 1] = y
      if (!wind) continue
      const angle = heading(wind.bearing, x, y, this.clock)
      const step = speed(x, y, this.clock) * SAMPLE_S
      x += Math.sin(angle) * step
      y += Math.cos(angle) * step
    }
    this.lives[index] = LIFE_S[0] + (LIFE_S[1] - LIFE_S[0]) * this.random()
    this.ages[index] = through * this.lives[index]
  }

  /** Moves each trail's head on with the wind, sheds its oldest point on each sample, and respawns the dead. */
  private step(wind: EstateWind, dt: number) {
    this.clock += dt
    this.sinceSample += dt
    const shed = this.sinceSample >= SAMPLE_S
    if (shed) this.sinceSample %= SAMPLE_S
    const { trails } = this
    for (let index = 0; index < PARTICLES; index += 1) {
      this.ages[index] += dt
      const base = index * TRAIL * 2
      const head = base + (TRAIL - 1) * 2
      const x = trails[head]
      const y = trails[head + 1]
      const out = Math.abs(x) > wind.radiusKm || Math.abs(y) > wind.radiusKm
      if (this.ages[index] >= this.lives[index] || out) {
        this.spawn(index)
        continue
      }
      if (shed) trails.copyWithin(base, base + 2, base + TRAIL * 2)
      const angle = heading(wind.bearing, x, y, this.clock)
      const step = speed(x, y, this.clock) * dt
      trails[head] = x + Math.sin(angle) * step
      trails[head + 1] = y + Math.cos(angle) * step
    }
  }

  /** Writes each trail's segments, brightest at the head and faded by its age; returns how many. */
  private fill(still: boolean) {
    const { trails, instances } = this
    let count = 0
    for (let index = 0; index < PARTICLES; index += 1) {
      const age = this.ages[index]
      const fade = still ? 1 : smooth(age / FADE_IN_S) * smooth((this.lives[index] - age) / FADE_OUT_S)
      if (fade <= 0.01) continue
      const base = index * TRAIL * 2
      for (let point = 0; point < TRAIL - 1; point += 1) {
        const at = count * 6
        instances[at] = trails[base + point * 2]
        instances[at + 1] = trails[base + point * 2 + 1]
        instances[at + 2] = trails[base + point * 2 + 2]
        instances[at + 3] = trails[base + point * 2 + 3]
        instances[at + 4] = HEAD_ALPHA * fade * (point / (TRAIL - 1)) ** 1.4
        instances[at + 5] = HEAD_ALPHA * fade * ((point + 1) / (TRAIL - 1)) ** 1.4
        count += 1
      }
    }
    return count
  }
}
