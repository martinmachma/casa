import { Vector3 } from 'three'
import { wallThickness } from '../layout/geometry'
import { floorRegions } from '../layout/rooms'
import { roomLabel } from '../layout/roomName'
import type { Floor, HouseLayout, Point } from '../layout/types'

/** A room with its own place in the menu: a fixed view of it, the rest of the house blurred. */
export type RoomView = { id: string; label: string; planName: string; floor: string; room: string }

/** Every room of every floor, under the name we gave it (or the plan's); names used twice get their plan number. */
export const roomViews = (house: HouseLayout, names: Map<string, string>): RoomView[] => {
  const views = house.floors.flatMap((floor) =>
    floor.rooms.map((room) => {
      const { name, number, planName } = roomLabel(room, names)
      return { id: room.id, label: name, number, planName, floor: floor.id, room: room.id }
    }),
  )
  const twice = (label: string) => views.filter((v) => v.label === label).length > 1
  return views.map(({ number, ...v }) => (number && twice(v.label) ? { ...v, label: `${v.label} ${number}` } : v))
}

/** The room's floor area as a box, walls included around it. */
export const roomBox = (floor: Floor, roomId: string, margin = 0.15): { min: Point; max: Point } | undefined => {
  const cells = floorRegions(floor).get(roomId)?.cells
  if (!cells?.length) return undefined
  return {
    min: [Math.min(...cells.map((c) => c.x0)) - margin, Math.min(...cells.map((c) => c.y0)) - margin],
    max: [Math.max(...cells.map((c) => c.x1)) + margin, Math.max(...cells.map((c) => c.y1)) + margin],
  }
}

/** Looking north into the room from above its south side, steeply enough to see over the cut-away front wall. */
export const roomPose = (floor: Floor, roomId: string, aspect: number) => {
  const box = roomBox(floor, roomId)
  if (!box) return undefined
  const cx = (box.min[0] + box.max[0]) / 2
  const cz = (box.min[1] + box.max[1]) / 2
  const width = box.max[0] - box.min[0]
  const depth = box.max[1] - box.min[1]
  // Far enough that the room fills the view (45° fov) with a little room left for the cards on the right.
  const fit = Math.max(depth, width / Math.min(aspect, 1.6)) * 1.55
  const pitch = 1.0
  // On a wide screen the cards take the right side, so the room sits a little left of the middle.
  const aside = aspect > 1.2 ? width * 0.12 : 0
  const target = new Vector3(cx + aside, floor.elevation + 0.6, cz)
  const position = target.clone().add(new Vector3(0, Math.sin(pitch) * fit, Math.cos(pitch) * fit))
  return { position, target, box }
}

/** A stretch of the room's outline, with the way out of the room. */
export type RoomEdge = { from: Point; to: Point; out: Point }

/** The room's outline: the sides of its floor cells that no other cell of the room shares. */
export const roomEdges = (floor: Floor, roomId: string): RoomEdge[] => {
  const cells = floorRegions(floor).get(roomId)?.cells ?? []
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6
  // The grid runs right across the floor, so a neighbouring cell spans exactly the same side.
  const has = (test: (d: (typeof cells)[number]) => boolean) => cells.some(test)
  return cells.flatMap((c) => {
    const edges: RoomEdge[] = []
    const sameX = (d: typeof c) => near(d.x0, c.x0) && near(d.x1, c.x1)
    const sameY = (d: typeof c) => near(d.y0, c.y0) && near(d.y1, c.y1)
    if (!has((d) => sameX(d) && near(d.y1, c.y0))) edges.push({ from: [c.x0, c.y0], to: [c.x1, c.y0], out: [0, -1] })
    if (!has((d) => sameX(d) && near(d.y0, c.y1))) edges.push({ from: [c.x0, c.y1], to: [c.x1, c.y1], out: [0, 1] })
    if (!has((d) => sameY(d) && near(d.x1, c.x0))) edges.push({ from: [c.x0, c.y0], to: [c.x0, c.y1], out: [-1, 0] })
    if (!has((d) => sameY(d) && near(d.x0, c.x1))) edges.push({ from: [c.x1, c.y0], to: [c.x1, c.y1], out: [1, 0] })
    return edges
  })
}

/** The walls along the room's outline, each with the way out of the room across it. */
export const roomWallSides = (floor: Floor, roomId: string): Map<string, Point> => {
  const sides = new Map<string, Point>()
  for (const { from, to, out } of roomEdges(floor, roomId)) {
    const axis = out[0] ? 0 : 1
    const lo = Math.min(from[1 - axis], to[1 - axis])
    const hi = Math.max(from[1 - axis], to[1 - axis])
    for (const w of floor.walls) {
      if (Math.abs(w.from[axis] - w.to[axis]) > 1e-6) continue
      const t = wallThickness(w, floor)
      const span = [Math.min(w.from[1 - axis], w.to[1 - axis]), Math.max(w.from[1 - axis], w.to[1 - axis])]
      if (Math.abs(w.from[axis] - (from[axis] + (out[axis] * t) / 2)) < 0.02 && span[0] < hi && span[1] > lo)
        sides.set(w.id, out)
    }
  }
  return sides
}
