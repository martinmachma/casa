import { Edges } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Plane, Vector3 } from 'three'
import type { FurnitureItem } from '../data/types'
import { snapToWalls, type SnapWall } from '../furniture/snap'
import { SELECTED_OUTLINE } from './palette'

type FurnitureBoxProps = {
  item: FurnitureItem
  elevation: number
  selected: boolean
  /** False while another tool (measuring) owns the pointer. */
  interactive: boolean
  snapWalls: SnapWall[] | undefined
  onSelect: (id: string) => void
  onMove: (id: string, placement: Pick<FurnitureItem, 'x' | 'y' | 'rotation'>) => void
  onMoveEnd: (id: string) => void
}

type Controls = { enabled: boolean }

/** A furniture box that can be dragged across its floor, snapping to walls when `snapWalls` is given. */
export const FurnitureBox = ({
  item,
  elevation,
  selected,
  interactive,
  snapWalls,
  onSelect,
  onMove,
  onMoveEnd,
}: FurnitureBoxProps) => {
  const getState = useThree((s) => s.get)
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), -elevation), [elevation])
  const drag = useRef<{ dx: number; dy: number; moved: boolean }>(undefined)
  const hit = useMemo(() => new Vector3(), [])

  // Stops the camera from orbiting/panning along with a drag.
  const setControlsEnabled = (enabled: boolean) => {
    const controls = getState().controls as Controls | null
    if (controls) controls.enabled = enabled
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onSelect(item.id)
    if (!e.ray.intersectPlane(plane, hit)) return
    drag.current = { dx: hit.x - item.x, dy: hit.z - item.y, moved: false }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setControlsEnabled(false)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d || !e.ray.intersectPlane(plane, hit)) return
    e.stopPropagation()
    d.moved = true
    const free = { x: hit.x - d.dx, y: hit.z - d.dy, rotation: item.rotation }
    onMove(item.id, snapWalls ? snapToWalls({ ...item, ...free }, snapWalls) : free)
  }

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    drag.current = undefined
    ;(e.target as Element).releasePointerCapture(e.pointerId)
    setControlsEnabled(true)
    if (d.moved) onMoveEnd(item.id)
  }

  if (!interactive)
    return (
      <mesh
        position={[item.x, elevation + item.height / 2, item.y]}
        rotation={[0, -item.rotation, 0]}
        castShadow
        receiveShadow
        raycast={() => null}
      >
        <boxGeometry args={[item.width, item.height, item.depth]} />
        <meshStandardMaterial color={item.color} roughness={0.8} />
      </mesh>
    )

  return (
    <mesh
      position={[item.x, elevation + item.height / 2, item.y]}
      rotation={[0, -item.rotation, 0]}
      castShadow
      receiveShadow
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerOver={(e) => (e.stopPropagation(), (document.body.style.cursor = 'grab'))}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <boxGeometry args={[item.width, item.height, item.depth]} />
      <meshStandardMaterial color={item.color} roughness={0.8} />
      {selected && <Edges color={SELECTED_OUTLINE} lineWidth={2} />}
    </mesh>
  )
}
