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

/** Outer walls are the thick ones. */
const EXTERIOR_WALL = 0.2

export const isExteriorWall = (wall: Wall, floor: Pick<Floor, 'wallThickness'>): boolean =>
  wallThickness(wall, floor) >= EXTERIOR_WALL

/** How square-on an interior wall must face the view to be cut away (|cos| of the angle); side-on walls stay. */
const CUTAWAY_FACING = 0.5
/** How far past a wall's face to look for the outside of the house. */
const OUTSIDE_PROBE = 0.05

const insidePolygon = (p: Point, polygon: Point[]): boolean => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i]
    const [xj, zj] = polygon[j]
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

/** The unit normal of a wall, its direction turned a quarter (towards side 'a'). */
const wallNormal = (wall: Wall): Point => {
  const length = wallLength(wall)
  return [-(wall.to[1] - wall.from[1]) / length, (wall.to[0] - wall.from[0]) / length]
}

/** For an outer wall, the unit normal pointing out of the house; undefined for walls with rooms on both sides. */
export const wallOutside = (wall: Wall, floor: Floor): Point | undefined => {
  if (wallLength(wall) === 0) return undefined
  const { min, max } = floorBounds(floor)
  const outline = floor.outline ?? [min, [max[0], min[1]], max, [min[0], max[1]]]
  const [nx, nz] = wallNormal(wall)
  const reach = wallThickness(wall, floor) / 2 + OUTSIDE_PROBE
  const mx = (wall.from[0] + wall.to[0]) / 2
  const mz = (wall.from[1] + wall.to[1]) / 2
  for (const sign of [1, -1]) {
    if (!insidePolygon([mx + sign * nx * reach, mz + sign * nz * reach], outline)) return [sign * nx, sign * nz]
  }
  return undefined
}

/**
 * Whether a wall is in the way, seen from `eye` looking along `view` (plan coordinates): you see it from
 * outside a room it closes off. Outer walls are cut whenever the eye is on their `outside`; interior
 * walls close off a room on either side, so they're cut unless the view runs along them. Judging those
 * by the view direction, not the angle to each wall, treats parallel walls alike.
 */
export const blocksView = (wall: Wall, outside: Point | undefined, eye: Point, view: Point): boolean => {
  if (wallLength(wall) === 0) return false
  if (outside) {
    const mx = (wall.from[0] + wall.to[0]) / 2
    const mz = (wall.from[1] + wall.to[1]) / 2
    return outside[0] * (eye[0] - mx) + outside[1] * (eye[1] - mz) > 0
  }
  const v = Math.hypot(view[0], view[1])
  if (v === 0) return true
  const [nx, nz] = wallNormal(wall)
  return Math.abs(nx * view[0] + nz * view[1]) / v > CUTAWAY_FACING
}

/** The parts of a wall's pieces below `height`, for a wall cut down to a stub. */
export const stubPieces = (pieces: WallPiece[], height: number): WallPiece[] =>
  pieces.filter((p) => p.y0 < height).map((p) => ({ ...p, y1: Math.min(p.y1, height) }))

