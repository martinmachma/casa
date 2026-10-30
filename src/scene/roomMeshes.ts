import { Box3, Vector3, type Mesh, type Object3D } from 'three'
import { wallThickness } from '../layout/geometry'
import { floorRegions } from '../layout/rooms'
import type { Floor } from '../layout/types'
import { roomEdges, roomWallSides } from '../rooms/roomViews'

const MARGIN = 0.02
const SAMPLES = 5
const MOSTLY = 0.6

/** Sort meshes by their physical footprint, including projections belonging to a paintable parent wall. */
export const roomMeshClassifier = (floor: Floor, roomId: string) => {
  const cells = floorRegions(floor).get(roomId)?.cells ?? []
  const box = new Box3()
  const mid = new Vector3()
  // Each wall along the room's outline: the way out of the room, and where its face on the room's side is.
  const outline = (() => {
    const faces = new Map<string, { out: [number, number]; face: number; span: [number, number] }>()
    for (const [id, out] of roomWallSides(floor, roomId)) {
      const wall = floor.walls.find((w) => w.id === id)!
      const axis = out[0] ? 0 : 1
      faces.set(id, {
        out: [out[0], out[1]],
        face: wall.from[axis] - (out[axis] * wallThickness(wall, floor)) / 2,
        span: [Math.min(wall.from[1 - axis], wall.to[1 - axis]), Math.max(wall.from[1 - axis], wall.to[1 - axis])],
      })
    }
    return faces
  })()
  const edges = roomEdges(floor, roomId)

  return (m: Mesh) => {
    const g = m.geometry
    if (!g.boundingBox) g.computeBoundingBox()
    box.copy(g.boundingBox!).applyMatrix4(m.matrixWorld).getCenter(mid)
    // Stairs belong to the rooms they're open onto, on the floor they rise from and the one they reach.
    const rooms = m.userData.rooms as string[] | undefined
    if (rooms) return rooms.includes(roomId)
    if (mid.y < floor.elevation - 0.1 || mid.y > floor.elevation + floor.height + 0.1) return false
    // A wall's corner block belongs to both walls that meet there: it goes with any room it touches.
    if (m.userData.corner)
      return cells.some(
        (c) =>
          box.max.x > c.x0 - MARGIN * 2 &&
          box.min.x < c.x1 + MARGIN * 2 &&
          box.max.z > c.y0 - MARGIN * 2 &&
          box.min.z < c.y1 + MARGIN * 2,
      )
    // Mostly over the room's floor (or its walls): sampled on a grid, as a room needn't be a rectangle.
    let wallId: string | undefined
    for (let p: Object3D | null = m; p && !wallId; p = p.parent) wallId = p.userData.physicalWallId ?? p.userData.wallId
    if (wallId && floor.walls.find((w) => w.id === wallId)?.notIn?.includes(roomId)) return false
    // A wall along the room's outline, and whatever is set in it (doors, windows, however they're swung), stands
    // off the room's floor: it's judged only by where it is along the wall, just inside the room's face of it.
    const side = wallId ? outline.get(wallId) : undefined
    let inX = side?.out[0] ? side.face - side.out[0] * MARGIN * 2 : undefined
    let inZ = side?.out[1] ? side.face - side.out[1] * MARGIN * 2 : undefined
    // Another wall's end can stand flush in the room's outline (a wall running off from the room's corner):
    // that piece is judged just inside the room, where its end face is.
    if (wallId && !side)
      for (const { from, to, out } of edges) {
        const axis = out[0] ? 'x' : 'z'
        const across = out[0] ? 'z' : 'x'
        const k = out[0] ? 0 : 1
        const near = out[k] > 0 ? box.min[axis] : box.max[axis]
        const lo = Math.min(from[1 - k], to[1 - k])
        const hi = Math.max(from[1 - k], to[1 - k])
        if (Math.abs(near - from[k]) > MARGIN * 1.5 || box.max[across] <= lo || box.min[across] >= hi) continue
        // Unless the room's own wall stands there: then it runs off behind that wall, outside the room.
        const behind = [...outline.values()].some(
          (o) =>
            o.out[k] === out[k] &&
            Math.abs(o.face - from[k]) < MARGIN &&
            o.span[0] <= box.min[across] + MARGIN &&
            o.span[1] >= box.max[across] - MARGIN,
        )
        if (behind) break
        if (out[0]) inX = from[0] - out[0] * MARGIN * 2
        else inZ = from[1] - out[1] * MARGIN * 2
        break
      }
    const over = (x: number, z: number) => {
      const px = inX ?? x
      const pz = inZ ?? z
      return cells.some((c) => px > c.x0 - MARGIN && px < c.x1 + MARGIN && pz > c.y0 - MARGIN && pz < c.y1 + MARGIN)
    }
    let inside = 0
    for (let i = 0; i < SAMPLES; i++)
      for (let j = 0; j < SAMPLES; j++) {
        const x = box.min.x + ((i + 0.5) / SAMPLES) * (box.max.x - box.min.x)
        const z = box.min.z + ((j + 0.5) / SAMPLES) * (box.max.z - box.min.z)
        if (over(x, z)) inside++
      }
    return inside >= SAMPLES * SAMPLES * MOSTLY
  }
}
