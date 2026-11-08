/** A person's own order of a menu: the ones shown up front in order, then the rest in order, by id. */
export type Order = { main: string[]; minor: string[] }
export type OrderZone = keyof Order

/**
 * The ids in the order they were put in; ids the order doesn't know (new ones, or none saved yet) follow in the
 * given order, up front or not as `minor` says, and ids that are gone are dropped.
 */
export const arrange = (items: { id: string; minor?: boolean }[], order: Order | undefined): Order => {
  const known = new Set(items.map((r) => r.id))
  const seen = new Set<string>()
  const keep = (ids: string[] = []) => ids.filter((id) => known.has(id) && !seen.has(id) && seen.add(id))
  const main = keep(order?.main)
  const minor = keep(order?.minor)
  for (const r of items) if (!seen.has(r.id)) (r.minor ? minor : main).push(r.id)
  return { main, minor }
}

/** The order with the id taken out of wherever it was and put at `index` among the others in `zone`. */
export const moveInOrder = (order: Order, id: string, zone: OrderZone, index: number): Order => {
  const main = order.main.filter((r) => r !== id)
  const minor = order.minor.filter((r) => r !== id)
  const into = zone === 'main' ? main : minor
  into.splice(Math.max(0, Math.min(index, into.length)), 0, id)
  return { main, minor }
}
