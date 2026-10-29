import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState, type RefObject } from 'react'
import { MathUtils, MOUSE, Spherical, TOUCH, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Device, DeviceKind, FurnitureItem } from '../data/types'
import type { HouseData } from '../data/useHouseData'
import { colliding } from '../furniture/collision'
import { floorSnapWalls, snapGroupToWalls } from '../furniture/snap'
import { floorBounds } from '../layout/geometry'
import { floorRegions } from '../layout/rooms'
import type { Floor, WallFace } from '../layout/types'
import { roomBox, roomWallSides } from '../rooms/roomViews'
import type { Focus } from './CutawayWall'
import { InputInvalidator } from './InputInvalidator'
import { Fade } from './Fade'
import { DevicePlacer, Devices } from './Devices'
import { FloorWalls } from './FloorWalls'
import { FurnitureBox, type ItemActions } from './FurnitureBox'
import { Outdoor } from './Outdoor'
import { HouseShadow } from './HouseShadow'
import { slabGeometry } from './prism'
import { Railings, Stairs } from './Stairs'
import { Roof } from './Roof'
import { house } from '../layout/layout'
import { FLOOR_SLAB } from './palette'
import type { SunPosition } from '../sun/sun'
import { daylight, Lights } from './Lights'
import { HouseLights, isLamp } from './HouseLights'
import { lightColor, lightLevel, type LightState } from '../devices/lights'
import { MeasureTool } from './MeasureTool'
import { Compass, CompassTracker } from './Compass'
import { WalkCamera } from './WalkCamera'
import { AnnotationLabels, AnnotationProjector, type Annotation } from './Annotations'
import { clearances } from '../measure/clearance'
import { distance, formatLength, type MeasuredLine, type MeasurePick, type Measurement } from '../measure/measure'
import { floorWallRects } from '../layout/rooms'
import { Line } from '@react-three/drei'
import { SELECTED_OUTLINE } from './palette'
import { RoomFloors } from './RoomFloors'
import { NEAR_PACE, type CameraNudge } from './cameraNudge'
import { CameraNudger } from './CameraNudger'
import { intro } from './intro'
import { FloorPointerTracker, type FloorPointer } from './FloorPointer'
import type { CameraMode, Interaction, Selection } from './selection'
import { FocusProjector, RoomCamera, type Pin } from './RoomFocus'

// Thick enough to close the gap between a floor's walls and the floor above (2.6 m walls, 2.9 m storey).
const SLAB = 0.3

type HouseSceneProps = {
  floorPointer: FloorPointer
  floors: Floor[]
  floorIndex: number
  onWalkFloorChange: (index: number) => void
  /** The whole house from outside, roof and all; nothing inside is shown or pickable. */
  outside: boolean
  camera: CameraMode
  /** In the 3D view, hide the walls nearest the camera so you can see inside. */
  cutaway: boolean
  data: HouseData
  /** What a tap does: nothing (just looking), select and drag (editing), or measure. */
  interaction: Interaction
  selection: Selection | undefined
  wallSnap: boolean
  furnitureSnap: boolean
  /** Sun position for sunlight, or undefined for even light. */
  sun: SunPosition | undefined
  north: number
  /** The measurement in progress; undefined when not measuring. */
  measure: Measurement | undefined
  onMeasurePick: (pick: MeasurePick) => void
  /** Finished measurements; those on this floor are drawn with a removable length. */
  measurements: MeasuredLine[]
  onRemoveMeasurement: (id: string) => void
  /** The device kind the next tap places, while the devices tool is on. */
  placing: DeviceKind | undefined
  /** Lights switched by hand, by device or lamp id; the rest come on after dark. */
  lights: Readonly<Record<string, LightState>>
  /** A light or lamp tapped while looking round. */
  onPickLight: (id: string) => void
  onPlaceDevice: (device: Omit<Device, 'id' | 'name'>) => void
  nudge: RefObject<CameraNudge>
  /** Changing it puts the camera back to its starting view. */
  viewKey: number
  onSelect: (selection: Selection | undefined) => void
  /** The selected item's floating buttons. */
  itemActions: ItemActions
  /** A room seen on its own: the camera is fixed on it and the rest of the house blurred. */
  focusRoom?: string
  /** Elements kept over points in the focused room. */
  pins?: Pin[]
  pinRefs?: RefObject<Map<string, HTMLElement | null>>
}

export const HouseScene = ({
  floorPointer,
  floors,
  floorIndex,
  onWalkFloorChange,
  outside,
  camera,
  cutaway,
  data,
  interaction,
  selection,
  wallSnap,
  furnitureSnap,
  sun,
  north,
  measure,
  onMeasurePick,
  measurements,
  onRemoveMeasurement,
  placing,
  lights,
  onPickLight,
  onPlaceDevice,
  nudge,
  viewKey,
  onSelect,
  itemActions,
  focusRoom,
  pins = [],
  pinRefs,
}: HouseSceneProps) => {
  const blur = useRef<HTMLDivElement>(null)
  const noPins = useRef(new Map<string, HTMLElement | null>())
  const [openDoors, setOpenDoors] = useState<ReadonlySet<string>>(() => new Set())
  const toggleDoor = (id: string) =>
    setOpenDoors((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const floor = floors[floorIndex]
  // Floors above the one looked at are left off; one taken off fades out, one put back fades in.
  const shownCount = camera === 'walk' ? floors.length : floorIndex + 1
  // What's on a floor (furniture, devices, measurements) shows on the floor looked at, or all of them walking.
  const furnished = (f: Floor) => !outside && (camera === 'walk' || f.id === floor.id)
  const snapWalls = useMemo(() => floorSnapWalls(floor), [floor])
  // Looking at a room, the walls between the camera and its middle are always cut, and only those.
  const focusPoint = useMemo((): Focus | undefined => {
    const box = focusRoom ? roomBox(floor, focusRoom) : undefined
    if (!box || !focusRoom) return undefined
    return {
      center: [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2],
      sides: roomWallSides(floor, focusRoom),
    }
  }, [floor, focusRoom])
  const { min, max } = floorBounds(floor)
  const cx = (min[0] + max[0]) / 2
  const cz = (min[1] + max[1]) / 2

  const items = outside ? [] : data.furniture.filter((f) => camera === 'walk' || f.floor === floor.id)
  // After dark the house's own lights come on, on every floor that's shown.
  const dark = 1 - daylight(sun)
  const level = (id: string) => lightLevel(lights[id], dark)
  const tint = (id: string) => lightColor(lights[id])
  // While looking round, a tap on a light or lamp picks it, to switch and set it.
  const lightPick = interaction === 'view' ? onPickLight : undefined
  const pickedLight = selection?.kind === 'light' ? selection.id : undefined
  const litFloors = floors.slice(0, outside || camera === 'walk' ? floors.length : floorIndex + 1)

  // While a piece is selected (and while it's dragged), how far each side is from the walls.
  const selectedIds = selection?.kind === 'furniture' ? selection.ids : []
  const selectedItem = selectedIds.length === 1 ? items.find((f) => f.id === selectedIds[0]) : undefined
  const wallRects = useMemo(() => floorWallRects(floor), [floor])
  // Measuring uses its own floor and wall targets.
  const pickable = interaction === 'edit'
  // While arranging, anything that runs into a wall or another piece is marked.
  const clashes = pickable ? colliding(items, wallRects) : new Set<string>()
  const gaps = selectedItem ? clearances(selectedItem, wallRects).filter((g) => g.distance > 0.005) : []
  const gapY = floor.elevation + 0.05
  const lines = outside ? [] : measurements.filter((m) => m.floor === floor.id)
  const lineY = floor.elevation + 0.03
  const annotations = [
    ...lines.map((m): Annotation => ({
      key: m.id,
      at: [(m.from[0] + m.to[0]) / 2, lineY, (m.from[1] + m.to[1]) / 2],
      text: formatLength(distance(m.from, m.to)) + (m.parallel ? '' : ' ∠'),
      kind: 'measure',
      onRemove: () => onRemoveMeasurement(m.id),
    })),
    ...gaps.map((g, i): Annotation => ({
      key: `gap${i}`,
      at: [(g.from[0] + g.to[0]) / 2, gapY, (g.from[1] + g.to[1]) / 2],
      text: formatLength(g.distance),
      kind: 'gap',
    })),
  ]

  const needle = useRef<HTMLDivElement>(null)
  const annotationRefs = useRef(new Map<string, HTMLDivElement | null>())

  const pickWall = (wallId: string, side: WallFace, part: number) => onSelect({ kind: 'wall', wallId, side, part })
  // A group moves together by however far the grabbed piece went.
  // Pieces may overlap walls and each other; overlaps are only highlighted.
  const moveItem = (id: string, placement: Pick<FurnitureItem, 'x' | 'y' | 'rotation'>) => {
    const grabbed = items.find((f) => f.id === id)
    if (!grabbed) return
    if (selectedIds.length < 2) {
      return data.patchFurniture(id, placement, `move:${id}`)
    }
    const dx = placement.x - grabbed.x
    const dy = placement.y - grabbed.y
    const moved = items.filter((f) => selectedIds.includes(f.id))
    const proposed = moved.map((f) => ({ ...f, x: f.x + dx, y: f.y + dy }))
    const [sx, sy] = wallSnap ? snapGroupToWalls(proposed, snapWalls) : [0, 0]
    data.patchFurnitures(
      new Map(proposed.map((f) => [f.id, { x: f.x + sx, y: f.y + sy }])),
      `move:${selectedIds.join()}`,
    )
  }
  // Shift/⌘-tap adds or removes; a plain tap on a piece of the group keeps the group, so it can be dragged.
  const pickItem = (id: string, add: boolean) => {
    if (add) {
      const ids = selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id]
      onSelect(ids.length ? { kind: 'furniture', ids } : undefined)
    } else if (!selectedIds.includes(id)) onSelect({ kind: 'furniture', ids: [id] })
  }
  const saveItem = () => data.endEdit()
  const moveDevice = (id: string, patch: Partial<Device>) => data.patchDevice(id, patch, `device:${id}`)

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop="demand"
        onPointerMissed={() => (pickable || interaction === 'devices' || pickedLight) && onSelect(undefined)}
      >
        <InputInvalidator />
        <FloorPointerTracker elevation={floor.elevation} pointRef={floorPointer} />
        {focusRoom ? (
          <RoomCamera
            floor={floor}
            roomId={focusRoom}
            from={
              lastView.mode === 'orbit'
                ? { position: lastView.position.clone(), target: lastView.target.clone() }
                : undefined
            }
          />
        ) : camera === 'walk' ? (
          <WalkCamera
            key={viewKey}
            floor={floor}
            floors={floors}
            onFloorChange={onWalkFloorChange}
            furniture={data.furniture}
            nudge={nudge}
            openDoors={openDoors}
          />
        ) : (
          <CameraRig
            key={`${camera}-${outside ? 'outside' : floor.id}-${viewKey}`}
            mode={camera}
            floor={outside ? floors[0] : floor}
            houseHeight={outside ? roofTop(floors) : undefined}
            viewKey={viewKey}
          />
        )}
        {focusRoom ? (
          <FocusProjector
            floor={floor}
            roomId={focusRoom}
            mask={blur}
            cutaway
            pins={pins}
            pinRefs={pinRefs ?? noPins}
          />
        ) : (
          <CameraNudger nudge={nudge} />
        )}
        <Lights sun={sun} north={north} center={[cx, floor.elevation, cz]} />
        <HouseLights floors={litFloors} devices={data.devices} furniture={data.furniture} level={level} tint={tint} />
        <CompassTracker north={north} needle={needle} />

        {house.outdoor && <Outdoor outdoor={house.outdoor} />}
        <HouseShadow floors={floors} roof={house.roof} openDoors={openDoors} />

        {/* Walking shows the connected floors, including the landing and the slab overhead. */}
        {floors.map((f, i) => (
          <Fade key={f.id} shown={i < shownCount}>
            {/* The ground floor's slab reaches down into the garden, so the house stands on the ground. */}
            <Slab
              floor={f}
              depth={i === 0 && house.outdoor ? Math.max(SLAB, f.elevation - house.outdoor.level + 0.1) : SLAB}
            />
            {floors[i + 1] && (
              <Stairs
                floor={f}
                next={floors[i + 1]}
                cut={i === floorIndex && !outside && camera !== 'walk' ? f.height : undefined}
              />
            )}
            <Railings floor={f} />
            <RoomFloors
              floor={f}
              regions={floorRegions(f)}
              materials={data.roomFloors}
              selectedRoom={selection?.kind === 'room' ? selection.roomId : undefined}
              interactive={pickable && f.id === floor.id}
              onPick={(roomId) => onSelect({ kind: 'room', roomId })}
            />
            <FloorWalls
              floor={f}
              colors={data.wallColors}
              selection={selection}
              interactive={pickable && (outside || f.id === floor.id)}
              doors={!measure && (outside || f.id === floor.id)}
              openDoors={openDoors}
              onToggleDoor={toggleDoor}
              cutaway={(cutaway || !!focusRoom) && (camera === 'orbit' || !!focusRoom) && !outside && f.id === floor.id}
              focus={focusPoint}
              onPick={pickWall}
            />
          </Fade>
        ))}

        <Fade shown={outside}>{house.roof && <Roof roof={house.roof} floor={floors[floors.length - 1]} />}</Fade>

        {interaction === 'devices' && placing && !outside && (
          <DevicePlacer
            floor={floor}
            kind={placing}
            onPlace={onPlaceDevice}
            cutaway={cutaway && camera === 'orbit'}
            plan={camera === 'top'}
          />
        )}
        {floors.map((f) => (
          <Fade key={f.id} shown={furnished(f)}>
            <Devices
              floor={f}
              devices={data.devices.filter((d) => d.floor === f.id && f.id === floor.id)}
              selectedId={selection?.kind === 'device' ? selection.id : pickedLight}
              glow={level}
              tint={tint}
              plan={camera === 'top'}
              onPickLight={lightPick}
              interactive={interaction === 'devices' && !placing}
              onSelect={(id) => onSelect({ kind: 'device', id })}
              onMove={moveDevice}
              onMoveEnd={saveItem}
            />
            {measurements
              .filter((m) => m.floor === f.id)
              .map((m) => (
                <Line
                  key={m.id}
                  points={[
                    [m.from[0], f.elevation + 0.03, m.from[1]],
                    [m.to[0], f.elevation + 0.03, m.to[1]],
                  ]}
                  color={SELECTED_OUTLINE}
                  lineWidth={3}
                />
              ))}
            {data.furniture
              .filter((item) => item.floor === f.id)
              .map((item) => (
                <FurnitureBox
                  key={item.id}
                  item={item}
                  glow={isLamp(item.model) ? level(item.id) : 0}
                  glowColor={tint(item.id)}
                  onPickLight={isLamp(item.model) ? lightPick : undefined}
                  elevation={f.elevation}
                  selected={selectedIds.includes(item.id) || pickedLight === item.id}
                  colliding={clashes.has(item.id)}
                  showActions={selectedIds[selectedIds.length - 1] === item.id}
                  interactive={pickable}
                  // Group snapping is applied to the shared translation in moveItem.
                  wallSnap={wallSnap && selectedIds.length < 2}
                  furnitureSnap={furnitureSnap && selectedIds.length < 2}
                  snapWalls={wallSnap ? snapWalls : undefined}
                  snapItems={items}
                  onSelect={pickItem}
                  onMove={moveItem}
                  onMoveEnd={saveItem}
                  onTap={(id) => selectedIds.length > 1 && onSelect({ kind: 'furniture', ids: [id] })}
                  actions={itemActions}
                />
              ))}
          </Fade>
        ))}
        {measure && (
          <MeasureTool
            floor={floor}
            items={items}
            measure={measure}
            onPick={onMeasurePick}
            cutaway={cutaway && camera === 'orbit' && !outside}
          />
        )}

        <AnnotationProjector items={annotations} refs={annotationRefs} />
        {gaps.map((g, i) => (
          <Line
            key={i}
            points={[
              [g.from[0], gapY, g.from[1]],
              [g.to[0], gapY, g.to[1]],
            ]}
            color={SELECTED_OUTLINE}
            lineWidth={2}
            dashed
            dashSize={0.08}
            gapSize={0.05}
          />
        ))}
      </Canvas>
      {focusRoom && <div className="room-blur" ref={blur} />}
      <AnnotationLabels items={annotations} refs={annotationRefs} />
      {!focusRoom && <Compass needle={needle} />}
    </>
  )
}

/** The floor's outline (its walls' bounding box if it has none), with its voids as holes. */
const Slab = ({ floor, color = FLOOR_SLAB, depth = SLAB }: { floor: Floor; color?: string; depth?: number }) => {
  const geometry = useMemo(() => slabGeometry(floor, depth), [floor, depth])
  return (
    <mesh geometry={geometry} position={[0, floor.elevation, 0]} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  )
}

/** How high the house stands: the top floor's walls plus the flat roof and its parapet. */
const roofTop = (floors: Floor[]) => {
  const top = floors[floors.length - 1]
  return top.elevation + top.height + SLAB + (house.roof?.parapet ?? 0)
}

type CameraRigProps = {
  mode: Exclude<CameraMode, 'walk'>
  floor: Floor
  /** Set from outside: the whole house this tall has to fit, seen from lower down. */
  houseHeight?: number
  /** Bumped by Reset view, which starts the camera afresh instead of keeping where it was. */
  viewKey: number
}

type Pose = { position: Vector3; target: Vector3 }

/** Where the orbit camera starts for a floor, or for the whole house when it's this tall. */
const orbitPose = (floor: Floor, aspect: number, houseHeight?: number): Pose => {
  const { min, max } = floorBounds(floor)
  const cx = (min[0] + max[0]) / 2
  const cz = (min[1] + max[1]) / 2
  const span = Math.max(max[0] - min[0], max[1] - min[1])
  // A portrait phone sees less sideways; step back so the whole house fits.
  const back = span * Math.max(1, 0.75 / aspect)
  // From outside, the whole house: look at its middle from further away and lower down.
  const look = floor.elevation + (houseHeight ? houseHeight / 2 : 0.8)
  const away = houseHeight ? Math.max(back, houseHeight) * 1.3 : back
  const up = houseHeight ? look + away * 0.55 : floor.elevation + back * 1.1
  return { position: new Vector3(cx + away * 0.8, up, cz + away * 1.25), target: new Vector3(cx, look, cz) }
}

/** The last orbit or top camera, so switching floors or to the whole house keeps the view. */
const lastView = { mode: '', viewKey: -1, position: new Vector3(), target: new Vector3(), zoom: 1 }

const CameraRig = ({ mode, floor, houseHeight, viewKey }: CameraRigProps) => {
  const size = useThree((s) => s.size)
  // Chosen once: carried over from the previous floor's camera, or this view's own start
  // (after Reset view, or a change between 3D and top). Resizing doesn't move it.
  const [start] = useState(() => {
    if (lastView.mode === mode && lastView.viewKey === viewKey)
      return { position: lastView.position.clone(), target: lastView.target.clone(), zoom: lastView.zoom }
    const { min, max } = floorBounds(floor)
    const cx = (min[0] + max[0]) / 2
    const cz = (min[1] + max[1]) / 2
    const span = Math.max(max[0] - min[0], max[1] - min[1])
    if (mode === 'top')
      return {
        // Straight down with north at the top; the tiny z offset keeps OrbitControls' math stable.
        position: new Vector3(cx, floor.elevation + 40, cz + 0.001),
        target: new Vector3(cx, floor.elevation, cz),
        zoom: Math.min(size.width, size.height) / (span * 1.35),
      }
    return { ...orbitPose(floor, size.width / size.height, houseHeight), zoom: 1 }
  })
  useFrame(({ camera, controls }) => {
    if (!controls) return
    const orbit = controls as OrbitControlsImpl
    // Panning and zooming scale with the distance to the target, so close in they'd crawl.
    // Speed them up there to keep the pace they have this far out.
    if (mode === 'orbit') {
      const boost = Math.max(1, NEAR_PACE / camera.position.distanceTo(orbit.target))
      orbit.panSpeed = boost
      orbit.zoomSpeed = boost
    }
    Object.assign(lastView, { mode, viewKey, zoom: camera.zoom })
    lastView.position.copy(camera.position)
    lastView.target.copy(orbit.target)
  })

  if (mode === 'top') {
    // The plan stays put sideways and in zoom; only its height follows the floor.
    const position = start.position.clone().setY(floor.elevation + 40)
    const target = start.target.clone().setY(floor.elevation)
    return (
      <>
        <OrthographicCamera makeDefault position={position.toArray()} zoom={start.zoom} near={0.1} far={200} />
        <OrbitControls
          makeDefault
          target={target.toArray()}
          enableRotate={false}
          screenSpacePanning
          mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
          touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
        />
      </>
    )
  }

  return (
    <>
      <PerspectiveCamera makeDefault position={start.position.toArray()} fov={45} near={0.1} far={200} />
      <OrbitControls makeDefault target={start.target.toArray()} maxPolarAngle={Math.PI / 2.05} minDistance={0.5} />
      <IntroFlight />
    </>
  )
}

const INTRO_SECONDS = 2.2
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/**
 * Starts high above the house looking straight down with the house square on, drops towards it,
 * and from about halfway down swings round and tilts into the view the camera was set up with.
 */
const IntroFlight = () => {
  // Stays mounted through re-renders; only the first camera of the session flies in.
  const flight = useRef<{ end: Spherical; start: Spherical; t: number }>(undefined)

  useFrame(({ camera, controls: active, invalidate }, delta) => {
    const controls = active as OrbitControlsImpl | null
    if (!controls) return
    if (!flight.current) {
      const pending = intro.pending
      intro.pending = false
      const end = new Spherical().setFromVector3(camera.position.clone().sub(controls.target))
      // The tiny angle keeps the overhead view's orientation stable.
      const start = new Spherical(end.radius * 2.2, 0.001, 0)
      flight.current = { end, start, t: pending ? 0 : 1 }
      if (!pending) return
      controls.enabled = false
    }
    const f = flight.current
    if (f.t >= 1) return
    f.t = Math.min(1, f.t + delta / INTRO_SECONDS)
    invalidate()
    const down = easeInOut(f.t)
    const turn = easeInOut(Math.max(0, (f.t - 0.45) / 0.55))
    const at = new Spherical(
      MathUtils.lerp(f.start.radius, f.end.radius, down),
      MathUtils.lerp(f.start.phi, f.end.phi, turn),
      MathUtils.lerp(f.start.theta, f.end.theta, turn),
    )
    camera.position.setFromSpherical(at).add(controls.target)
    camera.lookAt(controls.target)
    if (f.t >= 1) {
      controls.enabled = true
      controls.update()
    }
  })
  return null
}
