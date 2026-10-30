import { type ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import {
  cornerCuts,
  isExteriorWall,
  sidePart,
  splitPieces,
  stubPieces,
  wallHeight,
  wallJoints,
  wallLength,
  wallOwner,
  wallOwnerOffset,
  wallPieces,
  wallThickness,
  type WallPiece,
} from '../layout/geometry'
import type { Floor, Wall, WallFace, WallSide } from '../layout/types'
import { wallPartColor } from '../data/types'
import { DEFAULT_WALL, SELECTED_OUTLINE, WALL_CAP } from './palette'
import { OpeningFills } from './OpeningFills'
import { raycastIfShown } from './raycast'
import type { Selection } from './selection'
import { CutawayWall, STUB_HEIGHT, type Focus } from './CutawayWall'

// Walls overlap at corners by just under half their thickness, so end caps never sit flush
// with the neighbouring wall's face (which would z-fight).
const CORNER_INSET = 0.002
// A pointer that moved further than this between down and up was an orbit/pan, not a click.
const CLICK_SLOP_PX = 5
// The selection wash sits this far off the wall face, so it doesn't flicker against it.
const PROUD = 0.006

/** An end face is told apart by where it is along the wall, in millimetres. */
const endPart = (u: number) => Math.round(u * 1000)

type FloorWallsProps = {
  floor: Floor
  colors: Map<string, string>
  selection: Selection | undefined
  interactive: boolean
  /** Whether taps open and close doors. */
  doors: boolean
  openDoors: ReadonlySet<string>
  onToggleDoor: (id: string) => void
  /** Hide the walls between the camera and the middle of the floor, so you can see in. */
  cutaway: boolean
  /** The middle of the room being looked at: only walls between it and the camera are cut. */
  focus?: Focus
  onPick: (wallId: string, side: WallFace, part: number) => void
}

export const FloorWalls = ({
  floor,
  colors,
  selection,
  interactive,
  doors,
  openDoors,
  onToggleDoor,
  cutaway,
  focus,
  onPick,
}: FloorWallsProps) => {
  return (
    <group>
      {floor.walls.map((wall) => (
        <WallMesh
          key={wall.id}
          cutaway={cutaway}
          focus={focus}
          wall={wall}
          floor={floor}
          colors={colors}
          selected={
            selection?.kind === 'wall' && selection.wallId === wallOwner(wall, floor).id ? selection : undefined
          }
          interactive={interactive}
          doors={doors}
          openDoors={openDoors}
          onToggleDoor={onToggleDoor}
          onPick={onPick}
        />
      ))}
    </group>
  )
}

type WallMeshProps = {
  cutaway: boolean
  focus?: Focus
  wall: Wall
  floor: Floor
  colors: Map<string, string>
  selected: { side: WallFace; part: number } | undefined
  interactive: boolean
  doors: boolean
  openDoors: ReadonlySet<string>
  onToggleDoor: (id: string) => void
  onPick: (wallId: string, side: WallFace, part: number) => void
}

// Switching back must name the default: R3F leaves a raycast set to undefined unset, and nothing gets hit.
const noRaycast = () => null

const WallMesh = ({
  cutaway,
  focus,
  wall,
  floor,
  colors,
  selected,
  interactive,
  doors,
  openDoors,
  onToggleDoor,
  onPick,
}: WallMeshProps) => {
  const owner = wallOwner(wall, floor)
  const offset = wallOwnerOffset(wall, owner)
  const thickness = wallThickness(wall, floor)
  const ownJoints = useMemo(() => wallJoints(wall, floor), [wall, floor])
  const joints = useMemo(() => {
    const joints = wallJoints(owner, floor)
    return { a: joints.a.map((u) => u - offset), b: joints.b.map((u) => u - offset) }
  }, [owner, floor, offset])
  // Cut where other walls meet either side, so each box lies in one part of each side, and at corners, so the
  // corner block is a piece of its own.
  const corners = useMemo(() => cornerCuts(wall, floor), [wall, floor])
  const pieces = useMemo(
    () =>
      splitPieces(wallPieces(wall, wallHeight(wall, floor), thickness / 2 - CORNER_INSET), [
        ...new Set([...joints.a, ...joints.b, ...ownJoints.a, ...ownJoints.b, ...corners.map((c) => c.at)]),
      ]),
    [wall, floor, thickness, joints, ownJoints, corners],
  )
  const partOf = (p: WallPiece, side: WallSide) => sidePart(joints[side], (p.u0 + p.u1) / 2)
  const colorOf = (p: WallPiece, side: WallSide) =>
    wallPartColor(colors, owner.id, side, partOf(p, side)) ??
    wallPartColor(colors, wall.id, side, sidePart(ownJoints[side], (p.u0 + p.u1) / 2)) ??
    DEFAULT_WALL
  const endColor = (u: number) =>
    wallPartColor(colors, owner.id, 'end', endPart(u + offset)) ??
    wallPartColor(colors, wall.id, 'end', endPart(u)) ??
    WALL_CAP
  const inSelection = (list: WallPiece[]) => {
    const side = selected?.side
    if (!side || side === 'end') return []
    return list.filter((p) => partOf(p, side) === selected?.part)
  }
  const stub = useMemo(() => stubPieces(pieces, STUB_HEIGHT), [pieces])

  // Box faces in wall-local space: +z is side 'a', -z is side 'b', ±x the ends at u1 and u0.
  const handleClick = (p: WallPiece) => (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > CLICK_SLOP_PX) return
    const n = e.face?.normal
    if (!n) return
    e.stopPropagation()
    if (n.z > 0.5) onPick(owner.id, 'a', partOf(p, 'a'))
    else if (n.z < -0.5) onPick(owner.id, 'b', partOf(p, 'b'))
    else if (Math.abs(n.x) > 0.5) onPick(owner.id, 'end', endPart((n.x > 0 ? p.u1 : p.u0) + offset))
  }

  // The block at a corner, shared with the wall met there: a room view keeps it with either wall.
  const length = wallLength(wall)
  const cornerOf = (p: WallPiece) =>
    corners.find((c) => (c.at < length / 2 ? p.u1 <= c.at + 1e-6 : p.u0 >= c.at - 1e-6))?.wall
  const isCorner = (p: WallPiece) => cornerOf(p) !== undefined
  // Looking at a room, a corner this wall shares with one of the room's own walls goes with that wall: it
  // stands in the room's outline, so it's cut away (or left) with the walls either side of it there.
  const handedOver = (p: WallPiece) => {
    const other = cornerOf(p)
    return focus && !focus.sides.has(wall.id) && other && focus.sides.has(other) ? other : undefined
  }
  const own = pieces.filter((p) => !handedOver(p))
  const given = [...new Set(pieces.map(handedOver).filter((id) => id !== undefined))]

  // Only the horizontal section face is artificial. The vertical faces keep their real lighting/shadows,
  // including on shortened walls; the complete hidden wall still blocks light in the physical scene.
  const boxes = (list: WallPiece[], cut = false) => {
    return list.map((p, i) => (
      <mesh
        key={i}
        position={[(p.u0 + p.u1) / 2, (p.y0 + p.y1) / 2, 0]}
        userData={{ corner: isCorner(p) }}
        receiveShadow
        raycast={interactive ? raycastIfShown : noRaycast}
        onClick={interactive ? handleClick(p) : undefined}
        onPointerOver={interactive ? (e) => (e.stopPropagation(), (document.body.style.cursor = 'pointer')) : undefined}
        onPointerOut={interactive ? () => (document.body.style.cursor = '') : undefined}
      >
        <boxGeometry args={[p.u1 - p.u0, p.y1 - p.y0, thickness]} />
        <meshStandardMaterial roughness={1} attach="material-0" color={endColor(p.u1)} />
        <meshStandardMaterial roughness={1} attach="material-1" color={endColor(p.u0)} />
        <meshStandardMaterial
          attach="material-2"
          color={WALL_CAP}
          roughness={1}
          userData={{ section: (cut && p.y1 === STUB_HEIGHT) || p.y1 >= floor.height }}
        />
        <meshStandardMaterial roughness={1} attach="material-3" color={WALL_CAP} />
        <meshStandardMaterial roughness={1} attach="material-4" color={colorOf(p, 'a')} />
        <meshStandardMaterial roughness={1} attach="material-5" color={colorOf(p, 'b')} />
      </mesh>
    ))
  }

  const ownStub = stubPieces(own, STUB_HEIGHT)
  const opening = (top?: number) =>
    wall.openings && (
      <OpeningFills
        wallId={wall.id}
        openings={wall.openings}
        exterior={isExteriorWall(wall, floor)}
        clickable={doors}
        openDoors={openDoors}
        onToggleDoor={onToggleDoor}
        top={top}
      />
    )

  return (
    <>
      <CutawayWall
        wall={wall}
        floor={floor}
        cutaway={cutaway}
        focus={focus}
        full={
          <>
            {boxes(own)}
            {selected && selected.side !== 'end' && (
              <SideHighlight pieces={inSelection(pieces)} side={selected.side} thickness={thickness} />
            )}
            {selected?.side === 'end' && (
              <EndHighlight pieces={pieces} part={selected.part} offset={offset} thickness={thickness} />
            )}
            {opening()}
          </>
        }
        stub={
          <>
            {boxes(ownStub, true)}
            {selected && selected.side !== 'end' && (
              <SideHighlight pieces={inSelection(stub)} side={selected.side} thickness={thickness} />
            )}
            {selected?.side === 'end' && (
              <EndHighlight pieces={stub} part={selected.part} offset={offset} thickness={thickness} />
            )}
            {opening(STUB_HEIGHT)}
          </>
        }
      />
      {given.map((id) => {
        const corner = pieces.filter((p) => handedOver(p) === id)
        return (
          <CutawayWall
            key={id}
            wall={wall}
            floor={floor}
            cutaway={cutaway}
            focus={focus}
            decider={floor.walls.find((w) => w.id === id)}
            full={boxes(corner)}
            stub={boxes(stubPieces(corner, STUB_HEIGHT), true)}
          />
        )
      })}
    </>
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

/** A picked wall end washed like a side: every piece's end face at that point along the wall. */
const EndHighlight = ({
  pieces,
  part,
  thickness,
  offset = 0,
}: {
  pieces: WallPiece[]
  part: number
  thickness: number
  offset?: number
}) => (
  <>
    {pieces.flatMap((p, i) =>
      ([p.u0, p.u1] as const)
        .filter((u) => endPart(u + offset) === part)
        .map((u) => (
          <mesh
            key={`${i}:${u}`}
            position={[u + (u === p.u1 ? PROUD : -PROUD), (p.y0 + p.y1) / 2, 0]}
            rotation-y={u === p.u1 ? Math.PI / 2 : -Math.PI / 2}
            raycast={noRaycast}
          >
            <planeGeometry args={[thickness, p.y1 - p.y0]} />
            <meshBasicMaterial color={SELECTED_OUTLINE} transparent opacity={0.6} depthWrite={false} />
          </mesh>
        )),
    )}
  </>
)
