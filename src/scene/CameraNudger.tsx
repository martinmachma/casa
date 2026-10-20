import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { OrthographicCamera, PerspectiveCamera, Spherical, Vector3 } from 'three'
import { isTyping } from '../ui/isTyping'
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

/** Applies the on-screen buttons and WASD/arrow keys (pan) to the orbit/plan camera (inside the <Canvas>). */
export const CameraNudger = ({ nudge }: { nudge: RefObject<CameraNudge> }) => {
  const tmp = useMemo(
    () => ({ offset: new Vector3(), right: new Vector3(), forward: new Vector3(), spherical: new Spherical() }),
    [],
  )
  const up = useMemo(() => new Vector3(0, 1, 0), [])
  const keys = useRef(new Set<string>())

  useEffect(() => {
    const held = keys.current
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      held.add(e.key.toLowerCase())
    }
    const up = (e: KeyboardEvent) => held.delete(e.key.toLowerCase())
    const clear = () => held.clear()
    const focus = (e: FocusEvent) => {
      if (isTyping(e.target) || (e.target instanceof Element && e.target.closest('dialog'))) clear()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    window.addEventListener('focusin', focus)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      window.removeEventListener('focusin', focus)
    }
  }, [])

  useFrame(({ camera, controls, size }, delta) => {
    const orbit = controls as unknown as OrbitLike | null
    if (!orbit?.target) return
    const k = keys.current
    const axis = (plus: boolean, minus: boolean) => (plus ? 1 : 0) - (minus ? 1 : 0)
    const { zoom, turn, tilt } = nudge.current
    const forward = nudge.current.forward + axis(k.has('w') || k.has('arrowup'), k.has('s') || k.has('arrowdown'))
    const right = nudge.current.right + axis(k.has('d') || k.has('arrowright'), k.has('a') || k.has('arrowleft'))
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
