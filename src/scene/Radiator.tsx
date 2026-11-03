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

/** Flat-bar towel radiator with five banks separated by broad towel gaps and a central valve block. */
const TowelRail = ({ fixture: { width: w, height: h, depth: d, color = WHITE } }: { fixture: Fixture }) => {
  const groups = [7, 7, 7, 7, 4]
  const barHeight = 0.024,
    margin = 0.04,
    gap = 0.068
  const pitch = (h - 2 * margin - barHeight - (groups.length - 1) * gap) / (groups.reduce((a, b) => a + b, 0) - 1)
  const bars = groups.flatMap((count, bank) => {
    const preceding = groups.slice(0, bank).reduce((a, b) => a + b, 0)
    return Array.from({ length: count }, (_, i) => margin + barHeight / 2 + (preceding + i) * pitch + bank * gap)
  })
  return (
    <>
      {[-1, 1].map((side) => (
        <group key={side}>
          <RoundedBox
            args={[0.028, h, 0.035]}
            radius={0.005}
            smoothness={2}
            position={[side * (w / 2 - 0.014), h / 2, 0]}
            castShadow
            receiveShadow
            raycast={noRaycast}
          >
            <meshStandardMaterial color={color} roughness={0.5} shadowSide={FrontSide} />
          </RoundedBox>
          {[0.18, h - 0.18].map((y) => (
            <Block key={y} at={[side * (w / 2 - 0.014), y, -d / 2]} size={[0.024, 0.024, d]} color={color} />
          ))}
          <Tube at={[side * (w / 2 - 0.014), h + 0.003, 0]} radius={0.009} length={0.006} color={color} />
          <Tube at={[side * 0.025, -0.035, 0]} radius={0.01} length={0.07} color={color} />
        </group>
      ))}
      {bars.map((y, i) => (
        <Block key={i} at={[0, y, 0.013]} size={[w - 0.035, barHeight, 0.014]} color={color} />
      ))}
      <Block at={[0, -0.045, 0.005]} size={[0.09, 0.035, 0.035]} color={color} />
      <Tube at={[0.065, -0.045, 0.005]} radius={0.022} length={0.04} horizontal color={color} />
    </>
  )
}

export const Radiator = ({ fixture }: { fixture: Fixture }) =>
  fixture.kind === 'towelRail' ? <TowelRail fixture={fixture} /> : <Panel fixture={fixture} />
