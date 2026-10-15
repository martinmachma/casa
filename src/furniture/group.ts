import type { FurnitureItem } from '../data/types'
import { normalizeAngle } from './snap'

type Placed = Pick<FurnitureItem, 'id' | 'x' | 'y' | 'rotation'>

/** Turns a group of pieces together about the middle of their centres, keeping their arrangement. */
export const rotateGroup = (
  items: Placed[],
  radians: number,
): Map<string, Pick<FurnitureItem, 'x' | 'y' | 'rotation'>> => {
  const cx = items.reduce((s, i) => s + i.x, 0) / items.length
  const cy = items.reduce((s, i) => s + i.y, 0) / items.length
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return new Map(
    items.map((i) => {
      const dx = i.x - cx
      const dy = i.y - cy
      return [
        i.id,
        { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos, rotation: normalizeAngle(i.rotation + radians) },
      ]
    }),
  )
}
