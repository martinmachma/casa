import type { FurnitureItem } from '../data/types'
import { DOOR_SWING, OPENING_FRAME, openingId, openingSill, wallLength } from '../layout/geometry'
import type { Floor, Point, Rect } from '../layout/types'
import FOOTPRINTS from './footprints.json'

export type Solid = Pick<FurnitureItem, 'id' | 'floor' | 'x' | 'y' | 'width' | 'depth' | 'rotation' | 'height' | 'z'> &
  Partial<Pick<FurnitureItem, 'model'>>

// Overlaps under a centimetre (pieces seated flush, plans measured to the centimetre) don't count.
const TOLERANCE = 0.01
// Rugs and the like lie flat under the rest; only walls stop them.
const FLAT = 0.02
// Chairs and stools tuck under tables, desks and counters up to this height.
const SEATS = new Set(['chair', 'chairCushion', 'chairModernCushion', 'chairDesk', 'stoolBar'])
const TABLE_HEIGHT = 0.95

type Box = { c: Point; axes: [Point, Point]; half: [number, number] }

type Shape = number[][]
const FULL: Shape = [[-0.5, 0.5, -0.5, 0.5]]

/** A model's footprint as [u0, u1, v0, v1] rectangles in its box's own -0.5…0.5 coordinates. */
export const footprint = (model: string | undefined): Shape =>
  (model && (FOOTPRINTS as Record<string, Shape>)[model]) || FULL

/**
 * The piece's footprint as boxes: the parts of its model seen from above (from scripts/footprints.mjs), so the
 * empty corner of an L-shaped sofa or desk is free; a plain box or unknown model is one box.
 */
const boxesOf = (s: Pick<Solid, 'x' | 'y' | 'width' | 'depth' | 'rotation' | 'model'>): Box[] => {
  const cos = Math.cos(s.rotation)
  const sin = Math.sin(s.rotation)
  const u: Point = [cos, sin]
  const v: Point = [-sin, cos]
  return footprint(s.model).map(([u0, u1, v0, v1]) => {
    const cu = ((u0 + u1) / 2) * s.width
    const cv = ((v0 + v1) / 2) * s.depth
    return {
      c: [s.x + cu * u[0] + cv * v[0], s.y + cu * u[1] + cv * v[1]],
      axes: [u, v],
      half: [((u1 - u0) / 2) * s.width, ((v1 - v0) / 2) * s.depth],
    }
  })
}

const rectBox = (r: Rect): Box => ({
  c: [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2],
  axes: [
    [1, 0],
    [0, 1],
  ],
  half: [(r.x1 - r.x0) / 2, (r.y1 - r.y0) / 2],
})

const radius = (b: Box, m: Point) =>
  b.half[0] * Math.abs(b.axes[0][0] * m[0] + b.axes[0][1] * m[1]) +
  b.half[1] * Math.abs(b.axes[1][0] * m[0] + b.axes[1][1] * m[1])

/** Separating axes: the boxes overlap unless some edge direction keeps them apart. */
const overlaps = (a: Box, b: Box) => {
  const d: Point = [b.c[0] - a.c[0], b.c[1] - a.c[1]]
  for (const m of [...a.axes, ...b.axes]) {
    if (Math.abs(d[0] * m[0] + d[1] * m[1]) >= radius(a, m) + radius(b, m) - TOLERANCE) return false
  }
  return true
}

const isSeat = (s: Solid) => s.model !== undefined && SEATS.has(s.model)
const tucks = (a: Solid, b: Solid) =>
  (isSeat(a) && !isSeat(b) && b.height <= TABLE_HEIGHT) || (isSeat(b) && !isSeat(a) && a.height <= TABLE_HEIGHT)

const stacked = (a: Solid, b: Solid) => {
  const az = a.z ?? 0
  const bz = b.z ?? 0
  return Math.min(az + a.height, bz + b.height) - Math.max(az, bz) > TOLERANCE
}

/** What a piece runs into: other pieces by id, walls as `wall:<index>`. */
export const hits = (piece: Solid, others: Solid[], walls: Rect[]): string[] => {
  const boxes = boxesOf(piece)
  const touches = (others: Box[]) => boxes.some((a) => others.some((b) => overlaps(a, b)))
  const result: string[] = []
  walls.forEach((w, i) => touches([rectBox(w)]) && result.push(`wall:${i}`))
  if (piece.height <= FLAT) return result
  for (const o of others) {
    if (o.id === piece.id || o.floor !== piece.floor || o.height <= FLAT || !stacked(piece, o) || tucks(piece, o))
      continue
    if (touches(boxesOf(o))) result.push(o.id)
  }
  return result
}

/** Every piece on the floor that runs into a wall or another piece. */
export const colliding = (items: Solid[], walls: Rect[]): Set<string> =>
  new Set(items.filter((item) => hits(item, items, walls).length).map((item) => item.id))

/**
 * The plan area a hinged door's leaf sweeps, as drawn in 3D: it pivots on the wall's centre line at `hinge`, lies
 * along `along` when closed and turns towards `out`, its leaf `radius` long. Anything between `bottom` and `top`
 * inside it stops the door.
 */
export type DoorSweep = {
  id: string
  hinge: Point
  along: Point
  out: Point
  radius: number
  bottom: number
  top: number
}

/** The hinged doors of a floor and the areas their leaves sweep. */
export const doorSweeps = (floor: Floor): DoorSweep[] =>
  floor.walls.flatMap((wall) => {
    const length = wallLength(wall)
    if (!length) return []
    const d: Point = [(wall.to[0] - wall.from[0]) / length, (wall.to[1] - wall.from[1]) / length]
    return (wall.openings ?? []).flatMap((o, i): DoorSweep[] => {
      if (o.type !== 'door') return []
      // Side 'a' is the wall's direction turned a quarter.
      const side = o.swing === 'b' ? -1 : 1
      const atEnd = o.hinge === 'to'
      const u = atEnd ? o.offset + o.width - OPENING_FRAME : o.offset + OPENING_FRAME
      const bottom = openingSill(o)
      return [
        {
          id: openingId(wall.id, i),
          hinge: [wall.from[0] + d[0] * u, wall.from[1] + d[1] * u],
          along: atEnd ? [-d[0], -d[1]] : d,
          out: [-d[1] * side, d[0] * side],
          radius: o.width - 2 * OPENING_FRAME,
          bottom,
          top: bottom + o.height - OPENING_FRAME,
        },
      ]
    })
  })

const SWEEP_STEPS = 12

/** The swept area as a convex polygon: the hinge, then the arc from closed to open. */
export const sweepOutline = (s: DoorSweep): Point[] => [
  s.hinge,
  ...Array.from({ length: SWEEP_STEPS + 1 }, (_, k): Point => {
    const t = (k / SWEEP_STEPS) * DOOR_SWING
    const a = Math.cos(t) * s.radius
    const b = Math.sin(t) * s.radius
    return [s.hinge[0] + a * s.along[0] + b * s.out[0], s.hinge[1] + a * s.along[1] + b * s.out[1]]
  }),
]

const corners = (b: Box): Point[] =>
  [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ].map(([i, j]): Point => [
    b.c[0] + i * b.half[0] * b.axes[0][0] + j * b.half[1] * b.axes[1][0],
    b.c[1] + i * b.half[0] * b.axes[0][1] + j * b.half[1] * b.axes[1][1],
  ])

const edgeNormals = (polygon: Point[]): Point[] =>
  polygon.map((p, i) => {
    const q = polygon[(i + 1) % polygon.length]
    return [q[1] - p[1], p[0] - q[0]]
  })

/** Separating axes for two convex polygons, with the same centimetre of slack as pieces seated flush. */
const polygonsOverlap = (a: Point[], b: Point[]) => {
  for (const m of [...edgeNormals(a), ...edgeNormals(b)]) {
    const length = Math.hypot(m[0], m[1])
    if (length < 1e-9) continue
    const span = (poly: Point[]) => poly.map((p) => (p[0] * m[0] + p[1] * m[1]) / length)
    const sa = span(a)
    const sb = span(b)
    if (Math.min(...sa) >= Math.max(...sb) - TOLERANCE || Math.min(...sb) >= Math.max(...sa) - TOLERANCE) return false
  }
  return true
}

/** For each door something stands in the way of, the pieces that stop it opening fully. */
export const blockedDoors = (items: Solid[], sweeps: DoorSweep[], floor: string): Map<string, string[]> => {
  const result = new Map<string, string[]>()
  for (const s of sweeps) {
    const area = sweepOutline(s)
    const ids = items
      .filter((item) => item.floor === floor && item.height > FLAT)
      .filter((item) => (item.z ?? 0) < s.top - TOLERANCE && (item.z ?? 0) + item.height > s.bottom + TOLERANCE)
      .filter((item) => boxesOf(item).some((b) => polygonsOverlap(area, corners(b))))
      .map((item) => item.id)
    if (ids.length) result.set(s.id, ids)
  }
  return result
}

const unique = (values: number[]) => [...new Set(values)].sort((a, b) => a - b)

/** The outer edges of a footprint, as segments in the same -0.5…0.5 coordinates, joined where they run straight on. */
export const footprintOutline = (shape: Shape): [Point, Point][] => {
  const us = unique(shape.flatMap(([u0, u1]) => [u0, u1]))
  const vs = unique(shape.flatMap(([, , v0, v1]) => [v0, v1]))
  const solid = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= us.length - 1 || j >= vs.length - 1) return false
    const u = (us[i] + us[i + 1]) / 2
    const v = (vs[j] + vs[j + 1]) / 2
    return shape.some(([u0, u1, v0, v1]) => u > u0 && u < u1 && v > v0 && v < v1)
  }
  const segments: [Point, Point][] = []
  // Runs of cell edges with solid on one side only, along each grid line.
  const trace = (
    count: number,
    along: number,
    edge: (line: number, k: number) => boolean,
    at: (line: number, k: number) => Point,
  ) => {
    for (let line = 0; line < count; line++) {
      let start: number | undefined
      for (let k = 0; k <= along; k++) {
        const on = k < along && edge(line, k)
        if (on && start === undefined) start = k
        if (!on && start !== undefined) {
          segments.push([at(line, start), at(line, k)])
          start = undefined
        }
      }
    }
  }
  const cols = us.length - 1
  const rows = vs.length - 1
  trace(
    us.length,
    rows,
    (i, j) => solid(i - 1, j) !== solid(i, j),
    (i, j) => [us[i], vs[j]],
  )
  trace(
    vs.length,
    cols,
    (j, i) => solid(i, j - 1) !== solid(i, j),
    (j, i) => [us[i], vs[j]],
  )
  return segments
}
