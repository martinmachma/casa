import type { Floor, Roof as RoofLayout } from '../layout/types'
import { roofBoxes } from './roofGeometry'

const noRaycast = () => null

/** The flat roof over the top floor: the slab, a parapet round its edge and the chimney. */
export const Roof = ({ roof, floor }: { roof: RoofLayout; floor: Floor }) => (
  <group>
    {roofBoxes(floor, roof).map((b, i) => (
      <mesh key={i} position={b.at} receiveShadow raycast={noRaycast}>
        <boxGeometry args={b.size} />
        <meshStandardMaterial color={b.color} roughness={0.9} />
      </mesh>
    ))}
  </group>
)
