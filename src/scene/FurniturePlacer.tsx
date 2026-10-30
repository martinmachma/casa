import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
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
  const getState = useThree((s) => s.get)
  const [at, setAt] = useState<Point>()
  const latest = useRef({ floor, ground, piece, snap: { wallSnap, furnitureSnap, snapWalls, items }, onPlace })
  useLayoutEffect(() => {
    latest.current = { floor, ground, piece, snap: { wallSnap, furnitureSnap, snapWalls, items }, onPlace }
  })

  // The pointer is followed on the canvas itself, not through the scene's hits: the piece being carried, the
  // furniture and the walls under it would otherwise hide the floor from the pointer every other move.
  useEffect(() => {
    const canvas = getState().gl.domElement
    const raycaster = new Raycaster()
    const pointer = new Vector2()
    const hit = new Vector3()
    // Read on the floor's level first, then again on the ground found there, so a piece on the lawn sits under the pointer.
    const pointAt = (e: PointerEvent): Point | undefined => {
      const { floor, ground } = latest.current
      const rect = canvas.getBoundingClientRect()
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((e.clientY - rect.top) / rect.height) * 2)
      raycaster.setFromCamera(pointer, getState().camera)
      const { ray } = raycaster
      if (!ray.intersectPlane(new Plane(UP, -floor.elevation), hit)) return undefined
      const level = ground([hit.x, hit.z])
      if (level === floor.elevation) return [hit.x, hit.z]
      return ray.intersectPlane(new Plane(UP, -level), hit) ? [hit.x, hit.z] : undefined
    }
    let down: { x: number; y: number } | undefined
    const move = (e: PointerEvent) => {
      setAt(pointAt(e))
      getState().invalidate()
    }
    const press = (e: PointerEvent) => {
      down = e.button === 0 ? { x: e.clientX, y: e.clientY } : undefined
    }
    const release = (e: PointerEvent) => {
      const start = down
      down = undefined
      if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_SLOP_PX) return
      const p = pointAt(e)
      if (!p) return
      const { piece, snap, onPlace } = latest.current
      const { x, y, rotation } = snapFurniture(
        { ...piece, id: PLACING, x: p[0], y: p[1] },
        snap.snapWalls,
        snap.items,
        {
          walls: snap.wallSnap,
          furniture: snap.furnitureSnap,
        },
      )
      onPlace({ x, y, rotation })
    }
    const leave = () => setAt(undefined)
    canvas.style.cursor = 'crosshair'
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerdown', press)
    canvas.addEventListener('pointerup', release)
    canvas.addEventListener('pointerleave', leave)
    return () => {
      canvas.style.cursor = ''
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerdown', press)
      canvas.removeEventListener('pointerup', release)
      canvas.removeEventListener('pointerleave', leave)
    }
  }, [getState])

  const ghost = at && { ...piece, id: PLACING, x: at[0], y: at[1] }
  const placed: FurnitureItem | undefined =
    ghost &&
    ({
      ...ghost,
      ...snapFurniture(ghost, snapWalls, items, { walls: wallSnap, furniture: furnitureSnap }),
    } as FurnitureItem)

  return (
    <>
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
