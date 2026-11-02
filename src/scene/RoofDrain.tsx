import { Edges } from '@react-three/drei'
import { SELECTED_OUTLINE } from './palette'

const noRaycast = () => null
const METAL = '#74797d'

/** A small drain grille. Its top stands above the membrane, avoiding coplanar roof surfaces. */
export const RoofDrain = ({ selected }: { selected: boolean }) => (
  <group>
    <mesh castShadow receiveShadow raycast={noRaycast}>
      <cylinderGeometry args={[0.09, 0.09, 0.02, 32]} />
      <meshStandardMaterial color="#292d30" roughness={0.9} />
      {selected && <Edges color={SELECTED_OUTLINE} />}
    </mesh>
    <mesh position-y={0.01} rotation-x={Math.PI / 2} castShadow receiveShadow raycast={noRaycast}>
      <torusGeometry args={[0.083, 0.006, 8, 32]} />
      <meshStandardMaterial color={METAL} roughness={0.65} metalness={0.6} />
    </mesh>
    {[-0.05, -0.025, 0, 0.025, 0.05].map((z) => (
      <mesh key={z} position={[0, 0.014, z]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[2 * Math.sqrt(0.077 ** 2 - z ** 2), 0.005, 0.008]} />
        <meshStandardMaterial color={METAL} roughness={0.65} metalness={0.6} />
      </mesh>
    ))}
  </group>
)
