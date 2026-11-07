import type { Device, DeviceKind, FurnitureItem } from '../data/types'
import { deviceRoom } from '../devices/place'
import { floorShades } from '../devices/shades'
import { wallAngle } from '../layout/geometry'
import { floorRegions, roomAt } from '../layout/rooms'
import type { Floor } from '../layout/types'
import { isLamp } from '../scene/HouseLights'

/** A smart item in a room: a placed device, a lamp (switched like a ceiling light), or a window's outside shade. */
export type SmartItem = {
  id: string
  name: string
  kind: DeviceKind
  lamp: boolean
  entity: string | undefined
  /** Where its popover points, in the scene. */
  at: [number, number, number]
  /** The way (plan) its close-up looks at it from, for one only seen from one side, like a window's shade. */
  facing?: [number, number]
  /** Where its close-up is centred, if not on `at`. */
  look?: [number, number, number]
  /** For a light, how it hangs: its close-up looks into it (from below for one on the ceiling). */
  mount?: 'ceiling' | 'wall' | 'lamp'
  /** Where its controls stand, if beside it rather than at the end of its tag's line. */
  beside?: [number, number, number]
}

/** The header for what isn't a shade: lights, unless something else is in with them. */
export const itemsTitle = (items: SmartItem[]) => (items.every((i) => i.kind === 'light') ? 'Lights' : 'Devices')

/** Every smart item on a floor, with the room it's in (if any). */
export const floorItems = (
  floor: Floor,
  devices: Device[],
  furniture: FurnitureItem[],
): (SmartItem & { room: string | undefined })[] => {
  const regions = floorRegions(floor)
  return [
    ...devices
      .filter((d) => d.floor === floor.id && (!d.plan || d.kind === 'light'))
      .map((d) => {
        const room = deviceRoom(d, floor, regions)
        const wall = d.wall && floor.walls.find((w) => w.id === d.wall!.wallId)
        const angle = wall ? wallAngle(wall) : 0
        const side = d.wall?.side === 'a' ? 1 : -1
        return {
          id: d.id,
          name: d.name,
          kind: d.kind,
          lamp: false,
          entity: d.entity,
          at: [d.x, floor.elevation + d.z, d.y] as SmartItem['at'],
          room,
          // A wall light is approached from the face it shines out of.
          facing: wall ? ([-Math.sin(angle) * side, Math.cos(angle) * side] as [number, number]) : undefined,
          mount: d.kind === 'light' ? (d.wall ? ('wall' as const) : ('ceiling' as const)) : undefined,
        }
      }),
    ...furniture
      .filter((f) => f.floor === floor.id && isLamp(f.model))
      .map((f) => ({
        id: f.id,
        name: f.name,
        kind: 'light' as DeviceKind,
        lamp: true,
        mount: 'lamp' as const,
        entity: undefined,
        at: [f.x, floor.elevation + (f.z ?? 0) + f.height, f.y] as SmartItem['at'],
        room: roomAt(regions, f.x, f.y),
      })),
    ...floorShades(floor, regions).map((s) => ({ ...s, kind: 'blind' as DeviceKind, lamp: false, entity: undefined })),
  ]
}

/** A light that isn't in any room: on the house's outside, or out in the garden. */
export const outsideLight = (item: { kind: DeviceKind; room: string | undefined }) =>
  item.kind === 'light' && !item.room

export const roomItems = (floor: Floor, roomId: string, devices: Device[], furniture: FurnitureItem[]): SmartItem[] =>
  floorItems(floor, devices, furniture).filter((i) => i.room === roomId)

/** A smart item with the room it's in and the floor it's on. */
export type PlacedItem = SmartItem & { room: string | undefined; floorIndex: number }

/** A part of a list of items: a floor, split into its rooms, or what's outside. */
export type ItemSection<T> = { name: string; rooms: { name: string | undefined; items: T[] }[] }

/**
 * Items as a list reads them: each floor's rooms, then what isn't in a room as Outside. Floors stay in the order
 * given, and `firstRoom` comes first on its floor.
 */
export const itemSections = <T extends { room: string | undefined }>(
  floors: { name: string; items: T[] }[],
  roomName: (item: T) => string | undefined,
  firstRoom?: string,
): ItemSection<T>[] => {
  const inFloor = floors.map((floor) => {
    const inRooms = floor.items.filter((i) => i.room)
    const ids = [...new Set(inRooms.map((i) => i.room))]
    const ordered = [...ids.filter((id) => id === firstRoom), ...ids.filter((id) => id !== firstRoom)]
    return {
      name: floor.name,
      rooms: ordered.map((id) => {
        const items = inRooms.filter((i) => i.room === id)
        return { name: roomName(items[0]), items }
      }),
    }
  })
  const out = floors.flatMap((f) => f.items.filter((i) => !i.room))
  return [...inFloor, { name: 'Outside', rooms: out.length ? [{ name: undefined, items: out }] : [] }].filter(
    (s) => s.rooms.length,
  )
}
