import { openingId, openingSill, wallAngle, wallEndExtensions, wallPieces, wallThickness } from '../layout/geometry'
import type { Floor, Point } from '../layout/types'

/** A solid rectangle in the plan: centre, half sizes along its own axes, and its angle. */
export type Obstacle = { cx: number; cy: number; hu: number; hv: number; angle: number }

// Anything lower than this can't be walked through (sills, furniture); door openings start at 0.
const FOOT_HEIGHT = 0.3

/** Solid walls, closed doors and glass down to the floor block walking. Unlisted doors are closed. */
export const wallObstacles = (
  floor: Floor,
  openDoors: ReadonlySet<string> = new Set(),
  elevation = floor.elevation,
): Obstacle[] =>
  floor.walls.flatMap((wall) => {
    const angle = wallAngle(wall)
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    const half = wallThickness(wall, floor) / 2
    const fills = (wall.openings ?? [])
      .filter(
        (o, i) =>
          (o.type === 'window' && openingSill(o) < FOOT_HEIGHT) ||
          ((o.type === 'door' || o.type === 'sliding') && !openDoors.has(openingId(wall.id, i))),
      )
      .map((o) => ({ u0: o.offset, u1: o.offset + o.width, y0: 0, y1: o.height }))
    return [...wallPieces(wall, floor.height, wallEndExtensions(wall, floor)), ...fills]
      .filter((p) => p.y0 < elevation - floor.elevation + 1.8 && p.y1 > elevation - floor.elevation + 0.15)
      .map((p) => {
        const u = (p.u0 + p.u1) / 2
        return { cx: wall.from[0] + c * u, cy: wall.from[1] + s * u, hu: (p.u1 - p.u0) / 2, hv: half, angle }
      })
  })

/**
 * Pushes a walker (a circle of `radius`) out of every obstacle it overlaps, so it slides along walls instead of
 * stopping dead. A few passes settle corners.
 */
export const resolveCollisions = (p: Point, radius: number, obstacles: Obstacle[]): Point => {
  let [x, y] = p
  for (let pass = 0; pass < 3; pass++) {
    let moved = false
    for (const o of obstacles) {
      const c = Math.cos(o.angle)
      const s = Math.sin(o.angle)
      // Into the obstacle's own frame.
      const dx = x - o.cx
      const dy = y - o.cy
      const u = dx * c + dy * s
      const v = -dx * s + dy * c
      const nu = Math.max(-o.hu, Math.min(o.hu, u))
      const nv = Math.max(-o.hv, Math.min(o.hv, v))
      let pu = u - nu
      let pv = v - nv
      let d = Math.hypot(pu, pv)
      if (d >= radius) continue
      if (d < 1e-9) {
        // The centre is inside: leave by the nearest side.
        const outU = o.hu - Math.abs(u)
        const outV = o.hv - Math.abs(v)
        if (outU < outV) [pu, pv, d] = [Math.sign(u) || 1, 0, -outU]
        else [pu, pv, d] = [0, Math.sign(v) || 1, -outV]
      } else {
        pu /= d
        pv /= d
      }
      const push = radius - d
      x += (pu * c - pv * s) * push
      y += (pu * s + pv * c) * push
      moved = true
    }
    if (!moved) break
  }
  return [x, y]
}
