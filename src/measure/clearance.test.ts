import { describe, expect, it } from 'vitest'
import type { Floor } from '../layout/types'
import { clearances } from './clearance'
import { floorWallRects } from '../layout/rooms'

// A 4 × 3 m box on the centre lines with 0.2 m walls: 3.8 × 2.8 inside, 4.2 × 3.2 outside.
const floor: Floor = {
  id: 'f',
  name: 'F',
  elevation: 0,
  height: 2.5,
  wallThickness: 0.2,
  rooms: [],
  walls: [
    { id: 'n', from: [0, 0], to: [4, 0] },
    { id: 'e', from: [4, 0], to: [4, 3] },
    { id: 's', from: [4, 3], to: [0, 3] },
    { id: 'w', from: [0, 3], to: [0, 0] },
  ],
}

describe('clearances', () => {
  it('measures each side to the wall faces', () => {
    // A 1 × 0.5 m item in the middle of the room: 1.4 m to the east/west faces, 1.15 m to north/south.
    const gaps = clearances({ x: 2, y: 1.5, width: 1, depth: 0.5, rotation: 0 }, floorWallRects(floor))
    expect(gaps.map((g) => Math.round(g.distance * 100) / 100).sort()).toEqual([1.15, 1.15, 1.4, 1.4])
  })

  it('reads 0 when flush against a wall', () => {
    const gaps = clearances({ x: 0.6, y: 1.5, width: 1, depth: 0.5, rotation: 0 }, floorWallRects(floor))
    expect(Math.min(...gaps.map((g) => g.distance))).toBeCloseTo(0)
  })
})
