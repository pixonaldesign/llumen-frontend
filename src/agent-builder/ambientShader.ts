import { AMBIENT_MAX_STOPS, type AmbientStyle } from './canvasAmbient'

export const MAX_MESH_POINTS = 12
/** The gradients are soft, so they render at half the CSS resolution and the browser scales them up. */
const RENDER_SCALE = 0.5

const STYLE_CODES: Record<Exclude<AmbientStyle, 'blobs'>, number> = { mesh: 1, flow: 2, aurora: 3 }

export type ShaderFrame = {
  style: Exclude<AmbientStyle, 'blobs'>
  /** Viewport size in CSS pixels. */
  width: number
  height: number
  /** Animation clock, already scaled by the drift cycle. */
  time: number
  /** 0 idle, 1 fully in the run look. */
  run: number
  /** Laps travelled around the edges. */
  lap: number
  alpha: number
  /** Feature size for flow and aurora; larger is broader. */
  scale: number
  warp: number
  /** Mesh blend, 0 crisp regions to 1 broad blending. */
  blend: number
  /** `AMBIENT_MAX_STOPS` × rgba, 0–1. */
  colors: Float32Array
  colorCount: number
  /** The colours that circle the edges while running, packed like `colors`. */
  ringColors: Float32Array
  ringCount: number
  /** `MAX_MESH_POINTS` × xy in 0–1 viewport units, y down. */
  points: Float32Array
  pointCount: number
}

export type AmbientRenderer = { draw: (frame: ShaderFrame) => void; dispose: () => void }

const VERTEX = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uRun;
uniform float uLap;
uniform int uStyle;
uniform float uAlpha;
uniform float uScale;
uniform float uWarp;
uniform float uBlend;
uniform int uColorCount;
uniform vec4 uColors[${AMBIENT_MAX_STOPS}];
uniform int uRingCount;
uniform vec4 uRingColors[${AMBIENT_MAX_STOPS}];
uniform int uPointCount;
uniform vec2 uPoints[${MAX_MESH_POINTS}];
out vec4 outColor;

// 2D simplex noise (Ashima Arts, MIT), remapped to 0–1. Unlike value noise it has no grid-aligned steps.
vec3 permute(vec3 x) { return mod((x * 34.0 + 1.0) * x, 289.0); }

float noise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 a0 = x - floor(x + 0.5);
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g = vec3(a0.x * x0.x + h.x * x0.y, a0.yz * x12.xz + h.yz * x12.yw);
  return 0.5 + 65.0 * dot(m, g);
}

// Three octaves only: enough to look organic, few enough to stay soft rather than detailed.
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rotate = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) {
    value += amplitude * noise(p);
    p = rotate * p;
    amplitude *= 0.5;
  }
  return value / 0.875;
}

// Cyclic palette: x wraps, and neighbouring stops ease into each other.
vec4 cycle(vec4 colors[${AMBIENT_MAX_STOPS}], int count, float x) {
  float s = fract(x) * float(count);
  int i = min(int(floor(s)), count - 1);
  int j = (i + 1) % count;
  return mix(colors[i], colors[j], smoothstep(0.0, 1.0, fract(s)));
}

vec4 palette(float x) { return cycle(uColors, uColorCount, x); }

// Normalised Gaussian blend of every colour point, so colours meet in soft seams with no empty gaps.
vec4 mesh(vec2 uv, float aspect) {
  float t = uTime * 0.05;
  vec2 bend = vec2(fbm(uv * 2.2 + vec2(t, 0.0)), fbm(uv * 2.2 + vec2(7.3, -t))) - 0.5;
  vec2 p = uv + bend * uWarp * 0.35;
  float spread = mix(0.08, 0.5, uBlend);
  float falloff = 1.0 / (spread * spread);
  // Weights are taken relative to the nearest point so far-away pixels never underflow to zero.
  float nearest = 1e9;
  for (int i = 0; i < ${MAX_MESH_POINTS}; i++) {
    if (i >= uPointCount) break;
    vec2 d = (p - uPoints[i]) * vec2(aspect, 1.0);
    nearest = min(nearest, dot(d, d));
  }
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = 0; i < ${MAX_MESH_POINTS}; i++) {
    if (i >= uPointCount) break;
    vec2 d = (p - uPoints[i]) * vec2(aspect, 1.0);
    float w = exp(-(dot(d, d) - nearest) * falloff);
    sum += mix(uColors[i % uColorCount], uRingColors[i % uRingCount], uRun) * w;
    total += w;
  }
  return sum / total;
}

// Domain-warped noise: the field is folded through itself once, for broad, liquid folds.
vec4 flow(vec2 uv, float aspect) {
  float t = uTime * 0.05;
  vec2 p = vec2(uv.x * aspect, uv.y) * (0.32 / uScale);
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t)) - 0.5;
  float f = fbm(p + q * (0.3 + uWarp * 1.4) + vec2(0.3 * t, -0.2 * t));
  // fbm mostly lands in 0.2–0.8, so stretch it a little to reach every stop in the palette.
  vec4 color = palette((f - 0.2) * 1.3 + t * 0.1);
  color.a *= 0.55 + 0.45 * smoothstep(0.2, 0.8, f);
  return color;
}

// Three ribbons with long upward rays, each rippling on its own path.
vec4 aurora(vec2 uv, float aspect) {
  float t = uTime * 0.12;
  float x = uv.x * aspect / uScale;
  vec3 rgb = vec3(0.0);
  float alpha = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float centre = 0.32 + fk * 0.15 + 0.07 * sin(x * 1.3 + t + fk * 2.1) + uWarp * 0.3 * (fbm(vec2(x * 0.7 + fk * 3.1, t * 0.4)) - 0.5);
    float d = (uv.y - centre) / (0.09 + 0.04 * fk);
    float band = d < 0.0 ? exp(-d * d * 0.35) : exp(-d * d * 2.5);
    float rays = 0.6 + 0.4 * noise(vec2(x * 9.0 + fk * 10.0, t * 0.7));
    vec4 color = palette(x * 0.22 + fk * 0.33 + t * 0.04);
    float a = band * rays * color.a;
    rgb += color.rgb * a;
    alpha += a;
  }
  return vec4(rgb / max(alpha, 1e-3), min(alpha, 1.0));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  uv.y = 1.0 - uv.y;
  float aspect = uResolution.x / uResolution.y;
  vec4 color = uStyle == 1 ? mesh(uv, aspect) : uStyle == 2 ? flow(uv, aspect) : aurora(uv, aspect);
  // Running: flow and aurora hand over to colours circling the edges (mesh moves its points there instead).
  if (uStyle != 1 && uRun > 0.0) {
    vec2 d = (uv - 0.5) * vec2(aspect, 1.0);
    float angle = atan(d.y, d.x) / 6.2831853 + 0.5;
    vec4 ring = cycle(uRingColors, uRingCount, angle - uLap + 0.12 * (fbm(uv * 3.0 + uTime * 0.05) - 0.5));
    color = mix(color, ring, uRun);
  }
  float a = clamp(color.a * uAlpha, 0.0, 1.0);
  outColor = vec4(color.rgb * a, a);
}
`

let webgl2: boolean | undefined
export function supportsWebGL2() {
  if (webgl2 === undefined) {
    try {
      webgl2 = !!document.createElement('canvas').getContext('webgl2')
    } catch {
      webgl2 = false
    }
  }
  return webgl2
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  console.error(gl.getShaderInfoLog(shader))
  gl.deleteShader(shader)
  return null
}

export function createAmbientRenderer(canvas: HTMLCanvasElement): AmbientRenderer | null {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false })
  if (!gl) return null
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program))
    return null
  }
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  // One triangle that covers the whole viewport.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const uniform = (name: string) => gl.getUniformLocation(program, name)
  const u = {
    resolution: uniform('uResolution'),
    time: uniform('uTime'),
    run: uniform('uRun'),
    lap: uniform('uLap'),
    style: uniform('uStyle'),
    alpha: uniform('uAlpha'),
    scale: uniform('uScale'),
    warp: uniform('uWarp'),
    blend: uniform('uBlend'),
    colorCount: uniform('uColorCount'),
    colors: uniform('uColors'),
    ringCount: uniform('uRingCount'),
    ringColors: uniform('uRingColors'),
    pointCount: uniform('uPointCount'),
    points: uniform('uPoints'),
  }

  return {
    draw(frame) {
      const width = Math.max(1, Math.round(frame.width * RENDER_SCALE))
      const height = Math.max(1, Math.round(frame.height * RENDER_SCALE))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      gl.viewport(0, 0, width, height)
      gl.uniform2f(u.resolution, width, height)
      gl.uniform1f(u.time, frame.time)
      gl.uniform1f(u.run, frame.run)
      gl.uniform1f(u.lap, frame.lap)
      gl.uniform1i(u.style, STYLE_CODES[frame.style])
      gl.uniform1f(u.alpha, frame.alpha)
      gl.uniform1f(u.scale, Math.max(0.05, frame.scale))
      gl.uniform1f(u.warp, frame.warp)
      gl.uniform1f(u.blend, frame.blend)
      gl.uniform1i(u.colorCount, Math.max(1, frame.colorCount))
      gl.uniform4fv(u.colors, frame.colors)
      gl.uniform1i(u.ringCount, Math.max(1, frame.ringCount))
      gl.uniform4fv(u.ringColors, frame.ringColors)
      gl.uniform1i(u.pointCount, frame.pointCount)
      gl.uniform2fv(u.points, frame.points)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() {
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
    },
  }
}
