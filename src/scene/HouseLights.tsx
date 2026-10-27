import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { PointLight, Vector3 } from 'three'
import type { Device, FurnitureItem } from '../data/types'
import type { Floor } from '../layout/types'

/** Warm white, about 2700 K, like an ordinary household bulb. */
export const BULB = '#ffc285'
const CEILING_INTENSITY = 7
const LAMP_INTENSITY = 2.5
// Light falls off with the square of the distance; past this it's cut off so far rooms cost nothing.
const REACH = 9
// Point-light shadows are six renders each and use a texture unit, so only the lights nearest the camera cast them
// (enough that walls stop light from spilling into the next room). The rest light without shadows.
const SHADOWED = 6
const SHADOW_MAP = 512
// Frames between choosing which lights cast shadows.
const RESHUFFLE = 30

/** Where a lamp's bulb sits, as a share of the lamp's height. */
const LAMPS: Record<string, number> = { lampRoundFloor: 0.88, lampSquareTable: 0.7 }

export const isLamp = (model: string | undefined) => model !== undefined && model in LAMPS

type Bulb = { id: string; position: [number, number, number]; intensity: number }

type HouseLightsProps = {
  /** The floors on show; lights on any other floor stay dark. */
  floors: Floor[]
  devices: Device[]
  furniture: FurnitureItem[]
  /** 0 by day, 1 at night: lights fade in through dusk. */
  dark: number
}

/** The house's own lights, switched on after dark: each ceiling light and lamp is a warm point light. */
export const HouseLights = ({ floors, devices, furniture, dark }: HouseLightsProps) => {
  const lights = useRef<(PointLight | null)[]>([])
  const frame = useRef(0)
  const tmp = useRef(new Vector3())

  const bulbs: Bulb[] = []
  for (const f of floors) {
    for (const d of devices)
      if (d.floor === f.id && d.kind === 'light')
        bulbs.push({ id: d.id, position: [d.x, f.elevation + d.z - 0.08, d.y], intensity: CEILING_INTENSITY })
    for (const item of furniture)
      if (item.floor === f.id && isLamp(item.model))
        bulbs.push({
          id: item.id,
          position: [item.x, f.elevation + (item.z ?? 0) + item.height * LAMPS[item.model!], item.y],
          intensity: LAMP_INTENSITY,
        })
  }

  useFrame(({ camera }) => {
    const all = lights.current.slice(0, bulbs.length).filter((l): l is PointLight => !!l)
    if (!all.length) return
    const n = frame.current++
    if (n % RESHUFFLE === 0) {
      const eye = camera.getWorldPosition(tmp.current)
      const near = new Set(
        [...all]
          .sort((a, b) => a.position.distanceToSquared(eye) - b.position.distanceToSquared(eye))
          .slice(0, SHADOWED),
      )
      for (const l of all) {
        if (l.castShadow !== near.has(l)) l.shadow.needsUpdate = true
        l.castShadow = near.has(l)
      }
    }
    // The house barely changes, so each shadow is redrawn only every few frames, one light at a time.
    const shadowed = all.filter((l) => l.castShadow)
    if (shadowed.length) shadowed[n % shadowed.length].shadow.needsUpdate = true
  })

  if (dark <= 0) return null
  return (
    <>
      {bulbs.map((b, i) => (
        <pointLight
          key={b.id}
          ref={(l) => {
            lights.current[i] = l
          }}
          position={b.position}
          color={BULB}
          intensity={b.intensity * dark}
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
