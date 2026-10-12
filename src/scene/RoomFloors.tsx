import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import type { Rect, RoomRegion } from '../layout/rooms'
import type { Floor } from '../layout/types'
import { floorMaterial, floorTexture } from './floorMaterials'
import { FLOOR_SLAB, SELECTED_OUTLINE } from './palette'

// Just above the slab top, below anything standing on the floor.
const LIFT = 0.003
const CLICK_SLOP_PX = 5

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

type RoomFloorsProps = {
  floor: Floor
  regions: Map<string, RoomRegion>
  materials: Map<string, string>
  selectedRoom: string | undefined
  interactive: boolean
  onPick: (roomId: string) => void
}

export const RoomFloors = ({ floor, regions, materials, selectedRoom, interactive, onPick }: RoomFloorsProps) => (
  <group position={[0, floor.elevation + LIFT, 0]}>
    {[...regions.values()].map((region) => (
      <RoomFloorMesh
        key={region.roomId}
        region={region}
        material={materials.get(region.roomId)}
        selected={region.roomId === selectedRoom}
        interactive={interactive}
        onPick={onPick}
      />
    ))}
  </group>
)

type RoomFloorMeshProps = {
  region: RoomRegion
  material: string | undefined
  selected: boolean
  interactive: boolean
  onPick: (roomId: string) => void
}

const noRaycast = () => null

const RoomFloorMesh = ({ region, material, selected, interactive, onPick }: RoomFloorMeshProps) => {
  const geometry = useMemo(() => floorGeometry(region.cells), [region])
  const finish = floorMaterial(material)
  const map = finish ? floorTexture(finish) : null

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > CLICK_SLOP_PX) return
    e.stopPropagation()
    onPick(region.roomId)
  }

  return (
    <>
      <mesh
        geometry={geometry}
        receiveShadow
        raycast={interactive ? undefined : noRaycast}
        onClick={interactive ? handleClick : undefined}
      >
        <meshStandardMaterial
          key={finish?.id ?? 'plain'}
          map={map}
          color={map ? '#ffffff' : FLOOR_SLAB}
          roughness={finish?.roughness ?? 0.9}
        />
      </mesh>
      {selected && (
        <mesh geometry={geometry} position={[0, 0.002, 0]} raycast={noRaycast}>
          <meshBasicMaterial color={SELECTED_OUTLINE} transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
    </>
  )
}
