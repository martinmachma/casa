import { floorRegions } from './rooms'
import type { Floor, Wall, WallSide } from './types'

export const WC_TILE_HEIGHT = 1.5

/** Only the inward faces within the WC, including the clipped lengths of the shared west and core walls. */
export const wcWallFinish = (floor: Floor, wall: Wall) => {
  if (floor.id !== 'ground') return undefined
  const sides: Record<string, WallSide> = {
    'g-west': 'a',
    'g-storage-wc': 'a',
    'g-core': 'a',
    'g-wc-hall': 'b',
  }
  const side = sides[wall.id]
  const region = floorRegions(floor).get('g-wc')
  if (!side || !region) return undefined
  const axis = wall.from[0] === wall.to[0] ? 1 : 0
  const sign = Math.sign(wall.to[axis] - wall.from[axis])
  const ends = region.cells.flatMap((c) => (axis === 0 ? [c.x0, c.x1] : [c.y0, c.y1]))
  const offsets = ends.map((end) => (end - wall.from[axis]) * sign)
  return { side, u0: Math.min(...offsets), u1: Math.max(...offsets) }
}
