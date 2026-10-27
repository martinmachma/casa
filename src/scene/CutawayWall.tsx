import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode } from 'react'
import { Vector3, type Camera, type Group } from 'three'
import { blocksView, wallAngle, wallHeight, wallOutside } from '../layout/geometry'
import type { Floor, Point, Wall } from '../layout/types'

// Keep the visible outline pickable when the rest of the wall is cut away.
export const STUB_HEIGHT = 0.3
const forward = new Vector3()

const isCut = (wall: Wall, outside: Point | undefined, camera: Camera, cutaway: boolean) => {
  if (!cutaway) return false
  camera.getWorldDirection(forward)
  return blocksView(wall, outside, [camera.position.x, camera.position.z], [forward.x, forward.z])
}

export const visibleWallHeight = (wall: Wall, floor: Floor, camera: Camera, cutaway: boolean) =>
  isCut(wall, cutaway ? wallOutside(wall, floor) : undefined, camera, cutaway) ? Math.min(STUB_HEIGHT, wallHeight(wall, floor)) : wallHeight(wall, floor)

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
  useFrame(({ camera }) => {
    const cut = isCut(wall, outside, camera, cutaway)
    if (fullRef.current) fullRef.current.visible = !cut
    if (stubRef.current) stubRef.current.visible = cut
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
