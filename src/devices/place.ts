import type { Device, DeviceKind } from '../data/types'
import { openingSill, wallLength, wallThickness } from '../layout/geometry'
import { roomAt, type RoomRegion } from '../layout/rooms'
import type { Floor, Point, Wall, WallSide } from '../layout/types'
import { defaultHeight, onCeiling } from './kinds'

/** Where a device sits on a wall: the wall and face, and its plan position on that face. */
export type WallMount = { wall: { wallId: string; side: WallSide }; x: number; y: number }

/** How far a tap may be from a wall face (metres) and still snap to it. */
export const WALL_REACH = 0.4
/** Clearance kept from corners and from the edges of openings: about half a device plus a margin. */
const EDGE = 0.08
const EPS = 1e-9

type Frame = { d: Point; n: Point; length: number; thickness: number }

/** The wall's direction and its side-'a' normal (to the right walking from `from` to `to`). */
const frameOf = (wall: Wall, floor: Floor): Frame => {
  const length = wallLength(wall)
  const d: Point = [(wall.to[0] - wall.from[0]) / length, (wall.to[1] - wall.from[1]) / length]
  return { d, n: [-d[1], d[0]], length, thickness: wallThickness(wall, floor) }
}

/**
 * The spot nearest `t` metres along the wall where a device at height `z` fits: inside the wall's length, clear of
 * the corners and of any door or window at that height.
 */
export const clearSpot = (wall: Wall, thickness: number, t: number, z: number): number => {
  const length = wallLength(wall)
  const lo = thickness / 2 + EDGE
  const hi = length - thickness / 2 - EDGE
  if (lo > hi) return length / 2
  const blocked = (wall.openings ?? [])
    .filter((o) => z > openingSill(o) - EDGE && z < openingSill(o) + o.height + EDGE)
    .map((o) => [o.offset - EDGE, o.offset + o.width + EDGE])
  const free = (u: number) => u >= lo - EPS && u <= hi + EPS && !blocked.some(([a, b]) => u > a + EPS && u < b - EPS)
  const clamped = Math.min(hi, Math.max(lo, t))
  if (free(clamped)) return clamped
  const spots = [lo, hi, ...blocked.flat()].filter(free).sort((a, b) => Math.abs(a - clamped) - Math.abs(b - clamped))
  return spots[0] ?? clamped
}

/** The device's plan position on one face of a wall, `t` metres along it (moved clear of openings and corners). */
export const mountAt = (wall: Wall, floor: Floor, side: WallSide, t: number, z: number): WallMount => {
  const { d, n, thickness } = frameOf(wall, floor)
  const u = clearSpot(wall, thickness, t, z)
  const s = (side === 'a' ? 1 : -1) * (thickness / 2)
  return {
    wall: { wallId: wall.id, side },
    x: wall.from[0] + d[0] * u + n[0] * s,
    y: wall.from[1] + d[1] * u + n[1] * s,
  }
}

/**
 * Snaps a plan point to the nearest wall face within `reach` metres, for a device at height `z`. With `only`, it
 * slides along that one face however far away the point is (dragging a device along its wall).
 */
export const snapToWall = (
  p: Point,
  floor: Floor,
  z: number,
  reach = WALL_REACH,
  only?: { wallId: string; side: WallSide },
): WallMount | undefined => {
  let best: { wall: Wall; side: WallSide; t: number; distance: number } | undefined
  for (const wall of floor.walls) {
    if (only && wall.id !== only.wallId) continue
    const { d, n, length, thickness } = frameOf(wall, floor)
    const rx = p[0] - wall.from[0]
    const ry = p[1] - wall.from[1]
    const t = rx * d[0] + ry * d[1]
    const s = rx * n[0] + ry * n[1]
    const along = t < 0 ? -t : t > length ? t - length : 0
    const across = Math.max(0, Math.abs(s) - thickness / 2)
    const distance = Math.hypot(along, across)
    if (!only && distance > reach) continue
    if (best && distance >= best.distance) continue
    best = { wall, side: only?.side ?? (s >= 0 ? 'a' : 'b'), t, distance }
  }
  return best && mountAt(best.wall, floor, best.side, best.t, z)
}

/**
 * Where a device of `kind` tapped at plan point `p` goes: a light on the ceiling right there, anything else on the
 * nearest wall face within reach (undefined when there's none).
 */
export const placeDevice = (kind: DeviceKind, p: Point, floor: Floor): Omit<Device, 'id' | 'name'> | undefined => {
  const z = defaultHeight(kind, floor.height)
  if (onCeiling(kind)) return { floor: floor.id, kind, x: p[0], y: p[1], z }
  const mount = snapToWall(p, floor, z)
  return mount && { floor: floor.id, kind, z, ...mount }
}

/** The changes that turn a device into another kind: off the wall onto the ceiling, or onto the nearest wall. */
export const changeKind = (device: Device, kind: DeviceKind, floor: Floor): Partial<Device> => {
  const z = defaultHeight(kind, floor.height)
  if (onCeiling(kind)) {
    // Step out from the wall into the room, so the light isn't stuck to the wall's top edge.
    const wall = device.wall && floor.walls.find((w) => w.id === device.wall!.wallId)
    if (!wall) return { kind, z, wall: undefined }
    const { n } = frameOf(wall, floor)
    const s = device.wall!.side === 'a' ? 0.3 : -0.3
    return { kind, z, wall: undefined, x: device.x + n[0] * s, y: device.y + n[1] * s }
  }
  const mount = device.wall
    ? snapToWall([device.x, device.y], floor, z, Infinity, device.wall)
    : snapToWall([device.x, device.y], floor, z, Infinity)
  return { kind, z, ...mount }
}

/** The room a device is in; a wall-mounted one belongs to the room its face looks into. */
export const deviceRoom = (device: Device, floor: Floor, regions: Map<string, RoomRegion>): string | undefined => {
  const wall = device.wall && floor.walls.find((w) => w.id === device.wall!.wallId)
  if (!wall) return roomAt(regions, device.x, device.y)
  const { n } = frameOf(wall, floor)
  const s = device.wall!.side === 'a' ? 0.05 : -0.05
  return roomAt(regions, device.x + n[0] * s, device.y + n[1] * s)
}

/** How many devices each room on the floor has. */
export const devicesPerRoom = (devices: Device[], floor: Floor, regions: Map<string, RoomRegion>) => {
  const counts = new Map<string, number>()
  for (const device of devices) {
    if (device.floor !== floor.id) continue
    const room = deviceRoom(device, floor, regions)
    if (room) counts.set(room, (counts.get(room) ?? 0) + 1)
  }
  return counts
}
