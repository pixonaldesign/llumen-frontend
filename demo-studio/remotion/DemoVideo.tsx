import { useEffect, useMemo, useState } from 'react'
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  type CalculateMetadataFunction,
} from 'remotion'
import type { DemoTrack, TrackEvent } from '../track.ts'
import { buildTimeline } from './camera.ts'
import type { DemoProps } from './schema.ts'

let trackRequest: Promise<DemoTrack> | null = null
/** The take's cursor path and timing, from the demo's public folder next to raw.mp4. */
const loadTrack = () => (trackRequest ??= fetch(staticFile('track.json')).then((response) => response.json() as Promise<DemoTrack>))

export const calculateDemoMetadata: CalculateMetadataFunction<DemoProps> = async () => {
  const track = await loadTrack()
  return {
    width: track.format.width * track.format.scale,
    height: track.format.height * track.format.scale,
    fps: track.format.fps,
    durationInFrames: Math.max(1, Math.ceil(track.duration * track.format.fps)),
  }
}

function useTrack() {
  const [track, setTrack] = useState<DemoTrack | null>(null)
  const [handle] = useState(() => delayRender('Loading track.json'))
  useEffect(() => {
    loadTrack()
      .then((loaded) => {
        setTrack(loaded)
        continueRender(handle)
      })
      .catch((error) => cancelRender(error))
  }, [handle])
  return track
}

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

function Cursor({ track, t, x, y, size, ripple }: { track: DemoTrack; t: number; x: number; y: number; size: number; ripple: boolean }) {
  const press = lastBefore(track.events, t, ['down', 'up'])
  const since = press ? t - press.t : Infinity
  const scale = press?.type === 'down' ? interpolate(since, [0, 0.08], [1, 0.82], { extrapolateRight: 'clamp' }) : interpolate(since, [0, 0.18], [0.82, 1], { extrapolateRight: 'clamp' })
  const ripples = ripple ? track.events.filter((event) => event.type === 'down' && t >= event.t && t - event.t < 0.5) : []

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

export function DemoVideo(props: DemoProps) {
  const frame = useCurrentFrame()
  const { fps, width, height, durationInFrames } = useVideoConfig()
  const track = useTrack()
  const timeline = useMemo(
    () => (track ? buildTimeline(track, props.zooms, fps, durationInFrames) : []),
    [track, props.zooms, fps, durationInFrames],
  )

  if (!track || !timeline.length) return null

  const { format } = track
  const t = frame / fps
  const state = timeline[Math.min(frame, timeline.length - 1)]
  /** Output px per CSS px of the replay viewport. */
  const px = width / format.width
  const inset = props.inset * px
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
    <AbsoluteFill style={{ background: props.background }}>
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
        {props.cursor ? (
          <Cursor track={track} t={t} x={cursorX} y={cursorY} size={28 * px * fit * props.cursorScale} ripple={props.ripple} />
        ) : null}
      </AbsoluteFill>
      {props.keycaps ? <Keycaps track={track} t={t} unit={px} /> : null}
    </AbsoluteFill>
  )
}
