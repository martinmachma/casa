import type { Point } from '../layout/types'
import type { Footprint, SnapWall } from './snap'

const axes = (f: Footprint): Point[] => [
  [Math.cos(f.rotation), Math.sin(f.rotation)],
  [-Math.sin(f.rotation), Math.cos(f.rotation)],
]
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1]
const radius = (f: Footprint, axis: Point) => {
  const [width, depth] = axes(f)
  return (f.width * Math.abs(dot(width, axis)) + f.depth * Math.abs(dot(depth, axis))) / 2
}

/** Separating axes, including the interval swept by a translation. Touching edges are free. */
const overlaps = (a: Footprint, b: Footprint, offset: Point = [0, 0]): boolean => {
  let enter = 0
  let leave = 1
  for (const axis of [...axes(a), ...axes(b)]) {
    const distance = dot([a.x - b.x, a.y - b.y], axis)
    const reach = radius(a, axis) + radius(b, axis) - 1e-8
    const speed = dot(offset, axis)
    if (Math.abs(speed) < 1e-10) {
      if (Math.abs(distance) >= reach) return false
    } else {
      const t1 = (-reach - distance) / speed
      const t2 = (reach - distance) / speed
      enter = Math.max(enter, Math.min(t1, t2))
      leave = Math.min(leave, Math.max(t1, t2))
      if (enter >= leave) return false
    }
  }
  return true
}

/** Moves the selection beside itself in its first piece's frame, preserving the group layout. */
export const duplicateOffset = (items: Footprint[], walls: SnapWall[]): Point => {
  if (!items.length) return [0.3, 0.3]
  const wallFootprints = walls.flatMap((wall): Footprint[] => {
    const dx = wall.to[0] - wall.from[0]
    const dy = wall.to[1] - wall.from[1]
    const width = Math.hypot(dx, dy)
    return width > 0
      ? [
          {
            x: (wall.from[0] + wall.to[0]) / 2,
            y: (wall.from[1] + wall.to[1]) / 2,
            width,
            depth: wall.thickness,
            rotation: Math.atan2(dy, dx),
          },
        ]
      : []
  })
  const directions = axes(items[0])
  const offsets = directions.map((axis): Point => {
    const low = Math.min(...items.map((f) => dot([f.x, f.y], axis) - radius(f, axis)))
    const high = Math.max(...items.map((f) => dot([f.x, f.y], axis) + radius(f, axis)))
    return [axis[0] * (high - low + 0.3), axis[1] * (high - low + 0.3)]
  })
  for (const offset of [...offsets, ...offsets.map(([x, y]): Point => [-x, -y])]) {
    const blocked = items.some((item) => {
      const copy = { ...item, x: item.x + offset[0], y: item.y + offset[1] }
      // Sweep clear walls, but allow escape from an existing overlap if the copy clears it.
      return (
        wallFootprints.some((wall) =>
          overlaps(item, wall) ? overlaps(copy, wall) : overlaps(item, wall, offset),
        ) ||
        items.some((original) => overlaps(copy, original))
      )
    })
    if (!blocked) return offset
  }
  return [0.3, 0.3]
}
