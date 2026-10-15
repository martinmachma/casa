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

export type MeasureMode = 'points' | 'faces'

/** A straight side of a wall or furniture piece in the plan. */
export type Face = { a: Point; b: Point }

/** A tap in a measurement: where it landed and, measuring between faces, the face it picked. */
export type MeasurePick = { at: Point; face?: Face }

export type Measurement = { mode: MeasureMode; picks: MeasurePick[] }

/** A closed outline (wall rectangle or furniture footprint) whose sides can be picked. */
export type Outline = Point[]

export const rectOutline = (r: Rect): Outline => [
  [r.x0, r.y0],
  [r.x1, r.y0],
  [r.x1, r.y1],
  [r.x0, r.y1],
]

export const footprintOutline = (f: { x: number; y: number; width: number; depth: number; rotation: number }) => {
  const c = Math.cos(f.rotation)
  const s = Math.sin(f.rotation)
  const w = f.width / 2
  const d = f.depth / 2
  return [
    [-w, -d],
    [w, -d],
    [w, d],
    [-w, d],
  ].map(([u, v]): Point => [f.x + u * c - v * s, f.y + u * s + v * c])
}

/** The closest point to `p` on the segment a–b. */
const closestOnSegment = (p: Point, a: Point, b: Point): Point => {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0
  return [a[0] + t * dx, a[1] + t * dy]
}

const inside = (p: Point, outline: Outline) => {
  let hit = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i]
    const [xj, yj] = outline[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

const sinBetween = (f: Face, g: Face) => {
  const [dx, dy] = [f.b[0] - f.a[0], f.b[1] - f.a[1]]
  const [ex, ey] = [g.b[0] - g.a[0], g.b[1] - g.a[1]]
  return Math.abs(dx * ey - dy * ex) / Math.sqrt((dx * dx + dy * dy) * (ex * ex + ey * ey))
}

const PARALLEL_SIN = 0.02

/**
 * The side nearest to a tap: any side of an outline the tap is inside, or any side within `tolerance` of it.
 * Sides parallel to `parallelTo` win when there are any, so a tap near a corner picks the wall facing the first.
 * Returns the face and the tap moved onto it.
 */
export const pickFace = (
  p: Point,
  outlines: Outline[],
  tolerance: number,
  parallelTo?: Face,
): Required<MeasurePick> | undefined => {
  let best: Required<MeasurePick> | undefined
  let bestScore = Infinity
  for (const outline of outlines) {
    const within = inside(p, outline)
    outline.forEach((a, i) => {
      const b = outline[(i + 1) % outline.length]
      const at = closestOnSegment(p, a, b)
      const d = distance(p, at)
      if (!within && d >= tolerance) return
      const face = { a, b }
      const score = d + (parallelTo && sinBetween(face, parallelTo) > PARALLEL_SIN ? 1000 : 0)
      if (score < bestScore) [bestScore, best] = [score, { at, face }]
    })
  }
  return best
}

/**
 * What a finished measurement measures. Between faces it's the square distance from the first face's line to
 * the second tap, which for parallel faces is the gap between them wherever you tap.
 */
/** A finished measurement, kept on its floor until removed. */
export type MeasuredLine = { id: string; floor: string; from: Point; to: Point; parallel: boolean }

export const measuredLine = (m: Measurement): { from: Point; to: Point; parallel: boolean } | undefined => {
  const [p, q] = m.picks
  if (!q) return undefined
  if (m.mode === 'points' || !p.face || !q.face) return { from: p.at, to: q.at, parallel: true }
  const { a, b } = p.face
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  const t = ((q.at[0] - a[0]) * dx + (q.at[1] - a[1]) * dy) / len2
  const from: Point = [a[0] + t * dx, a[1] + t * dy]
  return { from, to: q.at, parallel: sinBetween(p.face, q.face) < PARALLEL_SIN }
}
