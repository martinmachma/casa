import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import { MOUSE, TOUCH } from 'three'
import type { Device, DeviceKind, FurnitureItem } from '../data/types'
import type { HouseData } from '../data/useHouseData'
import { floorSnapWalls } from '../furniture/snap'
import { floorBounds } from '../layout/geometry'
import { floorRegions } from '../layout/rooms'
import type { Floor, Point, WallFace } from '../layout/types'
import { DevicePlacer, Devices } from './Devices'
import { FloorWalls } from './FloorWalls'
import { FurnitureBox, type ItemActions } from './FurnitureBox'
import { Outdoor } from './Outdoor'
import { prismGeometry } from './prism'
import { Railings, Stairs } from './Stairs'
import { Roof } from './Roof'
import { house } from '../layout/layout'
import { DEFAULT_WALL, FLOOR_SLAB } from './palette'
import type { SunPosition } from '../sun/sun'
import { Lights } from './Lights'
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
import { RoomLabelProjector, RoomLabels } from './RoomLabels'
import type { CameraNudge } from './cameraNudge'
import { CameraNudger } from './CameraNudger'
import type { CameraMode, Interaction, Selection } from './selection'

// Thick enough to close the gap between a floor's walls and the floor above (2.6 m walls, 2.9 m storey).
const SLAB = 0.3

type HouseSceneProps = {
  floors: Floor[]
  floorIndex: number
  /** The whole house from outside, roof and all; nothing inside is shown or pickable. */
  outside: boolean
  camera: CameraMode
  /** In the 3D view, hide the walls nearest the camera so you can see inside. */
  cutaway: boolean
  data: HouseData
  /** What a tap does: nothing (just looking), select and drag (editing), or measure. */
  interaction: Interaction
  selection: Selection | undefined
  hoveredRoom: string | undefined
  onHoverRoom: (roomId: string | undefined) => void
  snap: boolean
  /** Sun position for sunlight, or undefined for even light. */
  sun: SunPosition | undefined
  north: number
  /** The room numbers over the 3D view, shown while the rooms box is open. */
  roomNumbers: boolean
  /** The measurement in progress; undefined when not measuring. */
  measure: Measurement | undefined
  onMeasurePick: (pick: MeasurePick) => void
  /** Finished measurements; those on this floor are drawn with a removable length. */
  measurements: MeasuredLine[]
  onRemoveMeasurement: (id: string) => void
  /** The device kind the next tap places, while the devices tool is on. */
  placing: DeviceKind | undefined
  onPlaceDevice: (device: Omit<Device, 'id' | 'name'>) => void
  nudge: RefObject<CameraNudge>
  /** Changing it puts the camera back to its starting view. */
  viewKey: number
  onSelect: (selection: Selection | undefined) => void
  /** The selected item's floating buttons. */
  itemActions: ItemActions
}

export const HouseScene = ({
  floors,
  floorIndex,
  outside,
  camera,
  cutaway,
  data,
  interaction,
  selection,
  hoveredRoom,
  onHoverRoom,
  snap,
  sun,
  north,
  roomNumbers,
  measure,
  onMeasurePick,
  measurements,
  onRemoveMeasurement,
  placing,
  onPlaceDevice,
  nudge,
  viewKey,
  onSelect,
  itemActions,
}: HouseSceneProps) => {
  const floor = floors[floorIndex]
  const snapWalls = useMemo(() => floorSnapWalls(floor), [floor])
  const { min, max } = floorBounds(floor)
  const cx = (min[0] + max[0]) / 2
  const cz = (min[1] + max[1]) / 2

  const items = outside ? [] : data.furniture.filter((f) => f.floor === floor.id)
  const devices = outside ? [] : data.devices.filter((d) => d.floor === floor.id)

  // While a piece is selected (and while it's dragged), how far each side is from the walls.
  const selectedItem =
    selection?.kind === 'furniture' ? items.find((f) => f.id === selection.id && f.floor === floor.id) : undefined
  const wallRects = useMemo(() => floorWallRects(floor), [floor])
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

  const labels = useRef<(HTMLDivElement | null)[]>([])
  const needle = useRef<HTMLDivElement>(null)
  const annotationRefs = useRef(new Map<string, HTMLDivElement | null>())
  // Only editing makes walls, floors and furniture respond; while measuring, taps go to the floor plane only.
  const pickable = interaction === 'edit'
  const pickRoom = pickable ? (roomId: string) => onSelect({ kind: 'room', roomId }) : undefined

  const pickWall = (wallId: string, side: WallFace, part: number) => onSelect({ kind: 'wall', wallId, side, part })
  const moveItem = (id: string, placement: Pick<FurnitureItem, 'x' | 'y' | 'rotation'>) =>
    data.patchFurniture(id, placement, `move:${id}`)
  const saveItem = () => data.endEdit()
  const moveDevice = (id: string, patch: Partial<Device>) => data.patchDevice(id, patch, `device:${id}`)

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        onPointerMissed={() => (pickable || interaction === 'devices') && onSelect(undefined)}
      >
        {camera === 'walk' ? (
          <WalkCamera key={`${floor.id}-${viewKey}`} floor={floor} furniture={data.furniture} nudge={nudge} />
        ) : (
          <CameraRig
            key={`${camera}-${outside ? 'outside' : floor.id}-${viewKey}`}
            mode={camera}
            floor={outside ? floors[0] : floor}
            houseHeight={outside ? roofTop(floors) : undefined}
          />
        )}
        <CameraNudger nudge={nudge} />
        <Lights sun={sun} north={north} center={[cx, floor.elevation, cz]} />
        <CompassTracker north={north} needle={needle} />

        {house.outdoor && <Outdoor outdoor={house.outdoor} />}

        {/* Floors below the current one stay visible for context but can't be clicked. */}
        {floors.slice(0, floorIndex + 1).map((f, i) => (
          <group key={f.id}>
            {/* The ground floor's slab reaches down into the garden, so the house stands on the ground. */}
            <Slab
              floor={f}
              depth={i === 0 && house.outdoor ? Math.max(SLAB, f.elevation - house.outdoor.level + 0.1) : SLAB}
            />
            {floors[i + 1] && (
              <Stairs floor={f} next={floors[i + 1]} cut={i === floorIndex && !outside ? f.height : undefined} />
            )}
            <Railings floor={f} />
            <RoomFloors
              floor={f}
              regions={floorRegions(f)}
              materials={data.roomFloors}
              selectedRoom={selection?.kind === 'room' ? selection.roomId : undefined}
              hoveredRoom={f.id === floor.id ? hoveredRoom : undefined}
              interactive={pickable && f.id === floor.id}
              onPick={(roomId) => onSelect({ kind: 'room', roomId })}
            />
            <FloorWalls
              floor={f}
              colors={data.wallColors}
              selection={selection}
              interactive={pickable && f.id === floor.id}
              doors={!measure && (outside || f.id === floor.id)}
              cutaway={cutaway && camera === 'orbit' && !outside && f.id === floor.id}
              onPick={pickWall}
            />
          </group>
        ))}

        {outside && house.roof && <Roof roof={house.roof} floor={floors[floors.length - 1]} />}

        {/* Walking needs a ceiling, so light comes in through the windows; the floor above's slab is one. */}
        {camera === 'walk' && floors[floorIndex + 1] && <Slab floor={floors[floorIndex + 1]} color={DEFAULT_WALL} />}

        {interaction === 'devices' && placing && !outside && (
          <DevicePlacer floor={floor} kind={placing} onPlace={onPlaceDevice} />
        )}
        <Devices
          floor={floor}
          devices={devices}
          selectedId={selection?.kind === 'device' ? selection.id : undefined}
          plan={camera === 'top'}
          interactive={interaction === 'devices' && !placing}
          onSelect={(id) => onSelect({ kind: 'device', id })}
          onMove={moveDevice}
          onMoveEnd={saveItem}
        />

        {lines.map((m) => (
          <Line
            key={m.id}
            points={[
              [m.from[0], lineY, m.from[1]],
              [m.to[0], lineY, m.to[1]],
            ]}
            color={SELECTED_OUTLINE}
            lineWidth={3}
          />
        ))}
        {measure && <MeasureTool floor={floor} items={items} measure={measure} onPick={onMeasurePick} />}

        {camera !== 'walk' && !outside && <RoomLabelProjector floor={floor} labels={labels} />}
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

        {items.map((item) => (
          <FurnitureBox
            key={item.id}
            item={item}
            elevation={floor.elevation}
            selected={selection?.kind === 'furniture' && selection.id === item.id}
            interactive={pickable}
            snapWalls={snap ? snapWalls : undefined}
            onSelect={(id) => onSelect({ kind: 'furniture', id })}
            onMove={moveItem}
            onMoveEnd={saveItem}
            actions={itemActions}
          />
        ))}
      </Canvas>
      {camera !== 'walk' && !outside && roomNumbers && (
        <RoomLabels
          floor={floor}
          labels={labels}
          names={data.roomNames}
          hovered={hoveredRoom}
          onHover={onHoverRoom}
          onPick={pickRoom}
        />
      )}
      <AnnotationLabels items={annotations} refs={annotationRefs} />
      <Compass needle={needle} />
    </>
  )
}

/** The floor's outline (its walls' bounding box if it has none), with its voids as holes. */
const slabGeometry = (floor: Floor, depth: number) => {
  const { min, max } = floorBounds(floor)
  const outline = floor.outline ?? [min, [max[0], min[1]], max, [min[0], max[1]]]
  const holes = (floor.voids ?? []).map((v): Point[] => [
    [v.x0, v.y0],
    [v.x1, v.y0],
    [v.x1, v.y1],
    [v.x0, v.y1],
  ])
  return prismGeometry(outline, depth, holes)
}

const Slab = ({ floor, color = FLOOR_SLAB, depth = SLAB }: { floor: Floor; color?: string; depth?: number }) => {
  const geometry = useMemo(() => slabGeometry(floor, depth), [floor, depth])
  return (
    <mesh geometry={geometry} position={[0, floor.elevation, 0]} castShadow receiveShadow>
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
}

const CameraRig = ({ mode, floor, houseHeight }: CameraRigProps) => {
  const size = useThree((s) => s.size)
  const { min, max } = floorBounds(floor)
  const cx = (min[0] + max[0]) / 2
  const cz = (min[1] + max[1]) / 2
  const span = Math.max(max[0] - min[0], max[1] - min[1])

  if (mode === 'top') {
    return (
      <>
        {/* Straight down with north at the top; the tiny z offset keeps OrbitControls' math stable. */}
        <OrthographicCamera
          makeDefault
          position={[cx, floor.elevation + 40, cz + 0.001]}
          zoom={Math.min(size.width, size.height) / (span * 1.35)}
          near={0.1}
          far={200}
        />
        <OrbitControls
          makeDefault
          target={[cx, floor.elevation, cz]}
          enableRotate={false}
          screenSpacePanning
          mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
          touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
        />
      </>
    )
  }

  // A portrait phone sees less sideways; step back so the whole house fits.
  const back = span * Math.max(1, 0.75 / (size.width / size.height))
  // From outside, the whole house: look at its middle from further away and lower down.
  const look = floor.elevation + (houseHeight ? houseHeight / 2 : 0.8)
  const away = houseHeight ? Math.max(back, houseHeight) * 1.3 : back
  const up = houseHeight ? look + away * 0.55 : floor.elevation + back * 1.1
  return (
    <>
      <PerspectiveCamera makeDefault position={[cx + away * 0.8, up, cz + away * 1.25]} fov={45} near={0.1} far={200} />
      <OrbitControls makeDefault target={[cx, look, cz]} maxPolarAngle={Math.PI / 2.05} />
    </>
  )
}
