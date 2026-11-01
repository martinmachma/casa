import { useState } from 'react'
import { openingId, openingSill, outsideFace, shadeId, wallLength, wallThickness } from '../layout/geometry'
import { roomAt, type RoomRegion } from '../layout/rooms'
import type { Floor } from '../layout/types'

/**
 * An outside venetian shade as Home Assistant controls one (a cover with tilt): how far it's let down (0 up to
 * 1 down) and how far its slats are turned shut (0 flat and open to 1 closed).
 */
export type ShadeState = { position: number; tilt: number }

export const SHADE_UP: ShadeState = { position: 0, tilt: 0 }

/** A shade over a window or sliding door in an outer wall. */
export type WindowShade = {
  id: string
  name: string
  room: string | undefined
  /** The top of the shade, in the scene, where its tag points. */
  at: [number, number, number]
  /** The middle of the window, which its close-up is centred on. */
  look: [number, number, number]
  /** Out of the house, across the wall (plan): its close-up looks at it from outside. */
  facing: [number, number]
  /** Just past the window's right-hand edge as seen from outside, where its controls stand. */
  beside: [number, number, number]
}

const COMPASS = ['East', 'South', 'West', 'North'] as const
/** How far past the window's edge its controls stand. */
const BESIDE = 0.25
/** How far in from the wall's outer face the shade hangs. */
export const SHADE_INSET = 0.045
/** How far into the house to look for the room a window belongs to, past the wall's inner face. */
const ROOM_PROBE = 0.3

/** Every window and sliding door in the floor's outer walls has a shade, named after the way it faces. */
export const floorShades = (floor: Floor, regions: Map<string, RoomRegion>): WindowShade[] =>
  floor.walls.flatMap((wall) => {
    const out = outsideFace(wall, floor)
    if (!out) return []
    const length = wallLength(wall)
    const d = [(wall.to[0] - wall.from[0]) / length, (wall.to[1] - wall.from[1]) / length]
    // Side 'a' is the wall's direction turned a quarter; the room is on the other side from the outside.
    const sign = out === 'a' ? 1 : -1
    const n = [-d[1] * sign, d[0] * sign]
    // Plan y grows south, so a normal's angle counts clockwise from east.
    const facing = COMPASS[(Math.round(Math.atan2(n[1], n[0]) / (Math.PI / 2)) + 4) % 4]
    const half = wallThickness(wall, floor) / 2
    const reach = half + ROOM_PROBE
    // The shade hangs just inside the wall's outer face.
    const face = half - SHADE_INSET
    return (wall.openings ?? []).flatMap((o, i) => {
      if (o.type !== 'window' && o.type !== 'sliding') return []
      const u = o.offset + o.width / 2
      const x = wall.from[0] + d[0] * u
      const y = wall.from[1] + d[1] * u
      const sill = floor.elevation + openingSill(o)
      const z = sill + o.height / 2
      // Facing the house, right is the outward normal turned a quarter back.
      const side = o.width / 2 + BESIDE
      return [
        {
          id: shadeId(openingId(wall.id, i)),
          name: `${facing} ${o.type === 'sliding' ? 'door' : 'window'}`,
          room: roomAt(regions, x - n[0] * reach, y - n[1] * reach),
          at: [x + n[0] * face, sill + o.height, y + n[1] * face] as WindowShade['at'],
          look: [x, z, y] as WindowShade['look'],
          facing: [n[0], n[1]] as WindowShade['facing'],
          beside: [x + n[1] * side, z, y - n[0] * side] as WindowShade['beside'],
        },
      ]
    })
  })

/** "Up", "Down", "40 % down". */
export const shadeText = (s: ShadeState) =>
  s.position <= 0.005 ? 'Up' : s.position >= 0.995 ? 'Down' : `${Math.round(s.position * 100)} % down`

const KEY = 'casa.shades'

const load = (): Record<string, ShadeState> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export type Shades = {
  states: Readonly<Record<string, ShadeState>>
  set: (id: string, patch: Partial<ShadeState>) => void
}

/**
 * The shades' positions, kept in this browser for now. Linking them to Home Assistant swaps this for each cover's
 * live position and tilt, and sends each change to it.
 */
export const useShades = (): Shades => {
  const [states, setStates] = useState(load)
  const set = (id: string, patch: Partial<ShadeState>) =>
    setStates((current) => {
      const next = { ...current, [id]: { ...SHADE_UP, ...current[id], ...patch } }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // Private windows may refuse; the shade still moves until reload.
      }
      return next
    })
  return { states, set }
}
