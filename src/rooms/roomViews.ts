import { Vector3 } from 'three'
import { floorRegions } from '../layout/rooms'
import type { Floor, Point } from '../layout/types'

/** A room with its own place in the menu: a fixed view of it, the rest of the house blurred. */
export type RoomView = { id: string; label: string; floor: string; room: string }

export const ROOM_VIEWS: RoomView[] = [{ id: 'living', label: 'Living room', floor: 'ground', room: 'g-living' }]

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

/** The convex hull of screen points, for the hole the room shows through. */
export const hull = (points: Point[]): Point[] => {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: Point[]) => {
    const out: Point[] = []
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop()
      out.push(q)
    }
    out.pop()
    return out
  }
  return [...half(p), ...half([...p].reverse())]
}
