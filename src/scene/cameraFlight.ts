import { animationProgress } from './animation'

/** Room changes, returns and floor changes share one clock, including their visual effects. */
export const CAMERA_FLIGHT_SECONDS = 1.1
/** A floor change only moves the view up or down, so it's quicker. */
export const FLOOR_FLIGHT_SECONDS = 0.45

type FlightKind = 'none' | 'enter' | 'switch' | 'leave' | 'move'
export type CameraFlight = { id: number; kind: FlightKind; progress: number }

/** Written by the active camera before fades and render passes run. Progress is eased, from 0 to 1. */
export const cameraFlight: CameraFlight = { id: 0, kind: 'none', progress: 1 }
// How long the current flight takes.
let flightSeconds = CAMERA_FLIGHT_SECONDS

/** A new destination starts from the current view, including when another flight is interrupted. */
export const beginCameraFlight = (kind: FlightKind, seconds = CAMERA_FLIGHT_SECONDS) => {
  cameraFlight.id++
  cameraFlight.kind = kind
  cameraFlight.progress = 0
  flightSeconds = seconds
}

/** Cubic easing shared by camera position, framing and the effects travelling with them. */
export const flightEase = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** Advance by elapsed time, so a slow frame cannot leave the visual transition behind the camera. */
export const advanceCameraFlight = (started: number, now: number) => {
  const t = animationProgress(started, now, flightSeconds)
  cameraFlight.progress = flightEase(t)
  return t
}

export type FlightFade = { id: number; from: number; target: number; start: number; pending: boolean }

/** Per-effect origin; an interrupted flight keeps the opacity already on screen. */
export const flightFade = (): FlightFade => ({ id: -1, from: 0, target: 0, start: 0, pending: false })

/**
 * Follow the remaining camera movement, catching up fully on its last frame. `changed` also binds effects whose
 * new room/floor reaches React after that last frame. Undefined leaves an ordinary, non-camera fade to its caller.
 */
export const followCameraFlight = (
  fade: FlightFade,
  value: number,
  target: number,
  changed = false,
  flight: CameraFlight = cameraFlight,
) => {
  if (flight.kind === 'none' || (flight.progress >= 1 && !changed && !(fade.id === flight.id && fade.pending)))
    return undefined
  if (fade.id !== flight.id || fade.target !== target) {
    fade.id = flight.id
    fade.from = value
    fade.target = target
    fade.start = flight.progress
  }
  fade.pending = flight.progress < 1
  const t = flight.progress >= 1 ? 1 : (flight.progress - fade.start) / (1 - fade.start)
  return fade.from + (target - fade.from) * t
}

/** The previous room clears over the first half; the next room comes into focus over the second half. */
export const roomBlurAmount = (flight: CameraFlight, from: number, shown = true) => {
  const p = flight.progress
  if (flight.kind === 'enter') return from + (1 - from) * p
  if (flight.kind === 'leave') return from * (1 - p)
  if (flight.kind === 'move') return from + ((shown ? 1 : 0) - from) * p
  if (flight.kind === 'switch') return p < 0.5 ? from * (1 - 2 * p) : 2 * p - 1
}
