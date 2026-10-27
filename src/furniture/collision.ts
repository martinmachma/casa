import type { FurnitureItem } from '../data/types'
import type { Point, Rect } from '../layout/types'
import type { Placement } from './snap'

export type Solid = Pick<FurnitureItem, 'id' | 'floor' | 'x' | 'y' | 'width' | 'depth' | 'rotation' | 'height' | 'z'> &
  Partial<Pick<FurnitureItem, 'model'>>

// Overlaps under a centimetre (pieces seated flush, plans measured to the centimetre) don't count.
const TOLERANCE = 0.01
// Rugs and the like lie flat under the rest; only walls stop them.
const FLAT = 0.02
// Chairs and stools tuck under tables, desks and counters up to this height.
const SEATS = new Set(['chair', 'chairCushion', 'chairModernCushion', 'chairDesk', 'stoolBar'])
const TABLE_HEIGHT = 0.95
// How finely a move is checked on its way, so a quick drag can't jump through a wall.
const STEP = 0.05

type Box = { c: Point; axes: [Point, Point]; half: [number, number] }

const boxOf = (s: Pick<Solid, 'x' | 'y' | 'width' | 'depth' | 'rotation'>): Box => {
  const cos = Math.cos(s.rotation)
  const sin = Math.sin(s.rotation)
  return {
    c: [s.x, s.y],
    axes: [
      [cos, sin],
      [-sin, cos],
    ],
    half: [s.width / 2, s.depth / 2],
  }
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
  const box = boxOf(piece)
  const result: string[] = []
  walls.forEach((w, i) => overlaps(box, rectBox(w)) && result.push(`wall:${i}`))
  if (piece.height <= FLAT) return result
  for (const o of others) {
    if (o.id === piece.id || o.floor !== piece.floor || o.height <= FLAT || !stacked(piece, o) || tucks(piece, o))
      continue
    if (overlaps(box, boxOf(o))) result.push(o.id)
  }
  return result
}

/** Every piece on the floor that runs into a wall or another piece. */
export const colliding = (items: Solid[], walls: Rect[]): Set<string> =>
  new Set(items.filter((item) => hits(item, items, walls).length).map((item) => item.id))

/**
 * Whether the pieces may move to `to` (same order): nowhere on the way may they run into anything they
 * weren't already in, so a piece stuck in a wall can still be pulled out but nothing new can be pushed in.
 */
export const canMove = (pieces: Solid[], to: Placement[], items: Solid[], walls: Rect[]): boolean => {
  const ids = new Set(pieces.map((p) => p.id))
  const others = items.filter((o) => !ids.has(o.id))
  const before = pieces.map((p) => new Set(hits(p, others, walls)))
  const travel = Math.max(0, ...pieces.map((p, i) => Math.hypot(to[i].x - p.x, to[i].y - p.y)))
  const steps = Math.max(1, Math.ceil(travel / STEP))
  for (let k = 1; k <= steps; k++) {
    const t = k / steps
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i]
      const at = {
        ...p,
        x: p.x + (to[i].x - p.x) * t,
        y: p.y + (to[i].y - p.y) * t,
        rotation: k === steps ? to[i].rotation : p.rotation,
      }
      if (hits(at, others, walls).some((h) => !before[i].has(h))) return false
    }
  }
  return true
}

/** The move if it's free, else as much of it as slides along whatever is in the way; undefined if stuck. */
export const constrainMove = (
  pieces: Solid[],
  to: Placement[],
  items: Solid[],
  walls: Rect[],
): Placement[] | undefined => {
  const slides = [to, to.map((p, i) => ({ ...p, y: pieces[i].y })), to.map((p, i) => ({ ...p, x: pieces[i].x }))]
  return slides.find((s) => canMove(pieces, s, items, walls))
}
