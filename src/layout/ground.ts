import { floorBounds, insidePolygon } from './geometry'
import type { Floor, Outdoor, Point } from './types'

/**
 * How high the surface is at a plan point by the ground floor: the slab inside the house, else the paving or
 * terrace there (the highest, where they meet), else the lawn.
 */
export const groundLevel = (floor: Floor, outdoor: Outdoor | undefined, p: Point): number => {
  if (!outdoor || onSlab(floor, p)) return floor.elevation
  const paved = [outdoor.terrace, ...(outdoor.paving ?? [])].filter((a) => insidePolygon(p, a.outline))
  return paved.length ? Math.max(...paved.map((a) => a.level)) : outdoor.level
}

const onSlab = (floor: Floor, p: Point): boolean => {
  if (floor.outline) return insidePolygon(p, floor.outline)
  const { min, max } = floorBounds(floor)
  return p[0] >= min[0] && p[0] <= max[0] && p[1] >= min[1] && p[1] <= max[1]
}
