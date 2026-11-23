import { Composition, registerRoot, type CalculateMetadataFunction } from 'remotion'
import { DemoVideo, type DemoVideoProps } from './DemoVideo.tsx'

const calculateMetadata: CalculateMetadataFunction<DemoVideoProps> = ({ props }) => {
  const track = props.track
  if (!track) return { width: 1920, height: 1080, fps: 30, durationInFrames: 90 }
  return {
    width: track.format.width * track.format.scale,
    height: track.format.height * track.format.scale,
    fps: track.format.fps,
    durationInFrames: Math.max(1, Math.ceil(track.duration * track.format.fps)),
  }
}

function Root() {
  return (
    <Composition
      id="Demo"
      component={DemoVideo}
      defaultProps={{ track: null }}
      calculateMetadata={calculateMetadata}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={90}
    />
  )
}

registerRoot(Root)
