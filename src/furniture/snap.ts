import { wallThickness } from '../layout/geometry'
import type { FurnitureItem } from '../data/types'
import type { Floor, Point } from '../layout/types'

export type Footprint = { x: number; y: number; width: number; depth: number; rotation: number }
export type SnapWall = { from: Point; to: Point; thickness: number }
export type Placement = Pick<Footprint, 'x' | 'y' | 'rotation'>
type SnapItem = Footprint & Pick<FurnitureItem, 'id' | 'floor' | 'z' | 'height'>

const QUARTER = Math.PI / 2
// An item turned further than this from square to a wall is left alone by it.
const SQUARE_TOLERANCE = (15 * Math.PI) / 180

export const floorSnapWalls = (floor: Floor): SnapWall[] =>
  floor.walls.map((w) => ({ from: w.from, to: w.to, thickness: wallThickness(w, floor) }))

export const normalizeAngle = (a: number): number => {
  const r = a % (2 * Math.PI)
  if (r > Math.PI) return r - 2 * Math.PI
  if (r <= -Math.PI) return r + 2 * Math.PI
  return r
}

/** Half the footprint's size measured along the unit vector `m`. */
const extentAlong = (f: Footprint, m: Point): number => {
  const c = Math.cos(f.rotation)
  const s = Math.sin(f.rotation)
  return (f.width / 2) * Math.abs(c * m[0] + s * m[1]) + (f.depth / 2) * Math.abs(-s * m[0] + c * m[1])
}

type Frame = { from: Point; d: Point; n: Point; length: number; thickness: number; angle: number }

const frameOf = (w: SnapWall): Frame => {
  const dx = w.to[0] - w.from[0]
  const dy = w.to[1] - w.from[1]
  const length = Math.hypot(dx, dy)
  return {
    from: w.from,
    d: [dx / length, dy / length],
    n: [-dy / length, dx / length],
    length,
    thickness: w.thickness,
    angle: Math.atan2(dy, dx),
  }
}

/**
 * How far the footprint's edge is from the wall face (negative when it overlaps the wall), and the
 * shift along the wall normal that makes it flush.
 */
const gapTo = (f: Footprint, w: Frame, alongMargin: number) => {
  const rx = f.x - w.from[0]
  const ry = f.y - w.from[1]
  const t = rx * w.d[0] + ry * w.d[1]
  if (t < -alongMargin || t > w.length + alongMargin) return undefined
  const s = rx * w.n[0] + ry * w.n[1]
  const target = Math.sign(s || 1) * (w.thickness / 2 + extentAlong(f, w.n))
  return { gap: Math.abs(s) - Math.abs(target), shift: target - s }
}

/**
 * Pushes a footprint flush against the nearest wall face within `threshold` metres (or one it overlaps) that it's
 * nearly square to, turning it square to that wall. A second, perpendicular wall in reach is snapped too, so items settle into corners.
 */
const wallPlacement = (f: Footprint, walls: SnapWall[], threshold: number): Placement | undefined => {
  const frames = walls.map(frameOf)

  let best: { frame: Frame; placed: Footprint; gap: number } | undefined
  for (const frame of frames) {
    // Square up to the wall at the quarter turn nearest the current rotation.
    const off = normalizeAngle(f.rotation - frame.angle)
    const k = Math.round(off / QUARTER)
    if (Math.abs(off - k * QUARTER) > SQUARE_TOLERANCE) continue
    const squared = { ...f, rotation: normalizeAngle(frame.angle + k * QUARTER) }
    const hit = gapTo(squared, frame, 0)
    if (!hit || hit.gap > threshold || (best && Math.abs(hit.gap) >= best.gap)) continue
    best = {
      frame,
      gap: Math.abs(hit.gap),
      placed: { ...squared, x: squared.x + frame.n[0] * hit.shift, y: squared.y + frame.n[1] * hit.shift },
    }
  }
  if (!best) return undefined

  const first = best.frame
  let placed = best.placed
  let cornerGap = Infinity
  for (const frame of frames) {
    if (frame === first || Math.abs(frame.d[0] * first.d[0] + frame.d[1] * first.d[1]) > 1e-3) continue
    const hit = gapTo(placed, frame, Math.max(placed.width, placed.depth))
    if (!hit || hit.gap > threshold || Math.abs(hit.gap) >= cornerGap) continue
    cornerGap = Math.abs(hit.gap)
    placed = { ...best.placed, x: best.placed.x + frame.n[0] * hit.shift, y: best.placed.y + frame.n[1] * hit.shift }
  }
  return { x: placed.x, y: placed.y, rotation: placed.rotation }
}

export const snapToWalls = (f: Footprint, walls: SnapWall[], threshold = 0.1): Placement =>
  wallPlacement(f, walls, threshold) ?? { x: f.x, y: f.y, rotation: f.rotation }

/** Seats against a wall first, otherwise the nearest overlapping furniture edge within reach. */
export const snapFurniture = (
  f: SnapItem,
  walls: SnapWall[],
  items: SnapItem[],
  threshold = 0.1,
  ignoredIds: readonly string[] = [f.id],
): Placement => {
  const wall = wallPlacement(f, walls, threshold)
  if (wall) return wall

  let best: Placement = { x: f.x, y: f.y, rotation: f.rotation }
  let bestGap = Infinity
  for (const item of items) {
    if (item.id === f.id || ignoredIds.includes(item.id) || item.floor !== f.floor) continue
    const z = f.z ?? 0
    const otherZ = item.z ?? 0
    if (Math.min(z + f.height, otherZ + item.height) <= Math.max(z, otherZ)) continue

    const off = normalizeAngle(f.rotation - item.rotation)
    const k = Math.round(off / QUARTER)
    if (Math.abs(off - k * QUARTER) > SQUARE_TOLERANCE) continue
    const squared = { ...f, rotation: normalizeAngle(item.rotation + k * QUARTER) }
    const c = Math.cos(item.rotation)
    const s = Math.sin(item.rotation)
    const axes: Point[] = [
      [c, s],
      [-s, c],
    ]
    for (let i = 0; i < axes.length; i++) {
      const normal = axes[i]
      const tangent = axes[1 - i]
      const dx = f.x - item.x
      const dy = f.y - item.y
      // The finite edges must overlap, rather than attracting diagonally separated corners.
      const along = dx * tangent[0] + dy * tangent[1]
      if (Math.abs(along) >= extentAlong(squared, tangent) + extentAlong(item, tangent)) continue
      const across = dx * normal[0] + dy * normal[1]
      const target = Math.sign(across || 1) * (extentAlong(squared, normal) + extentAlong(item, normal))
      const shift = target - across
      const gap = Math.abs(shift)
      if (gap > threshold || gap >= bestGap) continue
      bestGap = gap
      best = { x: f.x + normal[0] * shift, y: f.y + normal[1] * shift, rotation: squared.rotation }
    }
  }
  return best
}
