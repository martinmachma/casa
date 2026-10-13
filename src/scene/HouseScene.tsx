import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import { MOUSE, TOUCH } from 'three'
import type { FurnitureItem } from '../data/types'
import type { HouseData } from '../data/useHouseData'
import { floorSnapWalls } from '../furniture/snap'
import { floorBounds } from '../layout/geometry'
import { floorRegions } from '../layout/rooms'
import type { Floor, Point, WallSide } from '../layout/types'
import { FloorWalls } from './FloorWalls'
import { FurnitureBox } from './FurnitureBox'
import { Outdoor } from './Outdoor'
import { prismGeometry } from './prism'
import { Railings, Stairs } from './Stairs'
import { house } from '../layout/layout'
import { DEFAULT_WALL, FLOOR_SLAB } from './palette'
import type { SunPosition } from '../sun/sun'
import { Lights } from './Lights'
import { MeasureTool } from './MeasureTool'
import { NorthArrow } from './NorthArrow'
import { WalkCamera } from './WalkCamera'
import { AnnotationLabels, AnnotationProjector, type Annotation } from './Annotations'
import { clearances } from '../measure/clearance'
import { distance, formatLength, measuredLine, type MeasurePick, type Measurement } from '../measure/measure'
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
  camera: CameraMode
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
  /** The measurement in progress; undefined when not measuring. */
  measure: Measurement | undefined
  onMeasurePick: (pick: MeasurePick) => void
  nudge: RefObject<CameraNudge>
  /** Changing it puts the camera back to its starting view. */
  viewKey: number
  onSelect: (selection: Selection | undefined) => void
}

export const HouseScene = ({
  floors,
  floorIndex,
  camera,
  data,
  interaction,
  selection,
  hoveredRoom,
  onHoverRoom,
  snap,
  sun,
  north,
  measure,
  onMeasurePick,
  nudge,
  viewKey,
  onSelect,
}: HouseSceneProps) => {
  const floor = floors[floorIndex]
  const snapWalls = useMemo(() => floorSnapWalls(floor), [floor])
  const { min, max } = floorBounds(floor)
  const cx = (min[0] + max[0]) / 2
  const cz = (min[1] + max[1]) / 2

  const items = data.furniture.filter((f) => f.floor === floor.id)

  // While a piece is selected (and while it's dragged), how far each side is from the walls.
  const selectedItem =
    selection?.kind === 'furniture' ? items.find((f) => f.id === selection.id && f.floor === floor.id) : undefined
  const wallRects = useMemo(() => floorWallRects(floor), [floor])
  const gaps = selectedItem ? clearances(selectedItem, wallRects).filter((g) => g.distance > 0.005) : []
  const gapY = floor.elevation + 0.05
  const measured = measure && measuredLine(measure)
  const annotations = [
    ...(measured
      ? [
          {
            key: 'measure',
            at: [
              (measured.from[0] + measured.to[0]) / 2,
              floor.elevation + 0.03,
              (measured.from[1] + measured.to[1]) / 2,
            ] as [number, number, number],
            text: formatLength(distance(measured.from, measured.to)),
            kind: 'measure' as const,
          },
        ]
      : []),
    ...gaps.map((g, i): Annotation => ({
      key: `gap${i}`,
      at: [(g.from[0] + g.to[0]) / 2, gapY, (g.from[1] + g.to[1]) / 2],
      text: formatLength(g.distance),
      kind: 'gap',
    })),
  ]

  const labels = useRef<(HTMLDivElement | null)[]>([])
  const annotationRefs = useRef(new Map<string, HTMLDivElement | null>())
  // Only editing makes walls, floors and furniture respond; while measuring, taps go to the floor plane only.
  const pickable = interaction === 'edit'
  const pickRoom = pickable ? (roomId: string) => onSelect({ kind: 'room', roomId }) : undefined

  const pickWall = (wallId: string, side: WallSide) => onSelect({ kind: 'wall', wallId, side })
  const moveItem = (id: string, placement: Pick<FurnitureItem, 'x' | 'y' | 'rotation'>) =>
    data.patchFurniture(id, placement)
  const saveItem = (id: string) => {
    const item = data.furniture.find((f) => f.id === id)
    if (item) data.saveFurniture(item)
  }

  return (
    <>
      <Canvas shadows dpr={[1, 2]} onPointerMissed={() => pickable && onSelect(undefined)}>
        {camera === 'walk' ? (
          <WalkCamera key={`${floor.id}-${viewKey}`} floor={floor} furniture={data.furniture} nudge={nudge} />
        ) : (
          <CameraRig key={`${camera}-${floor.id}-${viewKey}`} mode={camera} floor={floor} />
        )}
        <CameraNudger nudge={nudge} />
        <Lights sun={sun} north={north} center={[cx, floor.elevation, cz]} />
        {sun && (
          <NorthArrow
            north={north}
            center={[cx, floor.elevation, cz]}
            radius={Math.hypot(max[0] - min[0], max[1] - min[1]) / 2 + 0.8}
          />
        )}

        {house.outdoor && <Outdoor outdoor={house.outdoor} />}

        {/* Floors below the current one stay visible for context but can't be clicked. */}
        {floors.slice(0, floorIndex + 1).map((f, i) => (
          <group key={f.id}>
            <Slab floor={f} />
            {floors[i + 1] && <Stairs floor={f} next={floors[i + 1]} />}
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
              onPick={pickWall}
            />
          </group>
        ))}

        {/* Walking needs a ceiling, so light comes in through the windows; the floor above's slab is one. */}
        {camera === 'walk' && floors[floorIndex + 1] && <Slab floor={floors[floorIndex + 1]} color={DEFAULT_WALL} />}

        {measure && <MeasureTool floor={floor} items={items} measure={measure} onPick={onMeasurePick} />}

        {camera !== 'walk' && <RoomLabelProjector floor={floor} labels={labels} />}
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
          />
        ))}
      </Canvas>
      {camera !== 'walk' && (
        <RoomLabels floor={floor} labels={labels} hovered={hoveredRoom} onHover={onHoverRoom} onPick={pickRoom} />
      )}
      <AnnotationLabels items={annotations} refs={annotationRefs} />
    </>
  )
}

/** The floor's outline (its walls' bounding box if it has none), with its voids as holes. */
const slabGeometry = (floor: Floor) => {
  const { min, max } = floorBounds(floor)
  const outline = floor.outline ?? [min, [max[0], min[1]], max, [min[0], max[1]]]
  const holes = (floor.voids ?? []).map((v): Point[] => [
    [v.x0, v.y0],
    [v.x1, v.y0],
    [v.x1, v.y1],
    [v.x0, v.y1],
  ])
  return prismGeometry(outline, SLAB, holes)
}

const Slab = ({ floor, color = FLOOR_SLAB }: { floor: Floor; color?: string }) => {
  const geometry = useMemo(() => slabGeometry(floor), [floor])
  return (
    <mesh geometry={geometry} position={[0, floor.elevation, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  )
}

const CameraRig = ({ mode, floor }: { mode: Exclude<CameraMode, 'walk'>; floor: Floor }) => {
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
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[cx + back * 0.8, floor.elevation + back * 1.1, cz + back * 1.25]}
        fov={45}
        near={0.1}
        far={200}
      />
      <OrbitControls makeDefault target={[cx, floor.elevation + 0.8, cz]} maxPolarAngle={Math.PI / 2.05} />
    </>
  )
}
