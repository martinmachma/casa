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
// How far a fitting narrows its light into a downward beam: 0 all round, 1 straight down only. A wall light washes down
// its own wall, so only a little of it carries across a terrace and in through a window to compete with the room's light.
const WALL_DOWNLIGHT = 0.85
// A wall light's fitting is wide next to the window frame it shines past, so what that frame throws across a room is soft.
const WALL_SHADOW_RADIUS = 8
const SHADOW_RADIUS = 1.5
// Past this, light is cut off so far rooms cost nothing.
const REACH = 9
// PointShadowAtlas shares one texture and lowers distant shadow detail instead of omitting lights.
const SHADOW_MAP = 512

/** Where a lamp's bulb sits, as a share of the lamp's height. */
const LAMPS: Record<string, number> = { lampRoundFloor: 0.88, lampSquareTable: 0.7 }

export const isLamp = (model: string | undefined) => model !== undefined && model in LAMPS

type Bulb = {
  id: string
  downlight: number
  shadowRadius: number
  position: [number, number, number]
  intensity: number
  color: string
}

type HouseLightsProps = {
  /** Keep every fixture mounted, including on floors currently hidden. */
  floors: Floor[]
  /** Floors from the ground up that can illuminate the view. */
  litFloorCount: number
  devices: Device[]
  furniture: FurnitureItem[]
  /** How brightly each light (by device or furniture id) shines, 0 (off) to 1. */
  level: (id: string) => number
  /** The colour each light gives off. */
  tint: (id: string) => string
}

/** Off fixtures keep their shader slots and atlas tiles, so switching never recompiles the house's materials. */
export const HouseLights = ({ floors, litFloorCount, devices, furniture, level, tint }: HouseLightsProps) => {
  const bulbs: Bulb[] = []
  for (const [index, f] of floors.entries()) {
    const brightness = (id: string) => (index < litFloorCount ? level(id) : 0)
    for (const d of devices)
      if (d.floor === f.id && d.kind === 'light')
        bulbs.push({
          id: d.id,
          downlight: d.wall ? WALL_DOWNLIGHT : 1,
          shadowRadius: d.wall ? WALL_SHADOW_RADIUS : SHADOW_RADIUS,
          position: lightPosition(d, f),
          intensity: CEILING_INTENSITY * brightness(d.id),
          color: tint(d.id),
        })
    for (const item of furniture)
      if (item.floor === f.id && isLamp(item.model))
        bulbs.push({
          id: item.id,
          downlight: 0,
          shadowRadius: SHADOW_RADIUS,
          // A lamp out in the garden stands on the lawn or terrace.
          position: [
            item.x,
            (f === house.floors[0] ? groundLevel(f, house.outdoor, [item.x, item.y]) : f.elevation) +
              (item.z ?? 0) +
              item.height * LAMPS[item.model!],
            item.y,
          ],
          intensity: LAMP_INTENSITY * brightness(item.id),
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
          shadow-radius={b.shadowRadius}
        />
      ))}
    </>
  )
}
