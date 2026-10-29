import type { Floor, HouseLayout, Opening, Point, Wall, WallSide } from './types'

/** A solid box of a wall in wall-local coordinates: u along the wall from `from`, y up from the floor. */
export type WallPiece = { u0: number; u1: number; y0: number; y1: number }

export const DEFAULT_WINDOW_SILL = 0.9

export const wallLength = (wall: Wall): number => Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1])

/** Plan angle of the wall direction, radians. */
export const wallAngle = (wall: Wall): number => Math.atan2(wall.to[1] - wall.from[1], wall.to[0] - wall.from[0])

export const wallThickness = (wall: Wall, floor: Pick<Floor, 'wallThickness'>): number =>
  wall.thickness ?? floor.wallThickness

/** How tall a wall stands: its own height, else the floor's. */
export const wallHeight = (wall: Wall, floor: Pick<Floor, 'height'>): number => wall.height ?? floor.height

export const openingSill = (o: Opening): number => o.sill ?? (o.type === 'window' ? DEFAULT_WINDOW_SILL : 0)

/** Openings have no stored id; wall ids are unique and openings retain their layout order. */
export const openingId = (wallId: string, index: number): string => `${wallId}:${index}`

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
        if (openingSill(o) + o.height > wallHeight(wall, floor) + 1e-9)
          throw new Error(`${label} is taller than the wall (${wallHeight(wall, floor)} m)`)
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
  const backing = wall.against && floor.walls.find((w) => w.id === wall.against)
  if (backing) return wallOutside(backing, floor)
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

/** Whether the wall's line runs between the camera and a point it looks at, so it stands in the way. */
export const separates = (wall: Wall, eye: Point, focus: Point): boolean => {
  if (wallLength(wall) === 0) return false
  const [nx, nz] = wallNormal(wall)
  const side = (p: Point) => nx * (p[0] - wall.from[0]) + nz * (p[1] - wall.from[1])
  return side(eye) * side(focus) < 0
}

/** The parts of a wall's pieces below `height`, for a wall cut down to a stub. */
export const stubPieces = (pieces: WallPiece[], height: number): WallPiece[] =>
  pieces.filter((p) => p.y0 < height).map((p) => ({ ...p, y1: Math.min(p.y1, height) }))

/** How far an end can sit off a wall's face and still count as butting into it. */
const JOINT_SLACK = 0.02

/**
 * Where each side of a wall is split into parts that read as separate walls, painted apart: where other
 * walls butt into it (either side of a partition), and floor-to-ceiling gaps (both sides). Distances
 * along the wall from `from`, sorted.
 */
export const wallJoints = (wall: Wall, floor: Floor): Record<WallSide, number[]> => {
  const length = wallLength(wall)
  const joints: Record<WallSide, number[]> = { a: [], b: [] }
  if (length === 0) return joints
  const dir: Point = [(wall.to[0] - wall.from[0]) / length, (wall.to[1] - wall.from[1]) / length]
  const [nx, nz] = wallNormal(wall)
  const half = wallThickness(wall, floor) / 2
  const local = (p: Point) => {
    const dx = p[0] - wall.from[0]
    const dz = p[1] - wall.from[1]
    return { u: dx * dir[0] + dz * dir[1], d: dx * nx + dz * nz }
  }
  for (const other of floor.walls) {
    if (other.id === wall.id) continue
    for (const [end, far] of [
      [other.from, other.to],
      [other.to, other.from],
    ]) {
      const e = local(end)
      const f = local(far)
      if (e.u <= half || e.u >= length - half) continue
      if (Math.abs(e.d) > half + wallThickness(other, floor) / 2 + JOINT_SLACK) continue
      if (Math.abs(f.d) <= half) continue
      joints[f.d > 0 ? 'a' : 'b'].push(e.u)
    }
  }
  for (const o of wall.openings ?? []) {
    if (openingSill(o) > 0 || o.height < floor.height) continue
    joints.a.push(o.offset + o.width / 2)
    joints.b.push(o.offset + o.width / 2)
  }
  joints.a.sort((p, q) => p - q)
  joints.b.sort((p, q) => p - q)
  return joints
}

/**
 * Where a wall meets another at a corner, the distance along it of the other wall's inner face: the block
 * past it is the corner itself, shared by both walls, and is cut off as a piece of its own.
 */
export const cornerCuts = (wall: Wall, floor: Floor): { at: number; wall: string }[] => {
  const length = wallLength(wall)
  const near = (p: Point, q: Point) => Math.hypot(p[0] - q[0], p[1] - q[1]) < JOINT_SLACK
  return floor.walls.flatMap((other) => {
    if (other.id === wall.id) return []
    const half = wallThickness(other, floor) / 2
    const ends = [other.from, other.to]
    return [
      ...(ends.some((e) => near(e, wall.from)) ? [half] : []),
      ...(ends.some((e) => near(e, wall.to)) ? [length - half] : []),
    ]
      .filter((u) => u > 0 && u < length)
      .map((at) => ({ at, wall: other.id }))
  })
}

/** Which part of a side, counted from `from`, the point `u` along the wall falls in. */
export const sidePart = (joints: number[], u: number): number => joints.filter((j) => j < u).length

/** Pieces cut at the given distances along the wall, so no piece spans one of them. */
export const splitPieces = (pieces: WallPiece[], cuts: number[]): WallPiece[] =>
  pieces.flatMap((p) => {
    const inside = cuts.filter((c) => c > p.u0 && c < p.u1).sort((a, b) => a - b)
    const edges = [p.u0, ...inside, p.u1]
    return edges.slice(1).map((u1, i) => ({ ...p, u0: edges[i], u1 }))
  })
