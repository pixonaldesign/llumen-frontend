import type { Map as MapboxMap } from 'mapbox-gl'
import type { StoryMapCapture } from './storyAiScenarios'

const CAPTURE_WIDTH = 560
const CAPTURE_ASPECT = 2.2

/** A still of the map's visible area (inside its padding) and the camera that shows it. */
export function captureMapView(map: MapboxMap): StoryMapCapture {
  const canvas = map.getCanvas()
  const ratio = canvas.width / Math.max(1, canvas.clientWidth)
  const { top: padTop = 0, right: padRight = 0, bottom: padBottom = 0, left: padLeft = 0 } = map.getPadding()
  const left = padLeft * ratio
  const width = Math.max(1, canvas.width - left - padRight * ratio)
  const height = Math.min(canvas.height, width / CAPTURE_ASPECT)
  const centerY = ((padTop + (canvas.clientHeight - padBottom)) / 2) * ratio
  const top = Math.max(0, Math.min(canvas.height - height, centerY - height / 2))
  const out = document.createElement('canvas')
  out.width = CAPTURE_WIDTH
  out.height = Math.round(CAPTURE_WIDTH / CAPTURE_ASPECT)
  out.getContext('2d')?.drawImage(canvas, left, top, width, height, 0, 0, out.width, out.height)
  const center = map.getCenter()
  return {
    image: out.toDataURL('image/jpeg', 0.74),
    camera: {
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
    },
  }
}
