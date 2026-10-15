import { ShaderCanvas } from '../story/StoryShader'

export type AgentShaderPattern = 'orbs' | 'ribbon' | 'ripples' | 'curtains' | 'smoke' | 'beam'

const PATTERN_INDEX: Record<AgentShaderPattern, number> = {
  orbs: 0,
  ribbon: 1,
  ripples: 2,
  curtains: 3,
  smoke: 4,
  beam: 5,
}

/** Each pattern is a glow field v (0 dark to 1 bright) over black: colorA lights the glow, colorB its core. */
const FRAGMENT = `
precision mediump float;
uniform vec2 resolution;
uniform float time;
uniform vec3 colorA;
uniform vec3 colorB;
uniform int preset;

float glow(vec2 p, vec2 c, float r) {
  vec2 d = p - c;
  return exp(-dot(d, d) / (r * r));
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  float aspect = resolution.x / resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = time;
  float v;
  if (preset == 0) {
    v = glow(p, vec2(aspect * (0.3 + 0.12 * sin(t * 0.7)), 0.4 + 0.18 * cos(t * 0.5)), 0.34);
    v += 0.8 * glow(p, vec2(aspect * (0.74 + 0.1 * cos(t * 0.6)), 0.72 + 0.12 * sin(t * 0.8)), 0.26);
    v += 0.6 * glow(p, vec2(aspect * (0.55 + 0.2 * sin(t * 0.4 + 2.0)), 0.12 + 0.1 * sin(t)), 0.22);
  } else if (preset == 1) {
    float y = uv.y - 0.55 + 0.4 * (uv.x - 0.5) + 0.12 * sin(uv.x * 5.0 + t) + 0.05 * sin(uv.x * 11.0 - t * 1.4);
    v = exp(-y * y * 26.0) + 0.45 * exp(-pow(y + 0.24, 2.0) * 40.0);
  } else if (preset == 2) {
    float d = length(p - vec2(aspect * 0.22, 0.18));
    v = pow(0.5 + 0.5 * sin(d * 8.0 - t * 1.6), 2.0) * exp(-d * 0.55) * 1.15;
  } else if (preset == 3) {
    float x = uv.x + 0.06 * sin(uv.y * 4.0 + t * 0.8);
    v = pow(0.5 + 0.5 * sin(x * 10.0 + 2.0 * sin(t * 0.5 + x * 3.0)), 2.5);
    v *= smoothstep(-0.2, 0.9, uv.y) * (0.85 + 0.3 * sin(t + x * 6.0));
  } else if (preset == 4) {
    vec2 q = p * 1.4;
    q += 0.35 * vec2(sin(q.y * 3.0 + t), cos(q.x * 3.0 - t * 0.8));
    q += 0.2 * vec2(sin(q.y * 5.0 - t * 1.1), cos(q.x * 4.0 + t));
    v = pow(0.5 + 0.5 * sin(q.x * 2.6 + q.y * 1.8), 3.0);
  } else {
    vec2 d = p - vec2(aspect, 1.0);
    float angle = atan(d.y, d.x) + 2.3 - 0.35 * sin(t * 0.6);
    v = exp(-angle * angle * 5.0) * exp(-length(d) * 0.4) * 1.1 + 0.75 * glow(p, vec2(aspect, 1.0), 0.6);
  }
  vec3 col = colorA * smoothstep(0.0, 0.7, v);
  col = mix(col, colorB, smoothstep(0.5, 1.1, v));
  gl_FragColor = vec4(col, 1.0);
}
`

export function AgentShader({
  className,
  pattern,
  glow,
  core,
}: {
  className?: string
  pattern: AgentShaderPattern
  glow: string
  core: string
}) {
  return (
    <ShaderCanvas
      className={className}
      fragment={FRAGMENT}
      preset={PATTERN_INDEX[pattern]}
      speed={0.4}
      from={glow}
      to={core}
    />
  )
}
