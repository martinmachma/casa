import { useMemo } from 'react'
import { Shape } from 'three'
import { SELECTED_OUTLINE } from './palette'

type NorthArrowProps = {
  north: number
  center: [number, number, number]
  /** Distance from the centre, metres: just outside the house. */
  radius: number
}

/** A flat arrow on the ground beside the house, pointing north. */
export const NorthArrow = ({ north, center, radius }: NorthArrowProps) => {
  const shape = useMemo(() => {
    // Points along -y in shape space, which the rotation below lays along plan-up (-z).
    const s = new Shape()
    s.moveTo(0, 0.6)
    s.lineTo(0.35, -0.3)
    s.lineTo(0, -0.12)
    s.lineTo(-0.35, -0.3)
    s.closePath()
    return s
  }, [])
  const bearing = (north * Math.PI) / 180
  return (
    <group
      position={[center[0] + Math.sin(bearing) * radius, center[1] + 0.01, center[2] - Math.cos(bearing) * radius]}
      rotation={[-Math.PI / 2, 0, -bearing]}
    >
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={SELECTED_OUTLINE} />
      </mesh>
    </group>
  )
}
