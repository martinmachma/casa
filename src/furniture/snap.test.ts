import { describe, expect, it } from 'vitest'
import { snapToWalls, type SnapWall } from './snap'

// A 4×4 room, walls 0.2 thick on their centre lines.
const room: SnapWall[] = [
  { from: [0, 0], to: [4, 0], thickness: 0.2 },
  { from: [4, 0], to: [4, 4], thickness: 0.2 },
  { from: [4, 4], to: [0, 4], thickness: 0.2 },
  { from: [0, 4], to: [0, 0], thickness: 0.2 },
]
const box = { width: 1, depth: 0.5, rotation: 0 }

describe('snapToWalls', () => {
  it('leaves an item in the middle of the room alone', () => {
    expect(snapToWalls({ ...box, x: 2, y: 2 }, room)).toEqual({ x: 2, y: 2, rotation: 0 })
  })

  it('pushes an item flush against a nearby wall face', () => {
    const p = snapToWalls({ ...box, x: 2, y: 0.4 }, room)
    expect(p.x).toBeCloseTo(2)
    expect(p.y).toBeCloseTo(0.1 + 0.25)
    expect(p.rotation).toBeCloseTo(0)
  })

  it('pulls an item out of a wall it overlaps', () => {
    const p = snapToWalls({ ...box, x: 2, y: 0.2 }, room)
    expect(p.y).toBeCloseTo(0.35)
  })

  it('pulls out an item buried deeper than the threshold', () => {
    // Turned so its 1 m width runs north–south, centre 0.4 m from the wall line: 0.2 m inside the face.
    const p = snapToWalls({ ...box, x: 2, y: 0.4, rotation: Math.PI / 2 }, room)
    expect(p.y).toBeCloseTo(0.1 + 0.5)
  })

  it('squares a slightly turned item to the wall', () => {
    const p = snapToWalls({ ...box, x: 2, y: 0.4, rotation: 0.2 }, room)
    expect(Math.abs(Math.sin(p.rotation))).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0.35)
  })

  it('uses the right half-size when the item is turned a quarter', () => {
    const p = snapToWalls({ ...box, x: 3.6, y: 2, rotation: Math.PI / 2 }, room)
    // Turned 90°, its 1 m width runs along y, so it sits 0.25 m (half depth) off the east wall face.
    expect(p.x).toBeCloseTo(4 - 0.1 - 0.25)
  })

  it('settles into a corner', () => {
    const p = snapToWalls({ ...box, x: 0.65, y: 0.4 }, room)
    expect(p.x).toBeCloseTo(0.1 + 0.5)
    expect(p.y).toBeCloseTo(0.1 + 0.25)
  })

  it('leaves an item turned well off square alone', () => {
    expect(snapToWalls({ ...box, x: 2, y: 0.4, rotation: 0.6 }, room)).toEqual({ x: 2, y: 0.4, rotation: 0.6 })
  })

  it('ignores a wall whose segment the item is not beside', () => {
    const short: SnapWall[] = [{ from: [0, 0], to: [1, 0], thickness: 0.2 }]
    expect(snapToWalls({ ...box, x: 3, y: 0.4 }, short)).toEqual({ x: 3, y: 0.4, rotation: 0 })
  })
})
