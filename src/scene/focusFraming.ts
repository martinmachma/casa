import type { OrthographicCamera, PerspectiveCamera } from 'three'

/** Projection scale and vertical offset in CSS pixels, carried between camera flights. */
export type CameraFraming = { zoom: number; offsetY: number }

/** Fits an opening with a border of space, including when the bottom sheet leaves less than a square of view. */
export const openingDistance = (
  [width, height]: [number, number],
  viewport: { width: number; height: number },
  fov: number,
) => {
  const aspect = viewport.width / viewport.height
  const halfFov = Math.tan((fov * Math.PI) / 360)
  // focusFraming widens the projection once the uncovered area is shorter than the viewport's short side.
  return (1.3 * Math.max(width / aspect, height / Math.min(1, aspect))) / (2 * halfFov)
}

/** The sheet's visible height, shared with the demand-rendered camera without rerendering the house each frame. */
export type FocusInset = {
  current: number
  set: (pixels: number) => void
  subscribe: (listener: () => void) => () => void
}

/** Wakes the camera when the sheet moves, including the frames of its CSS height transition. */
export const createFocusInset = (): FocusInset => {
  const listeners = new Set<() => void>()
  const inset: FocusInset = {
    current: 0,
    set: (pixels) => {
      if (inset.current === pixels) return
      inset.current = pixels
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return inset
}

/** Frames an orbit between the bottom sheet and optional top bar, scaling close-ups to fit short viewports. */
export const focusFraming = (
  { width, height }: { width: number; height: number },
  bottomInset: number,
  framing: CameraFraming = { zoom: 1, offsetY: 0 },
  topInset = 0,
): CameraFraming => {
  const top = Math.max(0, Math.min(topInset, height - 1))
  const inset = Math.max(0, Math.min(bottomInset, height - top - 1))
  const visible = height - top - inset
  framing.zoom = Math.min(1, visible / Math.min(width, height))
  framing.offsetY = (inset - top) / 2
  return framing
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
