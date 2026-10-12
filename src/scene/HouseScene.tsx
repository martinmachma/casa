import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { MOUSE, TOUCH } from 'three'
import type { FurnitureItem } from '../data/types'
import type { HouseData } from '../data/useHouseData'
import { floorSnapWalls } from '../furniture/snap'
import { floorBounds } from '../layout/geometry'
import { roomRegions } from '../layout/rooms'
import type { Floor, WallSide } from '../layout/types'
import { FloorWalls } from './FloorWalls'
import { FurnitureBox } from './FurnitureBox'
import { FLOOR_SLAB } from './palette'
import { RoomLabelProjector, RoomLabels } from './RoomLabels'
import type { CameraMode, Selection } from './selection'

// Thick enough to close the gap between a floor's walls and the floor above (2.6 m walls, 2.9 m storey).
const SLAB = 0.3

type HouseSceneProps = {
  floors: Floor[]
  floorIndex: number
  camera: CameraMode
  data: HouseData
  selection: Selection | undefined
  snap: boolean
  onSelect: (selection: Selection | undefined) => void
}

export const HouseScene = ({ floors, floorIndex, camera, data, selection, snap, onSelect }: HouseSceneProps) => {
  const floor = floors[floorIndex]
  const snapWalls = useMemo(() => floorSnapWalls(floor), [floor])
  const regions = useMemo(() => roomRegions(floor), [floor])
  const items = data.furniture.filter((f) => f.floor === floor.id)
  const labels = useRef<(HTMLDivElement | null)[]>([])

  const pickWall = (wallId: string, side: WallSide) => onSelect({ kind: 'wall', wallId, side })
  const moveItem = (id: string, placement: Pick<FurnitureItem, 'x' | 'y' | 'rotation'>) =>
    data.patchFurniture(id, placement)
  const saveItem = (id: string) => {
    const item = data.furniture.find((f) => f.id === id)
    if (item) data.saveFurniture(item)
  }

  return (
    <>
      <Canvas shadows dpr={[1, 2]} onPointerMissed={() => onSelect(undefined)}>
        <color attach="background" args={['#f4efe8']} />
        <CameraRig key={`${camera}-${floor.id}`} mode={camera} floor={floor} />
        <hemisphereLight args={['#fff8ee', '#b8a990', 1.5]} />
        <directionalLight
          position={[9, 24, 6]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
          shadow-bias={-0.0005}
          shadow-intensity={0.45}
        />

        {/* Floors below the current one stay visible for context but can't be clicked. */}
        {floors.slice(0, floorIndex + 1).map((f) => (
          <group key={f.id}>
            <Slab floor={f} />
            <FloorWalls
              floor={f}
              colors={data.wallColors}
              selection={selection}
              interactive={f.id === floor.id}
              onPick={pickWall}
            />
          </group>
        ))}

        <RoomLabelProjector floor={floor} labels={labels} />

        {items.map((item) => (
          <FurnitureBox
            key={item.id}
            item={item}
            elevation={floor.elevation}
            selected={selection?.kind === 'furniture' && selection.id === item.id}
            snapWalls={snap ? snapWalls : undefined}
            onSelect={(id) => onSelect({ kind: 'furniture', id })}
            onMove={moveItem}
            onMoveEnd={saveItem}
          />
        ))}
      </Canvas>
      <RoomLabels floor={floor} labels={labels} regions={regions} />
    </>
  )
}

const Slab = ({ floor }: { floor: Floor }) => {
  const { min, max } = floorBounds(floor)
  return (
    <mesh position={[(min[0] + max[0]) / 2, floor.elevation - SLAB / 2, (min[1] + max[1]) / 2]} receiveShadow>
      <boxGeometry args={[max[0] - min[0], SLAB, max[1] - min[1]]} />
      <meshStandardMaterial color={FLOOR_SLAB} roughness={0.9} />
    </mesh>
  )
}

const CameraRig = ({ mode, floor }: { mode: CameraMode; floor: Floor }) => {
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

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[cx + span * 0.8, floor.elevation + span * 1.1, cz + span * 1.25]}
        fov={45}
        near={0.1}
        far={200}
      />
      <OrbitControls makeDefault target={[cx, floor.elevation + 0.8, cz]} maxPolarAngle={Math.PI / 2.05} />
    </>
  )
}
