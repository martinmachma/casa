import { Edges, Html } from '@react-three/drei'
import { Copy, RotateCw, Trash2 } from 'lucide-react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import { Mesh, Plane, Vector3 } from 'three'
import type { FurnitureItem } from '../data/types'
import { snapFurniture, type SnapWall } from '../furniture/snap'
import { FurnitureModel } from './FurnitureModel'
import { SELECTED_OUTLINE } from './palette'
import { pastDragThreshold } from './selection'

type FurnitureBoxProps = {
  item: FurnitureItem
  elevation: number
  selected: boolean
  /** Whether the rotate/duplicate/remove buttons float over this one (one item of a group carries them). */
  showActions: boolean
  /** False while another tool (measuring) owns the pointer. */
  interactive: boolean
  wallSnap: boolean
  furnitureSnap: boolean
  snapWalls: SnapWall[] | undefined
  snapItems: FurnitureItem[]
  /** `add` (Shift, ⌘ or Ctrl held) adds the item to the selection, or takes it out again. */
  onSelect: (id: string, add: boolean) => void
  onMove: (id: string, placement: Pick<FurnitureItem, 'x' | 'y' | 'rotation'>) => void
  onMoveEnd: (id: string) => void
  /** A plain press let go without moving. */
  onTap: (id: string) => void
  actions: ItemActions
}

/** What the buttons floating over the selection do. */
export type ItemActions = {
  onRotate: () => void
  onDuplicate: () => void
  onDelete: () => void
}

type Controls = { enabled: boolean }

/** A furniture item that can be dragged across its floor with independent snapping options. */
export const FurnitureBox = ({
  item,
  elevation,
  selected,
  showActions,
  interactive,
  wallSnap,
  furnitureSnap,
  snapWalls,
  snapItems,
  onSelect,
  onMove,
  onMoveEnd,
  onTap,
  actions,
}: FurnitureBoxProps) => {
  const z = item.z ?? 0
  const getState = useThree((s) => s.get)
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), -(elevation + z)), [elevation, z])
  const drag = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    pointerType: string
    dx: number
    dy: number
    started: boolean
    moved: boolean
    add: boolean
  }>(undefined)
  const hit = useMemo(() => new Vector3(), [])

  // Stops the camera from orbiting/panning along with a drag.
  const setControlsEnabled = (enabled: boolean) => {
    const controls = getState().controls as Controls | null
    if (controls) controls.enabled = enabled
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (drag.current && drag.current.pointerId !== e.pointerId) return
    const add = e.shiftKey || e.metaKey || e.ctrlKey
    onSelect(item.id, add)
    // Taking an item out of the selection doesn't pick it up.
    if (add && selected) return
    if (!e.ray.intersectPlane(plane, hit)) return
    drag.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      pointerType: e.pointerType,
      dx: hit.x - item.x,
      dy: hit.z - item.y,
      started: false,
      moved: false,
      add,
    }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setControlsEnabled(false)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    e.stopPropagation()
    if (!d.started && !pastDragThreshold(d, e)) return
    if (!e.ray.intersectPlane(plane, hit)) return
    if (!d.started) {
      d.started = true
      // Pick up from here, so crossing the threshold doesn't jump by the ignored movement.
      d.dx = hit.x - item.x
      d.dy = hit.z - item.y
      return
    }
    const free = { x: hit.x - d.dx, y: hit.z - d.dy, rotation: item.rotation }
    const placement = snapFurniture({ ...item, ...free }, snapWalls, snapItems, {
      walls: wallSnap,
      furniture: furnitureSnap,
    })
    if (placement.x === item.x && placement.y === item.y && placement.rotation === item.rotation) return
    d.moved = true
    onMove(item.id, placement)
  }

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = undefined
    ;(e.target as Element).releasePointerCapture(e.pointerId)
    setControlsEnabled(true)
    if (d.moved) onMoveEnd(item.id)
    else if (!d.started && !d.add && e.type !== 'pointercancel') onTap(item.id)
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
      {showActions && interactive && (
        <Html position={[0, hitHeight, 0]} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
          <div className="float item-actions" onPointerDown={(e) => e.stopPropagation()}>
            <button title="Rotate 15° (R)" aria-label="Rotate" onClick={() => actions.onRotate()}>
              <RotateCw size={16} />
            </button>
            <button title="Duplicate (⌘D)" aria-label="Duplicate" onClick={() => actions.onDuplicate()}>
              <Copy size={16} />
            </button>
            <button className="danger" title="Remove (Del)" aria-label="Remove" onClick={() => actions.onDelete()}>
              <Trash2 size={16} />
            </button>
          </div>
        </Html>
      )}
    </group>
  )
}
