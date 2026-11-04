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

const FIRST_STEP = 1 / 120
const STEP_GROWTH = 1.5
const LONGEST_STEP = 0.1

/**
 * How far in seconds to move a held camera this frame, given the step before it (0 when it was still). The canvas
 * renders on demand, so a move's first delta holds all the idle time before it, and starting to move can stall a frame
 * or two; following delta straight away would make the camera jump. Steps can only grow gently, so it eases in instead.
 */
export const heldStep = (delta: number, previous: number) =>
  previous ? Math.min(delta, LONGEST_STEP, previous * STEP_GROWTH) : FIRST_STEP

/** Closer to the orbit target than this, panning and zooming keep the pace they have here. */
export const NEAR_PACE = 4

/** Base speeds for the mouse and touch camera controls: wheel and pinch zoom, and drag panning. */
export const ZOOM_SPEED = 1.2
export const PAN_SPEED = 1.6
