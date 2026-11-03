import type { Device, FurnitureItem } from '../data/types'
import { lightPosition } from '../devices/place'
import { groundLevel } from '../layout/ground'
import { house } from '../layout/layout'
import type { Floor } from '../layout/types'

// Light falls off more gently than in nature (squared): there's no light bounced off the walls, so it's what
// keeps a room's far side from going dark. Intensities are set for the same brightness 1.5 m away.
const DECAY = 1
const CEILING_INTENSITY = 7 / 1.5
const LAMP_INTENSITY = 2.5 / 1.5
// Past this, light is cut off so far rooms cost nothing.
const REACH = 9
// All bulbs stay lit. PointShadowAtlas shares one texture and lowers distant shadow detail instead of omitting lights.
const SHADOW_MAP = 512

/** Where a lamp's bulb sits, as a share of the lamp's height. */
const LAMPS: Record<string, number> = { lampRoundFloor: 0.88, lampSquareTable: 0.7 }

export const isLamp = (model: string | undefined) => model !== undefined && model in LAMPS

type Bulb = { id: string; downlight: boolean; position: [number, number, number]; intensity: number; color: string }

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
  const bulbs: Bulb[] = []
  for (const f of floors) {
    for (const d of devices)
      if (d.floor === f.id && d.kind === 'light' && level(d.id) > 0)
        bulbs.push({
          id: d.id,
          downlight: !d.wall,
          position: lightPosition(d, f),
          intensity: CEILING_INTENSITY * level(d.id),
          color: tint(d.id),
        })
    for (const item of furniture)
      if (item.floor === f.id && isLamp(item.model) && level(item.id) > 0)
        bulbs.push({
          id: item.id,
          downlight: false,
          // A lamp out in the garden stands on the lawn or terrace.
          position: [
            item.x,
            (f === house.floors[0] ? groundLevel(f, house.outdoor, [item.x, item.y]) : f.elevation) +
              (item.z ?? 0) +
              item.height * LAMPS[item.model!],
            item.y,
          ],
          intensity: LAMP_INTENSITY * level(item.id),
          color: tint(item.id),
        })
  }

  if (!bulbs.length) return null
  return (
    <>
      {bulbs.map((b) => (
        <pointLight
          key={b.id}
          userData={{ downlight: b.downlight }}
          castShadow
          position={b.position}
          color={b.color}
          intensity={b.intensity}
          distance={REACH}
          decay={DECAY}
          shadow-autoUpdate={false}
          shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
          shadow-camera-near={0.1}
          shadow-camera-far={REACH}
          // r186 cube shadows compare perspective depth. A bias of .002 detaches shadows by metres at range.
          shadow-bias={-0.000005}
          shadow-normalBias={0.003}
          shadow-radius={1.5}
        />
      ))}
    </>
  )
}
