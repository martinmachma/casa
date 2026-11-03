import { RoundedBox } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import { BoxGeometry, FrontSide } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Fixture } from '../layout/types'

const WHITE = '#f1f1ed'
const METAL = '#a4a8aa'
const noRaycast = () => null
type V = [number, number, number]

const Block = ({ size, at, color = WHITE }: { size: V; at: V; color?: string }) => (
  <mesh position={at} castShadow receiveShadow raycast={noRaycast}>
    <boxGeometry args={size} />
    <meshStandardMaterial shadowSide={FrontSide} color={color} roughness={0.4} />
  </mesh>
)

const Tube = ({
  at,
  length,
  radius,
  horizontal = false,
  color = WHITE,
}: {
  at: V
  length: number
  radius: number
  horizontal?: boolean
  color?: string
}) => (
  <mesh position={at} rotation-z={horizontal ? Math.PI / 2 : 0} castShadow receiveShadow raycast={noRaycast}>
    <cylinderGeometry args={[radius, radius, length, 16]} />
    <meshStandardMaterial shadowSide={FrontSide} color={color} roughness={0.35} metalness={color === METAL ? 0.6 : 0} />
  </mesh>
)

/** A generic pressed-steel panel with top grille, side covers and a thermostatic valve. */
const Panel = ({ fixture }: { fixture: Fixture }) => {
  const { width: w, height: h, depth: d } = fixture
  const grille = useMemo(() => {
    const count = Math.floor((w - 0.04) / 0.025)
    const parts = Array.from({ length: count }, (_, i) => {
      const x = -w / 2 + 0.03 + (i * (w - 0.06)) / (count - 1)
      return [
        new BoxGeometry(0.008, h - 0.035, 0.004).translate(x, h / 2, d / 2 + 0.002),
        new BoxGeometry(0.01, 0.006, d - 0.025).translate(x, h + 0.002, 0),
      ]
    }).flat()
    const merged = mergeGeometries(parts)!
    parts.forEach((p) => p.dispose())
    return merged
  }, [w, h, d])
  useEffect(() => () => grille.dispose(), [grille])
  const foot = fixture.z ?? 0
  return (
    <>
      <Block size={[w - 0.025, h - 0.025, d - 0.03]} at={[0, h / 2, 0]} color="#b7bab5" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <RoundedBox
            args={[w, h, 0.022]}
            radius={0.005}
            smoothness={2}
            position={[0, h / 2, (side * (d - 0.022)) / 2]}
            castShadow
            receiveShadow
            raycast={noRaycast}
          >
            <meshStandardMaterial shadowSide={FrontSide} color={WHITE} roughness={0.4} />
          </RoundedBox>
          <Block size={[0.015, h, d]} at={[(side * (w - 0.015)) / 2, h / 2, 0]} />
          {fixture.mount === 'floor' ? (
            <>
              <Block size={[0.02, foot + 0.04, 0.035]} at={[side * w * 0.3, -foot / 2 + 0.02, 0]} color={METAL} />
              <Block size={[0.08, 0.015, d + 0.05]} at={[side * w * 0.3, -foot + 0.0075, 0]} />
            </>
          ) : (
            <Block size={[0.03, h * 0.6, 0.04]} at={[side * w * 0.3, h / 2, -d / 2 - 0.02]} color={METAL} />
          )}
        </group>
      ))}
      {/* The small repeated details share a single mesh and do not add shadow draws. */}
      <mesh geometry={grille} receiveShadow raycast={noRaycast}>
        <meshStandardMaterial shadowSide={FrontSide} color={WHITE} roughness={0.4} />
      </mesh>
      <Tube at={[w / 2 + 0.018, h - 0.065, 0]} radius={0.016} length={0.04} horizontal color={METAL} />
      <Tube at={[w / 2 + 0.055, h - 0.065, 0]} radius={0.025} length={0.055} horizontal />
      {[-0.1, -0.045].map((x) => (
        <Tube key={x} at={[w / 2 + x, -0.025, 0]} radius={0.01} length={0.05} color={METAL} />
      ))}
    </>
  )
}

/** Ladder towel warmer, on the bathroom wall marked "žebřík" in the electrical drawing. */
const TowelRail = ({ fixture: { width: w, height: h, depth: d, color = WHITE } }: { fixture: Fixture }) => (
  <>
    {[-1, 1].map((side) => (
      <group key={side}>
        <Tube at={[side * (w / 2 - 0.016), h / 2, 0]} radius={0.016} length={h} color={color} />
        {[0.18, h - 0.18].map((y) => (
          <Block key={y} at={[side * (w / 2 - 0.016), y, -d / 2]} size={[0.025, 0.025, d]} color={color} />
        ))}
        <Tube at={[side * (w / 2 - 0.016), -0.025, 0]} radius={0.013} length={0.05} color={METAL} />
      </group>
    ))}
    {Array.from({ length: 24 }, (_, i) => (
      <Tube
        key={i}
        at={[0, 0.09 + (i * (h - 0.18)) / 23, 0.012]}
        radius={0.011}
        length={w - 0.032}
        color={color}
        horizontal
      />
    ))}
  </>
)

export const Radiator = ({ fixture }: { fixture: Fixture }) =>
  fixture.kind === 'towelRail' ? <TowelRail fixture={fixture} /> : <Panel fixture={fixture} />
