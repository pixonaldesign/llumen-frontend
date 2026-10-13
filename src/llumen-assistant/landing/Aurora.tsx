import { Color, Mesh, Program, Renderer, Triangle } from 'ogl'
import { useLayoutEffect, useRef } from 'react'
import styles from './FindingReveal.module.css'

/**
 * React Bits aurora shader (https://reactbits.dev/backgrounds/aurora).
 * The ribbon is flipped so it sits on the bottom edge of its box, which is
 * the viewport base for a finding.
 */
const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;
uniform float uFadeHold;
uniform float uFadeSpan;
uniform float uStreaks;
uniform float uHighlights;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439
  );
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
    0.5 - vec3(
      dot(x0, x0),
      dot(x12.xy, x12.xy),
      dot(x12.zw, x12.zw)
    ),
    0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) { \
  int index = 0; \
  for (int i = 0; i < 2; i++) { \
    ColorStop currentColor = colors[i]; \
    bool isInBetween = currentColor.position <= factor; \
    index = int(mix(float(index), float(i), float(isInBetween))); \
  } \
  ColorStop currentColor = colors[index]; \
  ColorStop nextColor = colors[index + 1]; \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  uv.y = 1.0 - uv.y;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  float fromBottom = gl_FragCoord.y;
  float fadeStart = max(uFadeHold * 0.45, uFadeHold - uFadeSpan * 0.65);
  float fadeEnd = uFadeHold + max(uFadeSpan, 1.0) * 1.65;
  float t = clamp((fromBottom - fadeStart) / max(fadeEnd - fadeStart, 1.0), 0.0, 1.0);
  float s = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  float veil = 1.0 - s;
  auroraAlpha *= veil;

  // Curtains: noise stretched hard along Y, then sine bands warped by that noise.
  float nWide = snoise(vec2(uv.x * 4.5 + uTime * 0.035, uv.y * 0.18 - uTime * 0.012));
  float nFine = snoise(vec2(uv.x * 11.0 - uTime * 0.028, uv.y * 0.06 + nWide * 0.4));
  float fine = sin(uv.x * 48.0 + nWide * 3.4 + nFine * 1.6);
  float wide = sin(uv.x * 16.0 + nFine * 2.2 + uTime * 0.015);
  fine = fine * 0.5 + 0.5;
  wide = wide * 0.5 + 0.5;
  float curtains = mix(wide, fine, 0.62);
  float rays = smoothstep(0.26, 0.9, curtains);

  float rise = veil;
  rays *= mix(0.78, 1.0, rise);

  float streakAmt = clamp(uStreaks, 0.0, 1.0);
  float structure = mix(1.0, 0.34 + rays, streakAmt);
  auroraAlpha *= structure;

  float core = pow(smoothstep(0.58, 1.0, curtains), 1.7) * rise * veil;
  float highlightAmt = clamp(uHighlights, 0.0, 1.0);
  vec3 tint = rampColor;
  vec3 bright = mix(tint, vec3(0.82, 0.96, 1.0), 0.4);
  vec3 body = tint * max(intensity, 0.0) * mix(1.0, 0.62 + 0.7 * rays, streakAmt);
  vec3 auroraColor = body + bright * core * highlightAmt * 1.45;

  float alpha = clamp(auroraAlpha + core * highlightAmt * 0.28, 0.0, 1.0);
  fragColor = vec4(auroraColor * alpha, alpha);
}
`

export type AuroraProps = {
  colorStops: [string, string, string]
  amplitude?: number
  blend?: number
  speed?: number
  /** Solid pixels from the viewport bottom before the shader fades out. */
  fadeHold?: number
  /** Length of that fade, in pixels. */
  fadeSpan?: number
  /** Vertical curtain strength. 0 keeps the soft ribbon. */
  streaks?: number
  /** Bright cores inside the curtains. */
  highlights?: number
  /** Called after the first frame is drawn with the live settings. */
  onReady?: () => void
}

/** Clock units already elapsed, so the first frame is the running ribbon rather than the empty origin. */
const AURORA_RUNNING_CLOCK = 80

function stopsToVec3(stops: string[]) {
  return stops.map((hex) => {
    const color = new Color(hex)
    return [color.r, color.g, color.b]
  })
}

export function Aurora({
  colorStops,
  amplitude = 1,
  blend = 0.5,
  speed = 1,
  fadeHold = 480,
  fadeSpan = 140,
  streaks = 0.24,
  highlights = 0.04,
  onReady,
}: AuroraProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef({ colorStops, amplitude, blend, speed, fadeHold, fadeSpan, streaks, highlights })
  const onReadyRef = useRef(onReady)
  propsRef.current = { colorStops, amplitude, blend, speed, fadeHold, fadeSpan, streaks, highlights }
  onReadyRef.current = onReady

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      // Keep the last frame when CSS opacity animations recomposite this canvas.
      preserveDrawingBuffer: true,
      dpr,
    })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.canvas.style.backgroundColor = 'transparent'
    gl.canvas.style.width = '100%'
    gl.canvas.style.height = '100%'

    const geometry = new Triangle(gl)
    if (geometry.attributes.uv) delete geometry.attributes.uv

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: propsRef.current.amplitude },
        uColorStops: { value: stopsToVec3(propsRef.current.colorStops) },
        uResolution: { value: [host.offsetWidth, host.offsetHeight] },
        uBlend: { value: propsRef.current.blend },
        uFadeHold: { value: propsRef.current.fadeHold },
        uFadeSpan: { value: propsRef.current.fadeSpan },
        uStreaks: { value: propsRef.current.streaks },
        uHighlights: { value: propsRef.current.highlights },
      },
    })

    const mesh = new Mesh(gl, { geometry, program })
    host.appendChild(gl.canvas)

    let lastW = -1
    let lastH = -1
    const resize = () => {
      const width = host.offsetWidth
      const height = host.offsetHeight
      if (width < 1 || height < 1 || (width === lastW && height === lastH)) return
      lastW = width
      lastH = height
      renderer.setSize(width, height)
      program.uniforms.uResolution.value = [width * dpr, height * dpr]
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    let frame = 0
    const draw = (t: number) => {
      const current = propsRef.current
      const time = t * 0.01 + AURORA_RUNNING_CLOCK
      program.uniforms.uTime.value = time * current.speed * 0.1
      program.uniforms.uAmplitude.value = current.amplitude
      program.uniforms.uBlend.value = current.blend
      program.uniforms.uFadeHold.value = current.fadeHold * dpr
      program.uniforms.uFadeSpan.value = current.fadeSpan * dpr
      program.uniforms.uStreaks.value = current.streaks
      program.uniforms.uHighlights.value = current.highlights
      program.uniforms.uColorStops.value = stopsToVec3(current.colorStops)
      renderer.render({ scene: mesh })
    }
    resize()
    draw(performance.now())
    onReadyRef.current?.()
    const update = (t: number) => {
      frame = requestAnimationFrame(update)
      draw(t)
    }
    frame = requestAnimationFrame(update)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      if (gl.canvas.parentNode === host) host.removeChild(gl.canvas)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return <div ref={hostRef} className={styles.auroraCanvas} />
}
