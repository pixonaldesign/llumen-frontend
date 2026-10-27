import { useEffect, useMemo, useRef } from 'react'
import type { AmbientStop, RaySettings } from './canvasAmbient'

/** Drawn at a fraction of the screen size and scaled up; the shaders are soft, so the lost detail doesn't show. */
const RESOLUTION = 0.5
const FRAME_MS = 1000 / 30

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const NOISE = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`

/* Slow domain-warped noise lit in the shader colours, fading out toward the screen edges. */
const SMOKE = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_intensity;
uniform float u_scale;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
${NOISE}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  vec2 s = p * u_scale;
  float t = u_time;
  vec2 q = vec2(fbm(s + vec2(0.0, t)), fbm(s + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(s + 2.0 * q + vec2(1.7, 9.2) + 0.6 * t), fbm(s + 2.0 * q + vec2(8.3, 2.8) - 0.4 * t));
  float f = fbm(s + 2.4 * r);

  /* Each colour owns the patches where its noise field is highest, so hues stay clean instead of averaging to grey. */
  vec4 w = exp(22.0 * (vec4(q.x, q.y, r.x, r.y) - 0.5));
  vec3 col = (u_c0 * w.x + u_c1 * w.y + u_c2 * w.z + u_c3 * w.w) / (w.x + w.y + w.z + w.w + 1e-4);

  float light = pow(smoothstep(0.28, 0.72, f), 1.4);
  float edge = smoothstep(1.4, 0.1, length(p * vec2(0.7, 1.0)));
  vec3 c = col * light * 0.8 * u_intensity * edge;
  c += (hash(gl_FragCoord.xy + fract(u_time * 7.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}
`

/*
 * A beam down one side that bends into a glow across the floor: the distance to that path, a vertical line,
 * a quarter circle, and a horizontal line, shapes the light, and the distance along it picks the colour.
 */
const RAYS = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform float u_count;
uniform float u_intensity;
uniform float u_core;
uniform float u_haze;
uniform float u_position;
uniform float u_width;
uniform float u_floor;
uniform float u_bend;
uniform float u_reach;
uniform float u_sway;
uniform float u_pulse;
uniform float u_shimmer;
${NOISE}
vec3 palette(float t) {
  float s = clamp(t, 0.0, 1.0) * max(u_count - 1.0, 1.0);
  if (s < 1.0) return mix(u_c0, u_c1, s);
  if (s < 2.0) return mix(u_c1, u_c2, s - 1.0);
  return mix(u_c2, u_c3, s - 2.0);
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = gl_FragCoord.xy / u_res.y;
  float t = u_time;

  float bx = u_position * aspect + u_sway * (0.06 * sin(t * 0.9) + 0.03 * sin(t * 0.37 + 1.3));
  float fy = u_floor + u_sway * 0.02 * sin(t * 0.6 + 2.0);
  float radius = max(u_bend * 0.6, 0.001);
  vec2 corner = vec2(bx - radius, fy + radius);
  float top = 1.2;
  float left = corner.x - max(u_reach, 0.001) * aspect;
  float beamLength = top - corner.y;
  float arcLength = 1.5708 * radius;
  float total = beamLength + arcLength + (corner.x - left);

  float y = clamp(p.y, corner.y, top);
  float beam = length(p - vec2(bx, y));

  /* Only inside the bend's quarter; past it the beam and floor cover the same end points. */
  float angle = atan(p.y - corner.y, p.x - corner.x);
  float arc = angle >= -1.5708 && angle <= 0.0 ? length(p - (corner + radius * vec2(cos(angle), sin(angle)))) : 1e3;

  float x = clamp(p.x, left, corner.x);
  float ground = length(p - vec2(x, fy));

  /* Blended by closeness, not just the nearest piece, so the colour and fade don't jump where two pieces are equally close. */
  vec3 dist = vec3(beam, arc, ground);
  float d = min(beam, min(arc, ground));
  vec3 k = exp(-(dist - d) / (u_width * 0.6));
  float s = dot(k, vec3(top - y, beamLength - angle * radius, beamLength + arcLength + (corner.x - x))) / (k.x + k.y + k.z);

  float along = s / total;
  float w = u_width * mix(0.8, 1.7, along);
  float body = exp(-pow(d / w, 3.0));
  float core = exp(-pow(d / (w * 0.35), 2.0));
  float haze = exp(-d / (w * (0.5 + u_haze * 2.0)));

  float fade = smoothstep(1.0, 0.5, along) * mix(1.0, 0.75, along);
  float streak = noise(vec2(d / w * 3.0, s * 2.2 - t * 1.4)) * 0.6 + noise(vec2(d / w * 7.0, s * 5.0 - t * 2.3)) * 0.4;
  float shimmer = mix(1.0, 0.45 + 1.1 * streak, u_shimmer);
  float pulse = 1.0 + u_pulse * 0.35 * sin(t * 1.7);
  float light = (body * 0.9 + haze * (0.1 + u_haze * 0.3)) * fade * shimmer * pulse * u_intensity;

  vec3 c = palette(along) * light;
  c += vec3(0.85, 1.0, 1.0) * core * u_core * fade * shimmer * pulse * u_intensity * 0.7;
  c = 1.0 - exp(-c * 1.3);
  c += (hash(gl_FragCoord.xy + fract(u_time * 7.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}
`

type Uniforms = Readonly<Record<string, number | readonly number[]>>

type ShaderCanvasProps = {
  /** Should screen-blend over the background: the shaders draw on black. */
  className?: string
  fragment: string
  /** Shader time per second, so changing it doesn't jump the pattern. */
  speed: number
  /** By name; numbers are floats, arrays vec2 or vec3. */
  uniforms: Uniforms
  /** Holds the current frame; it still redraws when the uniforms or size change. */
  paused?: boolean
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

function ShaderCanvas({ className, fragment, speed, uniforms, paused = false }: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paramsRef = useRef({ speed, uniforms, paused })
  const dirtyRef = useRef(true)

  useEffect(() => {
    paramsRef.current = { speed, uniforms, paused }
    dirtyRef.current = true
  }, [speed, uniforms, paused])

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false })
    if (!canvas || !gl) return

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const shader = compile(gl, gl.FRAGMENT_SHADER, fragment)
    const program = gl.createProgram()
    if (!vertex || !shader || !program) return
    gl.attachShader(program, vertex)
    gl.attachShader(program, shader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const locations = new Map<string, WebGLUniformLocation | null>()
    const uniform = (name: string) => {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name))
      return locations.get(name) ?? null
    }

    const resize = () => {
      const width = Math.max(1, Math.round(canvas.clientWidth * RESOLUTION))
      const height = Math.max(1, Math.round(canvas.clientHeight * RESOLUTION))
      if (canvas.width === width && canvas.height === height) return
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
      dirtyRef.current = true
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let shaderTime = 12
    let last = performance.now()
    let lastFrame = 0
    let frame = 0

    const draw = (now: number) => {
      frame = still ? 0 : requestAnimationFrame(draw)
      if (!still && now - lastFrame < FRAME_MS) return
      lastFrame = now
      const params = paramsRef.current
      const elapsed = Math.min(now - last, 100)
      last = now
      if (params.paused && !dirtyRef.current) return
      dirtyRef.current = false
      if (!params.paused) shaderTime += (elapsed / 1000) * params.speed
      gl.uniform2f(uniform('u_res'), canvas.width, canvas.height)
      gl.uniform1f(uniform('u_time'), shaderTime)
      for (const [name, value] of Object.entries(params.uniforms)) {
        const location = uniform(name)
        if (typeof value === 'number') gl.uniform1f(location, value)
        else if (value.length === 2) gl.uniform2fv(location, new Float32Array(value))
        else gl.uniform3fv(location, new Float32Array(value))
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(shader)
    }
  }, [fragment])

  return <canvas ref={canvasRef} className={className} aria-hidden />
}

function toVec3({ color, opacity }: AmbientStop): [number, number, number] {
  const value = Number.parseInt(color.replace('#', ''), 16)
  return [(((value >> 16) & 255) / 255) * opacity, (((value >> 8) & 255) / 255) * opacity, ((value & 255) / 255) * opacity]
}

const WHITE: AmbientStop = { color: '#ffffff', opacity: 1 }

/** The first four colours as `u_c0`–`u_c3`; fewer either repeat or hold the last one. */
function colorUniforms(colors: readonly AmbientStop[], fill: 'repeat' | 'hold') {
  const used = colors.slice(0, 4)
  const pick = (index: number) => (fill === 'repeat' ? used[index % used.length] : used[Math.min(index, used.length - 1)]) ?? WHITE
  return { u_c0: toVec3(pick(0)), u_c1: toVec3(pick(1)), u_c2: toVec3(pick(2)), u_c3: toVec3(pick(3)), u_count: Math.max(1, used.length) }
}

type SmokeShaderProps = {
  className?: string
  /** The first four colours tint the smoke, each scaled by its opacity; fewer repeat. */
  colors: readonly AmbientStop[]
  intensity: number
  speed: number
  scale: number
  paused?: boolean
}

export function SmokeShader({ className, colors, intensity, speed, scale, paused }: SmokeShaderProps) {
  const uniforms = useMemo(() => ({ ...colorUniforms(colors, 'repeat'), u_intensity: intensity, u_scale: scale }), [colors, intensity, scale])
  return <ShaderCanvas className={className} fragment={SMOKE} speed={speed} uniforms={uniforms} paused={paused} />
}

type RayShaderProps = {
  className?: string
  /** Up to four colours along the light, from the top of the beam to the end of the floor. */
  colors: readonly AmbientStop[]
  rays: RaySettings
  paused?: boolean
}

export function RayShader({ className, colors, rays, paused }: RayShaderProps) {
  const uniforms = useMemo(
    () => ({
      ...colorUniforms(colors, 'hold'),
      u_intensity: rays.intensity,
      u_core: rays.core,
      u_haze: rays.haze,
      u_position: rays.position,
      u_width: rays.width,
      u_floor: rays.floor,
      u_bend: rays.bend,
      u_reach: rays.reach,
      u_sway: rays.sway,
      u_pulse: rays.pulse,
      u_shimmer: rays.shimmer,
    }),
    [colors, rays],
  )
  return <ShaderCanvas className={className} fragment={RAYS} speed={rays.speed} uniforms={uniforms} paused={paused} />
}
