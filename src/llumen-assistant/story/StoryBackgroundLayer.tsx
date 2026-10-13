import { useEffect, useRef } from 'react'
import { StoryShader } from './StoryShader'
import {
  gradientCss,
  mediaFrameStyle,
  type BackgroundColor,
  type BackgroundMedia,
} from './storyBackground'
import styles from './StoryBackground.module.css'

export function BackgroundVideo({
  media,
  className,
  forceMuted = false,
  onDuration,
}: {
  media: BackgroundMedia
  className?: string
  forceMuted?: boolean
  onDuration?: (duration: number) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const probingRef = useRef(false)
  const muted = forceMuted || media.muted

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = media.playbackRate
  }, [media.playbackRate])

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted
  }, [muted])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const end = media.trimEnd ?? Number.POSITIVE_INFINITY
    if (video.currentTime < media.trimStart || video.currentTime >= end) video.currentTime = media.trimStart
    if (video.paused) video.play().catch(() => {})
  }, [media.trimStart, media.trimEnd, media.loop])

  const restartOrStop = (video: HTMLVideoElement) => {
    if (media.loop) {
      video.currentTime = media.trimStart
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }

  return (
    <video
      ref={videoRef}
      className={className}
      src={media.src}
      style={mediaFrameStyle(media)}
      autoPlay
      muted={muted}
      playsInline
      onLoadedMetadata={(event) => {
        const video = event.currentTarget
        video.playbackRate = media.playbackRate
        if (Number.isFinite(video.duration)) {
          if (media.trimStart > 0) video.currentTime = media.trimStart
          onDuration?.(video.duration)
          return
        }
        // Recorded WebM files often omit their duration; seeking past the end makes the browser measure it.
        probingRef.current = true
        video.currentTime = Number.MAX_SAFE_INTEGER
      }}
      onDurationChange={(event) => {
        const video = event.currentTarget
        if (!probingRef.current || !Number.isFinite(video.duration)) return
        probingRef.current = false
        video.currentTime = media.trimStart
        video.play().catch(() => {})
        onDuration?.(video.duration)
      }}
      onTimeUpdate={(event) => {
        const video = event.currentTarget
        if (!probingRef.current && media.trimEnd != null && video.currentTime >= media.trimEnd) restartOrStop(video)
      }}
      onEnded={(event) => {
        if (!probingRef.current) restartOrStop(event.currentTarget)
      }}
    />
  )
}

export function MediaFrame({
  media,
  forceMuted,
  onDuration,
}: {
  media: BackgroundMedia
  forceMuted?: boolean
  onDuration?: (duration: number) => void
}) {
  return (
    <>
      {media.mediaType === 'video' ? (
        <BackgroundVideo
          media={media}
          className={styles.fill}
          forceMuted={forceMuted}
          onDuration={onDuration}
        />
      ) : (
        <img className={styles.fill} src={media.src} alt="" style={mediaFrameStyle(media)} draggable={false} />
      )}
      {media.dim > 0 ? <span className={styles.dim} style={{ opacity: media.dim }} aria-hidden /> : null}
    </>
  )
}

export function ColorFill({ color }: { color: BackgroundColor }) {
  if (color.mode === 'shader') {
    return (
      <StoryShader
        className={styles.fill}
        preset={color.shader.preset}
        speed={color.shader.speed}
        from={color.shader.from}
        to={color.shader.to}
      />
    )
  }
  return (
    <span
      className={styles.fill}
      style={{ background: color.mode === 'gradient' ? gradientCss(color) : color.color }}
      aria-hidden
    />
  )
}

export function StoryBackgroundLayer({
  background,
  className,
  onDuration,
}: {
  background: BackgroundMedia | BackgroundColor
  className?: string
  onDuration?: (duration: number) => void
}) {
  return (
    <div className={`${styles.layer}${className ? ` ${className}` : ''}`} aria-hidden>
      {background.kind === 'media' ? (
        <MediaFrame key={background.src} media={background} onDuration={onDuration} />
      ) : (
        <ColorFill color={background} />
      )}
    </div>
  )
}
