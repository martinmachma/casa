import { ExtrudeGeometry, Path, Shape, Vector2 } from 'three'
import type { Point } from '../layout/types'

/** A plan polygon (with optional holes) extruded `depth` down from y = 0 (plan y is 3D z). */
export const prismGeometry = (polygon: Point[], depth: number, holes: Point[][] = []): ExtrudeGeometry => {
  const shape = new Shape(polygon.map(([x, y]) => new Vector2(x, y)))
  for (const h of holes) shape.holes.push(new Path(h.map(([x, y]) => new Vector2(x, y))))
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  // Shape space (x, y, extrude z) → world (x, -z, y): the polygon lies flat, extruded downwards.
  g.rotateX(Math.PI / 2)
  return g
}
