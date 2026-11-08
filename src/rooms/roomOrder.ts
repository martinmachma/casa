import { arrange, moveInOrder, type Order, type OrderZone } from '../lib/order'
import type { RoomView } from './roomViews'

/** Where the rooms sit in the menu: the big ones in order, then the small ones in order, by room id. */
export type RoomOrder = Order
export type RoomZone = OrderZone

/** The rooms in the order they were put in; new ones follow in plan order, big or small as the plan has them. */
export const arrangeRooms = (rooms: RoomView[], order: RoomOrder | undefined): RoomOrder => arrange(rooms, order)

/** The order with the room taken out of wherever it was and put at `index` among the others in `zone`. */
export const moveRoom = moveInOrder
