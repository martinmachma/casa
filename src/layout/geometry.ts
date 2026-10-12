import type { Floor, HouseLayout, Opening, Point, Wall } from './types'

/** A solid box of a wall in wall-local coordinates: u along the wall from `from`, y up from the floor. */
export type WallPiece = { u0: number; u1: number; y0: number; y1: number }

export const DEFAULT_WINDOW_SILL = 0.9

export const wallLength = (wall: Wall): number => Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1])

/** Plan angle of the wall direction, radians. */
export const wallAngle = (wall: Wall): number => Math.atan2(wall.to[1] - wall.from[1], wall.to[0] - wall.from[0])

export const wallThickness = (wall: Wall, floor: Pick<Floor, 'wallThickness'>): number =>
  wall.thickness ?? floor.wallThickness

export const openingSill = (o: Opening): number => o.sill ?? (o.type === 'window' ? DEFAULT_WINDOW_SILL : 0)

/**
 * Splits a wall into solid boxes around its openings. The two ends are pushed out by `endExtension`
 * so walls meeting at a corner overlap instead of leaving a notch.
 */
export const wallPieces = (wall: Wall, height: number, endExtension = 0): WallPiece[] => {
  const length = wallLength(wall)
  const openings = [...(wall.openings ?? [])].sort((p, q) => p.offset - q.offset)
  const pieces: WallPiece[] = []
  let cursor = 0 - endExtension

  for (const o of openings) {
    const start = o.offset
    const end = o.offset + o.width
    if (start > cursor) pieces.push({ u0: cursor, u1: start, y0: 0, y1: height })
    const sill = openingSill(o)
    const top = sill + o.height
    if (sill > 0) pieces.push({ u0: start, u1: end, y0: 0, y1: sill })
    if (top < height) pieces.push({ u0: start, u1: end, y0: top, y1: height })
    cursor = end
  }

  const end = length + endExtension
  if (end > cursor) pieces.push({ u0: cursor, u1: end, y0: 0, y1: height })
  return pieces
}

/** Throws a readable error for the mistakes easy to make when hand-editing the layout JSON. */
export const validateLayout = (layout: HouseLayout): void => {
  const ids = new Set<string>()
  const claim = (id: string, what: string) => {
    if (ids.has(id)) throw new Error(`Duplicate ${what} id "${id}"`)
    ids.add(id)
  }

  for (const floor of layout.floors) {
    claim(floor.id, 'floor')
    for (const room of floor.rooms) claim(room.id, 'room')
    for (const wall of floor.walls) {
      claim(wall.id, 'wall')
      const length = wallLength(wall)
      if (length === 0) throw new Error(`Wall "${wall.id}" has zero length`)
      const openings = [...(wall.openings ?? [])].sort((p, q) => p.offset - q.offset)
      let previousEnd = 0
      for (const o of openings) {
        const label = `${o.type} at offset ${o.offset} in wall "${wall.id}"`
        if (o.offset < 0 || o.width <= 0 || o.height <= 0) throw new Error(`Bad size for ${label}`)
        if (o.offset + o.width > length + 1e-9)
          throw new Error(`${label} runs past the wall end (wall is ${length.toFixed(2)} m)`)
        if (o.offset < previousEnd - 1e-9) throw new Error(`${label} overlaps the previous opening`)
        if (openingSill(o) + o.height > floor.height + 1e-9)
          throw new Error(`${label} is taller than the floor height ${floor.height} m`)
        previousEnd = o.offset + o.width
      }
    }
  }
}

/** Axis-aligned plan bounds of a floor's walls, including their thickness. */
export const floorBounds = (floor: Floor): { min: Point; max: Point } => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const wall of floor.walls) {
    const half = wallThickness(wall, floor) / 2
    for (const [x, y] of [wall.from, wall.to]) {
      minX = Math.min(minX, x - half)
      minY = Math.min(minY, y - half)
      maxX = Math.max(maxX, x + half)
      maxY = Math.max(maxY, y + half)
    }
  }
  return { min: [minX, minY], max: [maxX, maxY] }
}
