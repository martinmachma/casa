import { Line, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { MathUtils, MOUSE, Spherical, TOUCH, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Device, FurnitureItem, NewFurnitureItem } from '../data/types'
import type { HouseData } from '../data/useHouseData'
import type { DevicePlacement } from '../devices/kinds'
import { lightColor, lightLevel, type LightState } from '../devices/lights'
import type { ShadeState } from '../devices/shades'
import { blockedDoors, colliding, doorSweeps, fixtureSolids, sweepOutline } from '../furniture/collision'
import { floorSnapWalls, snapGroupToWalls } from '../furniture/snap'
import { floorBounds, shadeWall } from '../layout/geometry'
import { groundLevel } from '../layout/ground'
import { house } from '../layout/layout'
import { floorRegions, floorWallRects } from '../layout/rooms'
import type { Floor } from '../layout/types'
import { clearances } from '../measure/clearance'
import { distance, formatLength, type MeasuredLine, type Measurement, type MeasurePick } from '../measure/measure'
import { roomBox, roomWallSides } from '../rooms/roomViews'
import type { SunPosition } from '../sun/sun'
import { AmbientOcclusion } from './AmbientOcclusion'
import { AnnotationLabels, AnnotationProjector, type Annotation } from './Annotations'
import { NEAR_PACE, PAN_SPEED, ZOOM_SPEED, type CameraNudge } from './cameraNudge'
import { CameraNudger } from './CameraNudger'
import { Compass, CompassTracker } from './Compass'
import type { Focus } from './CutawayWall'
import { DebugHover } from './DebugHover'
import { DevicePlacer, Devices } from './Devices'
import { ElectricalRoutes } from './ElectricalRoutes'
import { Fade } from './Fade'
import { Fixtures } from './Fixtures'
import { FloorPointerTracker, type FloorPointer } from './FloorPointer'
import { FloorWalls, type Brush, type PaintFace, type PaintStroke } from './FloorWalls'
import { FurnitureBox, type ItemActions } from './FurnitureBox'
import { FurniturePlacer } from './FurniturePlacer'
import { HouseLights, isLamp } from './HouseLights'
import { HouseShadow } from './HouseShadow'
import { InputInvalidator } from './InputInvalidator'
import { intro } from './intro'
import { ItemOutline } from './ItemOutline'
import { daylight, Lights } from './Lights'
import { MeasureTool } from './MeasureTool'
import { MotionQuality } from './MotionQuality'
import { Outdoor } from './Outdoor'
import { COLLIDING, DOOR_SWEEP, FLOOR_SLAB, SELECTED_OUTLINE } from './palette'
import { OVERLAY, reachable } from './pick'
import { slabGeometry } from './prism'
import { Roof } from './Roof'
import { RoomBlur } from './RoomBlur'
import { RoomFloors } from './RoomFloors'
import { FocusProjector, RoomCamera, type Pin } from './RoomFocus'
import type { CameraMode, Interaction, Selection } from './selection'
import { ShadowUpdates } from './ShadowUpdates'
import { Railings, Stairs } from './Stairs'
import { WalkCamera } from './WalkCamera'
import { ZoomToSurface } from './ZoomToSurface'

// Thick enough to close the gap between a floor's walls and the floor above (2.6 m walls, 2.9 m storey).
const SLAB = 0.3

type HouseSceneProps = {
  floorPointer: FloorPointer
  floors: Floor[]
  floorIndex: number
  onWalkFloorChange: (index: number) => void
  /** The whole house from outside, roof and all; what's inside shows through the windows but can't be picked. */
  outside: boolean
  camera: CameraMode
  /** In the 3D view, hide the walls nearest the camera so you can see inside. */
  cutaway: boolean
  electrical: boolean
  data: HouseData
  /** What a tap does: nothing (just looking), select and drag (editing), measure, or paint walls. */
  interaction: Interaction
  /** What painting puts on the walls. */
  brush: Brush
  onPaint: (stroke: PaintStroke) => void
  onPaintWall: (face: PaintFace) => void
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
  placing: DevicePlacement | undefined
  /** Lights switched by hand, by device or lamp id; the rest come on after dark. */
  lights: Readonly<Record<string, LightState>>
  /** A light or lamp tapped while looking round. */
  onPickLight: (id: string) => void
  /** The windows' outside shades, by shade id; those nobody has moved are up. */
  shades: Readonly<Record<string, ShadeState>>
  /** A shade tapped while looking round. */
  onPickShade: (id: string) => void
  onPlaceDevice: (device: Omit<Device, 'id' | 'name'>) => void
  /** A new piece carried under the pointer until a tap puts it down. */
  placingPiece: Omit<NewFurnitureItem, 'x' | 'y'> | undefined
  onPlacePiece: (at: Pick<FurnitureItem, 'x' | 'y' | 'rotation'>) => void
  nudge: RefObject<CameraNudge>
  /** Changing it puts the camera back to its starting view. */
  viewKey: number
  onSelect: (selection: Selection | undefined) => void
  /** The selected item's floating buttons. */
  itemActions: ItemActions
  /** A room seen on its own: the camera is fixed on it and the rest of the house blurred. */
  focusRoom?: string
  /** An item opened from outside a room: keep the house's camera to return to after closing it. */
  temporaryFocus?: boolean
  /** Elements kept over points in the focused room. */
  pins?: Pin[]
  /** The smart item opened in the focused room: everything else is dimmed behind it. */
  open?: string
  /** The smart item pointed at, outlined. */
  hovered?: string
  /** A smart item pointed at in the focused room. */
  onHoverItem?: (id: string | undefined) => void
  pinRefs?: RefObject<Map<string, HTMLElement | null>>
}

const NO_BLOCKED = new Map<string, string[]>()

export const HouseScene = ({
  floorPointer,
  floors,
  floorIndex,
  onWalkFloorChange,
  outside,
  camera,
  cutaway,
  electrical,
  data,
  interaction,
  brush,
  onPaint,
  onPaintWall,
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
  shades,
  onPickShade,
  onPlaceDevice,
  placingPiece,
  onPlacePiece,
  nudge,
  viewKey,
  onSelect,
  itemActions,
  focusRoom,
  temporaryFocus,
  pins = [],
  open,
  hovered,
  onHoverItem,
  pinRefs,
}: HouseSceneProps) => {
  const noPins = useRef(new Map<string, HTMLElement | null>())
  useEffect(() => {
    if (!focusRoom && camera === 'walk') lastView.returnFrom = undefined
  }, [focusRoom, camera])
  const [openDoors, setOpenDoors] = useState<ReadonlySet<string>>(() => new Set())
  const toggleDoor = (id: string) =>
    setOpenDoors((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const floor = floors[floorIndex]
  // A window's shade opened is seen from outside on the whole house: every floor and the roof, nothing cut or dimmed.
  const whole = !!open && !!shadeWall(open)
  const closeUp = open ? pins.find((p) => p.key === `tag:${open}`) : undefined
  // Floors above the one looked at are left off; one taken off fades out, one put back fades in.
  const shownCount = camera === 'walk' || whole ? floors.length : floorIndex + 1
  // What's on a floor (furniture, devices, measurements) shows on the floor looked at, or all of them walking.
  // From outside, on every floor that's shown, to be seen through the windows.
  const furnished = (f: Floor) => camera === 'walk' || (outside ? floors.indexOf(f) < shownCount : f.id === floor.id)
  // Furniture is arranged on the floor looked at; from outside, on the ground floor and round it in the garden.
  const furnitureFloor = outside ? floors[0] : floor
  const ground = (f: Floor, p: [number, number]) => (f === floors[0] ? groundLevel(f, house.outdoor, p) : f.elevation)
  const snapWalls = useMemo(() => floorSnapWalls(furnitureFloor), [furnitureFloor])
  // Looking at a room, the walls between the camera and its middle are always cut, and only those.
  const focusPoint = useMemo((): Focus | undefined => {
    const box = focusRoom ? roomBox(floor, focusRoom) : undefined
    if (!box || !focusRoom || whole) return undefined
    return {
      center: [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2],
      box: roomBox(floor, focusRoom, 0)!,
      sides: roomWallSides(floor, focusRoom),
    }
  }, [floor, focusRoom, whole])
  const { min, max } = floorBounds(floor)
  const cx = (min[0] + max[0]) / 2
  const cz = (min[1] + max[1]) / 2

  const items = data.furniture.filter((f) => camera === 'walk' || f.floor === furnitureFloor.id)
  const fixtures = useMemo(() => floors.flatMap(fixtureSolids), [floors])
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
  const wallRects = useMemo(() => floorWallRects(furnitureFloor), [furnitureFloor])
  // Measuring uses its own floor and wall targets; a piece or device being put down takes every tap.
  const pickable = interaction === 'edit' && !placingPiece && !placing
  const cutWalls = (cutaway || !!focusRoom) && (camera === 'orbit' || !!focusRoom) && !outside && !whole
  // While arranging, anything that runs into a wall or another piece, or stands where a door swings, is marked.
  const sweeps = useMemo(() => doorSweeps(furnitureFloor), [furnitureFloor])
  const showSweeps = pickable && !outside
  const blocked = showSweeps ? blockedDoors([...items, ...fixtures], sweeps, furnitureFloor.id) : NO_BLOCKED
  const clashes = pickable ? colliding(items, wallRects, fixtures) : new Set<string>()
  for (const ids of blocked.values()) for (const id of ids) clashes.add(id)
  const gaps = selectedItem ? clearances(selectedItem, wallRects).filter((g) => g.distance > 0.005) : []
  const gapY = (selectedItem ? ground(furnitureFloor, [selectedItem.x, selectedItem.y]) : floor.elevation) + 0.05
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
        shadows="percentage"
        dpr={[1, 2]}
        frameloop="demand"
        onPointerMissed={() => (pickable || pickedLight) && onSelect(undefined)}
      >
        <InputInvalidator />
        <MotionQuality />
        <PointerReach />
        <FloorPointerTracker elevation={furnitureFloor.elevation} pointRef={floorPointer} />
        {focusRoom || closeUp ? (
          <RoomCamera
            floor={floor}
            roomId={focusRoom}
            furniture={data.furniture}
            closeUp={closeUp}
            from={
              lastView.mode === 'orbit'
                ? { position: lastView.position.clone(), target: lastView.target.clone() }
                : undefined
            }
            onView={(position, target) => {
              if (temporaryFocus) {
                lastView.returnFrom ??= { position: new Vector3(), target: new Vector3() }
                lastView.returnFrom.position.copy(position)
                lastView.returnFrom.target.copy(target)
                return
              }
              lastView.returnFrom = undefined
              Object.assign(lastView, { mode: 'orbit', viewKey, zoom: 1, elevation: floor.elevation })
              lastView.position.copy(position)
              lastView.target.copy(target)
            }}
          />
        ) : camera === 'walk' ? (
          <WalkCamera
            key={`${viewKey}-${outside}`}
            floor={floor}
            floors={floors}
            onFloorChange={onWalkFloorChange}
            furniture={data.furniture}
            nudge={nudge}
            openDoors={openDoors}
            outdoor={house.outdoor}
            outside={outside}
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
        <DebugHover copies={interaction === 'view'} />
        {focusRoom ? (
          !whole && <RoomBlur floor={floor} roomId={focusRoom} open={open} />
        ) : !closeUp ? (
          <CameraNudger nudge={nudge} />
        ) : null}
        <ItemOutline
          item={hovered}
          over={!!focusRoom && !whole}
          // With the whole house shown round a shade, the room's smart items are seen through its walls.
          seen={whole ? pins.flatMap((p) => (p.key.startsWith('tag:') ? [p.key.slice(4)] : [])) : undefined}
        />
        <FocusProjector pins={pins} pinRefs={pinRefs ?? noPins} />
        <Lights sun={sun} north={north} center={[cx, floor.elevation, cz]} />
        <HouseLights floors={litFloors} devices={data.devices} furniture={data.furniture} level={level} tint={tint} />
        <CompassTracker north={north} needle={needle} />

        {house.outdoor && <Outdoor outdoor={house.outdoor} />}
        <HouseShadow floors={floors} roof={house.roof} openDoors={openDoors} groundLevel={house.outdoor?.level} />

        {/* Walking shows the connected floors, including the landing and the slab overhead. */}
        {floors.map((f, i) => (
          <Fade key={f.id} shown={i < shownCount}>
            {/* The ground floor's slab reaches down into the garden, so the house stands on the ground; an upper
                one down to the walls below, so there's no slit between the floors. */}
            <Slab
              floor={f}
              depth={
                i === 0
                  ? house.outdoor
                    ? Math.max(SLAB, f.elevation - house.outdoor.level + 0.1)
                    : SLAB
                  : Math.max(SLAB, f.elevation - floors[i - 1].elevation - floors[i - 1].height)
              }
            />
            {floors[i + 1] && (
              <Stairs
                floor={f}
                next={floors[i + 1]}
                // A room the stairs open onto shows them whole, up to the floor they reach.
                cut={
                  i === floorIndex &&
                  !outside &&
                  !whole &&
                  camera !== 'walk' &&
                  !(focusRoom && f.stairs?.rooms?.includes(focusRoom))
                    ? f.height
                    : undefined
                }
              />
            )}
            <Railings floor={f} />
            <Fixtures floor={f} cutaway={cutWalls && !focusRoom && f.id === floor.id} />
            <RoomFloors floor={f} regions={floorRegions(f)} />
            <FloorWalls
              floor={f}
              colors={data.wallColors}
              areas={data.wallAreas}
              interactive={pickable && (outside || f.id === floor.id)}
              doors={!measure && interaction !== 'paint' && !placingPiece && !placing && (outside || f.id === floor.id)}
              openDoors={openDoors}
              onToggleDoor={toggleDoor}
              shades={shades}
              onPickShade={interaction === 'view' && (outside || f.id === floor.id) ? onPickShade : undefined}
              onHoverShade={onHoverItem}
              hoveredShade={hovered}
              cutaway={cutWalls && f.id === floor.id}
              focus={focusPoint}
              onTap={() => onSelect(undefined)}
              brush={interaction === 'paint' && (outside || f.id === floor.id) ? brush : undefined}
              onPaint={onPaint}
              onPaintWall={onPaintWall}
            />
          </Fade>
        ))}

        <Fade shown={outside || whole}>
          {house.roof && <Roof roof={house.roof} floor={floors[floors.length - 1]} />}
        </Fade>

        {floors.map((f) => (
          <Devices
            key={`electrical-${f.id}`}
            hoveredId={hovered}
            floor={f}
            cutaway={cutWalls && f.id === floor.id}
            focus={focusPoint}
            devices={data.devices.filter(
              (d) => d.plan && d.floor === f.id && (d.plan.area === 'inside' ? furnished(f) : outside),
            )}
            selectedId={selection?.kind === 'device' ? selection.id : pickedLight}
            glow={level}
            tint={tint}
            plan={electrical}
            interactive={false}
            onSelect={() => {}}
            onMove={() => {}}
            onMoveEnd={() => {}}
            onPickLight={
              pickable ? (id) => onSelect({ kind: 'device', id }) : interaction === 'view' ? onPickLight : undefined
            }
            onPickDevice={electrical && !measure ? (id) => onSelect({ kind: 'device', id }) : undefined}
            onHoverLight={onHoverItem}
          />
        ))}
        {electrical && outside && <ElectricalRoutes />}

        {interaction === 'edit' && placing && (!outside || placing === 'wall-light') && (
          <DevicePlacer
            floor={furnitureFloor}
            placement={placing}
            onPlace={onPlaceDevice}
            cutaway={cutaway && camera === 'orbit'}
            plan={camera === 'top'}
          />
        )}
        {interaction === 'edit' && placingPiece && (
          <FurniturePlacer
            floor={furnitureFloor}
            piece={placingPiece}
            ground={(p) => ground(furnitureFloor, p)}
            wallSnap={wallSnap}
            furnitureSnap={furnitureSnap}
            snapWalls={snapWalls}
            items={items}
            obstacles={fixtures}
            wallRects={wallRects}
            onPlace={onPlacePiece}
          />
        )}
        {floors.map((f) => (
          <Fade key={f.id} shown={furnished(f)}>
            <Devices
              floor={f}
              hoveredId={hovered}
              cutaway={cutWalls && f.id === floor.id}
              focus={focusPoint}
              devices={data.devices.filter((d) => !d.plan && d.floor === f.id && (outside || f.id === floor.id))}
              selectedId={selection?.kind === 'device' ? selection.id : pickedLight}
              glow={level}
              tint={tint}
              plan={camera === 'top'}
              onPickLight={lightPick}
              onPickDevice={focusRoom ? lightPick : undefined}
              onHoverLight={onHoverItem}
              interactive={pickable && !outside}
              onSelect={(id) => onSelect({ kind: 'device', id })}
              onMove={moveDevice}
              onMoveEnd={saveItem}
            />
            {measurements
              .filter((m) => m.floor === f.id && !outside)
              .map((m) => (
                <Line
                  key={m.id}
                  points={[
                    [m.from[0], f.elevation + 0.03, m.from[1]],
                    [m.to[0], f.elevation + 0.03, m.to[1]],
                  ]}
                  color={SELECTED_OUTLINE}
                  lineWidth={3}
                  userData={OVERLAY}
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
                  onHoverLight={onHoverItem}
                  elevation={f.elevation}
                  ground={ground(f, [item.x, item.y])}
                  floor={f}
                  // Looking at one room, only its walls are cut; its furniture is what's being looked at.
                  cutaway={cutWalls && !focusRoom && f.id === floor.id}
                  selected={selectedIds.includes(item.id) || pickedLight === item.id}
                  colliding={clashes.has(item.id)}
                  showActions={selectedIds[selectedIds.length - 1] === item.id}
                  interactive={pickable && (!outside || f.id === furnitureFloor.id)}
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
            cutaway={cutWalls}
            focus={focusPoint}
            wallSnap={wallSnap}
            furnitureSnap={furnitureSnap}
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
            userData={OVERLAY}
          />
        ))}
        {showSweeps &&
          sweeps.map((s) => {
            const y = furnitureFloor.elevation + 0.02
            // The leaf drawn open, then the arc its edge travels back to the wall.
            const [hinge, ...arc] = sweepOutline(s)
            return (
              <Line
                key={s.id}
                points={[hinge, ...arc.reverse()].map(([x, z]) => [x, y, z] as [number, number, number])}
                color={blocked.has(s.id) ? COLLIDING : DOOR_SWEEP}
                lineWidth={blocked.has(s.id) ? 2.5 : 1.5}
                raycast={() => null}
              />
            )
          })}
        <ShadowUpdates />
        <AmbientOcclusion />
      </Canvas>
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

/**
 * How far in or out a view carried over to another floor may be, as a share of that floor's own
 * starting view. Further in or out than this and the new floor eases to the nearer bound instead.
 * These bound only the switch; zooming afterwards is as free as ever.
 */
const FLOOR_ZOOM = {
  /** Distance from the camera to what it looks at, in 3D. */
  orbit: { closest: 0, furthest: 1 },
  /** Plan scale, in top view (higher is closer). */
  top: { out: 1, in: 2.5 },
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const ZOOM_EASE_SECONDS = 0.6
const RETURN_SECONDS = 1.1

/**
 * The last orbit or top camera, so switching floors or to the whole house keeps the view.
 * `elevation` is the floor it was looking at, or NaN for the whole house from outside.
 */
const lastView = {
  mode: '',
  viewKey: -1,
  position: new Vector3(),
  target: new Vector3(),
  zoom: 1,
  elevation: NaN,
  /** The item's last camera pose, for the flight back to the saved house view. */
  returnFrom: undefined as Pose | undefined,
}

const CameraRig = ({ mode, floor, houseHeight, viewKey }: CameraRigProps) => {
  const size = useThree((s) => s.size)
  // Chosen once: carried over from the previous floor's camera, or this view's own start
  // (after Reset view, or a change between 3D and top). Resizing doesn't move it.
  const [start] = useState(() => {
    const { min, max } = floorBounds(floor)
    const cx = (min[0] + max[0]) / 2
    const cz = (min[1] + max[1]) / 2
    const span = Math.max(max[0] - min[0], max[1] - min[1])
    const own =
      mode === 'top'
        ? {
            // Straight down with north at the top; the tiny z offset keeps OrbitControls' math stable.
            position: new Vector3(cx, floor.elevation + 40, cz + 0.001),
            target: new Vector3(cx, floor.elevation, cz),
            zoom: Math.min(size.width, size.height) / (span * 1.35),
          }
        : { ...orbitPose(floor, size.width / size.height, houseHeight), zoom: 1 }
    if (lastView.mode !== mode || lastView.viewKey !== viewKey) return { ...own, ease: undefined, from: undefined }
    // Restore the exact saved framing, including a zoom beyond the usual floor-switch bounds.
    if (lastView.returnFrom)
      return {
        position: lastView.position.clone(),
        target: lastView.target.clone(),
        zoom: lastView.zoom,
        ease: undefined,
        from: { position: lastView.returnFrom.position.clone(), target: lastView.returnFrom.target.clone() },
      }
    // Carried over, then eased within this floor's bounds so it ends neither lost in a corner nor far off:
    // `ease` runs the plan's zoom (top) or the distance to the target (3D) from what it was to the bound.
    // From one floor to another, the 3D view moves up or down with the floor, so it sees the new one as it saw
    // the old; left where it was, it would end down among the new floor's walls.
    const rise = mode === 'orbit' && !houseHeight ? floor.elevation - lastView.elevation || 0 : 0
    const carried = {
      position: lastView.position.clone().setY(lastView.position.y + rise),
      target: lastView.target.clone().setY(lastView.target.y + rise),
      zoom: lastView.zoom,
    }
    const [from, lo, hi] =
      mode === 'top'
        ? [carried.zoom, own.zoom * FLOOR_ZOOM.top.out, own.zoom * FLOOR_ZOOM.top.in]
        : [
            carried.position.distanceTo(carried.target),
            own.position.distanceTo(own.target) * FLOOR_ZOOM.orbit.closest,
            own.position.distanceTo(own.target) * FLOOR_ZOOM.orbit.furthest,
          ]
    const to = clamp(from, lo, hi)
    return { ...carried, ease: to === from ? undefined : { from, to }, from: undefined }
  })
  useEffect(() => {
    lastView.returnFrom = undefined
  }, [])
  const flight = useRef(start.from ? 0 : 1)
  const [flying, setFlying] = useState(!!start.from)
  const easing = useRef(start.ease ? 0 : 1)
  // Zooming or dragging meanwhile takes over from the ease.
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  useEffect(() => {
    if (!controls) return
    const stop = () => (easing.current = 1)
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controls])
  useFrame(({ camera, controls, invalidate }, delta) => {
    const orbit = controls as OrbitControlsImpl | null
    if (orbit && start.from && flight.current < 1) {
      // A view that's been idle carries a large first delta; keep the return flight from skipping ahead.
      flight.current = Math.min(1, flight.current + Math.min(delta, 1 / 30) / RETURN_SECONDS)
      const k = easeInOut(flight.current)
      camera.position.lerpVectors(start.from.position, start.position, k)
      orbit.target.lerpVectors(start.from.target, start.target, k)
      orbit.update()
      invalidate()
      if (flight.current >= 1) setFlying(false)
      return
    }
    if (!orbit || !start.ease || easing.current >= 1) return
    easing.current = Math.min(1, easing.current + delta / ZOOM_EASE_SECONDS)
    const value = MathUtils.lerp(start.ease.from, start.ease.to, easeInOut(easing.current))
    if (mode === 'top') {
      camera.zoom = value
      camera.updateProjectionMatrix()
    } else camera.position.sub(orbit.target).setLength(value).add(orbit.target)
    orbit.update()
    invalidate()
  })
  useFrame(({ camera, controls }) => {
    if (!controls) return
    const orbit = controls as OrbitControlsImpl
    // Panning and zooming scale with the distance to the target, so close in they'd crawl.
    // Speed them up there to keep the pace they have this far out.
    if (mode === 'orbit') {
      const boost = NEAR_PACE / camera.position.distanceTo(orbit.target)
      orbit.panSpeed = PAN_SPEED * Math.max(1, boost)
      orbit.zoomSpeed = ZOOM_SPEED * Math.max(1, boost / 2)
    }
    Object.assign(lastView, { mode, viewKey, zoom: camera.zoom, elevation: houseHeight ? NaN : floor.elevation })
    lastView.position.copy(camera.position)
    lastView.target.copy(orbit.target)
  })

  if (mode === 'top') {
    // The plan stays put sideways and in zoom; only its height follows the floor.
    const position = flying && start.from ? start.from.position : start.position.clone().setY(floor.elevation + 40)
    const target = flying && start.from ? start.from.target : start.target.clone().setY(floor.elevation)
    return (
      <>
        <OrthographicCamera makeDefault position={position.toArray()} zoom={start.zoom} near={0.1} far={200} />
        <OrbitControls
          makeDefault
          enabled={!flying}
          target={target.toArray()}
          enableRotate={false}
          zoomToCursor
          zoomSpeed={ZOOM_SPEED}
          panSpeed={PAN_SPEED}
          screenSpacePanning
          mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
          touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
        />
      </>
    )
  }

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={(flying && start.from ? start.from.position : start.position).toArray()}
        fov={45}
        near={0.1}
        far={200}
      />
      <OrbitControls
        makeDefault
        enabled={!flying}
        target={(flying && start.from ? start.from.target : start.target).toArray()}
        maxPolarAngle={Math.PI / 2.05}
        zoomToCursor
        minDistance={0.2}
      />
      <ZoomToSurface />
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

/** The pointer reaches only what's in front: see `reachable`. */
const PointerReach = () => {
  const setEvents = useThree((s) => s.setEvents)
  useEffect(() => setEvents({ filter: (hits, state) => reachable(hits, state.scene, state.raycaster) }), [setEvents])
  return null
}
