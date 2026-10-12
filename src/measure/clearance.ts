import type { Rect } from '../layout/rooms'
import type { Point } from '../layout/types'

export type Footprint = { x: number; y: number; width: number; depth: number; rotation: number }

/** The gap from one side of an item to the nearest wall face straight ahead of it. */
export type Clearance = { from: Point; to: Point; distance: number }

const MAX_REACH = 20

/** Distance along the ray to where it enters the rectangle; 0 if it starts inside, undefined if it misses. */
const rayHit = (p: Point, d: Point, r: Rect): number | undefined => {
  let t0 = -Infinity
  let t1 = Infinity
  for (const [pi, di, lo, hi] of [
    [p[0], d[0], r.x0, r.x1],
    [p[1], d[1], r.y0, r.y1],
  ]) {
    if (Math.abs(di) < 1e-12) {
      if (pi <= lo || pi >= hi) return undefined
      continue
    }
    const a = (lo - pi) / di
    const b = (hi - pi) / di
    t0 = Math.max(t0, Math.min(a, b))
    t1 = Math.min(t1, Math.max(a, b))
  }
  if (t1 <= 0 || t0 >= t1) return undefined
  return Math.max(0, t0)
}

/**
 * For each of the item's four sides, how far it is to the nearest wall straight out from that side. Rays leave
 * from both corners and the middle of the side and the shortest wins, so a door opening in front of the middle
 * doesn't hide the wall beside it.
 */
export const clearances = (f: Footprint, walls: Rect[]): Clearance[] => {
  const c = Math.cos(f.rotation)
  const s = Math.sin(f.rotation)
  // Item axes in the plan: u along its width, v along its depth.
  const u: Point = [c, s]
  const v: Point = [-s, c]
  const sides: { dir: Point; reach: number; along: Point; half: number }[] = [
    { dir: u, reach: f.width / 2, along: v, half: f.depth / 2 },
    { dir: [-u[0], -u[1]], reach: f.width / 2, along: v, half: f.depth / 2 },
    { dir: v, reach: f.depth / 2, along: u, half: f.width / 2 },
    { dir: [-v[0], -v[1]], reach: f.depth / 2, along: u, half: f.width / 2 },
  ]
  const result: Clearance[] = []
  for (const { dir, reach, along, half } of sides) {
    let best: Clearance | undefined
    // Just inside the corners, so a wall the item is flush against beside it doesn't count.
    for (const k of [-0.98, 0, 0.98]) {
      const from: Point = [f.x + dir[0] * reach + along[0] * half * k, f.y + dir[1] * reach + along[1] * half * k]
      let nearest = MAX_REACH
      for (const r of walls) {
        const t = rayHit(from, dir, r)
        if (t !== undefined && t < nearest) nearest = t
      }
      if (nearest < MAX_REACH && (!best || nearest < best.distance))
        best = { from, to: [from[0] + dir[0] * nearest, from[1] + dir[1] * nearest], distance: nearest }
    }
    if (best) result.push(best)
  }
  return result
}
