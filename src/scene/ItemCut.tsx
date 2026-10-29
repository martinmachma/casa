import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, type RefObject } from 'react'
import { DoubleSide, Mesh, Plane, Vector3, type Group, type Material } from 'three'
import type { FurnitureItem } from '../data/types'
import { backingWall, floorSnapWalls } from '../furniture/snap'
import { inTheWay } from '../furniture/cut'
import { floorBounds, wallOutside } from '../layout/geometry'
import type { Floor, Point } from '../layout/types'
import { wallCut } from './CutawayWall'

/** Anything reaching higher than this above its floor is cut down with the walls… */
export const ITEM_CUT_ABOVE = 1.2
/** …to this height, a little lower, so a piece only just over the line isn't trimmed by a sliver. */
export const ITEM_CUT_AT = 1.0
const UNCUT = 1e6
// How much darker than the piece itself its cut face is.
const CUT_FACE = 0.55

/**
 * Seen through the cut, a piece's inside faces are painted flat in its own colour, darkened: the cut reads as a
 * solid section, level all round, rather than a hollow shell.
 */
const capCut = (m: Material) => {
  m.userData.cut = { value: false }
  m.userData.side = m.side
  m.onBeforeCompile = (shader) => {
    shader.uniforms.cut = m.userData.cut
    shader.fragmentShader = `uniform bool cut;\n${shader.fragmentShader}`.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      if (cut && !gl_FrontFacing) gl_FragColor = linearToOutputTexel(vec4(diffuseColor.rgb * ${CUT_FACE}, 1.0));`,
    )
  }
  m.customProgramCacheKey = () => 'item-cut'
}

/**
 * Cuts the top off a piece that reaches above ITEM_CUT_ABOVE (tall, or hung up high) while walls are cut and it's
 * in the way: one against a wall goes with that wall, seen from behind it; one standing free goes when it's on the
 * camera's side of what's looked at (the floor's middle).
 */
export const useItemCut = (
  group: RefObject<Group | null>,
  item: FurnitureItem,
  floor: Floor | undefined,
  cutaway: boolean,
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
  const center = useMemo((): Point | undefined => {
    if (!floor) return undefined
    const { min, max } = floorBounds(floor)
    return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2]
  }, [floor])

  useFrame(({ camera }) => {
    const cut =
      !!floor &&
      cutaway &&
      reaches &&
      inTheWay([item.x, item.y], backing?.wall, [camera.position.x, camera.position.z], center!) &&
      (!backing || wallCut(backing.wall, floor, backing.outside, camera, cutaway))
    const constant = cut ? floor!.elevation + ITEM_CUT_AT : UNCUT
    if (cut) gl.localClippingEnabled = true
    plane.constant = constant
    // The model loads later than the piece, so its materials are picked up as they come.
    group.current?.traverse((o) => {
      if (!(o instanceof Mesh) || o.type !== 'Mesh') return
      for (const m of [o.material as Material].flat()) {
        if (!m.visible) continue
        if (m.clippingPlanes?.[0] !== plane) {
          m.clippingPlanes = [plane]
          capCut(m)
          m.needsUpdate = true
        }
        // The inside faces only need drawing while there's a cut to see them through.
        m.userData.cut.value = cut
        const side = cut ? DoubleSide : m.userData.side
        if (m.side !== side) {
          m.side = side
          m.needsUpdate = true
        }
      }
    })
  })
}
