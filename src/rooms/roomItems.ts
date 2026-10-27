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

export const roomItems = (floor: Floor, roomId: string, devices: Device[], furniture: FurnitureItem[]): SmartItem[] => {
  const regions = floorRegions(floor)
  return [
    ...devices
      .filter((d) => d.floor === floor.id && deviceRoom(d, floor, regions) === roomId)
      .map((d): SmartItem => ({
        id: d.id,
        name: d.name,
        kind: d.kind,
        lamp: false,
        entity: d.entity,
        at: [d.x, floor.elevation + d.z, d.y],
      })),
    ...furniture
      .filter((f) => f.floor === floor.id && isLamp(f.model) && roomAt(regions, f.x, f.y) === roomId)
      .map((f): SmartItem => ({
        id: f.id,
        name: f.name,
        kind: 'light',
        lamp: true,
        entity: undefined,
        at: [f.x, floor.elevation + (f.z ?? 0) + f.height, f.y],
      })),
  ]
}
