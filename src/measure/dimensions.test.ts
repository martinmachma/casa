import { describe, expect, it } from 'vitest'
import type { Floor } from '../layout/types'
import { clearances } from './clearance'
import { faceRuns, openingText } from './dimensions'
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
    { id: 'n', from: [0, 0], to: [4, 0], openings: [{ type: 'window', offset: 1, width: 1.2, height: 1.3 }] },
    { id: 'e', from: [4, 0], to: [4, 3] },
    { id: 's', from: [4, 3], to: [0, 3] },
    { id: 'w', from: [0, 3], to: [0, 0] },
  ],
}

describe('faceRuns', () => {
  it('gives the clear inside and the overall outside lengths', () => {
    const lengths = faceRuns(floor)
      .map((r) => Math.round(r.length * 100) / 100)
      .sort()
    expect(lengths).toEqual([2.8, 2.8, 3.2, 3.2, 3.8, 3.8, 4.2, 4.2])
  })

  it('splits a face where another wall meets it', () => {
    const split = { ...floor, walls: [...floor.walls, { id: 'mid', from: [2, 0], to: [2, 3] } as Floor['walls'][0]] }
    const north = faceRuns(split).filter((r) => r.key.startsWith('n:1'))
    expect(north.map((r) => Math.round(r.length * 100) / 100)).toEqual([1.8, 1.8])
  })
})

it('describes openings', () => {
  expect(openingText({ type: 'window', offset: 0, width: 1.2, height: 1.3 })).toBe('Window 120 × 130, sill 90')
  expect(openingText({ type: 'door', offset: 0, width: 0.9, height: 2.1 })).toBe('Door 90 × 210')
})

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
