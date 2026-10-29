import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { Group, MathUtils, Mesh, Plane, Vector3 } from 'three'
import { openingId, openingSill } from '../layout/geometry'
import type { Opening } from '../layout/types'
import { raycastIfShown } from './raycast'
import { DOOR_LEAF, EXTERIOR_FRAME, GLASS, HANDLE, INTERIOR_FRAME } from './palette'

const FRAME = 0.06
const FRAME_DEPTH = 0.08
const LEAF = 0.04
/** How far a door swings open. */
const SWING = (Math.PI / 180) * 95
/** How quickly doors move, per second (exponential easing). */
const SPEED = 6
// A pointer that moved further than this between down and up was an orbit/pan, not a click.
const CLICK_SLOP_PX = 5

// Switching back must name the default: R3F leaves a raycast set to undefined unset, and nothing gets hit.
const noRaycast = () => null

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

const Boxes = ({ boxes }: { boxes: Box[] }) =>
  boxes.map((b, k) => (
    <mesh key={k} position={b.at} castShadow raycast={noRaycast}>
      <boxGeometry args={b.size} />
      <meshStandardMaterial color={b.color} roughness={0.6} />
    </mesh>
  ))

/** Closed doors and glazed windows sitting in a wall's openings, in the wall's own frame (u along it, y up). */
export const OpeningFills = ({
  wallId,
  openings,
  exterior,
  clickable,
  top,
  openDoors,
  onToggleDoor,
}: {
  wallId: string
  openings: Opening[]
  openDoors: ReadonlySet<string>
  onToggleDoor: (id: string) => void
  /** Outer walls' doors and windows get dark aluminium frames. */
  exterior: boolean
  /** Whether a tap on a door opens or closes it. */
  clickable: boolean
  /** In a wall cut down to its stub: only what's below this height is drawn. */
  top?: number
}) => {
  const frameColor = exterior ? EXTERIOR_FRAME : INTERIOR_FRAME
  const fills = (
    <group>
      {openings.map((o, i) => {
        if (o.type === 'passage') return null
        const id = openingId(wallId, i)
        const door = { open: openDoors.has(id), onToggle: () => onToggleDoor(id), clickable }
        const u0 = o.offset
        const u1 = o.offset + o.width
        const y0 = openingSill(o)
        const y1 = y0 + o.height
        const window = o.type === 'window'
        const inner = { u0: u0 + FRAME, u1: u1 - FRAME, y0: window ? y0 + FRAME : y0, y1: y1 - FRAME }
        return (
          <group key={id}>
            <Boxes boxes={frame(u0, u1, y0, y1, frameColor, window)} />
            {o.type === 'window' && <Glass inner={inner} />}
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

const Glass = ({ inner, z = 0 }: { inner: Inner; z?: number }) => (
  <mesh position={[(inner.u0 + inner.u1) / 2, (inner.y0 + inner.y1) / 2, z]} raycast={noRaycast}>
    <boxGeometry args={[inner.u1 - inner.u0, inner.y1 - inner.y0, 0.012]} />
    <meshStandardMaterial color={GLASS} transparent opacity={0.28} roughness={0.05} depthWrite={false} />
  </mesh>
)

/** Open or closed on a tap, and how far it has got (0 closed to 1 open), eased each frame. */
type DoorState = { open: boolean; onToggle: () => void; clickable: boolean }

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
  ...state
}: { inner: Inner; color: string; atEnd: boolean; intoB: boolean } & DoorState) => {
  // The leaf reaches from the hinge along the wall; this turns it towards the side it opens into.
  const turn = (atEnd ? 1 : -1) * (intoB ? -1 : 1) * SWING
  const { group, handlers } = useToggle(state, (g, t) => (g.rotation.y = t * turn))
  const w = (inner.u1 - inner.u0) * (atEnd ? -1 : 1)
  const h = inner.y1 - inner.y0
  return (
    <group ref={group} position={[atEnd ? inner.u1 : inner.u0, 0, 0]}>
      <mesh position={[w / 2, inner.y0 + h / 2, 0]} castShadow receiveShadow {...handlers}>
        <boxGeometry args={[Math.abs(w), h, LEAF]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* A handle on each face, near the edge away from the hinge. */}
      <mesh position={[w - Math.sign(w) * 0.08, inner.y0 + 1.05, 0]} {...handlers}>
        <boxGeometry args={[0.12, 0.02, LEAF + 0.08]} />
        <meshStandardMaterial color={HANDLE} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

/** A glazed panel just inside the frame, sliding along the wall towards its end (+u), over whatever is next to it. */
const SlidingDoor = ({ inner, ...state }: { inner: Inner } & DoorState) => {
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
        <mesh key={k} position={b.at} castShadow {...handlers}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color={b.color} roughness={0.6} />
        </mesh>
      ))}
      {/* The glass takes taps too, so the whole panel opens it. */}
      <mesh position={[w / 2, (panel.y0 + panel.y1) / 2, 0]} {...handlers}>
        <boxGeometry args={[panel.u1 - panel.u0, panel.y1 - panel.y0, 0.012]} />
        <meshStandardMaterial color={GLASS} transparent opacity={0.28} roughness={0.05} depthWrite={false} />
      </mesh>
      <mesh position={[0.03, inner.y0 + 1.05, LEAF / 2 + 0.01]} {...handlers}>
        <boxGeometry args={[0.02, 0.3, 0.02]} />
        <meshStandardMaterial color={HANDLE} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  )
}
