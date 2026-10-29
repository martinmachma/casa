import { useEffect, useMemo } from 'react'
import { BoxGeometry, BufferGeometry, MeshBasicMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  floorBounds,
  openingId,
  openingSill,
  wallAngle,
  wallHeight,
  wallPieces,
  wallThickness,
} from '../layout/geometry'
import type { Floor, Roof } from '../layout/types'
import { slabGeometry } from './prism'

const SLAB = 0.3
// The parapet's thickness, as the roof draws it.
const PARAPET = 0.2
// A closed door's leaf, so the lights indoors stop at it even when its wall is cut away from view.
const LEAF = 0.04

// Draws nothing on screen; the sun's shadow pass still renders it.
const shadowOnly = new MeshBasicMaterial({ colorWrite: false, depthWrite: false })

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
const houseSolid = (floors: Floor[], roof: Roof | undefined, openDoors: ReadonlySet<string>) => {
  const parts: BufferGeometry[] = []
  floors.forEach((floor, i) => {
    // Down to the walls below, like the visible slab, so no light slips between the floors.
    const below = floors[i - 1]
    const slab = slabGeometry(floor, below ? Math.max(SLAB, floor.elevation - below.elevation - below.height) : SLAB)
    slab.translate(0, floor.elevation, 0)
    parts.push(bare(slab))
    for (const wall of floor.walls) {
      const thickness = wallThickness(wall, floor)
      for (const p of wallPieces(wall, wallHeight(wall, floor), thickness / 2)) {
        const piece = box(
          [p.u1 - p.u0, p.y1 - p.y0, thickness],
          [(p.u0 + p.u1) / 2, (p.y0 + p.y1) / 2, 0],
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
    // The roof slab, and the parapet round it apart: a shadow is cast by a solid's far side, so with the parapet
    // in one block with the slab, its inner faces would stand inside that block and catch the lights below.
    const { min, max } = floorBounds(top)
    const y = top.elevation + top.height
    const w = max[0] - min[0]
    const d = max[1] - min[1]
    const cx = (min[0] + max[0]) / 2
    const cz = (min[1] + max[1]) / 2
    parts.push(box([w, SLAB, d], [cx, y + SLAB / 2, cz]))
    const rim = roof?.parapet ?? 0
    if (rim > 0) {
      const ry = y + SLAB + rim / 2
      parts.push(
        box([PARAPET, rim, d], [min[0] + PARAPET / 2, ry, cz]),
        box([PARAPET, rim, d], [max[0] - PARAPET / 2, ry, cz]),
        box([w - 2 * PARAPET, rim, PARAPET], [cx, ry, min[1] + PARAPET / 2]),
        box([w - 2 * PARAPET, rim, PARAPET], [cx, ry, max[1] - PARAPET / 2]),
      )
    }
    const height = SLAB + rim
    const chimney = roof?.chimney
    if (chimney) {
      const stack = height + 0.6
      parts.push(
        box(
          [chimney.x1 - chimney.x0, stack, chimney.y1 - chimney.y0],
          [(chimney.x0 + chimney.x1) / 2, y + stack / 2, (chimney.y0 + chimney.y1) / 2],
        ),
      )
    }
  }
  const merged = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  return merged
}

/**
 * The whole house casting its shadow, whichever floor is shown and whichever walls are cut away.
 * It's invisible and unpickable; the visible walls, slabs and roof leave the shadow to it.
 */
export const HouseShadow = ({
  floors,
  roof,
  openDoors,
}: {
  floors: Floor[]
  roof: Roof | undefined
  openDoors: ReadonlySet<string>
}) => {
  const geometry = useMemo(() => houseSolid(floors, roof, openDoors), [floors, roof, openDoors])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={shadowOnly} castShadow raycast={() => null} />
}
