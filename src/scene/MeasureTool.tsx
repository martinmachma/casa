import { Line } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import type { FurnitureItem } from '../data/types'
import { floorBounds } from '../layout/geometry'
import { floorWallRects } from '../layout/rooms'
import type { Floor, Point } from '../layout/types'
import { OrthographicCamera, PerspectiveCamera } from 'three'
import {
  alignWith,
  footprintOutline,
  measuredLine,
  pickFace,
  rectOutline,
  snapToWallFaces,
  type Face,
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

/**
 * Catches taps on the floor plane (everything else is made non-clickable while measuring). Point to point, taps
 * snap to wall faces and corners; face to face, they pick the nearest side of a wall or piece. Draws the measured
 * line; the distance itself is shown by the MeasureBar.
 */
export const MeasureTool = ({ floor, items, measure, onPick }: MeasureToolProps) => {
  const walls = useMemo(() => floorWallRects(floor), [floor])
  const outlines = useMemo(() => [...items.map(footprintOutline), ...walls.map(rectOutline)], [items, walls])
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
  const faces: { face: Face; ghost: boolean }[] = [
    ...picks.flatMap((p) => (p.face ? [{ face: p.face, ghost: false }] : [])),
    ...(hover?.face && picks.length < 2 ? [{ face: hover.face, ghost: true }] : []),
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

      {faces.map(({ face, ghost }, i) => (
        <Line
          key={i}
          points={[at(face.a), at(face.b)]}
          color={SELECTED_OUTLINE}
          lineWidth={ghost ? 3 : 5}
          transparent
          opacity={ghost ? 0.5 : 1}
        />
      ))}
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
