import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Vector3, type Camera, type Group } from 'three'
import { blocksView, wallAngle, wallHeight, wallOutside } from '../layout/geometry'
import type { Floor, Point, Wall } from '../layout/types'

// Keep the visible outline pickable when the rest of the wall is cut away.
export const STUB_HEIGHT = 0.3
// How long a wall takes to sink to its stub or rise back.
const CUT_SECONDS = 0.35
const ease = (t: number) => t * t * (3 - 2 * t)
const forward = new Vector3()

const isCut = (wall: Wall, outside: Point | undefined, camera: Camera, cutaway: boolean) => {
  if (!cutaway) return false
  camera.getWorldDirection(forward)
  return blocksView(wall, outside, [camera.position.x, camera.position.z], [forward.x, forward.z])
}

export const visibleWallHeight = (wall: Wall, floor: Floor, camera: Camera, cutaway: boolean) =>
  isCut(wall, cutaway ? wallOutside(wall, floor) : undefined, camera, cutaway)
    ? Math.min(STUB_HEIGHT, wallHeight(wall, floor))
    : wallHeight(wall, floor)

/** Rendered walls and measurement targets share the same camera-dependent visibility. */
export const CutawayWall = ({
  wall,
  floor,
  cutaway,
  full,
  stub,
}: {
  wall: Wall
  floor: Floor
  cutaway: boolean
  full: ReactNode
  stub: ReactNode
}) => {
  const fullRef = useRef<Group>(null)
  const stubRef = useRef<Group>(null)
  const outside = useMemo(() => wallOutside(wall, floor), [wall, floor])
  // 0 standing, 1 cut down to the stub; the full wall sinks to the stub's height before the stub takes over.
  const k = useRef<number>(undefined)
  // Only switching the cut on or off animates; walls cut as the camera moves just go.
  const animate = useRef(false)
  const redraw = useThree((s) => s.invalidate)
  useEffect(() => {
    animate.current = true
    redraw()
  }, [cutaway, redraw])
  useFrame(({ camera, invalidate }, delta) => {
    const target = isCut(wall, outside, camera, cutaway) ? 1 : 0
    // A long idle gap (the view renders on demand) shouldn't skip the animation.
    const step = Math.min(delta, 1 / 30) / CUT_SECONDS
    const now =
      k.current === undefined || !animate.current
        ? target
        : k.current + Math.max(-step, Math.min(step, target - k.current))
    k.current = now
    if (now !== target) invalidate()
    else animate.current = false
    const full = fullRef.current
    if (full) {
      full.visible = now < 1
      const low = Math.min(STUB_HEIGHT, wallHeight(wall, floor)) / wallHeight(wall, floor)
      full.scale.y = 1 - (1 - low) * ease(now)
    }
    if (stubRef.current) stubRef.current.visible = now >= 1
  })
  return (
    <group position={[wall.from[0], floor.elevation, wall.from[1]]} rotation={[0, -wallAngle(wall), 0]}>
      <group ref={fullRef}>{full}</group>
      <group ref={stubRef} visible={false}>
        {stub}
      </group>
    </group>
  )
}
