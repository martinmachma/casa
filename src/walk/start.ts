import { floorBounds, insidePolygon } from '../layout/geometry'
import { floorRegions, roomAt, subtractRects } from '../layout/rooms'
import type { Floor, Point } from '../layout/types'
import { resolveCollisions, type Obstacle } from './collide'

export const EYE_HEIGHT = 1.6
export const WALK_RADIUS = 0.22
// Rugs and other low items can be stepped over.
export const STEP_OVER = 0.15

export type WalkStart = { floorIndex: number; at: Point; yaw: number }

/** A slab surface, excluding its stairwell and the space beyond its edge. */
export const onFloorSurface = (floor: Floor, at: Point, radius = 0): boolean => {
  const { min, max } = floorBounds(floor)
  const outline = floor.outline ?? [min, [max[0], min[1]], max, [min[0], max[1]]]
  const supported = Array.from({ length: radius ? 16 : 1 }, (_, i): Point => [
    at[0] + Math.cos((i * Math.PI) / 8) * radius,
    at[1] + Math.sin((i * Math.PI) / 8) * radius,
  ]).every((p) => insidePolygon(p, outline))
  return (
    supported &&
    !(floor.voids ?? []).some(
      (v) => at[0] > v.x0 - radius && at[0] < v.x1 + radius && at[1] > v.y0 - radius && at[1] < v.y1 + radius,
    )
  )
}

/** Keep the viewed or dropped position when possible; otherwise use the nearest clear room floor. */
export const nearestWalkPoint = (floor: Floor, preferred: Point, obstacles: Obstacle[]): Point | undefined => {
  const regions = floorRegions(floor)
  const cells = subtractRects(
    [...regions.values()].flatMap((r) => r.cells),
    floor.voids ?? [],
  )
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
  const candidates: Point[] = [preferred, ...floor.rooms.map((r) => r.label)]
  for (const c of cells) {
    const mx = Math.min(WALK_RADIUS, (c.x1 - c.x0) / 2)
    const my = Math.min(WALK_RADIUS, (c.y1 - c.y0) / 2)
    candidates.push(
      [clamp(preferred[0], c.x0 + mx, c.x1 - mx), clamp(preferred[1], c.y0 + my, c.y1 - my)],
      [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2],
    )
  }
  let best: Point | undefined
  let distance = Infinity
  for (const candidate of candidates) {
    const at = resolveCollisions(candidate, WALK_RADIUS, obstacles)
    if (!onFloorSurface(floor, at, WALK_RADIUS) || !roomAt(regions, ...at)) continue
    const checked = resolveCollisions(at, WALK_RADIUS, obstacles)
    if (Math.hypot(checked[0] - at[0], checked[1] - at[1]) > 1e-5) continue
    const d = Math.hypot(at[0] - preferred[0], at[1] - preferred[1])
    if (d < 1e-6) return at
    if (d < distance) {
      best = at
      distance = d
    }
  }
  return best
}
