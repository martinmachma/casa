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

/** How square-on a wall must face the viewer to be cut away (|cos| of the angle); side-on walls stay. */
const CUTAWAY_FACING = 0.5

/**
 * Whether a wall is in the way when looking at the floor from `eye` (plan coordinates): it faces the
 * viewer rather than running away from them, and either has a room behind it (interior walls) or lies
 * on the viewer's half of the floor around `center` (outer walls).
 */
export const blocksView = (wall: Wall, exterior: boolean, center: Point, eye: Point): boolean => {
  const vx = eye[0] - center[0]
  const vz = eye[1] - center[1]
  const v = Math.hypot(vx, vz)
  const length = wallLength(wall)
  if (v === 0 || length === 0) return false
  // The wall's normal is its direction turned a quarter.
  const nx = -(wall.to[1] - wall.from[1]) / length
  const nz = (wall.to[0] - wall.from[0]) / length
  if (Math.abs(nx * vx + nz * vz) / v <= CUTAWAY_FACING) return false
  if (!exterior) return true
  const mx = (wall.from[0] + wall.to[0]) / 2 - center[0]
  const mz = (wall.from[1] + wall.to[1]) / 2 - center[1]
  return mx * vx + mz * vz > 0
}

/** The parts of a wall's pieces below `height`, for a wall cut down to a stub. */
export const stubPieces = (pieces: WallPiece[], height: number): WallPiece[] =>
  pieces.filter((p) => p.y0 < height).map((p) => ({ ...p, y1: Math.min(p.y1, height) }))
