import type { Backend } from '../data/types'
import { useSavedOrder } from '../lib/useSavedOrder'

/** The signed-in person's order of the room menu, kept in their row of house.room_orders. */
export const useRoomOrder = (backend: Backend) =>
  useSavedOrder(['roomOrder', backend.kind], backend.loadRoomOrder, backend.saveRoomOrder)
