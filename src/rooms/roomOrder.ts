import type { RoomView } from './roomViews'

/** Where the rooms sit in the menu: the big ones in order, then the small ones in order, by room id. */
export type RoomOrder = { main: string[]; minor: string[] }
export type RoomZone = keyof RoomOrder

/**
 * The rooms in the order they were put in; rooms the order doesn't know (new ones, or none saved yet) follow in plan
 * order, big or small as the plan has them, and ids of rooms that are gone are dropped.
 */
export const arrangeRooms = (rooms: RoomView[], order: RoomOrder | undefined): RoomOrder => {
  const known = new Set(rooms.map((r) => r.id))
  const seen = new Set<string>()
  const keep = (ids: string[] = []) => ids.filter((id) => known.has(id) && !seen.has(id) && seen.add(id))
  const main = keep(order?.main)
  const minor = keep(order?.minor)
  for (const r of rooms) if (!seen.has(r.id)) (r.minor ? minor : main).push(r.id)
  return { main, minor }
}

/** The order with the room taken out of wherever it was and put at `index` among the others in `zone`. */
export const moveRoom = (order: RoomOrder, id: string, zone: RoomZone, index: number): RoomOrder => {
  const main = order.main.filter((r) => r !== id)
  const minor = order.minor.filter((r) => r !== id)
  const into = zone === 'main' ? main : minor
  into.splice(Math.max(0, Math.min(index, into.length)), 0, id)
  return { main, minor }
}
