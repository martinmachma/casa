import { floorBounds, wallThickness } from './geometry'
import type { Floor, Point } from './types'

/** An axis-aligned plan rectangle, metres. */
export type Rect = { x0: number; x1: number; y0: number; y1: number }

/** The floor of a room: rectangles that tile it exactly, and its clear area (to the wall faces). */
export type RoomRegion = { roomId: string; cells: Rect[]; area: number }

const EPS = 1e-6

/**
 * The wall's footprint, openings closed, with the ends pushed out like the 3D walls so corners close.
 * A diagonal wall would get its bounding box (the layout has none).
 */
const wallRect = (from: Point, to: Point, thickness: number): Rect => {
  const half = thickness / 2
  return {
    x0: Math.min(from[0], to[0]) - half,
    x1: Math.max(from[0], to[0]) + half,
    y0: Math.min(from[1], to[1]) - half,
    y1: Math.max(from[1], to[1]) + half,
  }
}

const sortedUnique = (values: number[]): number[] => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.filter((v, i) => i === 0 || v - sorted[i - 1] > EPS)
}

/**
 * Finds each room's floor by flood-filling from its label point, with every wall (doors and windows closed)
 * as a barrier. The grid runs along the wall faces, so for square walls the cells and areas are exact.
 * A room whose fill leaks out of the house (a wall missing in the layout) gets no region; rooms that share
 * one open space split it halfway between their labels.
 */
export const roomRegions = (floor: Floor): Map<string, RoomRegion> => {
  const walls = floor.walls.map((w) => wallRect(w.from, w.to, wallThickness(w, floor)))
  const { min, max } = floorBounds(floor)
  const xs = sortedUnique([min[0], max[0], ...walls.flatMap((r) => [r.x0, r.x1])])
  const ys = sortedUnique([min[1], max[1], ...walls.flatMap((r) => [r.y0, r.y1])])
  const cols = xs.length - 1
  const rows = ys.length - 1

  const blocked: boolean[] = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2
      const cy = (ys[j] + ys[j + 1]) / 2
      blocked.push(walls.some((r) => cx > r.x0 && cx < r.x1 && cy > r.y0 && cy < r.y1))
    }
  }

  const locate = (values: number[], v: number) => values.findIndex((_, k) => v >= values[k] && v < values[k + 1])
  const cellOf = (p: Point) => {
    const i = locate(xs, p[0])
    const j = locate(ys, p[1])
    return i < 0 || j < 0 || i >= cols || j >= rows ? -1 : j * cols + i
  }
  const regions = new Map<string, RoomRegion>()
  const done = new Set<string>()

  for (const room of floor.rooms) {
    if (done.has(room.id)) continue
    const start = cellOf(room.label)
    if (start < 0 || blocked[start]) continue

    const seen = new Set([start])
    const stack = [start]
    let leaked = false
    while (stack.length) {
      const c = stack.pop()!
      const ci = c % cols
      const cj = Math.floor(c / cols)
      if (ci === 0 || cj === 0 || ci === cols - 1 || cj === rows - 1) leaked = true
      const neighbours = [
        ci > 0 ? c - 1 : -1,
        ci < cols - 1 ? c + 1 : -1,
        cj > 0 ? c - cols : -1,
        cj < rows - 1 ? c + cols : -1,
      ]
      for (const n of neighbours) {
        if (n < 0 || blocked[n] || seen.has(n)) continue
        seen.add(n)
        stack.push(n)
      }
    }

    // Rooms with no wall between them (stairs and landing) share the space: split it halfway between labels,
    // across the direction the labels are spread along.
    const sharing = floor.rooms.filter((r) => !done.has(r.id) && seen.has(cellOf(r.label)))
    sharing.forEach((r) => done.add(r.id))
    if (leaked) continue
    const spreadX = Math.max(...sharing.map((r) => r.label[0])) - Math.min(...sharing.map((r) => r.label[0]))
    const spreadY = Math.max(...sharing.map((r) => r.label[1])) - Math.min(...sharing.map((r) => r.label[1]))
    const axis = spreadX >= spreadY ? 0 : 1
    sharing.sort((p, q) => p.label[axis] - q.label[axis])
    const cuts = sharing.map((r, k) => (k === 0 ? -Infinity : (sharing[k - 1].label[axis] + r.label[axis]) / 2))

    sharing.forEach((r, k) => {
      const lo = cuts[k]
      const hi = k + 1 < sharing.length ? cuts[k + 1] : Infinity
      const cells: Rect[] = []
      let area = 0
      for (const c of seen) {
        const ci = c % cols
        const cj = Math.floor(c / cols)
        const cell = { x0: xs[ci], x1: xs[ci + 1], y0: ys[cj], y1: ys[cj + 1] }
        if (axis === 0) [cell.x0, cell.x1] = [Math.max(cell.x0, lo), Math.min(cell.x1, hi)]
        else [cell.y0, cell.y1] = [Math.max(cell.y0, lo), Math.min(cell.y1, hi)]
        if (cell.x1 - cell.x0 < EPS || cell.y1 - cell.y0 < EPS) continue
        cells.push(cell)
        area += (cell.x1 - cell.x0) * (cell.y1 - cell.y0)
      }
      regions.set(r.id, { roomId: r.id, cells, area })
    })
  }
  return regions
}

const cache = new WeakMap<Floor, Map<string, RoomRegion>>()

/** `roomRegions`, computed once per floor object. */
export const floorRegions = (floor: Floor): Map<string, RoomRegion> => {
  let regions = cache.get(floor)
  if (!regions) cache.set(floor, (regions = roomRegions(floor)))
  return regions
}

/** Which room's floor contains the plan point, if any. */
export const roomAt = (regions: Map<string, RoomRegion>, x: number, y: number): string | undefined => {
  for (const region of regions.values())
    if (region.cells.some((c) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1)) return region.roomId
  return undefined
}
