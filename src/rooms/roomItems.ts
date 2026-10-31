import type { Device, DeviceKind, FurnitureItem } from '../data/types'
import { deviceRoom } from '../devices/place'
import { floorRegions, roomAt } from '../layout/rooms'
import type { Floor } from '../layout/types'
import { isLamp } from '../scene/HouseLights'

/** A smart item in a room: a placed device, or a lamp (switched like a ceiling light). */
export type SmartItem = {
  id: string
  name: string
  kind: DeviceKind
  lamp: boolean
  entity: string | undefined
  /** Where its popover points, in the scene. */
  at: [number, number, number]
}

/** Every smart item on a floor, with the room it's in (if any). */
export const floorItems = (
  floor: Floor,
  devices: Device[],
  furniture: FurnitureItem[],
): (SmartItem & { room: string | undefined })[] => {
  const regions = floorRegions(floor)
  return [
    ...devices
      .filter((d) => d.floor === floor.id)
      .map((d) => ({
        id: d.id,
        name: d.name,
        kind: d.kind,
        lamp: false,
        entity: d.entity,
        at: [d.x, floor.elevation + d.z, d.y] as SmartItem['at'],
        room: deviceRoom(d, floor, regions),
      })),
    ...furniture
      .filter((f) => f.floor === floor.id && isLamp(f.model))
      .map((f) => ({
        id: f.id,
        name: f.name,
        kind: 'light' as DeviceKind,
        lamp: true,
        entity: undefined,
        at: [f.x, floor.elevation + (f.z ?? 0) + f.height, f.y] as SmartItem['at'],
        room: roomAt(regions, f.x, f.y),
      })),
  ]
}

export const roomItems = (floor: Floor, roomId: string, devices: Device[], furniture: FurnitureItem[]): SmartItem[] =>
  floorItems(floor, devices, furniture).filter((i) => i.room === roomId)
