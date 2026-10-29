import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Vector3, type Camera, type Group } from 'three'
import { applyFade, fadeStep } from './Fade'
import { blocksView, separates, wallAngle, wallHeight, wallOutside } from '../layout/geometry'
import type { Floor, Point, Wall } from '../layout/types'

// Keep the visible outline pickable when the rest of the wall is cut away.
export const STUB_HEIGHT = 0.3
const forward = new Vector3()

const isCut = (wall: Wall, outside: Point | undefined, camera: Camera, cutaway: boolean, focus?: Point) => {
  if (!cutaway) return false
  // Looking at one room, only walls between the camera and it go; the far ones stay up.
  if (focus) return separates(wall, [camera.position.x, camera.position.z], focus)
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
  focus,
  full,
  stub,
}: {
  wall: Wall
  floor: Floor
  cutaway: boolean
  /** The middle of the room being looked at, if any. */
  focus?: Point
  full: ReactNode
  stub: ReactNode
}) => {
  const fullRef = useRef<Group>(null)
  const stubRef = useRef<Group>(null)
  const outside = useMemo(() => wallOutside(wall, floor), [wall, floor])
  // 0 standing, 1 cut down to the stub; the full wall fades out as the stub fades in.
  const k = useRef<number>(undefined)
  // Only switching the cut on or off animates; walls cut as the camera moves just go.
  const animate = useRef(false)
  const redraw = useThree((s) => s.invalidate)
  useEffect(() => {
    animate.current = true
    redraw()
  }, [cutaway, focus, redraw])
  useFrame(({ camera, invalidate }, delta) => {
    const target = isCut(wall, outside, camera, cutaway, focus) ? 1 : 0
    const now = k.current === undefined || !animate.current ? target : fadeStep(k.current, target, delta)
    if (now !== target) invalidate()
    else animate.current = false
    if (now === k.current) return
    k.current = now
    const full = fullRef.current
    const stub = stubRef.current
    if (!full || !stub) return
    full.visible = now < 1
    stub.visible = now > 0
    full.userData.fade = 1 - now
    stub.userData.fade = now
    applyFade(full)
    applyFade(stub)
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
