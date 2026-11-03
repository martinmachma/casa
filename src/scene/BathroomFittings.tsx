import { RoundedBox } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import {
  CatmullRomCurve3,
  DoubleSide,
  ExtrudeGeometry,
  FrontSide,
  Path,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
} from 'three'
import type { Fixture } from '../layout/types'
import { BATHROOM_WOOD } from './bathroomMaterials'
import { floorBump, floorTexture } from './floorMaterials'

type V = [number, number, number]
const BLACK = '#17191a'
const WHITE = '#f4f3ef'
const noRaycast = () => null

const Block = ({ at, size, color = BLACK, wood = false }: { at: V; size: V; color?: string; wood?: boolean }) => (
  <mesh position={at} castShadow receiveShadow raycast={noRaycast}>
    <boxGeometry args={size} />
    <meshStandardMaterial
      color={wood ? '#ffffff' : color}
      shadowSide={FrontSide}
      roughness={wood ? BATHROOM_WOOD.roughness : 0.35}
      metalness={color === BLACK && !wood ? 0.25 : 0}
      map={wood ? floorTexture(BATHROOM_WOOD) : undefined}
      bumpMap={wood ? floorBump(BATHROOM_WOOD) : undefined}
      bumpScale={BATHROOM_WOOD.bumpScale}
    />
  </mesh>
)

const Rod = ({ from, to, radius = 0.01, color = BLACK }: { from: V; to: V; radius?: number; color?: string }) => {
  const { center, quaternion, length } = useMemo(() => {
    const a = new Vector3(...from),
      b = new Vector3(...to),
      dir = b.clone().sub(a)
    return {
      center: a.add(b).multiplyScalar(0.5),
      length: dir.length(),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()),
    }
  }, [from, to])
  return (
    <mesh position={center} quaternion={quaternion} castShadow receiveShadow raycast={noRaycast}>
      <cylinderGeometry args={[radius, radius, length, 16]} />
      <meshStandardMaterial color={color} shadowSide={FrontSide} roughness={0.3} metalness={0.3} />
    </mesh>
  )
}

const Glass = ({ at, size }: { at: V; size: V }) => (
  <mesh position={at} receiveShadow raycast={noRaycast}>
    <boxGeometry args={size} />
    <meshStandardMaterial color="#c9dadd" transparent opacity={0.13} depthWrite={false} roughness={0.12} />
  </mesh>
)

/** A low rectangular tray, slim black enclosure, rain head, hand shower and hose. Local +z is its entrance. */
const Shower = ({ fixture: { width: w, depth: d, height: h } }: { fixture: Fixture }) => {
  const tray = 0.045,
    top = 2.05,
    front = d / 2 - 0.012,
    back = -d / 2 + 0.045
  const hose = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0.08, 0.99, back + 0.09),
        new Vector3(0.18, 0.55, back + 0.14),
        new Vector3(-0.1, 0.5, back + 0.17),
        new Vector3(-0.2, 1.5, back + 0.09),
      ]),
    [back],
  )
  return (
    <>
      <RoundedBox
        args={[w, tray, d]}
        position={[0, 0.012 + tray / 2, 0]}
        radius={0.012}
        smoothness={3}
        castShadow
        receiveShadow
        raycast={noRaycast}
      >
        <meshStandardMaterial color="#dddeda" shadowSide={FrontSide} roughness={0.55} />
      </RoundedBox>
      <Block at={[0, tray + 0.014, back + 0.06]} size={[0.3, 0.003, 0.055]} color="#676a69" />
      {Array.from({ length: 9 }, (_, i) => (
        <Block key={i} at={[-0.12 + i * 0.03, tray + 0.016, back + 0.06]} size={[0.009, 0.002, 0.04]} color="#292b2b" />
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block at={[side * (w / 2 - 0.01), top / 2, front]} size={[0.02, top, 0.02]} />
          <Block at={[side * (w / 2 - 0.01), top, 0]} size={[0.02, 0.025, d]} />
          <Block at={[side * (w / 2 - 0.01), tray + 0.02, 0]} size={[0.02, 0.018, d]} />
          <Glass at={[side * (w / 2 - 0.01), (top + tray) / 2, 0]} size={[0.006, top - tray, d - 0.025]} />
        </group>
      ))}
      <Block at={[0, top, front]} size={[w, 0.035, 0.035]} />
      <Block at={[0, tray + 0.02, front]} size={[w, 0.02, 0.025]} />
      <Block at={[0, (top + tray) / 2, front]} size={[0.014, top - tray, 0.014]} />
      {[-1, 1].map((side) => (
        <Glass key={side} at={[(side * w) / 4, (top + tray) / 2, front]} size={[w / 2 - 0.022, top - tray, 0.006]} />
      ))}
      <Rod from={[0.08, 0.85, front + 0.045]} to={[0.08, 1.12, front + 0.045]} radius={0.009} />
      {[0.88, 1.09].map((y) => (
        <Rod key={y} from={[0.08, y, front]} to={[0.08, y, front + 0.045]} radius={0.007} />
      ))}
      <Rod from={[0, 1, back]} to={[0, h - 0.06, back]} radius={0.015} />
      <Rod from={[0, h - 0.06, back]} to={[0, h - 0.06, back + 0.32]} radius={0.015} />
      <Rod from={[0, h - 0.06, back + 0.32]} to={[0, h - 0.11, back + 0.32]} radius={0.015} />
      <Rod from={[0, h - 0.11, back + 0.32]} to={[0, h - 0.13, back + 0.32]} radius={0.115} />
      <Rod from={[-0.17, 1.02, back + 0.06]} to={[0.17, 1.02, back + 0.06]} radius={0.026} />
      <Rod from={[-0.2, 1.45, back + 0.09]} to={[-0.2, 1.61, back + 0.09]} radius={0.018} />
      <Rod from={[-0.2, 1.59, back + 0.09]} to={[-0.2, 1.63, back + 0.12]} radius={0.045} />
      <mesh castShadow raycast={noRaycast}>
        <tubeGeometry args={[hose, 32, 0.009, 8, false]} />
        <meshStandardMaterial color={BLACK} roughness={0.4} />
      </mesh>
    </>
  )
}

/** Closed D-shaped pan, with the cistern and flush plate on the existing WC boxing. */
const Toilet = ({ fixture: { width: w, depth: d, height: h, z = 0 } }: { fixture: Fixture }) => {
  const geometry = useMemo(() => {
    const shape = new Shape()
    const r = w / 2
    shape.moveTo(-r, d / 2)
    shape.lineTo(-r, -d / 2 + r)
    shape.absarc(0, -d / 2 + r, r, Math.PI, 2 * Math.PI, false)
    shape.lineTo(r, d / 2)
    shape.closePath()
    return new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 24 })
  }, [w, d])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <>
      <group position={[0, 0.035, -0.012]} scale={[0.91, h - 0.06, 0.94]}>
        <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow raycast={noRaycast}>
          <meshStandardMaterial color="#e9e9e4" roughness={0.24} shadowSide={FrontSide} />
        </mesh>
      </group>
      <group position={[0, h - 0.035, 0]} scale={[1, 0.009, 1]}>
        <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <meshStandardMaterial color="#b3b6b3" roughness={0.45} />
        </mesh>
      </group>
      <group position={[0, h - 0.024, 0]} scale={[1, 0.024, 1]}>
        <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow raycast={noRaycast}>
          <meshStandardMaterial color={WHITE} roughness={0.22} shadowSide={FrontSide} />
        </mesh>
      </group>
      <Block at={[0, 0.98 - z, -d / 2 + 0.008]} size={[0.23, 0.15, 0.012]} color="#dedfdb" />
      <Block at={[-0.026, 0.98 - z, -d / 2 + 0.016]} size={[0.12, 0.075, 0.008]} color="#edeee9" />
      <Block at={[0.064, 0.98 - z, -d / 2 + 0.016]} size={[0.045, 0.075, 0.008]} color="#edeee9" />
    </>
  )
}

/** Wall-hung walnut drawers, a white integrated basin and a matt black deck mixer. */
const Vanity = ({ fixture: { width: w, depth: d, height: h } }: { fixture: Fixture }) => {
  const bx = w * 0.21,
    bz = 0.025,
    rx = 0.16,
    rz = 0.115
  const top = useMemo(() => {
    const shape = new Shape()
    shape.moveTo(-w / 2, -d / 2)
    shape.lineTo(w / 2, -d / 2)
    shape.lineTo(w / 2, d / 2)
    shape.lineTo(-w / 2, d / 2)
    shape.closePath()
    const hole = new Path()
    hole.absellipse(bx, -bz, rx, rz, 0, Math.PI * 2, true, 0)
    shape.holes.push(hole)
    return new ExtrudeGeometry(shape, { depth: 0.028, bevelEnabled: false, curveSegments: 32 })
  }, [w, d, bx])
  useEffect(() => () => top.dispose(), [top])
  const bowl = useMemo(
    () => [
      new Vector2(0, -0.105),
      new Vector2(0.24, -0.103),
      new Vector2(0.55, -0.087),
      new Vector2(0.8, -0.055),
      new Vector2(0.94, -0.02),
      new Vector2(1, 0),
    ],
    [],
  )
  return (
    <>
      {/* An open carcass leaves space for the recessed basin rather than filling it with wood. */}
      {[-1, 1].map((side) => (
        <Block key={side} at={[side * (w / 2 - 0.018), (h - 0.03) / 2, 0]} size={[0.018, h - 0.03, d - 0.02]} wood />
      ))}
      <Block at={[0, 0.012, 0]} size={[w - 0.035, 0.024, d - 0.02]} wood />
      <Block at={[0, (h - 0.03) / 2, -d / 2 + 0.016]} size={[w - 0.035, h - 0.03, 0.016]} wood />
      {[0, 1].map((i) => (
        <Block
          key={i}
          at={[0, 0.012 + ((i + 0.5) * (h - 0.045)) / 2, d / 2 - 0.006]}
          size={[w, (h - 0.045) / 2 - 0.008, 0.022]}
          wood
        />
      ))}
      <mesh
        geometry={top}
        position={[0, h - 0.028, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
        raycast={noRaycast}
      >
        <meshStandardMaterial color={WHITE} shadowSide={FrontSide} roughness={0.23} />
      </mesh>
      <mesh position={[bx, h, bz]} scale={[rx, 1, rz]} receiveShadow raycast={noRaycast}>
        <latheGeometry args={[bowl, 40]} />
        <meshStandardMaterial color={WHITE} roughness={0.24} side={DoubleSide} />
      </mesh>
      <Rod from={[bx, h - 0.104, bz]} to={[bx, h - 0.1, bz]} radius={0.014} />
      <Rod from={[bx, h, -d / 2 + 0.065]} to={[bx, h + 0.18, -d / 2 + 0.065]} radius={0.017} />
      <Rod from={[bx, h + 0.155, -d / 2 + 0.065]} to={[bx, h + 0.155, bz - 0.025]} radius={0.013} />
      <Block at={[bx, h + 0.192, -d / 2 + 0.08]} size={[0.025, 0.012, 0.075]} />
    </>
  )
}

export const BathroomFitting = ({ fixture }: { fixture: Fixture }) =>
  fixture.kind === 'shower' ? (
    <Shower fixture={fixture} />
  ) : fixture.kind === 'vanity' ? (
    <Vanity fixture={fixture} />
  ) : (
    <Toilet fixture={fixture} />
  )
