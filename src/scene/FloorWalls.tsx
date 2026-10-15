import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import { Vector3, type Group } from 'three'
import {
  blocksView,
  isExteriorWall,
  stubPieces,
  wallAngle,
  wallPieces,
  wallOutside,
  wallThickness,
  type WallPiece,
} from '../layout/geometry'
import type { Floor, Point, Wall, WallSide } from '../layout/types'
import { wallColorKey } from '../data/types'
import { DEFAULT_WALL, SELECTED_OUTLINE, WALL_CAP } from './palette'
import { OpeningFills } from './OpeningFills'
import { raycastIfShown } from './raycast'
import type { Selection } from './selection'

// Walls overlap at corners by just under half their thickness, so end caps never sit flush
// with the neighbouring wall's face (which would z-fight).
const CORNER_INSET = 0.002
// A pointer that moved further than this between down and up was an orbit/pan, not a click.
const CLICK_SLOP_PX = 5
// How much of a wall is left when it's cut away, so the rooms' outlines still show.
const STUB_HEIGHT = 0.3
// The selection wash sits this far off the wall face, so it doesn't flicker against it.
const PROUD = 0.006
const forward = new Vector3()

type FloorWallsProps = {
  floor: Floor
  colors: Map<string, string>
  selection: Selection | undefined
  interactive: boolean
  /** Whether taps open and close doors. */
  doors: boolean
  /** Hide the walls between the camera and the middle of the floor, so you can see in. */
  cutaway: boolean
  onPick: (wallId: string, side: WallSide) => void
}

export const FloorWalls = ({ floor, colors, selection, interactive, doors, cutaway, onPick }: FloorWallsProps) => {
  // A stable lookup filled by the walls' refs, not render state.
  const [parts] = useState(() => new Map<string, WallParts>())
  const outsides = useMemo(() => new Map(floor.walls.map((w) => [w.id, wallOutside(w, floor)])), [floor])

  // Every frame, since it depends on where the camera has orbited to.
  useFrame(({ camera }) => {
    const eye: Point = [camera.position.x, camera.position.z]
    camera.getWorldDirection(forward)
    const view: Point = [forward.x, forward.z]
    for (const wall of floor.walls) {
      const { full, stub } = parts.get(wall.id) ?? {}
      if (!full || !stub) continue
      const cut = cutaway && blocksView(wall, outsides.get(wall.id), eye, view)
      full.visible = !cut
      stub.visible = cut
    }
  })

  return (
    <group>
      {floor.walls.map((wall) => (
        <WallMesh
          key={wall.id}
          parts={parts}
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
}

/** A wall drawn whole, and cut down to a stub for when it's in the way; one of the two is shown. */
type WallParts = { full?: Group | null; stub?: Group | null }

type WallMeshProps = {
  parts: Map<string, WallParts>
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

const WallMesh = ({ parts, wall, floor, colorA, colorB, selectedSide, interactive, doors, onPick }: WallMeshProps) => {
  const thickness = wallThickness(wall, floor)
  const pieces = useMemo(
    () => wallPieces(wall, floor.height, thickness / 2 - CORNER_INSET),
    [wall, floor.height, thickness],
  )
  const stub = useMemo(() => stubPieces(pieces, STUB_HEIGHT), [pieces])
  const own = (key: keyof WallParts) => (g: Group | null) => {
    parts.set(wall.id, { ...parts.get(wall.id), [key]: g })
  }

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

  const boxes = (list: WallPiece[]) =>
    list.map((p, i) => (
      <mesh
        key={i}
        position={[(p.u0 + p.u1) / 2, (p.y0 + p.y1) / 2, 0]}
        castShadow
        receiveShadow
        raycast={interactive ? raycastIfShown : noRaycast}
        onClick={interactive ? handleClick : undefined}
        onPointerOver={interactive ? (e) => (e.stopPropagation(), (document.body.style.cursor = 'pointer')) : undefined}
        onPointerOut={interactive ? () => (document.body.style.cursor = '') : undefined}
      >
        <boxGeometry args={[p.u1 - p.u0, p.y1 - p.y0, thickness]} />
        <meshStandardMaterial attach="material-0" color={WALL_CAP} />
        <meshStandardMaterial attach="material-1" color={WALL_CAP} />
        <meshStandardMaterial attach="material-2" color={WALL_CAP} />
        <meshStandardMaterial attach="material-3" color={WALL_CAP} />
        <meshStandardMaterial attach="material-4" color={colorA} />
        <meshStandardMaterial attach="material-5" color={colorB} />
      </mesh>
    ))

  return (
    <group position={[wall.from[0], floor.elevation, wall.from[1]]} rotation={[0, -wallAngle(wall), 0]}>
      <group ref={own('full')}>
        {boxes(pieces)}
        {selectedSide && <SideHighlight pieces={pieces} side={selectedSide} thickness={thickness} />}
        {wall.openings && (
          <OpeningFills openings={wall.openings} exterior={isExteriorWall(wall, floor)} clickable={doors} />
        )}
      </group>
      <group ref={own('stub')} visible={false}>
        {boxes(stub)}
        {selectedSide && <SideHighlight pieces={stub} side={selectedSide} thickness={thickness} />}
      </group>
    </group>
  )
}

/** The picked side's face washed in the accent colour, as when measuring. */
const SideHighlight = ({ pieces, side, thickness }: { pieces: WallPiece[]; side: WallSide; thickness: number }) => {
  const z = (side === 'a' ? 1 : -1) * (thickness / 2 + PROUD)
  return (
    <group rotation-y={side === 'a' ? 0 : Math.PI}>
      {pieces.map((p, i) => (
        <mesh
          key={i}
          position={[((p.u0 + p.u1) / 2) * (side === 'a' ? 1 : -1), (p.y0 + p.y1) / 2, Math.abs(z)]}
          raycast={noRaycast}
        >
          <planeGeometry args={[p.u1 - p.u0, p.y1 - p.y0]} />
          <meshBasicMaterial color={SELECTED_OUTLINE} transparent opacity={0.6} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
