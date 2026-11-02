import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Mesh, Plane, Vector3, type Group } from 'three'
import type { Device, DeviceKind } from '../data/types'
import { DEVICE_KINDS } from '../devices/kinds'
import { placeDevice, snapToWall, WALL_REACH } from '../devices/place'
import { wallAngle } from '../layout/geometry'
import type { Floor, Point } from '../layout/types'
import { SELECTED_OUTLINE } from './palette'
import { visibleWallHeight } from './CutawayWall'
import { DeviceModel } from './DeviceModel'
import { applyFade, GHOST_OPACITY } from './Fade'

const CLICK_SLOP_PX = 5

/** Taps this close to a device pick it, though the device itself is much smaller. */
const HIT_RADIUS = 0.12

type DevicesProps = {
  floor: Floor
  devices: Device[]
  selectedId: string | undefined
  /** How brightly each ceiling light is lit, 0 (off) to 1. */
  glow: (id: string) => number
  /** The colour each ceiling light gives off. */
  tint: (id: string) => string
  /** Seen from straight above: wall plates get a marker on top of the wall, where they can be seen and picked. */
  plan: boolean
  /** See-through in the cutaway view, like the window shades; plan markers stay solid. */
  ghost?: boolean
  /** False unless the devices tool is on. */
  interactive: boolean
  onSelect: (id: string) => void
  onMove: (id: string, patch: Partial<Device>) => void
  onMoveEnd: () => void
  /** Set while looking round: a tap on a light picks it, to switch and set it. */
  onPickLight?: (id: string) => void
  /** Set in a room's view: a tap on any other device opens it. */
  onPickDevice?: (id: string) => void
  /** The device pointed at, while it can be picked. */
  onHoverLight?: (id: string | undefined) => void
}

type Controls = { enabled: boolean }

/** The floor's devices: plates on the walls, pucks on the ceiling. While editing them they can be dragged. */
export const Devices = ({
  floor,
  devices,
  selectedId,
  glow,
  tint,
  plan,
  ghost,
  interactive,
  onSelect,
  onMove,
  onMoveEnd,
  onPickLight,
  onPickDevice,
  onHoverLight,
}: DevicesProps) => (
  <group>
    {devices.map((device) => (
      <DeviceMesh
        key={device.id}
        device={device}
        floor={floor}
        selected={device.id === selectedId}
        glow={glow(device.id)}
        tint={tint(device.id)}
        plan={plan}
        ghost={ghost}
        interactive={interactive}
        onSelect={onSelect}
        onMove={onMove}
        onMoveEnd={onMoveEnd}
        onPickLight={onPickLight}
        onPickDevice={onPickDevice}
        onHoverLight={onHoverLight}
      />
    ))}
  </group>
)

type DeviceMeshProps = Omit<DevicesProps, 'devices' | 'selectedId' | 'glow' | 'tint'> & {
  device: Device
  selected: boolean
  glow: number
  tint: string
}

const DeviceMesh = ({
  device,
  floor,
  selected,
  glow,
  tint,
  plan,
  ghost,
  interactive,
  onSelect,
  onMove,
  onMoveEnd,
  onPickLight,
  onPickDevice,
  onHoverLight,
}: DeviceMeshProps) => {
  const model = useRef<Group>(null)
  // Reapply after a render adds model parts, preserving any fade inherited from the floor.
  useLayoutEffect(() => {
    if (model.current) applyFade(model.current)
  })
  const getState = useThree((s) => s.get)
  const level = floor.elevation + device.z
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), -level), [level])
  const drag = useRef<{ dx: number; dy: number; moved: boolean }>(undefined)
  const hit = useMemo(() => new Vector3(), [])
  const wall = device.wall && floor.walls.find((w) => w.id === device.wall!.wallId)
  const color = device.plan && device.kind === 'socket' && plan ? '#ba7c31' : DEVICE_KINDS[device.kind].color
  const pick = device.kind === 'light' ? onPickLight : onPickDevice

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
    : pick
      ? {
          raycast: Mesh.prototype.raycast,
          onClick: (e: ThreeEvent<MouseEvent>) => {
            if (e.delta > CLICK_SLOP_PX) return
            e.stopPropagation()
            pick(device.id)
          },
          onPointerOver: (e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
            onHoverLight?.(device.id)
          },
          onPointerOut: () => {
            document.body.style.cursor = ''
            onHoverLight?.(undefined)
          },
        }
      : { raycast: () => null }

  // From above, a marker on top of the wall (or just under the ceiling) where the device is.
  const offset = wall && device.plan ? 0.1 + device.z * 0.1 : 0
  const angle = wall ? wallAngle(wall) : 0
  const outSide = device.wall?.side === 'a' ? 1 : -1
  const marker = plan && (
    <mesh
      position={[
        device.x - Math.sin(angle) * offset * outSide,
        floor.elevation + Math.max(device.z, floor.height) + 0.04,
        device.y + Math.cos(angle) * offset * outSide,
      ]}
      rotation-x={-Math.PI / 2}
      {...handlers}
    >
      <circleGeometry args={[selected ? 0.12 : 0.09, 24]} />
      <meshBasicMaterial color={selected ? SELECTED_OUTLINE : color} depthTest={!device.plan} />
    </mesh>
  )
  // Round the device's middle, so it's sorted into the room with it.
  const hitSphere = (at?: [number, number, number]) => (
    <mesh position={at} {...handlers}>
      <sphereGeometry args={[HIT_RADIUS, 12, 8]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )

  const ceiling =
    !wall &&
    (device.kind === 'light' ||
      device.kind === 'fan' ||
      (device.kind === 'sensor' && (device.plan?.symbol.startsWith('OK') || /smoke/i.test(device.name))))
  const pillar = !wall && device.plan?.area === 'outside' && (device.kind === 'panel' || device.kind === 'bell')
  const rotation: [number, number, number] = wall
    ? [0, -wallAngle(wall) + (device.wall!.side === 'b' ? Math.PI : 0), 0]
    : ceiling
      ? [Math.PI / 2, 0, 0]
      : pillar
        ? [0, -Math.PI / 2, 0]
        : [0, 0, 0]
  return (
    <>
      <group
        ref={model}
        position={[device.x, level, device.y]}
        rotation={rotation}
        userData={{
          itemId: device.id,
          debug: `${device.name} · ${device.id.slice(0, 4)}`,
          fade: ghost ? GHOST_OPACITY : 1,
        }}
      >
        <DeviceModel device={device} selected={selected} glow={glow} tint={tint} wall={!!wall} />
        {hitSphere(device.plan?.area === 'roof' ? [0, 0, 0] : [0, 0, 0.03])}
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
        // A light hangs over a sofa or table as easily as over bare floor.
        userData={{ pastFurniture: kind === 'light' }}
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
          tint={DEVICE_KINDS[kind].color}
          plan={plan}
          ghost={cutaway && !plan}
          interactive={false}
          onSelect={() => {}}
          onMove={() => {}}
          onMoveEnd={() => {}}
        />
      )}
    </>
  )
}
