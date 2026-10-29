import type { Point, Wall } from '../layout/types'

/**
 * Whether a piece stands in the way of the view from `eye` to `center` (what's being looked at), so it's cut:
 * one against a wall when seen from behind that wall, one standing free when it's on the eye's side of `center`.
 */
export const inTheWay = (at: Point, backing: Pick<Wall, 'from' | 'to'> | undefined, eye: Point, center: Point) => {
  if (!backing) return (at[0] - center[0]) * (eye[0] - center[0]) + (at[1] - center[1]) * (eye[1] - center[1]) > 0
  const [dx, dz] = [backing.to[0] - backing.from[0], backing.to[1] - backing.from[1]]
  const side = (p: Point) => dx * (p[1] - backing.from[1]) - dz * (p[0] - backing.from[0])
  return side(at) * side(eye) < 0
}
