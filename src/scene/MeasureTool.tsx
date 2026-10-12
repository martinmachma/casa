import { Line } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import { floorBounds } from '../layout/geometry'
import { floorWallRects } from '../layout/rooms'
import type { Floor, Point } from '../layout/types'
import { OrthographicCamera, PerspectiveCamera } from 'three'
import { alignWith, snapToWallFaces } from '../measure/measure'
import { SELECTED_OUTLINE } from './palette'

const CLICK_SLOP_PX = 5
// Drawn just above the floor finishes and rugs.
const LIFT = 0.03
// Taps this close on screen to a wall face land on it, whatever the zoom.
const SNAP_PX = 16

type MeasureToolProps = {
  floor: Floor
  /** 0, 1 or 2 points already placed. */
  points: Point[]
  onPoint: (p: Point) => void
}

/**
 * Catches taps on the floor plane (everything else is made non-clickable while measuring), snapping them to wall
 * faces and corners, and draws the measured line. The distance itself is shown by the MeasureBar.
 */
export const MeasureTool = ({ floor, points, onPoint }: MeasureToolProps) => {
  const walls = useMemo(() => floorWallRects(floor), [floor])
  const [hover, setHover] = useState<Point>()
  const { min, max } = floorBounds(floor)
  const y = floor.elevation + LIFT
  const camera = useThree((s) => s.camera)
  const height = useThree((s) => s.size.height)

  /** Metres on the floor per screen pixel at the tapped spot. */
  const metresPerPixel = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (camera instanceof OrthographicCamera) return 1 / camera.zoom
    if (camera instanceof PerspectiveCamera) return (2 * e.distance * Math.tan((camera.fov * Math.PI) / 360)) / height
    return 0.01
  }

  const place = (e: ThreeEvent<PointerEvent | MouseEvent>): Point => {
    const tolerance = Math.min(0.4, Math.max(0.03, SNAP_PX * metresPerPixel(e)))
    const p = snapToWallFaces([e.point.x, e.point.z], walls, tolerance)
    return points.length === 1 ? alignWith(points[0], p) : p
  }

  const at = (p: Point): [number, number, number] => [p[0], y, p[1]]
  const preview = points.length === 1 && hover ? [points[0], hover] : undefined

  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[(min[0] + max[0]) / 2, floor.elevation + 0.01, (min[1] + max[1]) / 2]}
        onClick={(e) => {
          if (e.delta > CLICK_SLOP_PX) return
          e.stopPropagation()
          onPoint(place(e))
        }}
        onPointerMove={(e) => setHover(place(e))}
        onPointerOut={() => setHover(undefined)}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {points.length === 2 && <Line points={points.map(at)} color={SELECTED_OUTLINE} lineWidth={3} />}
      {preview && (
        <Line points={preview.map(at)} color={SELECTED_OUTLINE} lineWidth={2} dashed dashSize={0.1} gapSize={0.06} />
      )}
      {[...points, ...(hover && points.length < 2 ? [hover] : [])].map((p, i) => (
        <mesh key={i} position={at(p)} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.05, 20]} />
          <meshBasicMaterial color={SELECTED_OUTLINE} transparent opacity={i < points.length ? 1 : 0.5} />
        </mesh>
      ))}
    </group>
  )
}
