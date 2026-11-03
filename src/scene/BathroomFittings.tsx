import { RoundedBox } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import {
  BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  FrontSide,
  Path,
  Quaternion,
  Shape,
  Vector3,
} from 'three'
import type { Fixture } from '../layout/types'
import { BATHROOM_WOOD, SHOWER_RESIN } from './bathroomMaterials'
import { floorBump, floorTexture } from './floorMaterials'

type V = [number, number, number]
const BLACK = '#17191a'
const WHITE = '#f4f3ef'
const noRaycast = () => null

const Block = ({
  at,
  size,
  color = BLACK,
  wood = false,
  roughness,
}: {
  at: V
  size: V
  color?: string
  wood?: boolean
  roughness?: number
}) => (
  <mesh position={at} castShadow receiveShadow raycast={noRaycast}>
    <boxGeometry args={size} />
    <meshStandardMaterial
      color={wood ? '#ffffff' : color}
      shadowSide={FrontSide}
      roughness={roughness ?? (wood ? BATHROOM_WOOD.roughness : 0.5)}
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
      <meshStandardMaterial color={color} shadowSide={FrontSide} roughness={0.5} metalness={0.2} />
    </mesh>
  )
}

const Glass = ({ at, size }: { at: V; size: V }) => (
  <mesh position={at} receiveShadow raycast={noRaycast}>
    <boxGeometry args={size} />
    <meshStandardMaterial color="#c9dadd" transparent opacity={0.08} depthWrite={false} roughness={0.12} />
  </mesh>
)

const TrayMaterial = () => (
  <meshStandardMaterial
    color="#ffffff"
    map={floorTexture(SHOWER_RESIN)}
    bumpMap={floorBump(SHOWER_RESIN)}
    bumpScale={SHOWER_RESIN.bumpScale}
    roughness={SHOWER_RESIN.roughness}
    shadowSide={FrontSide}
  />
)

/** Low stone-resin tray with a shallow fall and a removable drain cover across the short north end. */
const ShowerTray = ({ width: w, depth: d }: { width: number; depth: number }) => {
  const inset = 0.018
  const floor = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute(
      'position',
      new Float32BufferAttribute(
        [
          -w / 2 + inset,
          0.023,
          -d / 2 + inset,
          -w / 2 + inset,
          0.023,
          d / 2 - inset,
          w / 2 - inset,
          0.032,
          d / 2 - inset,
          w / 2 - inset,
          0.032,
          -d / 2 + inset,
        ],
        3,
      ),
    )
    g.setAttribute('uv', new Float32BufferAttribute([0, 0, 0, d, w, d, w, 0], 2))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.computeVertexNormals()
    return g
  }, [w, d])
  useEffect(() => () => floor.dispose(), [floor])
  const cover = -w / 2 + 0.115
  return (
    <>
      <RoundedBox
        args={[w, 0.014, d]}
        position={[0, 0.011, 0]}
        radius={0.003}
        smoothness={2}
        castShadow
        receiveShadow
        raycast={noRaycast}
      >
        <meshStandardMaterial color="#323436" roughness={0.88} shadowSide={FrontSide} />
      </RoundedBox>
      <mesh geometry={floor} receiveShadow raycast={noRaycast}>
        <TrayMaterial />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block
            at={[side * (w / 2 - inset / 2), 0.029, 0]}
            size={[inset, 0.018, d]}
            color="#323436"
            roughness={0.88}
          />
          <Block
            at={[0, 0.029, side * (d / 2 - inset / 2)]}
            size={[w - 2 * inset, 0.018, inset]}
            color="#323436"
            roughness={0.88}
          />
        </group>
      ))}
      <Block at={[cover, 0.026, 0]} size={[0.19, 0.005, d - 0.07]} color="#121415" roughness={0.9} />
      <mesh position={[cover, 0.032, 0]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.17, 0.008, d - 0.09]} />
        <TrayMaterial />
      </mesh>
    </>
  )
}

/** The ALTIS-style corner entry: a fixed pane and sliding door on each exposed side, with paired flat pulls. */
const ShowerEnclosure = ({ width: w, depth: d }: { width: number; depth: number }) => {
  const top = 2.05,
    bottom = 0.04,
    height = top - bottom,
    mid = (top + bottom) / 2
  const left = -w / 2 + 0.014,
    right = w / 2 - 0.014,
    front = d / 2 - 0.014,
    back = -d / 2 + 0.014
  return (
    <>
      {/* Two glass sides form an L; the other two sides are the tiled walls. */}
      <Block at={[0, top, front]} size={[w, 0.035, 0.028]} />
      <Block at={[0, bottom, front]} size={[w, 0.018, 0.024]} />
      <Block at={[left, top, 0]} size={[0.028, 0.035, d]} />
      <Block at={[left, bottom, 0]} size={[0.024, 0.018, d]} />
      {[
        [right, front],
        [left, back],
        [left, front],
      ].map(([x, z], i) => (
        <Block key={i} at={[x, mid, z]} size={[0.026, height, 0.026]} />
      ))}
      <Block at={[0, mid, front]} size={[0.018, height, 0.018]} />
      <Block at={[left, mid, 0]} size={[0.018, height, 0.018]} />
      <Glass at={[w / 4, mid, front - 0.006]} size={[w / 2 - 0.025, height - 0.025, 0.006]} />
      <Glass at={[-w / 4, mid, front + 0.002]} size={[w / 2 - 0.025, height - 0.025, 0.006]} />
      <Glass at={[left + 0.006, mid, -d / 4]} size={[0.006, height - 0.025, d / 2 - 0.025]} />
      <Glass at={[left - 0.002, mid, d / 4]} size={[0.006, height - 0.025, d / 2 - 0.025]} />
      <Block at={[left + 0.055, 1.02, front + 0.032]} size={[0.025, 0.24, 0.022]} />
      <Block at={[left - 0.032, 1.02, front - 0.055]} size={[0.022, 0.24, 0.025]} />
      {[0.92, 1.12].map((y) => (
        <group key={y}>
          <Block at={[left + 0.055, y, front + 0.015]} size={[0.015, 0.015, 0.03]} />
          <Block at={[left - 0.015, y, front - 0.055]} size={[0.03, 0.015, 0.015]} />
        </group>
      ))}
      {/* Small roller housings above the two sliding panels. */}
      <Block at={[-w / 4, top + 0.003, front]} size={[0.045, 0.043, 0.032]} />
      <Block at={[left, top + 0.003, d / 4]} size={[0.032, 0.043, 0.045]} />
    </>
  )
}

/** A thin round head, viewed from its spray face along local +z. */
const SprayHead = ({ radius, rain = false }: { radius: number; rain?: boolean }) => (
  <>
    <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow raycast={noRaycast}>
      <cylinderGeometry args={[radius, radius, rain ? 0.009 : 0.016, 48]} />
      <meshStandardMaterial color={BLACK} roughness={0.5} metalness={0.2} shadowSide={FrontSide} />
    </mesh>
    <mesh position={[0, 0, rain ? 0.005 : 0.009]} receiveShadow raycast={noRaycast}>
      <circleGeometry args={[radius * 0.91, 48]} />
      <meshStandardMaterial color="#4b4c4b" roughness={0.75} />
    </mesh>
    {[8, 16, 24].flatMap((count, ring) =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2,
          r = radius * (0.23 + ring * 0.27)
        return (
          <mesh
            key={`${ring}:${i}`}
            position={[Math.cos(a) * r, Math.sin(a) * r, rain ? 0.0055 : 0.0095]}
            raycast={noRaycast}
          >
            <circleGeometry args={[rain ? 0.0019 : 0.0012, 6]} />
            <meshStandardMaterial color="#151718" roughness={0.9} />
          </mesh>
        )
      }),
    )}
  </>
)

/** Matt black thermostatic mixer, rounded riser, overhead rain disc, adjustable handset and U-shaped hose. */
const ShowerMixer = ({ depth: d, height: h }: { depth: number; height: number }) => {
  const wall = -d / 2,
    back = wall + 0.07,
    bar = back + 0.025
  const arm = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, h - 0.24, back),
        new Vector3(0, h - 0.13, back),
        new Vector3(0, h - 0.065, back + 0.055),
        new Vector3(0, h - 0.06, back + 0.18),
        new Vector3(0, h - 0.06, back + 0.31),
        new Vector3(0, h - 0.085, back + 0.36),
        new Vector3(0, h - 0.14, back + 0.36),
      ]),
    [h, back],
  )
  const hose = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0.025, 0.995, bar),
        new Vector3(-0.035, 0.65, bar + 0.1),
        new Vector3(-0.02, 0.4, bar + 0.12),
        new Vector3(0.12, 0.37, bar + 0.12),
        new Vector3(0.22, 0.52, bar + 0.1),
        new Vector3(0.17, 0.82, bar + 0.07),
        new Vector3(0.11, 1.42, back + 0.055),
      ]),
    [back, bar],
  )
  return (
    <>
      {[-0.095, 0.095].map((x) => (
        <group key={x}>
          <Rod from={[x, 1.04, wall + 0.002]} to={[x, 1.04, wall + 0.012]} radius={0.034} />
          <Rod from={[x, 1.04, wall + 0.01]} to={[x, 1.04, bar]} radius={0.014} />
        </group>
      ))}
      <Rod from={[-0.145, 1.04, bar]} to={[0.145, 1.04, bar]} radius={0.022} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Rod from={[side * 0.1, 1.04, bar]} to={[side * 0.145, 1.04, bar]} radius={0.024} />
          <Rod from={[side * 0.098, 1.04, bar]} to={[side * 0.101, 1.04, bar]} radius={0.0245} color="#383b3c" />
        </group>
      ))}
      <Block at={[0.12, 1.065, bar]} size={[0.012, 0.006, 0.013]} />
      <Rod from={[0, 1.04, back]} to={[0, h - 0.23, back]} radius={0.012} />
      {[1.2, 1.82].map((y) => (
        <group key={y}>
          <Rod from={[0, y, wall + 0.002]} to={[0, y, wall + 0.008]} radius={0.022} />
          <Rod from={[0, y, wall]} to={[0, y, back]} radius={0.009} />
        </group>
      ))}
      <mesh castShadow receiveShadow raycast={noRaycast}>
        <tubeGeometry args={[arm, 40, 0.012, 12, false]} />
        <meshStandardMaterial color={BLACK} roughness={0.5} metalness={0.2} shadowSide={FrontSide} />
      </mesh>
      <group position={[0, h - 0.14, back + 0.36]} rotation={[Math.PI / 2, 0, 0]}>
        <SprayHead radius={0.12} rain />
      </group>
      <Rod from={[0, 1.44, back]} to={[0.11, 1.44, back + 0.055]} radius={0.02} />
      <Rod from={[-0.025, 1.44, back]} to={[0.025, 1.44, back]} radius={0.023} />
      <group position={[0.11, 1.42, back + 0.055]} rotation={[-0.22, 0, -0.08]}>
        <Rod from={[0, 0, 0]} to={[0, 0.15, 0]} radius={0.014} />
        <group position={[0, 0.19, 0]}>
          <SprayHead radius={0.052} />
        </group>
      </group>
      <mesh castShadow receiveShadow raycast={noRaycast}>
        <tubeGeometry args={[hose, 48, 0.008, 8, false]} />
        <meshStandardMaterial color={BLACK} roughness={0.6} shadowSide={FrontSide} />
      </mesh>
    </>
  )
}

const Shower = ({ fixture: { width, depth, height } }: { fixture: Fixture }) => (
  <>
    <ShowerTray width={width} depth={depth} />
    <ShowerEnclosure width={width} depth={depth} />
    <ShowerMixer depth={depth} height={height} />
  </>
)

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

/** A rounded rectangular outline, shared by the countertop opening and each level of its recessed bowl. */
const basinOutline = (width: number, depth: number, radius: number, cx: number, cy: number) => {
  const p = new Path()
  const left = cx - width / 2,
    right = cx + width / 2,
    bottom = cy - depth / 2,
    top = cy + depth / 2
  p.moveTo(left + radius, bottom)
  p.lineTo(right - radius, bottom)
  p.quadraticCurveTo(right, bottom, right, bottom + radius)
  p.lineTo(right, top - radius)
  p.quadraticCurveTo(right, top, right - radius, top)
  p.lineTo(left + radius, top)
  p.quadraticCurveTo(left, top, left, top - radius)
  p.lineTo(left, bottom + radius)
  p.quadraticCurveTo(left, bottom, left + radius, bottom)
  return p
}

/** Wall-hung walnut drawers with a rounded rectangular basin at the window end of a one-metre white counter. */
const Vanity = ({ fixture: { width: w, depth: d, height: h } }: { fixture: Fixture }) => {
  const bx = w / 2 - 0.26,
    bz = 0.025
  const { top, bowl } = useMemo(() => {
    const shape = new Shape()
    shape.moveTo(-w / 2, -d / 2)
    shape.lineTo(w / 2, -d / 2)
    shape.lineTo(w / 2, d / 2)
    shape.lineTo(-w / 2, d / 2)
    shape.closePath()
    shape.holes.push(basinOutline(0.42, 0.3, 0.055, bx, -bz))
    const top = new ExtrudeGeometry(shape, { depth: 0.028, bevelEnabled: false, curveSegments: 12 })
    // Matching outlines join the opening to a flat basin floor through a softly rounded shoulder.
    const levels = [
      [0.42, 0.3, 0.055, 0],
      [0.416, 0.296, 0.055, -0.008],
      [0.394, 0.274, 0.055, -0.028],
      [0.346, 0.222, 0.06, -0.085],
      [0.318, 0.194, 0.06, -0.108],
      [0.3, 0.176, 0.058, -0.115],
    ]
    const rings = levels.map(([width, depth, radius]) =>
      basinOutline(width, depth, radius, bx, -bz).getPoints(12).slice(0, -1),
    )
    const count = rings[0].length
    const positions = rings.flatMap((ring, i) => ring.flatMap((p) => [p.x, levels[i][3], -p.y]))
    const indices: number[] = []
    for (let i = 0; i < rings.length - 1; i++)
      for (let j = 0; j < count; j++) {
        const a = i * count + j,
          b = i * count + ((j + 1) % count),
          c = a + count,
          e = b + count
        indices.push(a, b, c, b, e, c)
      }
    const center = positions.length / 3
    positions.push(bx, -0.115, bz)
    const last = (rings.length - 1) * count
    for (let j = 0; j < count; j++) indices.push(last + j, last + ((j + 1) % count), center)
    const bowl = new BufferGeometry()
    bowl.setAttribute('position', new Float32BufferAttribute(positions, 3))
    bowl.setIndex(indices)
    bowl.computeVertexNormals()
    return { top, bowl }
  }, [w, d, bx, bz])
  useEffect(
    () => () => {
      top.dispose()
      bowl.dispose()
    },
    [top, bowl],
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
      <mesh geometry={bowl} position={[0, h, 0]} receiveShadow raycast={noRaycast}>
        <meshStandardMaterial color={WHITE} roughness={0.24} side={DoubleSide} />
      </mesh>
      <Rod from={[bx, h - 0.114, bz - 0.025]} to={[bx, h - 0.111, bz - 0.025]} radius={0.023} />
      <Rod from={[bx, h, -d / 2 + 0.065]} to={[bx, h + 0.18, -d / 2 + 0.065]} radius={0.017} />
      <Rod from={[bx, h + 0.155, -d / 2 + 0.065]} to={[bx, h + 0.155, bz - 0.06]} radius={0.013} />
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
