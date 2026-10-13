import type { Room } from './types'

/** "Living + kitchen 1.03" → number "1.03", name "Living + kitchen". A room without a plan number keeps its name. */
export const roomParts = (room: Room): { number: string | undefined; name: string } => {
  const m = /^(.*?)\s*(\d+\.\d+)$/.exec(room.name)
  return m ? { number: m[2], name: m[1] || room.name } : { number: undefined, name: room.name }
}

/** As `roomParts`, with the name we gave the room (if any) in place of the plan's. */
export const roomLabel = (room: Room, names: Map<string, string>) => {
  const parts = roomParts(room)
  const given = names.get(room.id)?.trim()
  return { ...parts, name: given || parts.name, planName: parts.name }
}
