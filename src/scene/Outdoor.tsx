import { useMemo } from 'react'
import type { Outdoor as OutdoorLayout, Shed } from '../layout/types'
import { EXTERIOR_FRAME, GROUND, LAWN, PAVING, SHED_ROOF, SHED_WOOD } from './palette'
import { prismGeometry } from './prism'

const LAWN_DEPTH = 0.05
const ROOF = 0.08
const EAVE = 0.1
const DOOR_HEIGHT = 1.9
// The land around the plot, a little below the lawn so the two never flicker.
const GROUND_SIZE = 120
const GROUND_DROP = 0.01

const noRaycast = () => null

/** The garden behind the house: lawn, the paved terrace and the shed, on open ground all around. */
export const Outdoor = ({ outdoor }: { outdoor: OutdoorLayout }) => {
  const lawn = useMemo(() => prismGeometry(outdoor.garden, LAWN_DEPTH), [outdoor.garden])
  const terrace = useMemo(
    () => prismGeometry(outdoor.terrace.outline, outdoor.terrace.level - outdoor.level),
    [outdoor.terrace, outdoor.level],
  )
  const xs = outdoor.garden.map((p) => p[0])
  const ys = outdoor.garden.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cz = (Math.min(...ys) + Math.max(...ys)) / 2
  return (
    <group>
      <mesh
        position={[cx, outdoor.level - GROUND_DROP, cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        raycast={noRaycast}
      >
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color={GROUND} roughness={1} />
      </mesh>
      <mesh geometry={lawn} position={[0, outdoor.level, 0]} receiveShadow raycast={noRaycast}>
        <meshStandardMaterial color={LAWN} roughness={1} />
      </mesh>
      <mesh geometry={terrace} position={[0, outdoor.terrace.level, 0]} receiveShadow raycast={noRaycast}>
        <meshStandardMaterial color={PAVING} roughness={0.95} />
      </mesh>
      {outdoor.sheds.map((s) => (
        <ShedMesh key={s.id} shed={s} base={outdoor.terrace.level} />
      ))}
    </group>
  )
}

const ShedMesh = ({ shed, base }: { shed: Shed; base: number }) => {
  const w = shed.x1 - shed.x0
  const d = shed.y1 - shed.y0
  const cx = (shed.x0 + shed.x1) / 2
  const cz = (shed.y0 + shed.y1) / 2
  const door = shed.door && doorPlacement(shed)
  return (
    <group position={[0, base, 0]}>
      <mesh position={[cx, shed.height / 2, cz]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[w, shed.height, d]} />
        <meshStandardMaterial color={SHED_WOOD} roughness={0.85} />
      </mesh>
      <mesh position={[cx, shed.height + ROOF / 2, cz]} castShadow raycast={noRaycast}>
        <boxGeometry args={[w + 2 * EAVE, ROOF, d + 2 * EAVE]} />
        <meshStandardMaterial color={SHED_ROOF} roughness={0.8} />
      </mesh>
      {door && (
        <mesh position={door.at} rotation={[0, door.turn, 0]} raycast={noRaycast}>
          <boxGeometry args={[door.width, DOOR_HEIGHT, 0.02]} />
          <meshStandardMaterial color={EXTERIOR_FRAME} roughness={0.7} />
        </mesh>
      )}
    </group>
  )
}

/** Where the door panel sits, just proud of its side; `offset` runs from the side's north or west end. */
const doorPlacement = (shed: Shed) => {
  const { side, offset, width } = shed.door!
  const y = DOOR_HEIGHT / 2
  const along = offset + width / 2
  switch (side) {
    case 'east':
      return { at: [shed.x1 + 0.011, y, shed.y0 + along] as [number, number, number], turn: Math.PI / 2, width }
    case 'west':
      return { at: [shed.x0 - 0.011, y, shed.y0 + along] as [number, number, number], turn: Math.PI / 2, width }
    case 'north':
      return { at: [shed.x0 + along, y, shed.y0 - 0.011] as [number, number, number], turn: 0, width }
    case 'south':
      return { at: [shed.x0 + along, y, shed.y1 + 0.011] as [number, number, number], turn: 0, width }
  }
}
