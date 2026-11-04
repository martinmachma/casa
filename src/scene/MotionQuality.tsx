import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Matrix4 } from 'three'

// How long the view must stay still before it's drawn at full quality again.
const SETTLE_MS = 150
const MOVING_DPR = 1
/**
 * Moves smaller than this (in metres, and in the rotation's terms) don't count: the orbit controls' damping goes on
 * nudging the camera by less than that long after they stop asking for frames, which would flip each frame drawn
 * between cheap and full quality, and thin things like door frames would flicker.
 */
const STILL = 1e-3

const near = (a: Matrix4, b: Matrix4) => a.elements.every((v, i) => Math.abs(v - b.elements[i]) < STILL)

const asked = { frame: false }
/** Something other than the camera is animating (a floor fading, a wall being cut): the frames stay cheap for it too. */
export const animating = () => {
  asked.frame = true
}

/**
 * While the camera moves or anything else animates, frames are drawn at most at 1× pixel ratio: on a 2× screen that's
 * a quarter of the pixels. Shadows stay as they are, so nothing changes look when the view starts or stops moving.
 * Once the view settles, one full-resolution frame is drawn. A new `view` is cheap from its very first frame.
 */
export const MotionQuality = ({ view }: { view: string }) => {
  const invalidate = useThree((s) => s.invalidate)
  const seen = useRef(new Matrix4())
  const projection = useRef(new Matrix4())
  const moving = useRef(false)
  const settled = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(
    () => () => window.clearTimeout(timer.current),
    [],
  )
  useEffect(() => {
    animating()
    invalidate()
  }, [view, invalidate])

  // Runs before the camera rigs' own frame callbacks, so a move is seen a frame late; the settling frame is drawn in
  // full whatever it shows, and a camera still easing after it goes back to cheap frames.
  useFrame(({ camera, gl, viewport }) => {
    camera.updateMatrixWorld()
    // Measured from where it last moved, so a slow drift still adds up to a move.
    const still = near(seen.current, camera.matrixWorld) && projection.current.equals(camera.projectionMatrix)
    if (!still) {
      seen.current.copy(camera.matrixWorld)
      projection.current.copy(camera.projectionMatrix)
    }
    const animated = asked.frame
    asked.frame = false
    if (settled.current) {
      settled.current = false
      moving.current = false
    } else if (!still || animated) {
      moving.current = true
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        settled.current = true
        invalidate()
      }, SETTLE_MS)
    }
    // R3F puts its own ratio back on a resize, so this is checked every frame.
    const ratio = moving.current ? Math.min(MOVING_DPR, viewport.dpr) : viewport.dpr
    if (gl.getPixelRatio() !== ratio) gl.setPixelRatio(ratio)
  })
  return null
}
