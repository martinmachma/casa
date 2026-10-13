import { Line } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import type { FurnitureItem } from '../data/types'
import { floorBounds, wallAngle, wallPieces, wallThickness } from '../layout/geometry'
import { floorWallRects } from '../layout/rooms'
import type { Floor, Point, Wall } from '../layout/types'
import { OrthographicCamera, PerspectiveCamera } from 'three'
import {
  alignWith,
  footprintOutline,
  measuredLine,
  pickFace,
  rectOutline,
  snapToWallFaces,
  type MeasurePick,
  type Measurement,
} from '../measure/measure'
import { SELECTED_OUTLINE } from './palette'

const CLICK_SLOP_PX = 5
// Drawn just above the floor finishes and rugs.
const LIFT = 0.03
// Taps this close on screen to a wall face land on it, whatever the zoom.
const SNAP_PX = 16
// Measuring between faces, a tap this close on screen to a side picks it.
const FACE_PX = 28

type MeasureToolProps = {
  floor: Floor
  /** Pieces on this floor; their sides can be picked when measuring between faces. */
  items: FurnitureItem[]
  measure: Measurement
  onPick: (pick: MeasurePick) => void
}

// Highlights sit this far proud of the wall or piece they cover, so they don't flicker against it.
const PROUD = 0.006

/** What a picked face belongs to: a wall, or a piece of furniture. */
type Owner = { wall: Wall } | { item: FurnitureItem }

/**
 * Catches taps on the floor plane (everything else is made non-clickable while measuring). Point to point, taps
 * snap to wall faces and corners; face to face, they pick the nearest side of a wall or piece, and the whole wall
 * or piece lights up. Draws the measured line; the distance is shown in the measure panel and on the line.
 */
export const MeasureTool = ({ floor, items, measure, onPick }: MeasureToolProps) => {
  const walls = useMemo(() => floorWallRects(floor), [floor])
  const outlines = useMemo(() => [...items.map(footprintOutline), ...walls.map(rectOutline)], [items, walls])
  const owners = useMemo<Owner[]>(
    () => [...items.map((item) => ({ item })), ...floor.walls.map((wall) => ({ wall }))],
    [items, floor],
  )
  // A face's ends are corners of the outline it came from.
  const ownerOf = (pick: MeasurePick | undefined) => {
    const face = pick?.face
    if (!face) return undefined
    const has = (o: Point[], p: Point) => o.some((q) => q[0] === p[0] && q[1] === p[1])
    return owners[outlines.findIndex((o) => has(o, face.a) && has(o, face.b))]
  }
  const [hover, setHover] = useState<MeasurePick>()
  const { min, max } = floorBounds(floor)
  const y = floor.elevation + LIFT
  const camera = useThree((s) => s.camera)
  const height = useThree((s) => s.size.height)
  const { mode, picks } = measure

  /** Metres on the floor per screen pixel at the tapped spot. */
  const metresPerPixel = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (camera instanceof OrthographicCamera) return 1 / camera.zoom
    if (camera instanceof PerspectiveCamera) return (2 * e.distance * Math.tan((camera.fov * Math.PI) / 360)) / height
    return 0.01
  }

  const place = (e: ThreeEvent<PointerEvent | MouseEvent>): MeasurePick | undefined => {
    const p: Point = [e.point.x, e.point.z]
    if (mode === 'faces') {
      const tolerance = Math.min(0.5, Math.max(0.05, FACE_PX * metresPerPixel(e)))
      return pickFace(p, outlines, tolerance, picks.length === 1 ? picks[0].face : undefined)
    }
    const tolerance = Math.min(0.4, Math.max(0.03, SNAP_PX * metresPerPixel(e)))
    const at = snapToWallFaces(p, walls, tolerance)
    return { at: picks.length === 1 ? alignWith(picks[0].at, at) : at }
  }

  const at = (p: Point): [number, number, number] => [p[0], y, p[1]]
  const done = measuredLine(measure)
  const preview = picks.length === 1 && hover ? measuredLine({ mode, picks: [picks[0], hover] }) : undefined
  const lit: { owner: Owner; ghost: boolean }[] = [
    ...picks.flatMap((p) => (ownerOf(p) ? [{ owner: ownerOf(p)!, ghost: false }] : [])),
    ...(picks.length < 2 && ownerOf(hover) ? [{ owner: ownerOf(hover)!, ghost: true }] : []),
  ]
  const dots = mode === 'points' ? [...picks, ...(hover && picks.length < 2 ? [hover] : [])] : []

  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[(min[0] + max[0]) / 2, floor.elevation + 0.01, (min[1] + max[1]) / 2]}
        onClick={(e) => {
          if (e.delta > CLICK_SLOP_PX) return
          e.stopPropagation()
          const pick = place(e)
          if (pick) onPick(pick)
        }}
        onPointerMove={(e) => setHover(place(e))}
        onPointerOut={() => setHover(undefined)}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {lit.map(({ owner, ghost }, i) =>
        'wall' in owner ? (
          <WallHighlight key={i} wall={owner.wall} floor={floor} ghost={ghost} />
        ) : (
          <ItemHighlight key={i} item={owner.item} elevation={floor.elevation} ghost={ghost} />
        ),
      )}
      {done && <Line points={[at(done.from), at(done.to)]} color={SELECTED_OUTLINE} lineWidth={3} />}
      {preview && (
        <Line
          points={[at(preview.from), at(preview.to)]}
          color={SELECTED_OUTLINE}
          lineWidth={2}
          dashed
          dashSize={0.1}
          gapSize={0.06}
        />
      )}
      {dots.map((p, i) => (
        <mesh key={i} position={at(p.at)} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.05, 20]} />
          <meshBasicMaterial color={SELECTED_OUTLINE} transparent opacity={i < picks.length ? 1 : 0.5} />
        </mesh>
      ))}
    </group>
  )
}

const HighlightMaterial = ({ ghost }: { ghost: boolean }) => (
  <meshBasicMaterial color={SELECTED_OUTLINE} transparent opacity={ghost ? 0.28 : 0.6} depthWrite={false} />
)

/** The whole wall, openings and all, washed in the accent colour. */
const WallHighlight = ({ wall, floor, ghost }: { wall: Wall; floor: Floor; ghost: boolean }) => {
  const thickness = wallThickness(wall, floor)
  const pieces = useMemo(() => wallPieces(wall, floor.height, thickness / 2), [wall, floor.height, thickness])
  return (
    <group position={[wall.from[0], floor.elevation, wall.from[1]]} rotation={[0, -wallAngle(wall), 0]}>
      {pieces.map((p, i) => (
        <mesh key={i} position={[(p.u0 + p.u1) / 2, (p.y0 + p.y1) / 2, 0]} raycast={noRaycast}>
          <boxGeometry args={[p.u1 - p.u0 + 2 * PROUD, p.y1 - p.y0 + 2 * PROUD, thickness + 2 * PROUD]} />
          <HighlightMaterial ghost={ghost} />
        </mesh>
      ))}
    </group>
  )
}

const ItemHighlight = ({ item, elevation, ghost }: { item: FurnitureItem; elevation: number; ghost: boolean }) => {
  const height = Math.max(item.height, 0.02)
  return (
    <mesh position={[item.x, elevation + height / 2, item.y]} rotation={[0, -item.rotation, 0]} raycast={noRaycast}>
      <boxGeometry args={[item.width + 2 * PROUD, height + 2 * PROUD, item.depth + 2 * PROUD]} />
      <HighlightMaterial ghost={ghost} />
    </mesh>
  )
}

const noRaycast = () => null
