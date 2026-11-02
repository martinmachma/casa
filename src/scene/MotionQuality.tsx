import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Matrix4 } from 'three'
import { fastShadows } from './shadowShader'

// How long the view must stay still before it's drawn at full quality again.
const SETTLE_MS = 150
const MOVING_DPR = 1

/**
 * While the camera moves, frames are drawn cheaper: at most 1× pixel ratio, and bulbs' shadows with a single tap.
 * At night with the lights on those two are most of a frame. Once the view settles, one full-quality frame is drawn.
 */
export const MotionQuality = () => {
  const invalidate = useThree((s) => s.invalidate)
  const view = useRef(new Matrix4())
  const projection = useRef(new Matrix4())
  const moving = useRef(false)
  const settled = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      fastShadows.value = false
    },
    [],
  )

  // Runs before the camera rigs' own frame callbacks, so a move is seen a frame late; the settling frame is drawn in
  // full whatever it shows, and a camera still easing after it goes back to cheap frames.
  useFrame(({ camera, gl, viewport }) => {
    camera.updateMatrixWorld()
    const still = view.current.equals(camera.matrixWorld) && projection.current.equals(camera.projectionMatrix)
    view.current.copy(camera.matrixWorld)
    projection.current.copy(camera.projectionMatrix)
    if (settled.current) {
      settled.current = false
      moving.current = false
    } else if (!still) {
      moving.current = true
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        settled.current = true
        invalidate()
      }, SETTLE_MS)
    }
    fastShadows.value = moving.current
    // R3F puts its own ratio back on a resize, so this is checked every frame.
    const ratio = moving.current ? Math.min(MOVING_DPR, viewport.dpr) : viewport.dpr
    if (gl.getPixelRatio() !== ratio) gl.setPixelRatio(ratio)
  })
  return null
}
