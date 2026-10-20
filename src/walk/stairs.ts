import type { Floor, Point } from '../layout/types'

type Edge = [Point, Point]
type Tread = { polygon: Point[]; entry: Edge; exit: Edge }
export type StairRun = { lower: number; upper: number; treads: Tread[] }
const EPS = 1e-7

const edges = (polygon: Point[]): Edge[] => polygon.map((p, i) => [p, polygon[(i + 1) % polygon.length]])
const distance = (p: Point, [a, b]: Edge) =>
  Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1])

/** Adjacent winders sometimes share only part of an edge. */
const sharedEdge = (a: Point[], b: Point[]): Edge => {
  for (const edge of edges(a)) {
    for (const other of edges(b)) {
      if (other.some((p) => distance(p, edge) > EPS)) continue
      const [p, q] = edge
      const length = Math.hypot(q[0] - p[0], q[1] - p[1])
      const ux = (q[0] - p[0]) / length
      const uy = (q[1] - p[1]) / length
      const along = other.map((v) => (v[0] - p[0]) * ux + (v[1] - p[1]) * uy)
      const lo = Math.max(0, Math.min(...along))
      const hi = Math.min(length, Math.max(...along))
      if (hi - lo > EPS)
        return [
          [p[0] + ux * lo, p[1] + uy * lo],
          [p[0] + ux * hi, p[1] + uy * hi],
        ]
    }
  }
  throw new Error('Stair treads must share an edge')
}

const oppositeEdge = (polygon: Point[], edge: Edge): Edge =>
  edges(polygon).sort(
    (a, b) => distance(b[0], edge) + distance(b[1], edge) - distance(a[0], edge) - distance(a[1], edge),
  )[0]

export const stairRuns = (floors: Floor[]): StairRun[] =>
  floors.flatMap((floor, lower) => {
    const steps = floor.stairs?.steps
    if (!steps || steps.length < 2 || !floors[lower + 1]) return []
    const joins = steps.slice(1).map((step, i) => sharedEdge(steps[i], step))
    return [
      {
        lower,
        upper: lower + 1,
        treads: steps.map((polygon, i) => ({
          polygon,
          entry: i === 0 ? oppositeEdge(polygon, joins[0]) : joins[i - 1],
          exit: i === steps.length - 1 ? oppositeEdge(polygon, joins[i - 1]) : joins[i],
        })),
      },
    ]
  })

const contains = (polygon: Point[], p: Point): boolean => {
  let inside = false
  for (const [a, b] of edges(polygon)) {
    if (
      distance(p, [a, b]) < EPS &&
      p[0] >= Math.min(a[0], b[0]) - EPS &&
      p[0] <= Math.max(a[0], b[0]) + EPS &&
      p[1] >= Math.min(a[1], b[1]) - EPS &&
      p[1] <= Math.max(a[1], b[1]) + EPS
    )
      return true
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

/** Continuous rise across straight treads and winders; undefined outside the footprint.
 * Optional level aprons let the walker's radius pass the ends without opening the sides.
 */
export const stairHeight = (run: StairRun, floors: Floor[], p: Point, apron = 0): number | undefined => {
  const bottom = floors[run.lower].elevation
  const rise = floors[run.upper].elevation - bottom
  for (const [i, tread] of run.treads.entries()) {
    if (!contains(tread.polygon, p)) continue
    const a = distance(p, tread.entry)
    const b = distance(p, tread.exit)
    return bottom + (rise * (i + (a + b < EPS ? 0.5 : a / (a + b)))) / run.treads.length
  }
  if (apron > 0) {
    for (const top of [false, true]) {
      const tread = run.treads[top ? run.treads.length - 1 : 0]
      const edge = top ? tread.exit : tread.entry
      const other = top ? tread.entry : tread.exit
      const dx = (edge[0][0] + edge[1][0] - other[0][0] - other[1][0]) / 2
      const dy = (edge[0][1] + edge[1][1] - other[0][1] - other[1][1]) / 2
      const length = Math.hypot(dx, dy)
      const shift = (p: Point): Point => [p[0] + (dx / length) * apron, p[1] + (dy / length) * apron]
      if (contains([edge[0], edge[1], shift(edge[1]), shift(edge[0])], p)) return bottom + (top ? rise : 0)
    }
  }
  return undefined
}
