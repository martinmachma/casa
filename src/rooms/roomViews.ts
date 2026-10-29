import { PerspectiveCamera, Vector3 } from 'three'
import type { FurnitureItem } from '../data/types'
import { floorBounds, wallThickness } from '../layout/geometry'
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

const UP = new Vector3(0, 1, 0)

/**
 * A three-quarter view into the room from outside it, looking across its narrow side so its length runs along the
 * screen, from the side where its tall furniture is least in the way (else the one nearest the house's outside), and from just high enough to see over what stands in it (higher
 * for a small room, whose walls are close). The camera is set back just far enough for the whole floor, the furniture
 * on it and the far walls to fit, and on a wide screen the room sits left of the cards on the right.
 */
export const roomPose = (floor: Floor, roomId: string, aspect: number, items: FurnitureItem[] = []) => {
  const box = roomBox(floor, roomId)
  if (!box) return undefined
  const [x0, z0] = box.min
  const [x1, z1] = box.max
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const width = x1 - x0
  const depth = z1 - z0
  // Each side the camera could look from, as the way out of the room on that side, and how far the house goes on.
  const bounds = floorBounds(floor)
  const sides: { out: Point; beyond: number }[] = [
    { out: [0, 1], beyond: bounds.max[1] - z1 },
    { out: [1, 0], beyond: bounds.max[0] - x1 },
    { out: [-1, 0], beyond: x0 - bounds.min[0] },
    { out: [0, -1], beyond: z0 - bounds.min[1] },
  ]
  // On a wide screen the long side faces the camera, on a tall one the short side.
  const across = (width >= depth) === aspect >= 1
  const long = Math.max(width, depth) / Math.min(width, depth) > 1.25
  // Pieces tall enough to hide the room when they stand on the camera's side of it.
  const tall = items.filter(
    (i) => i.floor === floor.id && (i.z ?? 0) + i.height > 1.2 && i.x > x0 && i.x < x1 && i.y > z0 && i.y < z1,
  )
  // How much of the room the tall pieces hide from a camera looking along `yaw`: more for higher ones nearer to it.
  const hidden = (yaw: number) =>
    tall.reduce((sum, i) => {
      const toward = ((i.x - cx) * Math.sin(yaw) + (i.y - cz) * Math.cos(yaw)) / (Math.max(width, depth) / 2)
      return sum + Math.max(0, toward) * ((i.z ?? 0) + i.height - 1) * Math.max(i.width, i.depth)
    }, 0)
  // Turned a little off square, so two walls and the floor between them give the room its depth; whichever way
  // round hides least, outside the house rather than across it where they hide the same.
  const views = sides
    .filter((s) => !long || (s.out[1] !== 0) === across)
    .flatMap((s) => [-0.35, 0.35].map((turn) => ({ ...s, yaw: Math.atan2(s.out[0], s.out[1]) + turn })))
    .map((v) => ({ ...v, cost: hidden(v.yaw) + 0.1 * v.beyond }))
  const { yaw } = views.reduce((a, b) => (b.cost < a.cost - 0.05 ? b : a))
  const pitch = Math.min(0.95, Math.max(0.68, 1.05 - 0.06 * Math.min(width, depth)))
  const look = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))

  const floorY = floor.elevation
  const corners = [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ]
  // The floor, what stands on it, and the far walls up to near the ceiling.
  const points = corners.flatMap(([x, z]) => {
    const far = (x - cx) * look.x + (z - cz) * look.z < 0
    return [
      new Vector3(x, floorY, z),
      new Vector3(x, floorY + (far ? floor.height * 0.75 : 1), z),
    ]
  })
  // The part of the screen the room may take (NDC); the cards take the right of a wide screen.
  const wide = aspect > 1.2
  const frame = { x0: -0.96, x1: wide ? 0.5 : 0.96, y0: -0.9, y1: 0.84 }
  const camera = new PerspectiveCamera(45, aspect, 0.1, 200)
  const target = new Vector3(cx, floorY + 0.6, cz)
  const right = new Vector3()
  const place = (distance: number) => {
    camera.position.copy(target).addScaledVector(look, distance)
    camera.up.copy(UP)
    camera.lookAt(target)
    camera.updateMatrixWorld()
    const ndc = points.map((p) => p.clone().project(camera))
    return {
      x0: Math.min(...ndc.map((p) => p.x)),
      x1: Math.max(...ndc.map((p) => p.x)),
      y0: Math.min(...ndc.map((p) => p.y)),
      y1: Math.max(...ndc.map((p) => p.y)),
    }
  }
  const fits = (d: number) => {
    const r = place(d)
    return r.x1 - r.x0 <= frame.x1 - frame.x0 && r.y1 - r.y0 <= frame.y1 - frame.y0
  }
  let lo = 0.5
  let hi = 60
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) hi = mid
    else lo = mid
  }
  const distance = hi
  // Slide the view (camera and target together) until the room's picture sits in the middle of its part of the screen.
  for (let i = 0; i < 4; i++) {
    const r = place(distance)
    const dx = (frame.x0 + frame.x1) / 2 - (r.x0 + r.x1) / 2
    const dy = (frame.y0 + frame.y1) / 2 - (r.y0 + r.y1) / 2
    // Half the screen's height across, at the target's distance.
    const half = Math.tan((camera.fov * Math.PI) / 360) * distance
    right.setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    target.addScaledVector(right, -dx * half * aspect).addScaledVector(up, -dy * half)
  }
  place(distance)
  const position = camera.position.clone()
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
