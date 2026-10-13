import { useFrame } from '@react-three/fiber'
import type { RefObject } from 'react'
import { Vector3 } from 'three'

const forward = new Vector3()
const up = new Vector3()

/**
 * Turns the compass to match the camera, every frame without re-rendering. The screen's up, laid on the ground, is
 * the camera's forward plus its up: one of the two always has a level part, whether looking straight down or ahead.
 */
export const CompassTracker = ({ north, needle }: { north: number; needle: RefObject<HTMLDivElement | null> }) => {
  useFrame(({ camera }) => {
    const el = needle.current
    if (!el) return
    camera.getWorldDirection(forward)
    up.setFromMatrixColumn(camera.matrixWorld, 1)
    const x = forward.x + up.x
    const z = forward.z + up.z
    // Bearings clockwise from plan-up (-z), as `north` is.
    const facing = (Math.atan2(x, -z) * 180) / Math.PI
    el.style.setProperty('transform', `rotate(${north - facing}deg)`)
  })
  return null
}

/** A compass rose over the 3D view; its N points to true north as the camera turns. */
export const Compass = ({ needle }: { needle: RefObject<HTMLDivElement | null> }) => (
  <div className="compass float" aria-hidden>
    <div className="compass-rose" ref={needle}>
      <svg viewBox="-20 -20 40 40" width="40" height="40">
        <polygon points="0,-13 4,0 -4,0" className="compass-north" />
        <polygon points="0,13 4,0 -4,0" className="compass-south" />
        <text x="0" y="-14.5" className="compass-n">
          N
        </text>
      </svg>
    </div>
  </div>
)
