import type { ThreeEvent } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import { useMemo } from 'react'
import { Mesh } from 'three'
import { wallAngle, wallPieces, wallThickness } from '../layout/geometry'
import type { Floor, Wall, WallSide } from '../layout/types'
import { wallColorKey } from '../data/types'
import { DEFAULT_WALL, SELECTED_OUTLINE, WALL_CAP } from './palette'
import { OpeningFills } from './OpeningFills'
import type { Selection } from './selection'

// Walls overlap at corners by just under half their thickness, so end caps never sit flush
// with the neighbouring wall's face (which would z-fight).
const CORNER_INSET = 0.002
// A pointer that moved further than this between down and up was an orbit/pan, not a click.
const CLICK_SLOP_PX = 5

type FloorWallsProps = {
  floor: Floor
  colors: Map<string, string>
  selection: Selection | undefined
  interactive: boolean
  /** Whether taps open and close doors. */
  doors: boolean
  onPick: (wallId: string, side: WallSide) => void
}

export const FloorWalls = ({ floor, colors, selection, interactive, doors, onPick }: FloorWallsProps) => (
  <group>
    {floor.walls.map((wall) => (
      <WallMesh
        key={wall.id}
        wall={wall}
        floor={floor}
        colorA={colors.get(wallColorKey(wall.id, 'a')) ?? DEFAULT_WALL}
        colorB={colors.get(wallColorKey(wall.id, 'b')) ?? DEFAULT_WALL}
        selectedSide={selection?.kind === 'wall' && selection.wallId === wall.id ? selection.side : undefined}
        interactive={interactive}
        doors={doors}
        onPick={onPick}
      />
    ))}
  </group>
)

type WallMeshProps = {
  wall: Wall
  floor: Floor
  colorA: string
  colorB: string
  selectedSide: WallSide | undefined
  interactive: boolean
  doors: boolean
  onPick: (wallId: string, side: WallSide) => void
}

// Switching back must name the default: R3F leaves a raycast set to undefined unset, and nothing gets hit.
const noRaycast = () => null

const WallMesh = ({ wall, floor, colorA, colorB, selectedSide, interactive, doors, onPick }: WallMeshProps) => {
  const thickness = wallThickness(wall, floor)
  const pieces = useMemo(
    () => wallPieces(wall, floor.height, thickness / 2 - CORNER_INSET),
    [wall, floor.height, thickness],
  )

  // Box faces in wall-local space: +z is side 'a', -z is side 'b'.
  const sideOf = (e: ThreeEvent<MouseEvent>): WallSide | undefined => {
    const z = e.face?.normal.z ?? 0
    if (z > 0.5) return 'a'
    if (z < -0.5) return 'b'
    return undefined
  }

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > CLICK_SLOP_PX) return
    const side = sideOf(e)
    if (!side) return
    e.stopPropagation()
    onPick(wall.id, side)
  }

  return (
    <group position={[wall.from[0], floor.elevation, wall.from[1]]} rotation={[0, -wallAngle(wall), 0]}>
      {pieces.map((p, i) => (
        <mesh
          key={i}
          position={[(p.u0 + p.u1) / 2, (p.y0 + p.y1) / 2, 0]}
          castShadow
          receiveShadow
          raycast={interactive ? Mesh.prototype.raycast : noRaycast}
          onClick={interactive ? handleClick : undefined}
          onPointerOver={
            interactive ? (e) => (e.stopPropagation(), (document.body.style.cursor = 'pointer')) : undefined
          }
          onPointerOut={interactive ? () => (document.body.style.cursor = '') : undefined}
        >
          <boxGeometry args={[p.u1 - p.u0, p.y1 - p.y0, thickness]} />
          <meshStandardMaterial attach="material-0" color={WALL_CAP} />
          <meshStandardMaterial attach="material-1" color={WALL_CAP} />
          <meshStandardMaterial attach="material-2" color={WALL_CAP} />
          <meshStandardMaterial attach="material-3" color={WALL_CAP} />
          <meshStandardMaterial attach="material-4" color={colorA} />
          <meshStandardMaterial attach="material-5" color={colorB} />
          {/* An outline rather than a tint, so the picked colour is seen as it is. */}
          {selectedSide && <Edges color={SELECTED_OUTLINE} lineWidth={2} />}
        </mesh>
      ))}
      {wall.openings && <OpeningFills openings={wall.openings} thickness={thickness} clickable={doors} />}
    </group>
  )
}
