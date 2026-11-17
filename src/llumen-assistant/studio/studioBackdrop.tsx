import { GodRays, MeshGradient, PulsingBorder, SmokeRing, Swirl, Warp } from '@paper-design/shaders-react'
import type { StudioShader } from '../prototypeChrome'
import styles from './StudioView.module.css'

/** Charcoal to blue-charcoal, with a slate-blue blob for a visible hint of light. */
const MESH_COLORS = ['#1b1d21', '#181b21', '#1d3056', '#1b1d21', '#24406e', '#16181d', '#3a5384']
/** Mostly near-black, so the two blues read as one glow drifting around the screen. */
const GLOW_COLORS = ['#06070b', '#07080c', '#2f50a0', '#06070b', '#5a80d4', '#08090f', '#06070b']
const BACK = '#06070b'
/** Cap the shader so a 2x display doesn't allocate a 4K buffer behind a mostly opaque page. */
const PIXELS = 1280 * 720

/** The animated layer behind the Studio. */
export function StudioBackdrop({ shader, active }: { shader: StudioShader; active: boolean }) {
  const shared = { maxPixelCount: PIXELS, className: styles.shaderCanvas }
  const speed = (value: number) => (active ? value : 0)

  switch (shader) {
    case 'mesh':
      return <MeshGradient {...shared} speed={speed(0.12)} scale={1} distortion={0.3} swirl={0} colors={MESH_COLORS} />
    case 'glow':
      return <MeshGradient {...shared} speed={speed(0.24)} scale={1} distortion={0.3} swirl={0} colors={GLOW_COLORS} />
    case 'rings':
      return (
        <SmokeRing
          {...shared}
          speed={speed(0.35)}
          scale={1.15}
          colorBack={BACK}
          colors={['#2a0f0c', '#8a4a20', '#566f44', '#2f66b4', '#16264c']}
          radius={0.3}
          thickness={0.38}
          innerShape={0.6}
          noiseScale={0.8}
          noiseIterations={3}
        />
      )
    case 'flare':
      return (
        <GodRays
          {...shared}
          speed={speed(0.3)}
          offsetX={-0.42}
          offsetY={-0.44}
          colorBack={BACK}
          colorBloom="#22396e"
          colors={['#34569aaa', '#94acd6aa', '#c49a6c55', '#28468a']}
          density={0.2}
          spotty={0.3}
          midSize={0.22}
          midIntensity={0.4}
          intensity={0.48}
          bloom={0.32}
        />
      )
    case 'streaks':
      return (
        <Warp
          {...shared}
          speed={speed(0.35)}
          rotation={-28}
          colors={[BACK, BACK, '#24448a', BACK, '#5f86d2', BACK]}
          shape="stripes"
          shapeScale={0.08}
          proportion={0.35}
          softness={1}
          distortion={0.12}
          swirl={0.12}
          swirlIterations={3}
        />
      )
    case 'orb':
      return (
        <PulsingBorder
          {...shared}
          speed={speed(0.4)}
          scale={0.55}
          colorBack={BACK}
          colors={['#3d63b8', '#9a4a8e', '#5b47b0']}
          aspectRatio="square"
          roundness={1}
          thickness={0.08}
          softness={0.9}
          intensity={0.18}
          bloom={0.22}
          spots={4}
          spotSize={0.4}
          pulse={0.15}
          smoke={0.4}
          smokeSize={0.5}
        />
      )
    case 'veil':
      return (
        <Swirl
          {...shared}
          speed={speed(0.15)}
          scale={1.6}
          colorBack={BACK}
          colors={['#06070b', '#1d3566', '#2c5a6a', '#5a4630', '#1a1f3a']}
          bandCount={3}
          twist={0.15}
          center={0.3}
          proportion={0.4}
          softness={1}
          noiseFrequency={0.3}
          noise={0.3}
        />
      )
  }
}
