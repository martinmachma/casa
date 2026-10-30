import { describe, expect, it } from 'vitest'
import {
  blocksView,
  cornerCuts,
  floorBounds,
  sidePart,
  splitPieces,
  validateLayout,
  wallJoints,
  wallOutside,
  wallPieces,
} from './geometry'
import { house } from './layout'
import type { Floor, HouseLayout, Point, Wall } from './types'

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

  it('rejects dangling compound members and members turned away from their parent', () => {
    const layout = layoutWith({ ...wall([]), partOf: 'missing' })
    expect(() => validateLayout(layout)).toThrow(/owner/)
    layout.floors[0].walls.push({ id: 'missing', from: [1, 0], to: [1, 2] })
    expect(() => validateLayout(layout)).toThrow(/direction/)
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

describe('cutaway', () => {
  // A 10 x 10 box around the origin with a wall across the middle, seen from the south (+z).
  const floor: Floor = {
    id: 'f',
    name: 'Test',
    rooms: [],
    elevation: 0,
    height: 2.6,
    wallThickness: 0.2,
    walls: [
      { id: 's', from: [-5, 5], to: [5, 5] },
      { id: 'n', from: [-5, -5], to: [5, -5] },
      { id: 'e', from: [5, -5], to: [5, 5] },
      { id: 'mid', from: [-5, 1], to: [5, 1] },
    ],
  }
  const [south, north, east, mid] = floor.walls
  // Looking from `eye` towards the middle of the box.
  const cut = (wall: Wall, eye: Point) => blocksView(wall, wallOutside(wall, floor), eye, [-eye[0], -eye[1]])

  it('tells outer walls from interior ones', () => {
    expect(wallOutside(south, floor)?.map((c) => c + 0)).toEqual([0, 1])
    expect(wallOutside(mid, floor)).toBeUndefined()
  })

  it('cuts outer walls seen from outside, even at a slant, and keeps the far ones', () => {
    expect(cut(south, [0, 20])).toBe(true)
    expect(cut(east, [8, 20])).toBe(true)
    expect(cut(north, [0, 20])).toBe(false)
  })

  it('keeps the far outer wall when the camera is inside the house', () => {
    expect(cut(north, [0, 3])).toBe(false)
  })

  it('cuts interior walls across the view wherever they are', () => {
    expect(cut(mid, [0, 20])).toBe(true)
    expect(cut(mid, [0, -20])).toBe(true)
  })

  it('keeps interior walls the view runs along', () => {
    expect(cut(mid, [20, 0])).toBe(false)
  })
})

describe('wallJoints', () => {
  it('splits a side where a partition butts into it, not the other side', () => {
    const wall: Wall = { id: 'w', from: [0, 0], to: [4, 0] }
    const partition: Wall = { id: 'p', from: [1.5, 0], to: [1.5, 3] }
    const floor = { wallThickness: 0.1, walls: [wall, partition] } as unknown as Floor
    const joints = wallJoints(wall, floor)
    // y grows south, and side 'a' is to the right walking from→to: here, south.
    expect(joints).toEqual({ a: [1.5], b: [] })
    expect(sidePart(joints.a, 1)).toBe(0)
    expect(sidePart(joints.a, 3)).toBe(1)
  })
})

describe('cornerCuts', () => {
  it("cuts a wall at the other wall's inner face where they meet at a corner", () => {
    const wall: Wall = { id: 'w', from: [0, 0], to: [4, 0] }
    const corner: Wall = { id: 'c', from: [4, 0], to: [4, 3], thickness: 0.3 }
    const floor = { wallThickness: 0.1, walls: [wall, corner] } as unknown as Floor
    expect(cornerCuts(wall, floor)).toEqual([{ at: 4 - 0.15, wall: 'c' }])
  })
})

describe('splitPieces', () => {
  it('cuts in order along the wall, whatever order the cuts come in', () => {
    const pieces = splitPieces([{ u0: 0, u1: 6, y0: 0, y1: 2.6 }], [2, 0.1, 5.9])
    expect(pieces.map((p) => [p.u0, p.u1])).toEqual([
      [0, 0.1],
      [0.1, 2],
      [2, 5.9],
      [5.9, 6],
    ])
  })
})
