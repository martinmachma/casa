import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Vector3, type Camera, type Group } from 'three'
import { applyFade, fadeStep } from './Fade'
import { blocksView, separates, wallAngle, wallHeight, wallOutside } from '../layout/geometry'
import type { Floor, Point, Wall } from '../layout/types'

// Keep the visible outline pickable when the rest of the wall is cut away.
export const STUB_HEIGHT = 0.3
const forward = new Vector3()

/**
 * A room being looked at: its middle, its floor's extent, and the walls along its outline with the way out across
 * each.
 */
export type Focus = { center: Point; box: { min: Point; max: Point }; sides: Map<string, Point> }

/** A wall wholly past the room's floor on the camera's side, in either direction, stands between them. */
const beyond = (wall: Wall, eye: Point, { min, max }: Focus['box']) =>
  [0, 1].some((a) => {
    const lo = Math.min(wall.from[a], wall.to[a])
    const hi = Math.max(wall.from[a], wall.to[a])
    return (eye[a] > max[a] && lo >= max[a]) || (eye[a] < min[a] && hi <= min[a])
  })

const isCut = (wall: Wall, outside: Point | undefined, camera: Camera, cutaway: boolean, focus?: Focus) => {
  if (!cutaway) return false
  // Looking at one room, only walls between the camera and it go: its own walls seen from outside, and
  // walls beyond it in the way. Walls inside it and its far walls stay up.
  if (focus) {
    const out = focus.sides.get(wall.id)
    const eye: Point = [camera.position.x, camera.position.z]
    if (out) return (eye[0] - wall.from[0]) * out[0] + (eye[1] - wall.from[1]) * out[1] > 0
    return separates(wall, eye, focus.center) || beyond(wall, eye, focus.box)
  }
  camera.getWorldDirection(forward)
  return blocksView(wall, outside, [camera.position.x, camera.position.z], [forward.x, forward.z])
}

/** A wall built against another (a shaft, a chimney breast) is cut or left standing with it. */
const decidingWall = (wall: Wall, floor: Floor) =>
  (wall.against && floor.walls.find((w) => w.id === wall.against)) || wall

/** Whether a wall is cut down now, seen by `camera` (its outside worked out once by the caller). */
export const wallCut = (
  wall: Wall,
  floor: Floor,
  outside: Point | undefined,
  camera: Camera,
  cutaway: boolean,
  focus?: Focus,
) => isCut(decidingWall(wall, floor), outside, camera, cutaway, focus)

export const visibleWallHeight = (wall: Wall, floor: Floor, camera: Camera, cutaway: boolean) =>
  isCut(decidingWall(wall, floor), cutaway ? wallOutside(wall, floor) : undefined, camera, cutaway)
    ? Math.min(STUB_HEIGHT, wallHeight(wall, floor))
    : wallHeight(wall, floor)

/** Rendered walls and measurement targets share the same camera-dependent visibility. */
export const CutawayWall = ({
  wall,
  floor,
  cutaway,
  focus,
  decider: other,
  full,
  stub,
}: {
  wall: Wall
  /** The wall whose cut this follows, if not its own (a corner block going with the room's wall it meets). */
  decider?: Wall
  floor: Floor
  cutaway: boolean
  /** The middle of the room being looked at, if any. */
  focus?: Focus
  full: ReactNode
  stub: ReactNode
}) => {
  const fullRef = useRef<Group>(null)
  const stubRef = useRef<Group>(null)
  const outside = useMemo(() => wallOutside(other ?? wall, floor), [other, wall, floor])
  const decider = useMemo(() => decidingWall(other ?? wall, floor), [other, wall, floor])
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
    const target = isCut(decider, outside, camera, cutaway, focus) ? 1 : 0
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
    <group
      position={[wall.from[0], floor.elevation, wall.from[1]]}
      rotation={[0, -wallAngle(wall), 0]}
      userData={{ wallId: wall.id }}
    >
      <group ref={fullRef}>{full}</group>
      <group ref={stubRef} visible={false}>
        {stub}
      </group>
    </group>
  )
}
