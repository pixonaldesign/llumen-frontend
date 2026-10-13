import { useEffect, useRef } from 'react'
import type { BackgroundShaderPreset } from './storyBackground'

const PRESET_INDEX: Record<BackgroundShaderPreset, number> = { aurora: 0, waves: 1, plasma: 2 }

/** Renders at a fraction of device pixels; the shapes are soft, so the upscale is invisible. */
const RENDER_SCALE = 0.5

const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

const FRAGMENT = `
precision mediump float;
uniform vec2 resolution;
uniform float time;
uniform vec3 colorA;
uniform vec3 colorB;
uniform int preset;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  float aspect = resolution.x / resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float v;
  if (preset == 0) {
    float y = uv.y + 0.14 * sin(p.x * 2.6 + time * 0.55) + 0.07 * sin(p.x * 6.3 - time * 0.8);
    float band = exp(-pow((y - 0.55) * 4.2, 2.0));
    float band2 = exp(-pow((y - 0.32) * 6.0, 2.0)) * 0.6;
    vec3 base = mix(colorA * 0.55, colorA, uv.y);
    vec3 col = base + colorB * (band + band2) * 0.5;
    gl_FragColor = vec4(col, 1.0);
    return;
  } else if (preset == 1) {
    v = 0.5 + 0.5 * sin(p.x * 5.0 + sin(p.y * 3.5 + time * 0.9) * 1.6 + time * 0.4);
    v = smoothstep(0.1, 0.9, v);
  } else {
    v = sin(p.x * 7.0 + time)
      + sin(p.y * 8.0 + time * 1.2)
      + sin((p.x + p.y) * 6.0 + time * 0.7)
      + sin(length(p - vec2(aspect * 0.5, 0.5)) * 11.0 - time * 1.4);
    v = 0.5 + 0.125 * v;
  }
  gl_FragColor = vec4(mix(colorA, colorB, v), 1.0);
}
`

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

export function StoryShader({
  className,
  preset,
  speed,
  from,
  to,
}: {
  className?: string
  preset: BackgroundShaderPreset
  speed: number
  from: string
  to: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const settingsRef = useRef({ preset, speed, from, to })
  const redrawRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    settingsRef.current = { preset, speed, from, to }
    redrawRef.current?.()
  }, [preset, speed, from, to])

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext('webgl', { antialias: false, premultipliedAlpha: false })
    if (!canvas || !gl) return
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    if (!vertex || !fragment || !program) return
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const uniforms = {
      resolution: gl.getUniformLocation(program, 'resolution'),
      time: gl.getUniformLocation(program, 'time'),
      colorA: gl.getUniformLocation(program, 'colorA'),
      colorB: gl.getUniformLocation(program, 'colorB'),
      preset: gl.getUniformLocation(program, 'preset'),
    }

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2) * RENDER_SCALE
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale))
      gl.viewport(0, 0, canvas.width, canvas.height)
      redrawRef.current?.()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let elapsed = 0
    let last = performance.now()
    let frame = 0
    const draw = (now: number) => {
      const current = settingsRef.current
      elapsed += ((now - last) / 1000) * current.speed
      last = now
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
      gl.uniform1f(uniforms.time, elapsed)
      gl.uniform3fv(uniforms.colorA, hexToRgb(current.from))
      gl.uniform3fv(uniforms.colorB, hexToRgb(current.to))
      gl.uniform1i(uniforms.preset, PRESET_INDEX[current.preset])
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      if (!reduceMotion) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    if (reduceMotion) redrawRef.current = () => draw(last)

    return () => {
      redrawRef.current = null
      cancelAnimationFrame(frame)
      observer.disconnect()
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} aria-hidden />
}
