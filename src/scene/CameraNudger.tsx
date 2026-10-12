import { useFrame } from '@react-three/fiber'
import { useMemo, type RefObject } from 'react'
import { OrthographicCamera, PerspectiveCamera, Spherical, Vector3 } from 'three'
import type { CameraNudge } from './cameraNudge'

type OrbitLike = { target: Vector3; maxPolarAngle: number; update: () => void }

// Per second while a button is held.
const ZOOM_RATE = 1.3
const TURN_RATE = 1.4
const TILT_RATE = 0.9
const PAN_RATE = 0.9
const MIN_DISTANCE = 1.5
const MAX_DISTANCE = 60
const MIN_POLAR = 0.05

/** Applies the on-screen buttons to the orbit/plan camera (inside the <Canvas>). */
export const CameraNudger = ({ nudge }: { nudge: RefObject<CameraNudge> }) => {
  const tmp = useMemo(
    () => ({ offset: new Vector3(), right: new Vector3(), forward: new Vector3(), spherical: new Spherical() }),
    [],
  )
  const up = useMemo(() => new Vector3(0, 1, 0), [])

  useFrame(({ camera, controls, size }, delta) => {
    const orbit = controls as unknown as OrbitLike | null
    if (!orbit?.target) return
    const { forward, right, zoom, turn, tilt } = nudge.current
    if (!forward && !right && !zoom && !turn && !tilt) return
    const dt = Math.min(delta, 0.1)
    const { offset } = tmp
    offset.copy(camera.position).sub(orbit.target)

    if (zoom) {
      const factor = Math.exp(zoom * ZOOM_RATE * dt)
      if (camera instanceof OrthographicCamera) {
        camera.zoom *= factor
        camera.updateProjectionMatrix()
      } else {
        const distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, offset.length() / factor))
        offset.setLength(distance)
      }
    }

    if (turn || tilt) {
      const s = tmp.spherical.setFromVector3(offset)
      s.theta -= turn * TURN_RATE * dt
      s.phi = Math.min(orbit.maxPolarAngle, Math.max(MIN_POLAR, s.phi - tilt * TILT_RATE * dt))
      offset.setFromSpherical(s)
    }

    if (forward || right) {
      // Screen right and screen "up", flattened onto the floor.
      tmp.right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize()
      tmp.forward.crossVectors(up, tmp.right).normalize()
      const reach =
        camera instanceof OrthographicCamera
          ? Math.min(size.width, size.height) / camera.zoom
          : camera instanceof PerspectiveCamera
            ? offset.length()
            : 10
      const step = reach * PAN_RATE * dt
      const move = tmp.right.multiplyScalar(right * step).addScaledVector(tmp.forward, forward * step)
      orbit.target.add(move)
    }

    camera.position.copy(orbit.target).add(offset)
    orbit.update()
  })

  return null
}
