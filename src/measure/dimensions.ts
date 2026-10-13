import { wallLength, wallThickness } from '../layout/geometry'
import type { Floor, Wall } from '../layout/types'

const cm = (m: number) => Math.round(m * 100)

/** "6.03 m centre line · 34 cm thick · 2.68 m high", for the wall inspector. */
export const wallText = (wall: Wall, floor: Floor) =>
  `${wallLength(wall).toFixed(2)} m centre line · ${cm(wallThickness(wall, floor))} cm thick · ` +
  `${floor.height.toFixed(2)} m high`
