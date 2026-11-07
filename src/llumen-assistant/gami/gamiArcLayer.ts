/**
 * The GAMI routes as arcs through the sky: each great circle rises to a peak above its midpoint, drawn
 * as a screen-space ribbon by a custom layer, since Mapbox's elevated lines don't render on the globe.
 * Positions are kept on both the globe and web mercator and blended as the map leaves the globe. The
 * map's depth buffer hides arcs above the globe, so the shader hides whatever the globe itself covers.
 */
import mapboxgl from 'mapbox-gl'
import { greatCircle, type LngLat } from './gamiGeo'

export type SkyArc = { from: LngLat; to: LngLat; color: string; width?: number; opacity?: number }

const STEPS = 96
const EARTH_RADIUS_M = 6371008.8
/** Mapbox's globe radius in its ECEF units. */
const GLOBE_RADIUS = 8192 / Math.PI / 2
/** The peak height as a share of the route's length, within a floor and a ceiling. */
const PEAK_SHARE = 0.28
const PEAK_MIN_M = 40_000
const PEAK_MAX_M = 1_100_000

/** Floats per vertex: position, previous and next on globe and mercator (18), side, progress, rgba, width. */
const STRIDE = 25

const VERTEX = `#version 300 es
precision highp float;
uniform mat4 u_matrix;
uniform mat4 u_globe_to_merc;
uniform float u_transition;
uniform vec2 u_resolution;
uniform float u_pixel_ratio;
uniform vec3 u_camera_ecef;
uniform float u_globe_radius;
in vec3 a_ecef;
in vec3 a_merc;
in vec3 a_prev_ecef;
in vec3 a_prev_merc;
in vec3 a_next_ecef;
in vec3 a_next_merc;
in float a_side;
in float a_progress;
in vec4 a_color;
in float a_width;
out float v_side;
out float v_progress;
out vec4 v_color;
out float v_half;
out float v_shown;

// 0 when the globe stands between the camera and p.
float unblocked(vec3 p) {
  vec3 d = p - u_camera_ecef;
  float a = dot(d, d);
  float b = 2.0 * dot(u_camera_ecef, d);
  float c = dot(u_camera_ecef, u_camera_ecef) - u_globe_radius * u_globe_radius;
  float disc = b * b - 4.0 * a * c;
  if (disc <= 0.0) return 1.0;
  float t = (-b - sqrt(disc)) / (2.0 * a);
  return t > 0.0 && t < 1.0 ? 0.0 : 1.0;
}

vec4 project(vec3 ecef, vec3 merc) {
  vec4 globe = u_globe_to_merc * vec4(ecef, 1.0);
  globe /= globe.w;
  return u_matrix * vec4(mix(globe.xyz, merc, u_transition), 1.0);
}

vec2 screen(vec4 clip) {
  return clip.xy / clip.w * u_resolution * 0.5;
}

void main() {
  vec4 clip = project(a_ecef, a_merc);
  vec2 here = screen(clip);
  vec2 dir = screen(project(a_next_ecef, a_next_merc)) - screen(project(a_prev_ecef, a_prev_merc));
  dir = length(dir) > 0.0001 ? normalize(dir) : vec2(1.0, 0.0);
  float half_px = (a_width * 0.5 + 0.75) * u_pixel_ratio;
  vec2 offset = vec2(-dir.y, dir.x) * half_px * a_side;
  clip.xy += offset / (u_resolution * 0.5) * clip.w;
  gl_Position = clip;
  v_side = a_side;
  v_progress = a_progress;
  v_color = a_color;
  v_half = half_px;
  v_shown = u_transition > 0.5 ? 1.0 : unblocked(a_ecef);
}
`

const FRAGMENT = `#version 300 es
precision highp float;
uniform float u_grow;
uniform float u_alpha;
in float v_side;
in float v_progress;
in vec4 v_color;
in float v_half;
in float v_shown;
out vec4 fragColor;

void main() {
  if (v_progress > u_grow || v_shown < 0.5) discard;
  float edge = 1.0 - smoothstep(1.0 - 1.5 / v_half, 1.0, abs(v_side));
  float alpha = v_color.a * u_alpha * edge;
  fragColor = vec4(v_color.rgb * alpha, alpha);
}
`

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? [...value].map((char) => char + char).join('') : value
  const n = Number.parseInt(full.slice(0, 6), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function ecef([lng, lat]: LngLat, altitudeM: number): [number, number, number] {
  const radius = GLOBE_RADIUS * (1 + altitudeM / EARTH_RADIUS_M)
  const phi = (lat * Math.PI) / 180
  const lambda = (lng * Math.PI) / 180
  return [Math.cos(phi) * Math.sin(lambda) * radius, -Math.sin(phi) * radius, Math.cos(phi) * Math.cos(lambda) * radius]
}

function merc(at: LngLat, altitudeM: number): [number, number, number] {
  const point = mapboxgl.MercatorCoordinate.fromLngLat(at, altitudeM)
  return [point.x, point.y, point.z]
}

function routeLengthM(from: LngLat, to: LngLat) {
  const [a, b] = [from, to].map(([lng, lat]) => [(lng * Math.PI) / 180, (lat * Math.PI) / 180])
  const h = Math.sin((b[1] - a[1]) / 2) ** 2 + Math.cos(a[1]) * Math.cos(b[1]) * Math.sin((b[0] - a[0]) / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

type Geometry = { vertices: Float32Array; indices: Uint32Array }

const geometryCache = new WeakMap<SkyArc, { lift: number; geometry: Geometry }>()

/** One arc's ribbon: two vertices per point along the route, one each side. */
function arcGeometry(arc: SkyArc, lift: number): Geometry {
  const cached = geometryCache.get(arc)
  if (cached && cached.lift === lift) return cached.geometry
  const path = greatCircle(arc.from, arc.to, STEPS)
  const peak = Math.min(PEAK_MAX_M, Math.max(PEAK_MIN_M, routeLengthM(arc.from, arc.to) * PEAK_SHARE)) * lift
  const last = path.length - 1
  const points = path.map((at, i) => {
    const t = i / last
    const altitude = peak * Math.sin(Math.PI * t)
    return { ecef: ecef(at, altitude), merc: merc(at, altitude), t }
  })
  const [r, g, b] = hexToRgb(arc.color)
  const vertices = new Float32Array(points.length * 2 * STRIDE)
  points.forEach((point, i) => {
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(last, i + 1)]
    for (const [k, side] of [-1, 1].entries()) {
      vertices.set(
        [...point.ecef, ...point.merc, ...prev.ecef, ...prev.merc, ...next.ecef, ...next.merc, side, point.t, r, g, b, arc.opacity ?? 0.9, arc.width ?? 2],
        (i * 2 + k) * STRIDE,
      )
    }
  })
  const indices = new Uint32Array(last * 6)
  for (let i = 0; i < last; i += 1) {
    const v = i * 2
    indices.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6)
  }
  const geometry = { vertices, indices }
  geometryCache.set(arc, { lift, geometry })
  return geometry
}

const ATTRIBUTES: [name: string, size: number][] = [
  ['a_ecef', 3],
  ['a_merc', 3],
  ['a_prev_ecef', 3],
  ['a_prev_merc', 3],
  ['a_next_ecef', 3],
  ['a_next_merc', 3],
  ['a_side', 1],
  ['a_progress', 1],
  ['a_color', 4],
  ['a_width', 1],
]

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Arc shader failed')
  return shader
}

export class SkyArcLayer implements mapboxgl.CustomLayerInterface {
  readonly id: string
  readonly type = 'custom' as const
  readonly renderingMode = '3d' as const
  private map: mapboxgl.Map | null = null
  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private vertexBuffer: WebGLBuffer | null = null
  private indexBuffer: WebGLBuffer | null = null
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private indexCount = 0
  private dirty = true
  private arcs: SkyArc[] = []
  private lift = 1
  private grow = 1

  constructor(id: string) {
    this.id = id
  }

  /** The arcs to draw; `grow` (0–1) draws them out from their origin, `lift` 0 lays them on the ground. */
  setArcs(arcs: SkyArc[], grow: number, lift: number) {
    if (lift !== this.lift || arcs.length !== this.arcs.length || arcs.some((arc, i) => arc !== this.arcs[i])) {
      this.arcs = arcs
      this.lift = lift
      this.dirty = true
    }
    this.grow = grow
    this.map?.triggerRepaint()
  }

  onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    this.map = map
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    this.program = program
    for (const name of [
      'u_matrix',
      'u_globe_to_merc',
      'u_transition',
      'u_resolution',
      'u_pixel_ratio',
      'u_camera_ecef',
      'u_globe_radius',
      'u_grow',
      'u_alpha',
    ]) {
      this.uniforms[name] = gl.getUniformLocation(program, name)
    }
    this.vertexBuffer = gl.createBuffer()
    this.indexBuffer = gl.createBuffer()
    this.vao = gl.createVertexArray()
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
    let offset = 0
    for (const [name, size] of ATTRIBUTES) {
      const location = gl.getAttribLocation(program, name)
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, STRIDE * 4, offset * 4)
      offset += size
    }
    gl.bindVertexArray(null)
    this.dirty = true
  }

  onRemove(_map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    gl.deleteProgram(this.program)
    gl.deleteBuffer(this.vertexBuffer)
    gl.deleteBuffer(this.indexBuffer)
    gl.deleteVertexArray(this.vao)
    this.map = null
  }

  private upload(gl: WebGL2RenderingContext) {
    const parts = this.arcs.map((arc) => arcGeometry(arc, this.lift))
    const vertexCount = parts.reduce((sum, part) => sum + part.vertices.length / STRIDE, 0)
    const vertices = new Float32Array(vertexCount * STRIDE)
    const indices = new Uint32Array(parts.reduce((sum, part) => sum + part.indices.length, 0))
    let base = 0
    let at = 0
    for (const part of parts) {
      vertices.set(part.vertices, base * STRIDE)
      for (let i = 0; i < part.indices.length; i += 1) indices[at + i] = part.indices[i] + base
      base += part.vertices.length / STRIDE
      at += part.indices.length
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW)
    this.indexCount = indices.length
    this.dirty = false
  }

  render(
    gl: WebGL2RenderingContext,
    matrix: number[],
    _projection?: unknown,
    globeToMercator?: number[],
    transition?: number,
  ) {
    if (!this.program || !this.vao) return
    if (this.dirty) {
      gl.bindVertexArray(this.vao)
      this.upload(gl)
      gl.bindVertexArray(null)
    }
    if (!this.indexCount || this.grow <= 0) return
    gl.useProgram(this.program)
    gl.uniformMatrix4fv(this.uniforms.u_matrix, false, matrix)
    gl.uniformMatrix4fv(this.uniforms.u_globe_to_merc, false, globeToMercator ?? IDENTITY)
    gl.uniform1f(this.uniforms.u_transition, globeToMercator ? (transition ?? 0) : 1)
    gl.uniform2f(this.uniforms.u_resolution, gl.drawingBufferWidth, gl.drawingBufferHeight)
    gl.uniform1f(this.uniforms.u_pixel_ratio, window.devicePixelRatio || 1)
    gl.uniform1f(this.uniforms.u_grow, this.grow)
    gl.uniform1f(this.uniforms.u_alpha, Math.min(1, this.grow))
    gl.uniform3fv(this.uniforms.u_camera_ecef, globeToMercator ? cameraInGlobe(matrix, globeToMercator) : [0, 0, 0])
    gl.uniform1f(this.uniforms.u_globe_radius, GLOBE_RADIUS * 0.999)
    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.depthMask(false)
    gl.bindVertexArray(this.vao)
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0)
    gl.bindVertexArray(null)
    gl.depthMask(true)
  }
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

/** Column-major `a × b`. */
function multiply(a: number[], b: number[]) {
  const out = new Array<number>(16)
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[col * 4 + k]
      out[col * 4 + row] = sum
    }
  }
  return out
}

/** Column-major inverse by cofactors. */
function invert(m: number[]) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m
  const b00 = a00 * a11 - a01 * a10
  const b01 = a00 * a12 - a02 * a10
  const b02 = a00 * a13 - a03 * a10
  const b03 = a01 * a12 - a02 * a11
  const b04 = a01 * a13 - a03 * a11
  const b05 = a02 * a13 - a03 * a12
  const b06 = a20 * a31 - a21 * a30
  const b07 = a20 * a32 - a22 * a30
  const b08 = a20 * a33 - a23 * a30
  const b09 = a21 * a32 - a22 * a31
  const b10 = a21 * a33 - a23 * a31
  const b11 = a22 * a33 - a23 * a32
  const inv = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06)
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * inv,
    (a02 * b10 - a01 * b11 - a03 * b09) * inv,
    (a31 * b05 - a32 * b04 + a33 * b03) * inv,
    (a22 * b04 - a21 * b05 - a23 * b03) * inv,
    (a12 * b08 - a10 * b11 - a13 * b07) * inv,
    (a00 * b11 - a02 * b08 + a03 * b07) * inv,
    (a32 * b02 - a30 * b05 - a33 * b01) * inv,
    (a20 * b05 - a22 * b02 + a23 * b01) * inv,
    (a10 * b10 - a11 * b08 + a13 * b06) * inv,
    (a01 * b08 - a00 * b10 - a03 * b06) * inv,
    (a30 * b04 - a31 * b02 + a33 * b00) * inv,
    (a21 * b02 - a20 * b04 - a23 * b00) * inv,
    (a11 * b07 - a10 * b09 - a12 * b06) * inv,
    (a00 * b09 - a01 * b07 + a02 * b06) * inv,
    (a31 * b01 - a30 * b03 - a32 * b00) * inv,
    (a20 * b03 - a21 * b01 + a22 * b00) * inv,
  ]
}

/** The camera in globe units: the point the view projects to clip (0, 0, z, 0). */
function cameraInGlobe(matrix: number[], globeToMercator: number[]): [number, number, number] {
  const inverse = invert(multiply(matrix, globeToMercator))
  const w = inverse[11]
  return [inverse[8] / w, inverse[9] / w, inverse[10] / w]
}
