import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import { Plane, Ray, Vector3 } from 'three'
import type { FurnitureItem, NewFurnitureItem } from '../data/types'
import { colliding } from '../furniture/collision'
import { snapFurniture, type SnapWall } from '../furniture/snap'
import type { Floor, Point, Rect } from '../layout/types'
import { FurnitureBox } from './FurnitureBox'

// A pointer that moved further than this between down and up was an orbit/pan, not a tap.
const CLICK_SLOP_PX = 5
const PLACING = 'placing'
const noop = () => {}
const UP = new Vector3(0, 1, 0)

type FurniturePlacerProps = {
  floor: Floor
  /** The piece being put down, without its position. */
  piece: Omit<NewFurnitureItem, 'x' | 'y'>
  /** The level underfoot at a plan point: the floor, or the lawn and terrace round the ground floor. */
  ground: (p: Point) => number
  wallSnap: boolean
  furnitureSnap: boolean
  snapWalls: SnapWall[]
  items: FurnitureItem[]
  wallRects: Rect[]
  onPlace: (at: Pick<FurnitureItem, 'x' | 'y' | 'rotation'>) => void
}

/** Carries a new piece under the pointer, snapped as a drag would, until a tap puts it down. */
export const FurniturePlacer = ({
  floor,
  piece,
  ground,
  wallSnap,
  furnitureSnap,
  snapWalls,
  items,
  wallRects,
  onPlace,
}: FurniturePlacerProps) => {
  const hit = useMemo(() => new Vector3(), [])
  const [at, setAt] = useState<Point>()

  // Read on the floor's level first, then again on the ground found there, so a piece on the lawn sits under the pointer.
  const pointAt = (ray: Ray): Point | undefined => {
    if (!ray.intersectPlane(new Plane(UP, -floor.elevation), hit)) return undefined
    const level = ground([hit.x, hit.z])
    if (level === floor.elevation) return [hit.x, hit.z]
    return ray.intersectPlane(new Plane(UP, -level), hit) ? [hit.x, hit.z] : undefined
  }

  const ghost = at && { ...piece, id: PLACING, x: at[0], y: at[1] }
  const placed: FurnitureItem | undefined =
    ghost &&
    ({
      ...ghost,
      ...snapFurniture(ghost, snapWalls, items, { walls: wallSnap, furniture: furnitureSnap }),
    } as FurnitureItem)

  return (
    <>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, floor.elevation + 0.01, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > CLICK_SLOP_PX) return
          e.stopPropagation()
          const p = pointAt(e.ray)
          if (!p) return
          const { x, y, rotation } = snapFurniture({ ...piece, id: PLACING, x: p[0], y: p[1] }, snapWalls, items, {
            walls: wallSnap,
            furniture: furnitureSnap,
          })
          onPlace({ x, y, rotation })
        }}
        onPointerMove={(e) => setAt(pointAt(e.ray))}
        onPointerOver={() => (document.body.style.cursor = 'crosshair')}
        onPointerOut={() => {
          document.body.style.cursor = ''
          setAt(undefined)
        }}
      >
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {placed && (
        <FurnitureBox
          item={placed}
          elevation={floor.elevation}
          ground={ground([placed.x, placed.y])}
          selected
          colliding={colliding([...items, placed], wallRects).has(PLACING)}
          showActions={false}
          interactive={false}
          wallSnap={false}
          furnitureSnap={false}
          snapWalls={undefined}
          snapItems={[]}
          onSelect={noop}
          onMove={noop}
          onMoveEnd={noop}
          onTap={noop}
          actions={{ onRotate: noop, onDuplicate: noop, onDelete: noop }}
        />
      )}
    </>
  )
}
