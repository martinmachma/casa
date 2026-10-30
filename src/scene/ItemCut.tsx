import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { BufferGeometry, Matrix4, Mesh, MeshStandardMaterial, Plane, Vector3, type Group } from 'three'
import type { FurnitureItem } from '../data/types'
import { backingWall, floorSnapWalls } from '../furniture/snap'
import { inTheWay } from '../furniture/cut'
import { floorBounds, wallOutside } from '../layout/geometry'
import type { Floor, Point } from '../layout/types'
import { wallCut } from './CutawayWall'
import { itemSection, type SectionSource } from './itemSection'

/** Anything reaching higher than this above its floor is cut down with the walls… */
export const ITEM_CUT_ABOVE = 1.2
/** …to this height, a little lower, so a piece only just over the line isn't trimmed by a sliver. */
export const ITEM_CUT_AT = 1.0
const UNCUT = 1e6

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
  const plane = useMemo(() => new Plane(new Vector3(0, -1, 0), UNCUT), [])
  const sectionRef = useRef<{
    cap: Mesh<BufferGeometry, MeshStandardMaterial>
    sources: SectionSource[]
    height: number
    signature: string
    inverse: Matrix4
  }>(undefined)
  useLayoutEffect(() => {
    const cap = new Mesh(new BufferGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
    cap.material.userData.section = true
    cap.visible = false
    cap.raycast = () => {}
    // Avoid sharing a depth with an existing shelf exactly at the cut height.
    cap.position.y = 0.0001
    sectionRef.current = { cap, sources: [], height: NaN, signature: '', inverse: new Matrix4() }
    const section = sectionRef.current!
    const root = group.current
    root?.add(section.cap)
    return () => {
      root?.remove(section.cap)
      section.cap.geometry.dispose()
      section.cap.material.dispose()
    }
  }, [group])
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

  useFrame(({ camera, gl }) => {
    const section = sectionRef.current
    if (!section) return
    const cut =
      !!floor &&
      cutaway &&
      reaches &&
      inTheWay([item.x, item.y], backing?.wall, [camera.position.x, camera.position.z], center!) &&
      (!backing || wallCut(backing.wall, floor, backing.outside, camera, cutaway))
    const constant = cut ? floor!.elevation + ITEM_CUT_AT : UNCUT
    if (cut) gl.localClippingEnabled = true
    plane.setComponents(0, -1, 0, constant)
    // The model loads later than the piece, so its materials are picked up as they come.
    const root = group.current
    section.cap.visible = cut
    if (!root) return
    if (cut) {
      root.updateWorldMatrix(true, true)
      section.inverse.copy(root.matrixWorld).invert()
    }
    const sources: SectionSource[] = []
    root.traverse((o) => {
      if (!(o instanceof Mesh) || o.type !== 'Mesh' || o === section.cap) return
      let opaque = false
      for (const m of [o.material].flat()) {
        if (!m.visible) continue
        opaque ||= !m.transparent
        if (m.clippingPlanes?.[0] !== plane) {
          m.clippingPlanes = [plane]
          m.needsUpdate = true
        }
      }
      if (cut && opaque)
        sources.push({ mesh: o, matrix: new Matrix4().multiplyMatrices(section.inverse, o.matrixWorld) })
    })
    if (!cut) return
    const height = constant - root.position.y
    const signature = sources
      .map(
        ({ mesh }) =>
          mesh.geometry.uuid +
          [mesh.material]
            .flat()
            .map((m) => (m instanceof MeshStandardMaterial ? m.color.getHexString() : ''))
            .join(),
      )
      .join(';')
    if (
      height !== section.height ||
      signature !== section.signature ||
      sources.length !== section.sources.length ||
      sources.some((s, i) => s.mesh !== section.sources[i].mesh || !s.matrix.equals(section.sources[i].matrix))
    ) {
      section.cap.geometry.dispose()
      section.cap.geometry = itemSection(sources, height)
      section.sources = sources
      section.height = height
      section.signature = signature
    }
  })
}
