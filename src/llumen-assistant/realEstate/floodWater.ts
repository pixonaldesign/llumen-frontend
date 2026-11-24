/**
 * Baked flood depth laid on the ground, as Map 3D draws its live flood: depth sampled smoothly across
 * the grid, coloured by a ramp in the shader, the shoreline eased in over a few centimetres. The depth
 * frames come three to an image (one per channel); the layer blends between two of them at any time
 * between frames, so the water creeps outward instead of stepping.
 */
import mapboxgl from 'mapbox-gl'
import type { LngLat } from './estateGeo'

/** Depth frames over the ground: their corners run top-left, top-right, bottom-right, bottom-left. */
export type EstateWater = {
  /** Images of three frames each, oldest first; a channel holds sqrt(depth / `depthMaxM`) as a byte. */
  packs: readonly string[]
  frames: number
  framesPerHour: number
  depthMaxM: number
  corners: [LngLat, LngLat, LngLat, LngLat]
  opacity?: number
  group: string
}

/** Hours from the first frame to the last: where the layer rests until told otherwise. */
export const waterEnd = (water: EstateWater) => (water.frames - 1) / water.framesPerHour

/** Depth (m) to colour, shallow to deep, and where the shoreline fades in. */
const RAMP: [number, string][] = [
  [0, '#7ce2ff'],
  [0.3, '#28a0ff'],
  [0.8, '#2854e6'],
  [1.5, '#4628be'],
]
const EDGE_M: [number, number] = [0.02, 0.1]
const MAX_ALPHA = 0.92

const hex = (color: string) => [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16) / 255).join(', ')

const VERTEX = `
attribute vec2 a_pos;
attribute vec2 a_uv;
uniform mat4 u_matrix;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
}`

const FRAGMENT = `
precision highp float;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform vec3 u_fromChannel;
uniform vec3 u_toChannel;
uniform float u_mix;
uniform float u_depthMax;
uniform float u_opacity;
varying vec2 v_uv;

float depthIn(sampler2D frames, vec3 channel) {
  float v = dot(texture2D(frames, v_uv).rgb, channel);
  return v * v * u_depthMax;
}

vec3 ramp(float d) {
${RAMP.slice(1)
  .map(([at], index) => {
    const [from, fromColor] = RAMP[index]
    const toColor = RAMP[index + 1][1]
    return `  if (d < ${at.toFixed(3)}) return mix(vec3(${hex(fromColor)}), vec3(${hex(toColor)}), (d - ${from.toFixed(3)}) / ${(at - from).toFixed(3)});`
  })
  .join('\n')}
  return vec3(${hex(RAMP[RAMP.length - 1][1])});
}

void main() {
  float d = mix(depthIn(u_from, u_fromChannel), depthIn(u_to, u_toChannel), u_mix);
  float a = smoothstep(${EDGE_M[0].toFixed(3)}, ${EDGE_M[1].toFixed(3)}, d) * ${MAX_ALPHA.toFixed(2)} * u_opacity;
  if (a <= 0.002) discard;
  gl_FragColor = vec4(ramp(d) * a, a);
}`

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}

const CHANNELS: [number, number, number][] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

export class FloodWater implements mapboxgl.CustomLayerInterface {
  readonly id: string
  readonly type = 'custom' as const
  readonly renderingMode = '3d' as const
  readonly slot = 'middle'
  private map: mapboxgl.Map | null = null
  private gl: WebGL2RenderingContext | null = null
  private water: EstateWater | null = null
  private grow = 0
  private hours: number | null = null
  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private buffer: WebGLBuffer | null = null
  private images: HTMLImageElement[] = []
  private textures: (WebGLTexture | null)[] = []

  constructor(id: string) {
    this.id = id
  }

  /** Shows `water` at `grow` (0 hidden, 1 full), or nothing for null. New frames load in the background. */
  set(water: EstateWater | null, grow: number) {
    if (water && water.packs !== this.water?.packs) this.load(water)
    if (water && this.water && water.corners !== this.water.corners) this.uploadQuad(water)
    this.water = water ?? this.water
    this.grow = water ? grow : 0
    this.map?.triggerRepaint()
  }

  /** Hours since the first frame, between frames included; null rests on the last frame. */
  setTime(hours: number | null) {
    if (hours === this.hours) return
    this.hours = hours
    this.map?.triggerRepaint()
  }

  onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    this.map = map
    this.gl = gl
    const program = gl.createProgram()!
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    this.program = program
    this.buffer = gl.createBuffer()
    this.vao = gl.createVertexArray()
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    const pos = gl.getAttribLocation(program, 'a_pos')
    const uv = gl.getAttribLocation(program, 'a_uv')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(uv)
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    if (this.water) this.uploadQuad(this.water)
  }

  onRemove(_map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    gl.deleteProgram(this.program)
    gl.deleteVertexArray(this.vao)
    gl.deleteBuffer(this.buffer)
    this.textures.forEach((texture) => texture && gl.deleteTexture(texture))
    this.textures = []
    this.program = null
    this.map = null
    this.gl = null
  }

  render(gl: WebGL2RenderingContext, matrix: number[]) {
    const water = this.water
    if (!water || this.grow <= 0 || !this.program || !this.local) return
    const last = water.frames - 1
    const at = Math.max(0, Math.min(last, (this.hours ?? waterEnd(water)) * water.framesPerHour))
    const from = Math.floor(at)
    const to = Math.min(last, from + 1)
    const fromTexture = this.texture(gl, Math.floor(from / 3))
    const toTexture = this.texture(gl, Math.floor(to / 3))
    if (!fromTexture || !toTexture) return

    const { origin, km } = this.local
    const m = Array.from(matrix)
    const local = new Float32Array(16)
    for (let row = 0; row < 4; row += 1) {
      local[row] = m[row] * km
      local[4 + row] = -m[4 + row] * km
      local[8 + row] = m[8 + row]
      local[12 + row] = origin.x * m[row] + origin.y * m[4 + row] + m[12 + row]
    }

    const program = this.program
    gl.useProgram(program)
    gl.bindVertexArray(this.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, fromTexture)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, toTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_from'), 0)
    gl.uniform1i(gl.getUniformLocation(program, 'u_to'), 1)
    gl.uniform3fv(gl.getUniformLocation(program, 'u_fromChannel'), CHANNELS[from % 3])
    gl.uniform3fv(gl.getUniformLocation(program, 'u_toChannel'), CHANNELS[to % 3])
    gl.uniform1f(gl.getUniformLocation(program, 'u_mix'), at - from)
    gl.uniform1f(gl.getUniformLocation(program, 'u_depthMax'), water.depthMaxM)
    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), (water.opacity ?? 1) * this.grow)
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_matrix'), false, local)
    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.bindVertexArray(null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  /** The quad's corners in km east and north of its top-left one, which anchors the matrix: float32 holds km where it would blur mercator. */
  private local: { origin: mapboxgl.MercatorCoordinate; km: number } | null = null

  private uploadQuad(water: EstateWater) {
    const gl = this.gl
    if (!gl || !this.buffer) return
    const origin = mapboxgl.MercatorCoordinate.fromLngLat(water.corners[0])
    const km = origin.meterInMercatorCoordinateUnits() * 1000
    const at = (corner: LngLat) => {
      const point = mapboxgl.MercatorCoordinate.fromLngLat(corner)
      return [(point.x - origin.x) / km, -(point.y - origin.y) / km]
    }
    const [tl, tr, br, bl] = water.corners.map(at)
    const quad = new Float32Array([...tl, 0, 0, ...tr, 1, 0, ...bl, 0, 1, ...br, 1, 1])
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    this.local = { origin, km }
  }

  private load(water: EstateWater) {
    const gl = this.gl
    if (gl) this.textures.forEach((texture) => texture && gl.deleteTexture(texture))
    this.textures = water.packs.map(() => null)
    this.images = water.packs.map((url) => {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => this.map?.triggerRepaint()
      image.src = url
      return image
    })
    if (gl) this.uploadQuad(water)
  }

  /** The pack's texture once its image has arrived, uploaded raw: no premultiplying, no colour conversion. */
  private texture(gl: WebGL2RenderingContext, index: number) {
    const ready = this.textures[index]
    if (ready) return ready
    const image = this.images[index]
    if (!image?.complete || !image.naturalWidth) return null
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    const premultiply = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL)
    const flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL)
    const conversion = gl.getParameter(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip)
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, conversion)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)
    this.textures[index] = texture
    return texture
  }
}
