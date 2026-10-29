import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { PointLight, Vector3 } from 'three'
import type { Device, FurnitureItem } from '../data/types'
import type { Floor } from '../layout/types'

const CEILING_INTENSITY = 7
const LAMP_INTENSITY = 2.5
// Light falls off with the square of the distance; past this it's cut off so far rooms cost nothing.
const REACH = 9
// Point-light shadows are six renders each and use a texture unit, so only as many lights as the GPU has units to
// spare cast them (without one, light goes through walls, floors and the roof). Units kept for the sun's shadow and
// the materials' own textures:
const KEEP_UNITS = 4
const SHADOW_MAP = 512
// Frames between choosing which lights cast shadows.
const RESHUFFLE = 30

/** Where a lamp's bulb sits, as a share of the lamp's height. */
const LAMPS: Record<string, number> = { lampRoundFloor: 0.88, lampSquareTable: 0.7 }

export const isLamp = (model: string | undefined) => model !== undefined && model in LAMPS

type Bulb = { id: string; position: [number, number, number]; intensity: number; color: string }

type HouseLightsProps = {
  /** The floors on show; lights on any other floor stay dark. */
  floors: Floor[]
  devices: Device[]
  furniture: FurnitureItem[]
  /** How brightly each light (by device or furniture id) shines, 0 (off) to 1. */
  level: (id: string) => number
  /** The colour each light gives off. */
  tint: (id: string) => string
}

/** The house's own lights: each ceiling light and lamp that's on is a point light. */
export const HouseLights = ({ floors, devices, furniture, level, tint }: HouseLightsProps) => {
  const lights = useRef<(PointLight | null)[]>([])
  const frame = useRef(0)
  const tmp = useRef(new Vector3())

  const bulbs: Bulb[] = []
  for (const f of floors) {
    for (const d of devices)
      if (d.floor === f.id && d.kind === 'light' && level(d.id) > 0)
        bulbs.push({
          id: d.id,
          position: [d.x, f.elevation + d.z - 0.08, d.y],
          intensity: CEILING_INTENSITY * level(d.id),
          color: tint(d.id),
        })
    for (const item of furniture)
      if (item.floor === f.id && isLamp(item.model) && level(item.id) > 0)
        bulbs.push({
          id: item.id,
          position: [item.x, f.elevation + (item.z ?? 0) + item.height * LAMPS[item.model!], item.y],
          intensity: LAMP_INTENSITY * level(item.id),
          color: tint(item.id),
        })
  }

  useFrame(({ camera, controls, gl }) => {
    const all = lights.current.slice(0, bulbs.length).filter((l): l is PointLight => !!l)
    if (!all.length) return
    const n = frame.current++
    if (n % RESHUFFLE === 0) {
      // Nearest what's looked at, not the eye: turning round the house mustn't change which lights cast shadows.
      const target = (controls as { target?: Vector3 } | null)?.target
      const focus = target ?? camera.getWorldPosition(tmp.current)
      const spare = Math.max(0, gl.capabilities.maxTextures - KEEP_UNITS)
      const weight = (l: PointLight) => l.intensity / Math.max(1, l.position.distanceToSquared(focus))
      const near = new Set([...all].sort((a, b) => weight(b) - weight(a)).slice(0, spare))
      for (const l of all) {
        if (l.castShadow !== near.has(l)) l.shadow.needsUpdate = true
        l.castShadow = near.has(l)
      }
    }
    // The house barely changes, so each shadow is redrawn only every few frames, one light at a time.
    const shadowed = all.filter((l) => l.castShadow)
    if (shadowed.length) shadowed[n % shadowed.length].shadow.needsUpdate = true
  })

  if (!bulbs.length) return null
  return (
    <>
      {bulbs.map((b, i) => (
        <pointLight
          key={b.id}
          ref={(l) => {
            lights.current[i] = l
          }}
          position={b.position}
          color={b.color}
          intensity={b.intensity}
          distance={REACH}
          decay={2}
          shadow-autoUpdate={false}
          shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
          shadow-camera-near={0.05}
          shadow-camera-far={REACH}
          shadow-bias={-0.002}
          shadow-radius={4}
        />
      ))}
    </>
  )
}
