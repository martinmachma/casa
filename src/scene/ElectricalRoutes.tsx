import { Line } from '@react-three/drei'
import { ELECTRICAL_ROUTES } from '../devices/electrical'
import type { Floor } from '../layout/types'

/** The drawn routes are schematic, never an as-built depth. */
export const ElectricalRoutes = ({ outside, floor }: { outside: boolean; floor: Floor }) => (
  <group>
    {ELECTRICAL_ROUTES.filter((r) => (outside ? r.area !== 'inside' : r.area === 'inside')).map((route) => (
      <Line
        key={route.id}
        points={outside ? route.points : route.points.filter(([, z]) => z <= floor.elevation + floor.height)}
        color={route.kind === 'data' ? '#438caa' : route.kind === 'earth' ? '#8d9b4b' : '#ba7c31'}
        lineWidth={2}
        dashed={route.area !== 'roof'}
        dashSize={0.16}
        gapSize={0.1}
        depthTest={false}
        transparent
        opacity={0.85}
        raycast={() => null}
      />
    ))}
  </group>
)
