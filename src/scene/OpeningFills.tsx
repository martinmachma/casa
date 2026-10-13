import { openingSill } from '../layout/geometry'
import type { Opening } from '../layout/types'
import { DOOR_LEAF, EXTERIOR_FRAME, GLASS, HANDLE, INTERIOR_FRAME } from './palette'

const FRAME = 0.06
const FRAME_DEPTH = 0.08
const LEAF = 0.04
// Outer walls are the thick ones; their doors and windows get dark aluminium frames.
const EXTERIOR_WALL = 0.2

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

/** Closed doors and glazed windows sitting in a wall's openings, in the wall's own frame (u along it, y up). */
export const OpeningFills = ({ openings, thickness }: { openings: Opening[]; thickness: number }) => {
  const exterior = thickness >= EXTERIOR_WALL
  const frameColor = exterior ? EXTERIOR_FRAME : INTERIOR_FRAME
  return (
    <group>
      {openings.map((o, i) => {
        if (o.type === 'passage') return null
        const u0 = o.offset
        const u1 = o.offset + o.width
        const y0 = openingSill(o)
        const y1 = y0 + o.height
        const boxes = frame(u0, u1, y0, y1, frameColor, o.type === 'window')
        const inner = { u0: u0 + FRAME, u1: u1 - FRAME, y0: o.type === 'window' ? y0 + FRAME : y0, y1: y1 - FRAME }
        const w = inner.u1 - inner.u0
        const h = inner.y1 - inner.y0
        const mid: [number, number, number] = [(inner.u0 + inner.u1) / 2, (inner.y0 + inner.y1) / 2, 0]
        return (
          <group key={i}>
            {boxes.map((b, k) => (
              <mesh key={k} position={b.at} castShadow raycast={noRaycast}>
                <boxGeometry args={b.size} />
                <meshStandardMaterial color={b.color} roughness={0.6} />
              </mesh>
            ))}
            {o.type === 'window' ? (
              <mesh position={mid} raycast={noRaycast}>
                <boxGeometry args={[w, h, 0.012]} />
                <meshStandardMaterial color={GLASS} transparent opacity={0.28} roughness={0.05} depthWrite={false} />
              </mesh>
            ) : (
              <>
                <mesh position={mid} castShadow receiveShadow raycast={noRaycast}>
                  <boxGeometry args={[w, h, LEAF]} />
                  <meshStandardMaterial color={exterior ? EXTERIOR_FRAME : DOOR_LEAF} roughness={0.7} />
                </mesh>
                {/* A handle on each face, near the edge away from the hinge. */}
                <mesh position={[inner.u1 - 0.08, inner.y0 + 1.05, 0]} raycast={noRaycast}>
                  <boxGeometry args={[0.12, 0.02, LEAF + 0.08]} />
                  <meshStandardMaterial color={HANDLE} metalness={0.6} roughness={0.3} />
                </mesh>
              </>
            )}
          </group>
        )
      })}
    </group>
  )
}
