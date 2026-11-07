import type { OrthographicCamera, PerspectiveCamera } from 'three'

/** Projection scale and vertical offset in CSS pixels, carried between camera flights. */
export type CameraFraming = { zoom: number; offsetY: number }

/** Frames an orbit's target above a bottom card, scaling close-ups to fit short viewports. */
export const focusFraming = (
  { width, height }: { width: number; height: number },
  bottomInset: number,
): CameraFraming => {
  const inset = Math.max(0, Math.min(bottomInset, height - 1))
  const visible = height - inset
  return {
    zoom: Math.min(1, visible / Math.min(width, height)),
    offsetY: inset / 2,
  }
}

/** Eases the projection with a flight, without allocating a view object on each frame. */
export const blendFocusFraming = (
  camera: PerspectiveCamera | OrthographicCamera,
  { width, height }: { width: number; height: number },
  from: CameraFraming,
  to: CameraFraming,
  progress: number,
) => {
  camera.zoom = from.zoom + (to.zoom - from.zoom) * progress
  const offsetY = from.offsetY + (to.offsetY - from.offsetY) * progress
  camera.setViewOffset(width, height, 0, offsetY, width, height)
}
