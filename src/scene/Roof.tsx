import { useMemo } from 'react'
import { ExtrudeGeometry, Shape } from 'three'
import { floorBounds } from '../layout/geometry'
import type { Floor, Roof as RoofLayout } from '../layout/types'
import { DEFAULT_WALL, ROOF_TILE } from './palette'

const THICKNESS = 0.18
const GABLE = 0.12
const CAP = 0.12
/** How far the chimney stands above where the roof meets it. */
const STACK = 0.8

const noRaycast = () => null

/** The gable roof over the top floor: two slopes, the triangular gable walls under them and the chimney. */
export const Roof = ({ roof, floor }: { roof: RoofLayout; floor: Floor }) => {
  const { min, max } = floorBounds(floor)
  const alongX = max[0] - min[0] > max[1] - min[1]
  // Local frame: x across the ridge, z along it, y up from the wall tops; turned a quarter when the ridge runs east-west.
  const across = alongX ? max[1] - min[1] : max[0] - min[0]
  const along = alongX ? max[0] - min[0] : max[1] - min[1]
  const cx = (min[0] + max[0]) / 2
  const cz = (min[1] + max[1]) / 2
  const top = floor.elevation + floor.height

  const p = (roof.pitch * Math.PI) / 180
  const half = across / 2
  const reach = half + roof.overhang
  const slope = reach / Math.cos(p)
  const rise = half * Math.tan(p)
  // Middle of a slope's underside, then out along its normal to the middle of the slab.
  const midX = reach / 2 + (THICKNESS / 2) * Math.sin(p)
  const midY = (half - reach / 2) * Math.tan(p) + (THICKNESS / 2) * Math.cos(p)
  const length = along + 2 * roof.overhang

  const gable = useMemo(() => {
    const shape = new Shape()
    shape.moveTo(-half, 0)
    shape.lineTo(half, 0)
    shape.lineTo(0, rise)
    shape.closePath()
    return new ExtrudeGeometry(shape, { depth: GABLE, bevelEnabled: false })
  }, [half, rise])

  /** The roof's top surface above a plan point. */
  const surfaceAt = (x: number, y: number) =>
    top + (half - Math.abs(alongX ? y - cz : x - cx)) * Math.tan(p) + THICKNESS / Math.cos(p)
  const chimney = roof.chimney
  const stackTop =
    chimney &&
    Math.max(...[chimney.x0, chimney.x1].flatMap((x) => [chimney.y0, chimney.y1].map((y) => surfaceAt(x, y)))) + STACK

  return (
    <group>
      <group position={[cx, top, cz]} rotation={[0, alongX ? Math.PI / 2 : 0, 0]}>
        {[1, -1].map((side) => (
          <mesh
            key={side}
            position={[side * midX, midY, 0]}
            rotation={[0, 0, -side * p]}
            castShadow
            receiveShadow
            raycast={noRaycast}
          >
            <boxGeometry args={[slope, THICKNESS, length]} />
            <meshStandardMaterial color={ROOF_TILE} roughness={0.85} />
          </mesh>
        ))}
        <mesh position={[0, rise + THICKNESS / Math.cos(p), 0]} castShadow raycast={noRaycast}>
          <boxGeometry args={[0.26, CAP, length]} />
          <meshStandardMaterial color={ROOF_TILE} roughness={0.85} />
        </mesh>
        {[-1, 1].map((end) => (
          <mesh
            key={end}
            geometry={gable}
            position={[0, 0, end === -1 ? -along / 2 : along / 2 - GABLE]}
            castShadow
            receiveShadow
            raycast={noRaycast}
          >
            <meshStandardMaterial color={DEFAULT_WALL} roughness={0.9} />
          </mesh>
        ))}
      </group>
      {chimney && stackTop && (
        <mesh
          position={[(chimney.x0 + chimney.x1) / 2, (top + stackTop) / 2, (chimney.y0 + chimney.y1) / 2]}
          castShadow
          raycast={noRaycast}
        >
          <boxGeometry args={[chimney.x1 - chimney.x0, stackTop - top, chimney.y1 - chimney.y0]} />
          <meshStandardMaterial color={DEFAULT_WALL} roughness={0.9} />
        </mesh>
      )}
    </group>
  )
}
