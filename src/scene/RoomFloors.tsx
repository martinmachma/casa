import { memo, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { floorRegions, subtractRects, type Rect, type RoomRegion } from '../layout/rooms'
import type { Floor } from '../layout/types'
import { floorBump, floorTexture, roomFloor } from './floorMaterials'
import { FLOOR_SLAB } from './palette'

// Just above the slab top, below anything standing on the floor.
const LIFT = 0.003

/** A flat mesh over the rectangles, facing up, with plan metres as UVs so textures line up across cells. */
const floorGeometry = (cells: Rect[]): BufferGeometry => {
  const positions: number[] = []
  const uvs: number[] = []
  for (const c of cells) {
    // Two triangles, wound counter-clockwise seen from above (+y): plan y is 3D z.
    const quad = [
      [c.x0, c.y0],
      [c.x0, c.y1],
      [c.x1, c.y1],
      [c.x0, c.y0],
      [c.x1, c.y1],
      [c.x1, c.y0],
    ]
    for (const [x, y] of quad) {
      positions.push(x, 0, y)
      uvs.push(x, -y)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  g.computeVertexNormals()
  return g
}

export const RoomFloors = memo(({ floor }: { floor: Floor }) => {
  const regions = useMemo(() => floorRegions(floor), [floor])
  return (
    <group position={[0, floor.elevation + LIFT, 0]}>
      {[...regions.values()].map((region) => (
        <RoomFloorMesh key={region.roomId} region={region} voids={floor.voids} />
      ))}
    </group>
  )
})

type RoomFloorMeshProps = {
  region: RoomRegion
  /** Left bare, like the stairwell. */
  voids: Rect[] | undefined
}

// Taps go through the floor to whatever is under it.
const noRaycast = () => null

const RoomFloorMesh = ({ region, voids }: RoomFloorMeshProps) => {
  const geometry = useMemo(() => floorGeometry(subtractRects(region.cells, voids ?? [])), [region, voids])
  const finish = roomFloor(region.roomId)
  return (
    <mesh geometry={geometry} receiveShadow raycast={noRaycast}>
      {finish ? (
        <meshStandardMaterial
          map={floorTexture(finish)}
          bumpMap={floorBump(finish)}
          bumpScale={finish.bumpScale}
          roughness={finish.roughness}
        />
      ) : (
        <meshStandardMaterial color={FLOOR_SLAB} roughness={0.9} />
      )}
    </mesh>
  )
}
