/**
 * What the on-screen camera buttons are holding down right now. Each axis is -1, 0 or 1; the scene applies it
 * every frame, so holding a button keeps the camera moving. Plain mutable state: it changes on every press and
 * nothing needs to re-render for it.
 */
export type CameraNudge = {
  /** Pan (or walk) forward/back on screen. */
  forward: number
  /** Pan (or step) right/left. */
  right: number
  /** Zoom in/out. */
  zoom: number
  /** Orbit (or turn) right/left. */
  turn: number
  /** Tilt the view up/down. */
  tilt: number
}

export type CameraNudgeAxis = keyof CameraNudge

export const createCameraNudge = (): CameraNudge => ({ forward: 0, right: 0, zoom: 0, turn: 0, tilt: 0 })

/** Closer to the orbit target than this, panning and zooming keep the pace they have here. */
export const NEAR_PACE = 4
