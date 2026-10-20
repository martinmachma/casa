import type { NewFurnitureItem } from '../data/types'
import type { Point } from '../layout/types'

/** Moves the mean of the copied centres to the cursor, preserving the arrangement and floor-relative heights. */
export const pasteFurniture = (items: readonly NewFurnitureItem[], floor: string, at: Point): NewFurnitureItem[] => {
  if (!items.length) return []
  const cx = items.reduce((sum, item) => sum + item.x, 0) / items.length
  const cy = items.reduce((sum, item) => sum + item.y, 0) / items.length
  return items.map((item) => ({ ...item, floor, x: item.x + at[0] - cx, y: item.y + at[1] - cy }))
}
