import type { Room } from './types'

/** "Living + kitchen 1.03" → number "1.03", name "Living + kitchen". A room without a plan number keeps its name. */
export const roomParts = (room: Room): { number: string | undefined; name: string } => {
  const m = /^(.*?)\s*(\d+\.\d+)$/.exec(room.name)
  return m ? { number: m[2], name: m[1] || room.name } : { number: undefined, name: room.name }
}
