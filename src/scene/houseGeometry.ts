import { BoxGeometry, BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  openingId,
  openingSill,
  wallAngle,
  wallEndExtensions,
  wallHeight,
  wallPieces,
  wallThickness,
} from '../layout/geometry'
import type { Floor, Roof } from '../layout/types'
import { slabGeometry } from './prism'
import { roofBoxes } from './roofGeometry'

const SLAB = 0.3
// A closed door's leaf, so the lights indoors stop at it even when its wall is cut away from view.
const LEAF = 0.04

/** Plain positions only, so boxes and slabs can share one merged geometry. */
const bare = (geometry: BufferGeometry) => {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry
  for (const name of Object.keys(flat.attributes)) if (name !== 'position') flat.deleteAttribute(name)
  return flat
}

const box = (size: [number, number, number], at: [number, number, number], angle = 0) => {
  const geometry = new BoxGeometry(...size)
  geometry.translate(...at)
  geometry.rotateY(angle)
  return bare(geometry)
}

/** The whole house's walls, closed doors, slabs and roof as one solid, for shadows. */
export const houseSolid = (
  floors: Floor[],
  roof: Roof | undefined,
  openDoors: ReadonlySet<string>,
  groundLevel?: number,
) => {
  const parts: BufferGeometry[] = []
  floors.forEach((floor, i) => {
    // Down to the walls below, like the visible slab, so no light slips between the floors.
    const below = floors[i - 1]
    const depth = below
      ? Math.max(SLAB, floor.elevation - below.elevation - below.height)
      : Math.max(SLAB, floor.elevation - (groundLevel ?? floor.elevation) + 0.1)
    const slab = slabGeometry(floor, depth)
    slab.translate(0, floor.elevation, 0)
    parts.push(bare(slab))
    for (const wall of floor.walls) {
      const thickness = wallThickness(wall, floor)
      for (const p of wallPieces(wall, wallHeight(wall, floor), wallEndExtensions(wall, floor))) {
        const y0 = p.y0
        const piece = box(
          [p.u1 - p.u0, p.y1 - y0, thickness],
          [(p.u0 + p.u1) / 2, (y0 + p.y1) / 2, 0],
          -wallAngle(wall),
        )
        piece.translate(wall.from[0], floor.elevation, wall.from[1])
        parts.push(piece)
      }
      wall.openings?.forEach((o, i) => {
        if (o.type !== 'door' || openDoors.has(openingId(wall.id, i))) return
        const sill = openingSill(o)
        const leaf = box([o.width, o.height, LEAF], [o.offset + o.width / 2, sill + o.height / 2, 0], -wallAngle(wall))
        leaf.translate(wall.from[0], floor.elevation, wall.from[1])
        parts.push(leaf)
      })
    }
  })
  const top = floors[floors.length - 1]
  if (top) {
    const boxes = roof ? roofBoxes(top, roof) : roofBoxes(top, { parapet: 0 }).slice(0, 1)
    for (const b of boxes) parts.push(box(b.size, b.at))
  }

  const merged = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  return merged
}
