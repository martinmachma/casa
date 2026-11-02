import { RoundedBox } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import { FrontSide, Quaternion, Vector2, Vector3, type Group } from 'three'
import type { FurnitureItem } from '../data/types'
import type { Fixture, Floor } from '../layout/types'
import { useItemCut } from './ItemCut'
import { MergeParts } from './MergeParts'
import { Radiator } from './Radiator'

// Viessmann's casings are white with an anthracite control strip; the plumbing runs in copper.
const CASING = '#f1f1ef'
const CONTROL = '#3a3d40'
const DISPLAY = '#1d2a33'
const CAP = '#a3a7ab'
const COPPER = '#b8794a'

// The boiler's flue rises to just under the storeroom's lowered ceiling (2.3 m clear), then turns into the
// chimney behind the wall it hangs on.
const FLUE_RADIUS = 0.05
const FLUE_AT = 2.2
const PIPE_RADIUS = 0.011

const noRaycast = () => null

type V = [number, number, number]

/** A straight pipe between two points, with a ball at each end to round off the bends. */
const Pipe = ({ from, to, radius, color }: { from: V; to: V; radius: number; color: string }) => {
  const { position, quaternion, length } = useMemo(() => {
    const a = new Vector3(...from)
    const b = new Vector3(...to)
    const dir = b.clone().sub(a)
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize()),
      length: dir.length(),
    }
  }, [from, to])
  const metal = color === COPPER
  return (
    <>
      <mesh position={position} quaternion={quaternion} castShadow receiveShadow raycast={noRaycast}>
        <cylinderGeometry args={[radius, radius, length, 16]} />
        <meshStandardMaterial
          shadowSide={FrontSide}
          color={color}
          metalness={metal ? 0.6 : 0}
          roughness={metal ? 0.35 : 0.4}
        />
      </mesh>
      {[from, to].map((p, i) => (
        <mesh key={i} position={p} raycast={noRaycast}>
          <sphereGeometry args={[radius, 12, 8]} />
          <meshStandardMaterial color={color} metalness={metal ? 0.6 : 0} roughness={metal ? 0.35 : 0.4} />
        </mesh>
      ))}
    </>
  )
}

/** Wall-hung gas condensing boiler (Vitodens 050-W): a white case, the control strip along its foot. */
const Boiler = ({ fixture }: { fixture: Fixture }) => {
  const { width: w, depth: d, height: h } = fixture
  const z = fixture.z ?? 0
  const back = -d / 2
  const flue = FLUE_AT - z
  const pipes = [-0.13, -0.045, 0.045, 0.13]
  return (
    <>
      <RoundedBox
        args={[w, h, d]}
        radius={0.02}
        smoothness={3}
        position={[0, h / 2, 0]}
        castShadow
        receiveShadow
        raycast={noRaycast}
      >
        <meshStandardMaterial shadowSide={FrontSide} color={CASING} roughness={0.35} />
      </RoundedBox>
      {/* The control strip with its display and buttons. */}
      <mesh position={[0, 0.05, d / 2 + 0.002]} raycast={noRaycast}>
        <boxGeometry args={[w - 0.03, 0.08, 0.004]} />
        <meshStandardMaterial color={CONTROL} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.055, d / 2 + 0.0045]} raycast={noRaycast}>
        <boxGeometry args={[0.07, 0.035, 0.002]} />
        <meshStandardMaterial color={DISPLAY} emissive="#4f8fb5" emissiveIntensity={0.25} roughness={0.2} />
      </mesh>
      {[-0.09, -0.065, 0.065, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.055, d / 2 + 0.0045]} raycast={noRaycast}>
          <boxGeometry args={[0.014, 0.014, 0.003]} />
          <meshStandardMaterial color={CAP} roughness={0.4} />
        </mesh>
      ))}
      {/* The flue: up from the top, then back into the wall to the chimney. */}
      <Pipe from={[0, h, 0]} to={[0, flue, 0]} radius={FLUE_RADIUS} color={CASING} />
      <Pipe from={[0, flue, 0]} to={[0, flue, back - 0.06]} radius={FLUE_RADIUS} color={CASING} />
      {/* Gas, heating flow and return, and the tank's feed: down from the underside and into the wall. */}
      {pipes.map((x) => (
        <group key={x}>
          <Pipe from={[x, 0, back + 0.07]} to={[x, -0.14, back + 0.07]} radius={PIPE_RADIUS} color={COPPER} />
          <Pipe from={[x, -0.14, back + 0.07]} to={[x, -0.14, back - 0.04]} radius={PIPE_RADIUS} color={COPPER} />
        </group>
      ))}
    </>
  )
}

/** Floor-standing hot water tank (Vitocell 100-W): a white cylinder with rounded shoulders on a dark plinth. */
const WaterTank = ({ fixture }: { fixture: Fixture }) => {
  const { width, depth: d, height: h } = fixture
  const r = width / 2
  const plinth = 0.03
  const profile = useMemo(() => {
    const shoulder = 0.06
    const points = [new Vector2(0, plinth), new Vector2(r, plinth), new Vector2(r, h - shoulder)]
    for (let i = 1; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2)
      points.push(new Vector2(r - shoulder + shoulder * Math.cos(a), h - shoulder + shoulder * Math.sin(a)))
    }
    points.push(new Vector2(0, h))
    return points
  }, [r, h])
  const back = -d / 2
  return (
    <>
      <mesh castShadow receiveShadow raycast={noRaycast}>
        <latheGeometry args={[profile, 48]} />
        <meshStandardMaterial shadowSide={FrontSide} color={CASING} roughness={0.35} />
      </mesh>
      <mesh position={[0, plinth / 2, 0]} receiveShadow raycast={noRaycast}>
        <cylinderGeometry args={[r - 0.02, r - 0.02, plinth, 48]} />
        <meshStandardMaterial color={CONTROL} roughness={0.6} />
      </mesh>
      {/* The cover on top, and the thermometer at the front. */}
      <mesh position={[0, h + 0.008, 0]} castShadow raycast={noRaycast}>
        <cylinderGeometry args={[r - 0.1, r - 0.08, 0.016, 48]} />
        <meshStandardMaterial color={CAP} roughness={0.45} />
      </mesh>
      <mesh position={[0, h - 0.22, r]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[0.03, 0.03, 0.012, 24]} />
        <meshStandardMaterial color={CAP} roughness={0.4} />
      </mesh>
      {/* The heating coil's flow and return and the hot water out: up from the top and into the wall behind. */}
      {[-0.08, 0, 0.08].map((x) => (
        <group key={x}>
          <Pipe from={[x, h, back + 0.16]} to={[x, h + 0.12, back + 0.16]} radius={PIPE_RADIUS} color={COPPER} />
          <Pipe from={[x, h + 0.12, back + 0.16]} to={[x, h + 0.12, back - 0.06]} radius={PIPE_RADIUS} color={COPPER} />
        </group>
      ))}
    </>
  )
}

/** One fixture, cut down with the walls like a piece of furniture when it's in the way. */
const FixtureModel = ({ fixture, floor, cutaway }: { fixture: Fixture; floor: Floor; cutaway: boolean }) => {
  const group = useRef<Group>(null)
  const item = useMemo((): FurnitureItem => ({ ...fixture, floor: floor.id, color: CASING }), [fixture, floor.id])
  useItemCut(group, item, floor, cutaway)
  return (
    <group
      ref={group}
      position={[fixture.x, floor.elevation + (fixture.z ?? 0), fixture.y]}
      rotation={[0, -fixture.rotation, 0]}
    >
      <MergeParts>
        {fixture.kind === 'boiler' ? (
          <Boiler fixture={fixture} />
        ) : fixture.kind === 'waterTank' ? (
          <WaterTank fixture={fixture} />
        ) : (
          <Radiator fixture={fixture} />
        )}
      </MergeParts>
    </group>
  )
}

/** The floor's built-in heating equipment, shared by every saved version. */
export const Fixtures = ({ floor, cutaway }: { floor: Floor; cutaway: boolean }) => (
  <>
    {(floor.fixtures ?? []).map((f) => (
      <FixtureModel key={f.id} fixture={f} floor={floor} cutaway={cutaway} />
    ))}
  </>
)
