import { Html, Line } from '@react-three/drei'
import { Copy, RotateCw, Trash2 } from 'lucide-react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import { Mesh, Plane, Vector3 } from 'three'
import type { FurnitureItem } from '../data/types'
import { footprint, footprintOutline } from '../furniture/collision'
import type { Point } from '../layout/types'
import { snapFurniture, type SnapWall } from '../furniture/snap'
import { FurnitureModel } from './FurnitureModel'
import { COLLIDING, SELECTED_OUTLINE } from './palette'

type FurnitureBoxProps = {
  item: FurnitureItem
  /** How brightly a lamp is lit, 0 to 1. */
  glow?: number
  /** The colour a lamp gives off. */
  glowColor?: string
  elevation: number
  selected: boolean
  /** Runs into a wall or another piece. */
  colliding?: boolean
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
  /** Set for a lamp while looking round: a tap picks it, to switch and set it. */
  onPickLight?: (id: string) => void
  actions: ItemActions
}

/** What the buttons floating over the selection do. */
export type ItemActions = {
  onRotate: () => void
  onDuplicate: () => void
  onDelete: () => void
}

type Controls = { enabled: boolean }
// A pointer that moved further than this between down and up was an orbit/pan, not a tap.
const CLICK_SLOP_PX = 5

/** A furniture item that can be dragged across its floor with independent snapping options. */
export const FurnitureBox = ({
  item,
  glow,
  glowColor,
  elevation,
  selected,
  colliding,
  showActions,
  interactive,
  wallSnap,
  furnitureSnap,
  snapWalls,
  snapItems,
  onSelect,
  onPickLight,
  onMove,
  onMoveEnd,
  onTap,
  actions,
}: FurnitureBoxProps) => {
  const z = item.z ?? 0
  const getState = useThree((s) => s.get)
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), -(elevation + z)), [elevation, z])
  const press = useRef<{
    pointerId: number
    offset?: { dx: number; dy: number }
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
    if (press.current) return
    const add = e.shiftKey || e.metaKey || e.ctrlKey
    // Only a piece already in the selection can be picked up. Modifier-clicks only change selection.
    const offset =
      selected && !add && e.ray.intersectPlane(plane, hit) ? { dx: hit.x - item.x, dy: hit.z - item.y } : undefined
    press.current = {
      pointerId: e.pointerId,
      offset,
      moved: false,
      add,
    }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setControlsEnabled(false)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = press.current
    if (!d || d.pointerId !== e.pointerId) return
    e.stopPropagation()
    if (!d.offset) return
    if (!e.ray.intersectPlane(plane, hit)) return
    const free = { x: hit.x - d.offset.dx, y: hit.z - d.offset.dy, rotation: item.rotation }
    const placement = snapFurniture({ ...item, ...free }, snapWalls, snapItems, {
      walls: wallSnap,
      furniture: furnitureSnap,
    })
    if (placement.x === item.x && placement.y === item.y && placement.rotation === item.rotation) return
    d.moved = true
    onMove(item.id, placement)
  }

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    const d = press.current
    if (!d || d.pointerId !== e.pointerId) return
    e.stopPropagation()
    press.current = undefined
    ;(e.target as Element).releasePointerCapture(e.pointerId)
    setControlsEnabled(true)
    if (d.moved) onMoveEnd(item.id)
    else if (e.type !== 'pointercancel') {
      onSelect(item.id, d.add)
      if (!d.add) onTap(item.id)
    }
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
        onPointerOver: (e: ThreeEvent<PointerEvent>) => (
          e.stopPropagation(),
          (document.body.style.cursor = selected ? 'grab' : 'pointer')
        ),
        onPointerOut: () => (document.body.style.cursor = ''),
      }
    : onPickLight
      ? {
          raycast: Mesh.prototype.raycast,
          onClick: (e: ThreeEvent<MouseEvent>) => {
            if (e.delta > CLICK_SLOP_PX) return
            e.stopPropagation()
            onPickLight(item.id)
          },
          onPointerOver: (e: ThreeEvent<PointerEvent>) => (
            e.stopPropagation(),
            (document.body.style.cursor = 'pointer')
          ),
          onPointerOut: () => (document.body.style.cursor = ''),
        }
      : { raycast: () => null }
  // Rugs are nearly flat; keep their hit box tappable.
  const hitHeight = Math.max(item.height, 0.02)
  const shape = footprint(item.model)
  // The footprint's outline round the bottom and the top, joined by uprights at its corners.
  const outline = useMemo(() => {
    const at = ([u, v]: Point, y: number): [number, number, number] => [u * item.width, y, v * item.depth]
    const edges = footprintOutline(shape)
    const corners = new Map(edges.flat().map((p) => [p.join(), p]))
    return [
      ...edges.flatMap(([a, b]) => [at(a, 0), at(b, 0), at(a, hitHeight), at(b, hitHeight)]),
      ...[...corners.values()].flatMap((p) => [at(p, 0), at(p, hitHeight)]),
    ]
  }, [shape, item.width, item.depth, hitHeight])

  return (
    <group position={[item.x, elevation + z, item.y]} rotation={[0, -item.rotation, 0]}>
      {/* The boxes are the item itself, or, for a model, its invisible hit boxes, following its footprint. */}
      {shape.map(([u0, u1, v0, v1], i) => (
        <mesh
          key={i}
          position={[((u0 + u1) / 2) * item.width, hitHeight / 2, ((v0 + v1) / 2) * item.depth]}
          castShadow={!item.model}
          receiveShadow={!item.model}
          {...handlers}
        >
          <boxGeometry args={[(u1 - u0) * item.width, hitHeight, (v1 - v0) * item.depth]} />
          {item.model ? (
            <meshBasicMaterial visible={false} />
          ) : (
            <meshStandardMaterial color={item.color} roughness={0.8} />
          )}
        </mesh>
      ))}
      {colliding &&
        shape.map(([u0, u1, v0, v1], i) => (
          <mesh
            key={i}
            position={[((u0 + u1) / 2) * item.width, hitHeight / 2, ((v0 + v1) / 2) * item.depth]}
            raycast={() => null}
          >
            <boxGeometry args={[(u1 - u0) * item.width + 0.01, hitHeight + 0.01, (v1 - v0) * item.depth + 0.01]} />
            <meshBasicMaterial color={COLLIDING} transparent opacity={0.3} depthWrite={false} />
          </mesh>
        ))}
      {(selected || colliding) && (
        <Line
          points={outline}
          segments
          color={colliding ? COLLIDING : SELECTED_OUTLINE}
          lineWidth={colliding && selected ? 3 : 2}
          raycast={() => null}
        />
      )}
      {item.model && (
        <Suspense fallback={null}>
          <FurnitureModel
            model={item.model}
            width={item.width}
            depth={item.depth}
            height={item.height}
            fabric={item.color}
            glow={glow}
            glowColor={glowColor}
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
