import type { Floor } from '../layout/types'
import type { RoomView } from '../rooms/roomViews'

/** What a stop holds, shown under its name while dragging: its rooms and how many are lit. */
export const describeFloor =
  (floors: Floor[], rooms: RoomView[], lit: Map<string, boolean>) => (index: number | undefined) => {
    const inIt = index === undefined ? rooms : rooms.filter((r) => r.floor === floors[index].id)
    const on = inIt.filter((r) => lit.get(r.room)).length
    return `${inIt.length} rooms · ${on ? `${on} lit` : 'all dark'}`
  }
