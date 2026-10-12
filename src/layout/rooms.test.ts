import { describe, expect, it } from 'vitest'
import { house } from './layout'
import { roomAt, roomRegions } from './rooms'
import type { Floor } from './types'

// A 4×3 m box (wall centre lines), 0.2 m walls, split by a wall at x = 2 with a door in it.
const floor: Floor = {
  id: 'f',
  name: 'F',
  elevation: 0,
  height: 2.5,
  wallThickness: 0.2,
  rooms: [
    { id: 'west', name: 'West', label: [1, 1.5] },
    { id: 'east', name: 'East', label: [3, 1.5] },
  ],
  walls: [
    { id: 'n', from: [0, 0], to: [4, 0] },
    { id: 'e', from: [4, 0], to: [4, 3] },
    { id: 's', from: [4, 3], to: [0, 3] },
    { id: 'w', from: [0, 3], to: [0, 0] },
    { id: 'mid', from: [2, 0], to: [2, 3], openings: [{ type: 'door', offset: 1, width: 0.9, height: 2 }] },
  ],
}

describe('roomRegions', () => {
  it('measures each room to the wall faces, doors closed', () => {
    const regions = roomRegions(floor)
    expect(regions.get('west')?.area).toBeCloseTo(1.8 * 2.8)
    expect(regions.get('east')?.area).toBeCloseTo(1.8 * 2.8)
  })

  it('skips a room that is not closed off', () => {
    const open = { ...floor, walls: floor.walls.filter((w) => w.id !== 'e') }
    const regions = roomRegions(open)
    expect(regions.has('east')).toBe(false)
    expect(regions.get('west')?.area).toBeCloseTo(1.8 * 2.8)
  })

  it('splits an open space halfway between the labels', () => {
    const open = { ...floor, walls: floor.walls.filter((w) => w.id !== 'mid') }
    const regions = roomRegions(open)
    expect(regions.get('west')?.area).toBeCloseTo(1.9 * 2.8)
    expect(regions.get('east')?.area).toBeCloseTo(1.9 * 2.8)
  })

  it('finds the room under a point', () => {
    const regions = roomRegions(floor)
    expect(roomAt(regions, 0.5, 0.5)).toBe('west')
    expect(roomAt(regions, 3.5, 2.5)).toBe('east')
    expect(roomAt(regions, 2, 1.5)).toBeUndefined()
  })

  it('finds every room of the bundled layout', () => {
    for (const f of house.floors) {
      const regions = roomRegions(f)
      for (const room of f.rooms) expect(regions.get(room.id)?.area, `${room.id} on ${f.id}`).toBeGreaterThan(0.5)
    }
  })
})
