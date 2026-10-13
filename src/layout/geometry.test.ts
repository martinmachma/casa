import { describe, expect, it } from 'vitest'
import { floorBounds, validateLayout, wallPieces } from './geometry'
import { house } from './layout'
import type { HouseLayout, Wall } from './types'

const wall = (openings: Wall['openings']): Wall => ({ id: 'w', from: [0, 0], to: [5, 0], openings })

describe('wallPieces', () => {
  it('is one full piece without openings', () => {
    expect(wallPieces(wall([]), 2.5)).toEqual([{ u0: 0, u1: 5, y0: 0, y1: 2.5 }])
  })

  it('extends both ends for corner overlap', () => {
    expect(wallPieces(wall([]), 2.5, 0.1)).toEqual([{ u0: -0.1, u1: 5.1, y0: 0, y1: 2.5 }])
  })

  it('cuts a door: sides plus a lintel, nothing below', () => {
    const pieces = wallPieces(wall([{ type: 'door', offset: 1, width: 1, height: 2 }]), 2.5)
    expect(pieces).toEqual([
      { u0: 0, u1: 1, y0: 0, y1: 2.5 },
      { u0: 1, u1: 2, y0: 2, y1: 2.5 },
      { u0: 2, u1: 5, y0: 0, y1: 2.5 },
    ])
  })

  it('cuts a window with the default sill, in offset order', () => {
    const pieces = wallPieces(
      wall([
        { type: 'window', offset: 3, width: 1, height: 1 },
        { type: 'door', offset: 0.5, width: 1, height: 2.5 },
      ]),
      2.5,
    )
    expect(pieces).toEqual([
      { u0: 0, u1: 0.5, y0: 0, y1: 2.5 },
      { u0: 1.5, u1: 3, y0: 0, y1: 2.5 },
      { u0: 3, u1: 4, y0: 0, y1: 0.9 },
      { u0: 3, u1: 4, y0: 1.9, y1: 2.5 },
      { u0: 4, u1: 5, y0: 0, y1: 2.5 },
    ])
  })

  it('leaves no end piece when an opening reaches the wall end', () => {
    const pieces = wallPieces(wall([{ type: 'door', offset: 4, width: 1, height: 2.5 }]), 2.5)
    expect(pieces).toEqual([{ u0: 0, u1: 4, y0: 0, y1: 2.5 }])
  })
})

describe('validateLayout', () => {
  const layoutWith = (w: Wall): HouseLayout => ({
    name: 't',
    site: house.site,
    floors: [{ id: 'f', name: 'F', elevation: 0, height: 2.5, wallThickness: 0.1, rooms: [], walls: [w] }],
  })

  it('accepts the bundled layout', () => {
    expect(() => validateLayout(house)).not.toThrow()
    expect(house.floors).toHaveLength(2)
    // Thick front and back walls stop flush with the side walls' outer faces: the house is 6.2 m wide, no stubs.
    for (const floor of house.floors) {
      const { min, max } = floorBounds(floor)
      expect(max[0] - min[0]).toBeCloseTo(6.2)
    }
  })

  it('rejects an opening past the wall end', () => {
    expect(() => validateLayout(layoutWith(wall([{ type: 'door', offset: 4.5, width: 1, height: 2 }])))).toThrow(
      /past the wall end/,
    )
  })

  it('rejects overlapping openings', () => {
    const w = wall([
      { type: 'door', offset: 1, width: 1, height: 2 },
      { type: 'window', offset: 1.5, width: 1, height: 1 },
    ])
    expect(() => validateLayout(layoutWith(w))).toThrow(/overlaps/)
  })

  it('rejects an opening taller than the floor', () => {
    expect(() => validateLayout(layoutWith(wall([{ type: 'window', offset: 1, width: 1, height: 2 }])))).toThrow(
      /taller/,
    )
  })
})
