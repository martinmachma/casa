import { ExtrudeGeometry, Path, Shape, Vector2 } from 'three'
import { floorBounds } from '../layout/geometry'
import type { Floor, Point } from '../layout/types'

/** A plan polygon (with optional holes) extruded `depth` down from y = 0 (plan y is 3D z). */
export const prismGeometry = (polygon: Point[], depth: number, holes: Point[][] = []): ExtrudeGeometry => {
  const shape = new Shape(polygon.map(([x, y]) => new Vector2(x, y)))
  for (const h of holes) shape.holes.push(new Path(h.map(([x, y]) => new Vector2(x, y))))
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  // Shape space (x, y, extrude z) → world (x, -z, y): the polygon lies flat, extruded downwards.
  g.rotateX(Math.PI / 2)
  return g
}

/** A floor's slab: its outline (or bounds) with the stair voids cut out, `depth` thick below y = 0. */
export const slabGeometry = (floor: Floor, depth: number) => {
  const { min, max } = floorBounds(floor)
  const outline = floor.outline ?? [min, [max[0], min[1]], max, [min[0], max[1]]]
  const holes = (floor.voids ?? []).map((v): Point[] => [
    [v.x0, v.y0],
    [v.x1, v.y0],
    [v.x1, v.y1],
    [v.x0, v.y1],
  ])
  return prismGeometry(outline, depth, holes)
}
