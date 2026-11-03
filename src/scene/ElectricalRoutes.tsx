import { Line } from '@react-three/drei'
import { ELECTRICAL_ROUTES } from '../devices/electrical'

/** Only the roof lightning conductors are visible; cable routes stay in the inventory notes. */
export const ElectricalRoutes = () => (
  <group>
    {ELECTRICAL_ROUTES.filter((r) => r.area === 'roof').map((route) => (
      <Line
        key={route.id}
        points={route.points}
        color="#8d9b4b"
        lineWidth={2}
        depthTest={false}
        transparent
        opacity={0.85}
        raycast={() => null}
      />
    ))}
  </group>
)
