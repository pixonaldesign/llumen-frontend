import { useMemo } from 'react'
import { AbsoluteFill, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import type { DemoTrack, TrackEvent } from '../track.ts'
import { buildTimeline } from './camera.ts'

export type DemoVideoProps = { track: DemoTrack | null }

const KEY_GLYPHS: Record<string, string> = {
  Meta: '⌘',
  Control: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Enter: '↵',
  Escape: 'esc',
  Tab: '⇥',
  Backspace: '⌫',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'space',
}

const showKey = (key: string) => key.includes('+') || key === 'Escape'

function lastBefore<T extends TrackEvent['type']>(events: TrackEvent[], t: number, types: T[]) {
  let found: Extract<TrackEvent, { type: T }> | null = null
  for (const event of events) {
    if (event.t > t) break
    if ((types as string[]).includes(event.type)) found = event as Extract<TrackEvent, { type: T }>
  }
  return found
}

function Cursor({ track, t, x, y, size }: { track: DemoTrack; t: number; x: number; y: number; size: number }) {
  const press = lastBefore(track.events, t, ['down', 'up'])
  const since = press ? t - press.t : Infinity
  const scale = press?.type === 'down' ? interpolate(since, [0, 0.08], [1, 0.82], { extrapolateRight: 'clamp' }) : interpolate(since, [0, 0.18], [0.82, 1], { extrapolateRight: 'clamp' })
  const ripples = track.events.filter((event) => event.type === 'down' && t >= event.t && t - event.t < 0.5)

  return (
    <>
      {ripples.map((event) => {
        const p = (t - event.t) / 0.5
        const radius = size * (0.4 + p * 0.9)
        return (
          <div
            key={event.t}
            style={{
              position: 'absolute',
              left: x - radius,
              top: y - radius,
              width: radius * 2,
              height: radius * 2,
              borderRadius: '50%',
              border: `${size * 0.06}px solid rgba(255, 255, 255, ${0.55 * (1 - p)})`,
              background: `rgba(255, 255, 255, ${0.12 * (1 - p)})`,
            }}
          />
        )
      })}
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        style={{
          position: 'absolute',
          left: x - size * (4 / 28),
          top: y - size * (3 / 28),
          transform: `scale(${scale})`,
          transformOrigin: `${(4 / 28) * 100}% ${(3 / 28) * 100}%`,
          filter: `drop-shadow(0 ${size * 0.05}px ${size * 0.12}px rgba(0, 0, 0, 0.45))`,
          overflow: 'visible',
        }}
      >
        <path
          d="M4 3 L4 22.5 L9.2 17.6 L12.8 25.6 L16.4 24 L12.9 16.2 L20 16.2 Z"
          fill="#000"
          stroke="#fff"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </svg>
    </>
  )
}

function Keycaps({ track, t, unit }: { track: DemoTrack; t: number; unit: number }) {
  const event = lastBefore(track.events, t, ['key'])
  if (!event || !showKey(event.key)) return null
  const age = t - event.t
  if (age > 1.4) return null
  const opacity = interpolate(age, [0, 0.12, 1.1, 1.4], [0, 1, 1, 0])
  const lift = interpolate(age, [0, 0.18], [unit * 10, 0], { extrapolateRight: 'clamp' })
  const keys = event.key.split('+').map((part) => KEY_GLYPHS[part] ?? part)
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: unit * 48,
        display: 'flex',
        gap: unit * 8,
        padding: unit * 10,
        transform: `translate(-50%, ${lift}px)`,
        opacity,
        borderRadius: unit * 16,
        background: 'rgba(10, 14, 22, 0.86)',
        boxShadow: `0 ${unit * 12}px ${unit * 40}px rgba(0, 0, 0, 0.45)`,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      }}
    >
      {keys.map((key, index) => (
        <span
          key={index}
          style={{
            minWidth: unit * 44,
            padding: `${unit * 8}px ${unit * 14}px`,
            borderRadius: unit * 10,
            border: `${unit}px solid rgba(255, 255, 255, 0.16)`,
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#fff',
            fontSize: unit * 26,
            lineHeight: 1,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {key}
        </span>
      ))}
    </div>
  )
}

export function DemoVideo({ track }: DemoVideoProps) {
  const frame = useCurrentFrame()
  const { fps, width, height, durationInFrames } = useVideoConfig()
  const timeline = useMemo(() => (track ? buildTimeline(track, fps, durationInFrames) : []), [track, fps, durationInFrames])

  if (!track) {
    return (
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', background: '#0a0e16', color: '#fff', fontSize: 40 }}>
        Run `npm run demo -- studio &lt;name&gt;` to load a demo
      </AbsoluteFill>
    )
  }

  const { render, format } = track
  const t = frame / fps
  const state = timeline[Math.min(frame, timeline.length - 1)]
  /** Output px per CSS px of the replay viewport. */
  const px = width / format.width
  const inset = (render.inset ?? 0) * px
  const fit = (width - inset * 2) / width
  const uiWidth = width * fit
  const uiHeight = height * fit
  const uiLeft = (width - uiWidth) / 2
  const uiTop = (height - uiHeight) / 2
  const toStage = (x: number, y: number) => [uiLeft + x * px * fit, uiTop + y * px * fit] as const
  const [camX, camY] = toStage(state.cx, state.cy)
  const [cursorX, cursorY] = toStage(state.x, state.y)
  const zoom = state.zoom

  return (
    <AbsoluteFill style={{ background: render.background ?? 'linear-gradient(135deg, #1b2340 0%, #0a0e16 55%, #10233a 100%)' }}>
      <AbsoluteFill
        style={{
          transform: `translate(${width / 2 - camX * zoom}px, ${height / 2 - camY * zoom}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: uiLeft,
            top: uiTop,
            width: uiWidth,
            height: uiHeight,
            overflow: 'hidden',
            borderRadius: inset ? 14 * px : 0,
            boxShadow: inset ? `0 ${30 * px}px ${80 * px}px rgba(0, 0, 0, 0.5)` : undefined,
          }}
        >
          <OffthreadVideo src={staticFile('raw.mp4')} muted style={{ width: '100%', height: '100%' }} />
        </div>
        {render.cursor === 'none' ? null : <Cursor track={track} t={t} x={cursorX} y={cursorY} size={28 * px * fit * (render.cursorScale ?? 1)} />}
      </AbsoluteFill>
      {render.keys === false ? null : <Keycaps track={track} t={t} unit={px} />}
    </AbsoluteFill>
  )
}
