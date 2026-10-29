import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, type RefObject } from 'react'
import { Mesh, Plane, Vector3, type Group, type Material } from 'three'
import type { FurnitureItem } from '../data/types'
import { backingWall, floorSnapWalls } from '../furniture/snap'
import { wallOutside } from '../layout/geometry'
import type { Floor } from '../layout/types'
import { wallCut, type Focus } from './CutawayWall'

/** Anything reaching higher than this above its floor is cut down with the walls… */
export const ITEM_CUT_ABOVE = 1.2
/** …to this height, a little lower, so a piece only just over the line isn't trimmed by a sliver. */
export const ITEM_CUT_AT = 1.0
const UNCUT = 1e6

/**
 * Cuts the top off a piece that reaches above ITEM_CUT_ABOVE (tall, or hung up high) while walls are cut: one
 * standing against a wall goes with that wall, one standing free goes whenever walls are cut.
 */
export const useItemCut = (
  group: RefObject<Group | null>,
  item: FurnitureItem,
  floor: Floor | undefined,
  cutaway: boolean,
  focus?: Focus,
) => {
  const gl = useThree((s) => s.gl)
  const plane = useMemo(() => new Plane(new Vector3(0, -1, 0), UNCUT), [])
  const reaches = (item.z ?? 0) + item.height > ITEM_CUT_ABOVE
  const backing = useMemo(() => {
    if (!floor || !reaches) return undefined
    const i = backingWall(item, floorSnapWalls(floor))
    const wall = i === undefined ? undefined : floor.walls[i]
    return wall && { wall, outside: wallOutside(wall, floor) }
  }, [floor, reaches, item])

  useFrame(({ camera }) => {
    const cut =
      !!floor &&
      cutaway &&
      reaches &&
      (!backing || wallCut(backing.wall, floor, backing.outside, camera, cutaway, focus))
    const constant = cut ? floor!.elevation + ITEM_CUT_AT : UNCUT
    if (cut) gl.localClippingEnabled = true
    plane.constant = constant
    // The model loads later than the piece, so its materials are picked up as they come.
    group.current?.traverse((o) => {
      if (!(o instanceof Mesh) || o.type !== 'Mesh') return
      for (const m of [o.material as Material].flat()) {
        if (m.clippingPlanes?.[0] !== plane) m.clippingPlanes = [plane]
      }
    })
  })
}
