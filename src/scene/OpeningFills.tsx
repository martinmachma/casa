import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { FrontSide, Group, InstancedMesh, MathUtils, Mesh, Object3D, Plane, Vector3 } from 'three'
import { DOOR_SWING, OPENING_FRAME as FRAME, openingId, openingSill, shadeId } from '../layout/geometry'
import { SHADE_UP, type ShadeState } from '../devices/shades'
import type { Opening, WallSide } from '../layout/types'
import { raycastIfShown } from './raycast'
import { DOOR_LEAF, EXTERIOR_FRAME, GLASS, HANDLE, INTERIOR_FRAME, SHADE } from './palette'

const FRAME_DEPTH = 0.08
const LEAF = 0.04
/** How quickly doors move, per second (exponential easing). */
const SPEED = 6
// A pointer that moved further than this between down and up was an orbit/pan, not a click.
const CLICK_SLOP_PX = 5

// Switching back must name the default: R3F leaves a raycast set to undefined unset, and nothing gets hit.
const noRaycast = () => null

/** Clipped fills retain physical shading on their remaining faces, just like shortened wall sides. */
const FillMaterial = ({
  section,
  color,
  transparent,
  opacity,
  depthWrite,
  roughness,
  metalness,
}: {
  section?: boolean
  color: string
  transparent?: boolean
  opacity?: number
  depthWrite?: boolean
  roughness?: number
  metalness?: number
}) => (
  <meshStandardMaterial
    shadowSide={FrontSide}
    color={color}
    transparent={transparent}
    opacity={opacity}
    depthWrite={depthWrite}
    roughness={section ? 1 : roughness}
    metalness={section ? 0 : metalness}
  />
)

type Box = { at: [number, number, number]; size: [number, number, number]; color: string }

/** A frame around the opening: two jambs and a head, plus a sill bar for windows. */
const frame = (u0: number, u1: number, y0: number, y1: number, color: string, bottom: boolean): Box[] => {
  const h = y1 - y0
  const boxes: Box[] = [
    { at: [u0 + FRAME / 2, y0 + h / 2, 0], size: [FRAME, h, FRAME_DEPTH], color },
    { at: [u1 - FRAME / 2, y0 + h / 2, 0], size: [FRAME, h, FRAME_DEPTH], color },
    { at: [(u0 + u1) / 2, y1 - FRAME / 2, 0], size: [u1 - u0, FRAME, FRAME_DEPTH], color },
  ]
  if (bottom) boxes.push({ at: [(u0 + u1) / 2, y0 + FRAME / 2, 0], size: [u1 - u0, FRAME, FRAME_DEPTH], color })
  return boxes
}

const Boxes = ({ boxes, section }: { boxes: Box[]; section?: boolean }) =>
  boxes.map((b, k) => (
    <mesh key={k} position={b.at} castShadow receiveShadow raycast={noRaycast}>
      <boxGeometry args={b.size} />
      <FillMaterial section={section} color={b.color} roughness={0.6} />
    </mesh>
  ))

/** Closed doors and glazed windows sitting in a wall's openings, in the wall's own frame (u along it, y up). */
export const OpeningFills = ({
  wallId,
  openings,
  exterior,
  outside,
  thickness,
  clickable,
  top,
  openDoors,
  onToggleDoor,
  shades,
  onPickShade,
}: {
  wallId: string
  openings: Opening[]
  openDoors: ReadonlySet<string>
  onToggleDoor: (id: string) => void
  /** Outer walls' doors and windows get dark aluminium frames. */
  exterior: boolean
  /** The face looking out of the house, where windows and sliding doors get an outside shade. */
  outside?: WallSide
  thickness: number
  shades: Readonly<Record<string, ShadeState>>
  /** Opens a shade's controls when it's tapped; left out, shades don't take taps. */
  onPickShade?: (id: string) => void
  /** Whether a tap on a door opens or closes it. */
  clickable: boolean
  /** In a wall cut down to its stub: only what's below this height is drawn. */
  top?: number
}) => {
  const section = top !== undefined
  const shaded = (o: Opening) => !!outside && (o.type === 'window' || o.type === 'sliding')
  const frameColor = exterior ? EXTERIOR_FRAME : INTERIOR_FRAME
  const fills = (
    <group>
      {openings.map((o, i) => {
        if (o.type === 'passage') return null
        const id = openingId(wallId, i)
        const door = { section, open: openDoors.has(id), onToggle: () => onToggleDoor(id), clickable }
        const u0 = o.offset
        const u1 = o.offset + o.width
        const y0 = openingSill(o)
        const y1 = y0 + o.height
        const window = o.type === 'window'
        const inner = { u0: u0 + FRAME, u1: u1 - FRAME, y0: window ? y0 + FRAME : y0, y1: y1 - FRAME }
        return (
          // A window with a shade is one item: opened, it's drawn clear of the dimmed rest.
          <group key={id} userData={shaded(o) ? { itemId: shadeId(id) } : undefined}>
            <Boxes boxes={frame(u0, u1, y0, y1, frameColor, window)} section={section} />
            {o.type === 'window' && <Glass inner={inner} section={section} />}
            {o.type === 'door' && (
              <Door
                inner={inner}
                color={exterior ? EXTERIOR_FRAME : DOOR_LEAF}
                atEnd={o.hinge === 'to'}
                intoB={o.swing === 'b'}
                {...door}
              />
            )}
            {o.type === 'sliding' && <SlidingDoor inner={inner} {...door} />}
            {shaded(o) && (
              <Shade
                u0={u0}
                u1={u1}
                y0={y0}
                y1={y1}
                z={(outside === 'a' ? 1 : -1) * (thickness / 2 - SHADE_INSET)}
                section={section}
                state={shades[shadeId(id)] ?? SHADE_UP}
                onPick={onPickShade && (() => onPickShade(shadeId(id)))}
              />
            )}
          </group>
        )
      })}
    </group>
  )
  return top === undefined ? fills : <ClipAbove top={top}>{fills}</ClipAbove>
}

/** Draws its children only below `top`, measured from where it stands. */
const ClipAbove = ({ top, children }: { top: number; children: ReactNode }) => {
  const gl = useThree((s) => s.gl)
  const group = useRef<Group>(null)
  const plane = useMemo(() => new Plane(new Vector3(0, -1, 0), 0), [])
  useLayoutEffect(() => {
    gl.localClippingEnabled = true
    const g = group.current
    if (!g) return
    g.updateWorldMatrix(true, false)
    plane.constant = new Vector3().setFromMatrixPosition(g.matrixWorld).y + top
    g.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh) for (const mat of [m.material].flat()) mat.clippingPlanes = [plane]
    })
  })
  return <group ref={group}>{children}</group>
}

type Inner = { u0: number; u1: number; y0: number; y1: number }

const Glass = ({ inner, z = 0, section }: { inner: Inner; z?: number; section?: boolean }) => (
  <mesh position={[(inner.u0 + inner.u1) / 2, (inner.y0 + inner.y1) / 2, z]} raycast={noRaycast}>
    <boxGeometry args={[inner.u1 - inner.u0, inner.y1 - inner.y0, 0.012]} />
    <FillMaterial section={section} color={GLASS} transparent opacity={0.28} roughness={0.05} depthWrite={false} />
  </mesh>
)

/** Open or closed on a tap, and how far it has got (0 closed to 1 open), eased each frame. */
type DoorState = { open: boolean; onToggle: () => void; clickable: boolean; section?: boolean }

const useToggle = ({ open, onToggle, clickable }: DoorState, apply: (group: Group, amount: number) => void) => {
  const group = useRef<Group>(null)
  const amount = useRef(0)
  useFrame(({ invalidate }, dt) => {
    const target = open ? 1 : 0
    if (!group.current || amount.current === target) return
    invalidate()
    amount.current = MathUtils.damp(amount.current, target, SPEED, dt)
    if (Math.abs(amount.current - target) < 0.001) amount.current = target
    apply(group.current, amount.current)
  })
  const handlers = clickable
    ? {
        raycast: raycastIfShown,
        onClick: (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > CLICK_SLOP_PX) return
          e.stopPropagation()
          onToggle()
        },
        onPointerOver: (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), (document.body.style.cursor = 'pointer')),
        onPointerOut: () => (document.body.style.cursor = ''),
      }
    : { raycast: noRaycast }
  return { group, handlers }
}

/** A leaf hinged at the opening's start (or end), swinging into side 'a' (+z) or 'b' (-z). */
const Door = ({
  inner,
  color,
  atEnd,
  intoB,
  section,
  ...state
}: { inner: Inner; color: string; atEnd: boolean; intoB: boolean } & DoorState) => {
  // The leaf reaches from the hinge along the wall; this turns it towards the side it opens into.
  const turn = (atEnd ? 1 : -1) * (intoB ? -1 : 1) * DOOR_SWING
  const { group, handlers } = useToggle(state, (g, t) => (g.rotation.y = t * turn))
  const w = (inner.u1 - inner.u0) * (atEnd ? -1 : 1)
  const h = inner.y1 - inner.y0
  return (
    <group ref={group} position={[atEnd ? inner.u1 : inner.u0, 0, 0]}>
      <mesh position={[w / 2, inner.y0 + h / 2, 0]} castShadow receiveShadow {...handlers}>
        <boxGeometry args={[Math.abs(w), h, LEAF]} />
        <FillMaterial section={section} color={color} roughness={0.7} />
      </mesh>
      {/* A handle on each face, near the edge away from the hinge. */}
      <mesh position={[w - Math.sign(w) * 0.08, inner.y0 + 1.05, 0]} {...handlers}>
        <boxGeometry args={[0.12, 0.02, LEAF + 0.08]} />
        <FillMaterial section={section} color={HANDLE} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

/** A glazed panel just inside the frame, sliding along the wall towards its end (+u), over whatever is next to it. */
const SlidingDoor = ({ inner, section, ...state }: { inner: Inner } & DoorState) => {
  const w = inner.u1 - inner.u0
  const z = FRAME_DEPTH / 2 + LEAF / 2 + 0.005
  const { group, handlers } = useToggle(state, (g, t) => (g.position.x = inner.u0 + t * (w - FRAME)))
  const panel: Inner = { u0: FRAME, u1: w - FRAME, y0: inner.y0 + FRAME, y1: inner.y1 - FRAME }
  const boxes = frame(0, w, inner.y0, inner.y1, EXTERIOR_FRAME, true).map((b) => ({
    ...b,
    size: [b.size[0], b.size[1], LEAF] as Box['size'],
  }))
  return (
    <group ref={group} position={[inner.u0, 0, z]}>
      {boxes.map((b, k) => (
        <mesh key={k} position={b.at} castShadow receiveShadow {...handlers}>
          <boxGeometry args={b.size} />
          <FillMaterial section={section} color={b.color} roughness={0.6} />
        </mesh>
      ))}
      {/* The glass takes taps too, so the whole panel opens it. */}
      <mesh position={[w / 2, (panel.y0 + panel.y1) / 2, 0]} {...handlers}>
        <boxGeometry args={[panel.u1 - panel.u0, panel.y1 - panel.y0, 0.012]} />
        <FillMaterial section={section} color={GLASS} transparent opacity={0.28} roughness={0.05} depthWrite={false} />
      </mesh>
      <mesh position={[0.03, inner.y0 + 1.05, LEAF / 2 + 0.01]} {...handlers}>
        <boxGeometry args={[0.02, 0.3, 0.02]} />
        <FillMaterial section={section} color={HANDLE} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

/** How far in from the wall's outer face the shade's slats are centred, in the reveal outside the glazing. */
const SHADE_INSET = 0.045
/** Zetta 70: 70 mm Z-shaped slats on a 63 mm pitch, stacking to about 9 mm each when raised. */
const SLAT_DEPTH = 0.07
const SLAT_PITCH = 0.063
const SLAT_STACKED = 0.009
const SLAT_THICK = 0.006
/** How far hanging slats turn from flat when tilted fully shut, radians. */
const SLAT_SHUT = 1.4
const RAIL = 0.025
const HEAD = 0.05
const BOTTOM = 0.03
/** How quickly a shade travels and its slats turn, per second (exponential easing); slower than a door. */
const SHADE_SPEED = 3

/**
 * An outside venetian shade (Isotra Zetta 70) in the window's reveal: guide rails at the sides and a head profile
 * above. Let down, its slats hang from the head on their ladders, turned by the tilt; the rest stack on the bottom
 * bar, as a real one gathers them when it's raised. Tapping it opens its controls.
 */
const Shade = ({
  u0,
  u1,
  y0,
  y1,
  z,
  state,
  section,
  onPick,
}: {
  u0: number
  u1: number
  y0: number
  y1: number
  z: number
  state: ShadeState
  section: boolean
  onPick?: () => void
}) => {
  const slats = useRef<InstancedMesh>(null)
  const bottom = useRef<Mesh>(null)
  const pick = useRef<Mesh>(null)
  const shown = useRef<ShadeState | undefined>(undefined)
  const w = u1 - u0
  const top = y1 - HEAD
  const count = Math.max(1, Math.floor((y1 - y0 - HEAD - BOTTOM) / SLAT_PITCH))
  const dummy = useMemo(() => new Object3D(), [])
  const place = ({ position, tilt }: ShadeState) => {
    // How many slats hang (fractionally); the others lie stacked under the last one.
    const hanging = position * count
    if (slats.current) {
      for (let k = 0; k < count; k++) {
        const down = Math.min(k + 1, hanging) * SLAT_PITCH + Math.max(0, k + 1 - hanging) * SLAT_STACKED
        dummy.position.set(0, top - down, 0)
        dummy.rotation.set(tilt * SLAT_SHUT * MathUtils.clamp(hanging - k, 0, 1), 0, 0)
        dummy.updateMatrix()
        slats.current.setMatrixAt(k, dummy.matrix)
      }
      slats.current.instanceMatrix.needsUpdate = true
      slats.current.computeBoundingSphere()
    }
    const end = top - hanging * SLAT_PITCH - (count - hanging) * SLAT_STACKED
    bottom.current?.position.setY(end - BOTTOM / 2)
    // The taps land on a sheet over whatever is down, from the head to the bottom bar.
    pick.current?.scale.setY(y1 - end + BOTTOM)
    pick.current?.position.setY((y1 + end - BOTTOM) / 2)
  }
  useLayoutEffect(() => {
    if (!shown.current) place((shown.current = { ...state }))
  })
  useFrame(({ invalidate }, dt) => {
    const s = shown.current
    if (!s || (s.position === state.position && s.tilt === state.tilt)) return
    invalidate()
    for (const key of ['position', 'tilt'] as const) {
      s[key] = MathUtils.damp(s[key], state[key], SHADE_SPEED, dt)
      if (Math.abs(s[key] - state[key]) < 0.001) s[key] = state[key]
    }
    place(s)
  })
  const handlers = onPick
    ? {
        raycast: raycastIfShown,
        onClick: (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > CLICK_SLOP_PX) return
          e.stopPropagation()
          onPick()
        },
        onPointerOver: (e: ThreeEvent<PointerEvent>) => (e.stopPropagation(), (document.body.style.cursor = 'pointer')),
        onPointerOut: () => (document.body.style.cursor = ''),
      }
    : { raycast: noRaycast }
  const material = <FillMaterial section={section} color={SHADE} roughness={0.5} metalness={0.3} />
  return (
    <group position={[(u0 + u1) / 2, 0, z]}>
      <instancedMesh ref={slats} args={[undefined, undefined, count]} castShadow raycast={noRaycast}>
        <boxGeometry args={[w - RAIL, SLAT_THICK, SLAT_DEPTH]} />
        {material}
      </instancedMesh>
      <mesh ref={bottom} castShadow raycast={noRaycast}>
        <boxGeometry args={[w - RAIL, BOTTOM, SLAT_DEPTH * 0.6]} />
        {material}
      </mesh>
      <mesh position={[0, y1 - HEAD / 2, 0]} castShadow raycast={noRaycast}>
        <boxGeometry args={[w, HEAD, SLAT_DEPTH + 0.02]} />
        {material}
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * (w - RAIL)) / 2, (y0 + y1) / 2, 0]} castShadow raycast={noRaycast}>
          <boxGeometry args={[RAIL, y1 - y0, 0.04]} />
          {material}
        </mesh>
      ))}
      <mesh ref={pick} {...handlers}>
        <boxGeometry args={[w, 1, SLAT_DEPTH + 0.02]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
