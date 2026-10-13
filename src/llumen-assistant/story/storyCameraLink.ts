/** Keeps several story maps on one camera: a move on any member is replayed on the others. */
export type StoryCamera = {
  center: [number, number]
  zoom: number
  bearing: number
  pitch: number
}

type CameraListener = (camera: StoryCamera) => void

export type StoryCameraLink = {
  /** Returns the shared camera to adopt, or null when the member is the first to join. */
  join: (listener: CameraListener) => StoryCamera | null
  leave: (listener: CameraListener) => void
  publish: (source: CameraListener, camera: StoryCamera) => void
}

export function createCameraLink(): StoryCameraLink {
  const listeners = new Set<CameraListener>()
  let current: StoryCamera | null = null
  return {
    join(listener) {
      const adopt = listeners.size > 0 ? current : null
      listeners.add(listener)
      return adopt
    },
    leave(listener) {
      listeners.delete(listener)
      if (listeners.size === 0) current = null
    },
    publish(source, camera) {
      current = camera
      for (const listener of listeners) if (listener !== source) listener(camera)
    },
  }
}
