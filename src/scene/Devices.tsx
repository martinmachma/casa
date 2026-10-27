import { Edges } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { Mesh, Plane, Vector3 } from 'three'
import type { Device, DeviceKind } from '../data/types'
import { DEVICE_KINDS } from '../devices/kinds'
import { placeDevice, snapToWall, WALL_REACH } from '../devices/place'
import { wallAngle } from '../layout/geometry'
import type { Floor, Point } from '../layout/types'
import { BULB } from './HouseLights'
import { SELECTED_OUTLINE } from './palette'
import { visibleWallHeight } from './CutawayWall'

const CLICK_SLOP_PX = 5

/** Plate sizes on the wall, metres: width, height, depth off the face. */
const PLATES: Record<Exclude<DeviceKind, 'light'>, [number, number, number]> = {
  switch: [0.086, 0.086, 0.012],
  socket: [0.086, 0.086, 0.02],
  sensor: [0.06, 0.06, 0.04],
  thermostat: [0.1, 0.1, 0.025],
  blind: [0.12, 0.07, 0.03],
  other: [0.08, 0.08, 0.03],
}

// A lit light's face is far brighter than anything it lights.
const LIT_GLOW = 4
const LIGHT_RADIUS = 0.11
const LIGHT_DEPTH = 0.04
/** Taps this close to a device pick it, though the device itself is much smaller. */
const HIT_RADIUS = 0.12

type DevicesProps = {
  floor: Floor
  devices: Device[]
  selectedId: string | undefined
  /** How brightly the ceiling lights are lit, 0 (off) to 1. */
  glow: number
  /** Seen from straight above: wall plates get a marker on top of the wall, where they can be seen and picked. */
  plan: boolean
  /** False unless the devices tool is on. */
  interactive: boolean
  onSelect: (id: string) => void
  onMove: (id: string, patch: Partial<Device>) => void
  onMoveEnd: () => void
}

type Controls = { enabled: boolean }

/** The floor's devices: plates on the walls, pucks on the ceiling. While editing them they can be dragged. */
export const Devices = ({
  floor,
  devices,
  selectedId,
  glow,
  plan,
  interactive,
  onSelect,
  onMove,
  onMoveEnd,
}: DevicesProps) => (
  <group>
    {devices.map((device) => (
      <DeviceMesh
        key={device.id}
        device={device}
        floor={floor}
        selected={device.id === selectedId}
        glow={glow}
        plan={plan}
        interactive={interactive}
        onSelect={onSelect}
        onMove={onMove}
        onMoveEnd={onMoveEnd}
      />
    ))}
  </group>
)

type DeviceMeshProps = Omit<DevicesProps, 'devices' | 'selectedId'> & { device: Device; selected: boolean }

const DeviceMesh = ({
  device,
  floor,
  selected,
  glow,
  plan,
  interactive,
  onSelect,
  onMove,
  onMoveEnd,
}: DeviceMeshProps) => {
  const getState = useThree((s) => s.get)
  const level = floor.elevation + device.z
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), -level), [level])
  const drag = useRef<{ dx: number; dy: number; moved: boolean }>(undefined)
  const hit = useMemo(() => new Vector3(), [])
  const wall = device.wall && floor.walls.find((w) => w.id === device.wall!.wallId)
  const color = DEVICE_KINDS[device.kind].color

  const setControlsEnabled = (enabled: boolean) => {
    const controls = getState().controls as Controls | null
    if (controls) controls.enabled = enabled
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onSelect(device.id)
    if (!e.ray.intersectPlane(plane, hit)) return
    // Wall devices follow the pointer itself (it's snapped to the wall); ceiling ones keep their grab offset.
    drag.current = wall ? { dx: 0, dy: 0, moved: false } : { dx: hit.x - device.x, dy: hit.z - device.y, moved: false }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setControlsEnabled(false)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d || !e.ray.intersectPlane(plane, hit)) return
    e.stopPropagation()
    d.moved = true
    const p: Point = [hit.x - d.dx, hit.z - d.dy]
    if (!device.wall) return onMove(device.id, { x: p[0], y: p[1] })
    // Along its own wall, or onto another one the pointer comes close to.
    const mount =
      snapToWall(p, floor, device.z, WALL_REACH / 2) ?? snapToWall(p, floor, device.z, Infinity, device.wall)
    if (mount) onMove(device.id, mount)
  }

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current
    if (!d) return
    drag.current = undefined
    ;(e.target as Element).releasePointerCapture(e.pointerId)
    setControlsEnabled(true)
    if (d.moved) onMoveEnd()
  }

  const handlers = interactive
    ? {
        raycast: Mesh.prototype.raycast,
        onPointerDown,
        onPointerMove,
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        onPointerOver: (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), (document.body.style.cursor = 'grab')),
        onPointerOut: () => (document.body.style.cursor = ''),
      }
    : { raycast: () => null }

  const material = (
    <meshStandardMaterial
      color={color}
      roughness={0.5}
      emissive={device.kind !== 'light' ? '#000000' : glow > 0 ? BULB : color}
      emissiveIntensity={device.kind === 'light' ? Math.max(0.35, glow * LIT_GLOW) : 0}
    />
  )
  const outline = selected && <Edges color={SELECTED_OUTLINE} lineWidth={2} />
  // From above, a marker on top of the wall (or just under the ceiling) where the device is.
  const marker = plan && (
    <mesh
      position={[device.x, floor.elevation + Math.max(device.z, floor.height) + 0.02, device.y]}
      rotation-x={-Math.PI / 2}
      raycast={() => null}
    >
      <circleGeometry args={[selected ? 0.12 : 0.09, 24]} />
      <meshBasicMaterial color={selected ? SELECTED_OUTLINE : color} />
    </mesh>
  )
  const hitSphere = (
    <mesh {...handlers}>
      <sphereGeometry args={[HIT_RADIUS, 12, 8]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )

  if (device.kind === 'light' || !wall) {
    return (
      <>
        <group position={[device.x, level, device.y]}>
          <mesh position={[0, -LIGHT_DEPTH / 2, 0]} castShadow raycast={() => null}>
            {device.kind === 'light' ? (
              <cylinderGeometry args={[LIGHT_RADIUS, LIGHT_RADIUS * 0.9, LIGHT_DEPTH, 24]} />
            ) : (
              <boxGeometry args={[0.08, 0.08, 0.08]} />
            )}
            {material}
            {outline}
          </mesh>
          {hitSphere}
        </group>
        {marker}
      </>
    )
  }

  // Wall-local axes: x along the wall, +z out of side 'a' (as in FloorWalls).
  const [w, h, depth] = PLATES[device.kind]
  const out = device.wall!.side === 'a' ? 1 : -1
  return (
    <>
      <group position={[device.x, level, device.y]} rotation={[0, -wallAngle(wall), 0]}>
        <mesh position={[0, 0, (out * depth) / 2]} castShadow raycast={() => null}>
          <boxGeometry args={[w, h, depth]} />
          {material}
          {outline}
        </mesh>
        {hitSphere}
      </group>
      {marker}
    </>
  )
}

type DevicePlacerProps = {
  floor: Floor
  kind: DeviceKind
  onPlace: (device: Omit<Device, 'id' | 'name'>) => void
  cutaway: boolean
  /** Seen from straight above, as for Devices. */
  plan: boolean
}

/**
 * Catches taps while a device kind is picked, showing the device where a tap would put it. The pointer is read at
 * the kind's height (a socket's tap on a wall lands on that wall), then a light goes on the ceiling there and
 * anything else onto the nearest wall face.
 */
export const DevicePlacer = ({ floor, kind, onPlace, cutaway, plan }: DevicePlacerProps) => {
  const camera = useThree((s) => s.camera)
  const kindHeight = DEVICE_KINDS[kind].height
  // Lights are placed where the floor was tapped, the way a plan is read.
  const level = floor.elevation + (kindHeight === 'ceiling' ? 0 : kindHeight)
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), -level), [level])
  const hit = useMemo(() => new Vector3(), [])
  const [preview, setPreview] = useState<Omit<Device, 'id' | 'name'>>()

  const placement = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (!e.ray.intersectPlane(plane, hit)) return undefined
    const visibleFloor =
      cutaway && kindHeight !== 'ceiling'
        ? {
            ...floor,
            walls: floor.walls.filter((wall) => visibleWallHeight(wall, floor, camera, cutaway) >= kindHeight),
          }
        : floor
    return placeDevice(kind, [hit.x, hit.z], visibleFloor)
  }

  return (
    <>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, floor.elevation + 0.01, 0]}
        onClick={(e) => {
          if (e.delta > CLICK_SLOP_PX) return
          e.stopPropagation()
          const placed = placement(e)
          if (placed) onPlace(placed)
        }}
        onPointerMove={(e) => setPreview(placement(e))}
        onPointerOver={() => (document.body.style.cursor = 'crosshair')}
        onPointerOut={() => {
          document.body.style.cursor = ''
          setPreview(undefined)
        }}
      >
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {preview && (
        <DeviceMesh
          device={{ ...preview, id: 'placing', name: '' }}
          floor={floor}
          selected
          glow={0}
          plan={plan}
          interactive={false}
          onSelect={() => {}}
          onMove={() => {}}
          onMoveEnd={() => {}}
        />
      )}
    </>
  )
}
