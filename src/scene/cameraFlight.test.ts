import { describe, expect, it } from 'vitest'
import {
  advanceCameraFlight,
  beginCameraFlight,
  cameraFlightSeconds,
  cameraFlight,
  flightEase,
  flightFade,
  followCameraFlight,
  roomBlurAmount,
  type CameraFlight,
} from './cameraFlight'

describe('camera-synchronised transitions', () => {
  it.each([false, true])('finishes floors, cut walls and room blur with the camera (compact: %s)', (compact) => {
    const seconds = cameraFlightSeconds(compact)
    for (const frameMs of [1000 / 60, 125, 500, 2000]) {
      beginCameraFlight('switch', seconds)
      const floor = flightFade()
      const wall = flightFade()
      let floorOpacity = 0
      let wallCut = 1
      let now = 100_000
      let changedRoom = false
      do {
        advanceCameraFlight(100_000, now)
        const midway = cameraFlight.progress >= 0.5
        const changed = midway && !changedRoom
        changedRoom ||= midway
        floorOpacity = followCameraFlight(floor, floorOpacity, midway ? 1 : 0, changed) ?? floorOpacity
        wallCut = followCameraFlight(wall, wallCut, midway ? 0 : 1, changed) ?? wallCut
        if (cameraFlight.progress === 1) {
          expect(floorOpacity).toBe(1)
          expect(wallCut).toBe(0)
          expect(roomBlurAmount(cameraFlight, 1)).toBe(1)
        }
        now += frameMs
      } while (cameraFlight.progress < 1)
      expect(now - frameMs - 100_000).toBeLessThan(seconds * 1000 + frameMs + 0.001)
    }
  })

  it('binds a floor/room commit arriving after a frame skips past the whole flight', () => {
    const flight: CameraFlight = { id: 4, kind: 'switch', progress: 1 }
    expect(followCameraFlight(flightFade(), 0, 1, true, flight)).toBe(1)
    expect(followCameraFlight(flightFade(), 1, 0, true, flight)).toBe(0)
  })

  it('restarts interrupted fades from their current opacity, including a reversal halfway', () => {
    const flight: CameraFlight = { id: 1, kind: 'move', progress: 0 }
    const fade = flightFade()
    expect(followCameraFlight(fade, 0, 1, false, flight)).toBe(0)
    flight.progress = 0.4
    const partial = followCameraFlight(fade, 0, 1, false, flight)!
    expect(partial).toBeCloseTo(0.4)
    flight.id++
    flight.progress = 0
    expect(followCameraFlight(fade, partial, 0, false, flight)).toBe(partial)
    flight.progress = 0.5
    const reversed = followCameraFlight(fade, partial, 0, false, flight)!
    expect(reversed).toBeCloseTo(0.2)
    // A wall's target can change as the camera crosses it; this also stays continuous.
    expect(followCameraFlight(fade, reversed, 1, false, flight)).toBe(reversed)
    flight.progress = 1
    expect(followCameraFlight(fade, reversed, 1, false, flight)).toBe(1)
    // Manual controls regain their own fade after the flight ends.
    expect(followCameraFlight(fade, 1, 0, false, flight)).toBeUndefined()
  })

  it('enters, switches and leaves from the blur actually on screen without a jump', () => {
    const flight: CameraFlight = { id: 1, kind: 'enter', progress: 0 }
    expect(roomBlurAmount(flight, 0.3)).toBe(0.3)
    flight.progress = 1
    expect(roomBlurAmount(flight, 0.3)).toBe(1)
    flight.kind = 'switch'
    flight.progress = 0
    expect(roomBlurAmount(flight, 0.7)).toBe(0.7)
    flight.progress = 0.5
    expect(roomBlurAmount(flight, 0.7)).toBe(0)
    flight.progress = 0.75
    expect(roomBlurAmount(flight, 0.7)).toBe(0.5)
    flight.kind = 'leave'
    flight.progress = 0
    expect(roomBlurAmount(flight, 0.5)).toBe(0.5)
    flight.progress = 1
    expect(roomBlurAmount(flight, 0.5)).toBe(0)
    flight.kind = 'move'
    flight.progress = 0.5
    expect(roomBlurAmount(flight, 1, false)).toBe(0.5)
    expect(roomBlurAmount(flight, 0, true)).toBe(0.5)
    flight.progress = 1
    expect(roomBlurAmount(flight, 1, false)).toBe(0)
    flight.kind = 'none'
    expect(roomBlurAmount(flight, 1)).toBeUndefined()
  })

  it('uses the same elapsed-time easing for the camera and its effects after idle', () => {
    beginCameraFlight('enter')
    const began = 900_000
    expect(advanceCameraFlight(began, began)).toBe(0)
    const t = advanceCameraFlight(began, began + 400)
    expect(cameraFlight.progress).toBe(flightEase(t))
    expect(roomBlurAmount(cameraFlight, 0)).toBe(cameraFlight.progress)
    expect(advanceCameraFlight(began, began + 5000)).toBe(1)
    expect(cameraFlight.progress).toBe(1)
  })
})
