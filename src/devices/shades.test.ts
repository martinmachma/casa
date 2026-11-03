import { describe, expect, it } from 'vitest'
import { house } from '../layout/layout'
import { floorRegions } from '../layout/rooms'
import { floorShades } from './shades'

describe('floorShades', () => {
  it('gives every outside window a shade, named by the way it faces, in the room behind it', () => {
    const shades = house.floors.flatMap((f) => floorShades(f, floorRegions(f)))
    expect(shades).toHaveLength(8)
    expect(shades.every((s) => s.room)).toBe(true)
    const living = shades.filter((s) => s.room === 'g-living').map((s) => s.name)
    expect(living).toEqual(['North door', 'North window', 'South window'])
  })
})
