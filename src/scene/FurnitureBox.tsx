import { Edges, Html } from '@react-three/drei'
import { Copy, RotateCw, Trash2 } from 'lucide-react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import { Mesh, Plane, Vector3 } from 'three'
import type { FurnitureItem } from '../data/types'
import { snapToWalls, type SnapWall } from '../furniture/snap'
import { FurnitureModel } from './FurnitureModel'
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
  actions: ItemActions
}

/** What the buttons floating over a selected item do. */
export type ItemActions = {
  onRotate: (item: FurnitureItem) => void
  onDuplicate: (item: FurnitureItem) => void
  onDelete: (item: FurnitureItem) => void
}

type Controls = { enabled: boolean }

/** A furniture item (a box, or a model stretched to its size) that can be dragged across its floor, snapping to walls when `snapWalls` is given. */
export const FurnitureBox = ({
  item,
  elevation,
  selected,
  interactive,
  snapWalls,
  onSelect,
  onMove,
  onMoveEnd,
  actions,
}: FurnitureBoxProps) => {
  const z = item.z ?? 0
  const getState = useThree((s) => s.get)
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), -(elevation + z)), [elevation, z])
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

  const handlers = interactive
    ? {
        // Named, not left out: R3F wouldn't restore it after the item was non-interactive.
        raycast: Mesh.prototype.raycast,
        onPointerDown,
        onPointerMove,
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        // The release would otherwise click through to the floor beneath and change the selection.
        onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
        onPointerOver: (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), (document.body.style.cursor = 'grab')),
        onPointerOut: () => (document.body.style.cursor = ''),
      }
    : { raycast: () => null }
  // Rugs are nearly flat; keep their hit box tappable.
  const hitHeight = Math.max(item.height, 0.02)

  return (
    <group position={[item.x, elevation + z, item.y]} rotation={[0, -item.rotation, 0]}>
      {/* The box is the item itself, or, for a model, its invisible hit box and selection outline. */}
      <mesh position={[0, hitHeight / 2, 0]} castShadow={!item.model} receiveShadow={!item.model} {...handlers}>
        <boxGeometry args={[item.width, hitHeight, item.depth]} />
        {item.model ? (
          <meshBasicMaterial visible={false} />
        ) : (
          <meshStandardMaterial color={item.color} roughness={0.8} />
        )}
        {selected && <Edges color={SELECTED_OUTLINE} lineWidth={2} />}
      </mesh>
      {item.model && (
        <Suspense fallback={null}>
          <FurnitureModel
            model={item.model}
            width={item.width}
            depth={item.depth}
            height={item.height}
            fabric={item.color}
          />
        </Suspense>
      )}
      {selected && interactive && (
        <Html position={[0, hitHeight, 0]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
          <div className="float item-actions" onPointerDown={(e) => e.stopPropagation()}>
            <button title="Rotate 15° (R)" aria-label="Rotate" onClick={() => actions.onRotate(item)}>
              <RotateCw size={16} />
            </button>
            <button title="Duplicate (⌘D)" aria-label="Duplicate" onClick={() => actions.onDuplicate(item)}>
              <Copy size={16} />
            </button>
            <button className="danger" title="Remove (Del)" aria-label="Remove" onClick={() => actions.onDelete(item)}>
              <Trash2 size={16} />
            </button>
          </div>
        </Html>
      )}
    </group>
  )
}
