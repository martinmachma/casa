import type { Rect } from '../layout/rooms'
import type { Point } from '../layout/types'

/** How close (metres) a tap must be to a wall face or corner to land exactly on it. */
export const SNAP_DISTANCE = 0.12
/** A second point within this angle of square to the first lines up exactly. */
const ALIGN_ANGLE = (4 * Math.PI) / 180

/**
 * Moves a point onto the nearest wall face within `tolerance`, separately in x and y, so a tap near a corner
 * lands on the corner and one near a face lands on the face.
 */
export const snapToWallFaces = (p: Point, walls: Rect[], tolerance = SNAP_DISTANCE): Point => {
  let [x, y] = p
  let bestX = tolerance
  let bestY = tolerance
  for (const r of walls) {
    // A face only counts beside its own wall (plus the tolerance, for corners).
    if (p[1] >= r.y0 - tolerance && p[1] <= r.y1 + tolerance)
      for (const fx of [r.x0, r.x1]) {
        const d = Math.abs(p[0] - fx)
        if (d < bestX) [bestX, x] = [d, fx]
      }
    if (p[0] >= r.x0 - tolerance && p[0] <= r.x1 + tolerance)
      for (const fy of [r.y0, r.y1]) {
        const d = Math.abs(p[1] - fy)
        if (d < bestY) [bestY, y] = [d, fy]
      }
  }
  return [x, y]
}

/** Squares `b` up with `a` when the line between them is nearly horizontal or vertical in the plan. */
export const alignWith = (a: Point, b: Point): Point => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const angle = Math.abs(Math.atan2(dy, dx))
  if (Math.min(angle, Math.PI - angle) < ALIGN_ANGLE) return [b[0], a[1]]
  if (Math.abs(angle - Math.PI / 2) < ALIGN_ANGLE) return [a[0], b[1]]
  return b
}

export const distance = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1])

/** "3.42 m", or centimetres under a metre. */
export const formatLength = (m: number) => (m < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(2)} m`)
