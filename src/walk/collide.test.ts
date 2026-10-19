import { describe, expect, it } from 'vitest'
import { openingId } from '../layout/geometry'
import type { Floor } from '../layout/types'
import { resolveCollisions, wallObstacles } from './collide'

const floor: Floor = {
  id: 'f',
  name: 'F',
  elevation: 0,
  height: 2.5,
  wallThickness: 0.2,
  rooms: [],
  walls: [
    {
      id: 'w',
      from: [0, 0],
      to: [4, 0],
      openings: [
        { type: 'door', offset: 1, width: 1, height: 2 },
        { type: 'window', offset: 2.5, width: 1, height: 1 },
      ],
    },
  ],
}

describe('walking into walls', () => {
  const obstacles = wallObstacles(floor)

  it('keeps the walker off a wall face', () => {
    const [x, y] = resolveCollisions([0.5, 0.2], 0.25, obstacles)
    expect(x).toBeCloseTo(0.5)
    expect(y).toBeCloseTo(0.35)
  })

  it('lets the walker through a door', () => {
    const open = wallObstacles(floor, new Set([openingId('w', 0)]))
    expect(resolveCollisions([1.5, 0], 0.25, open)).toEqual([1.5, 0])
  })

  it('does not let the walker through a window', () => {
    const [, y] = resolveCollisions([3, 0.05], 0.25, obstacles)
    expect(y).toBeCloseTo(0.35)
  })
})

describe.each(['door', 'sliding'] as const)('%s collisions', (type) => {
  const doorFloor: Floor = {
    ...floor,
    walls: [{ ...floor.walls[0], openings: [{ type, offset: 1, width: 1, height: 2 }] }],
  }

  it('blocks both faces when closed, passes when open, and blocks again when closed', () => {
    const openDoors = new Set<string>()
    const checkClosed = () => {
      const obstacles = wallObstacles(doorFloor, openDoors)
      expect(resolveCollisions([1.5, 0.05], 0.25, obstacles)).toEqual([1.5, 0.35])
      expect(resolveCollisions([1.5, -0.05], 0.25, obstacles)).toEqual([1.5, -0.35])
    }
    checkClosed()
    openDoors.add(openingId('w', 0))
    expect(resolveCollisions([1.5, 0], 0.25, wallObstacles(doorFloor, openDoors))).toEqual([1.5, 0])
    openDoors.delete(openingId('w', 0))
    checkClosed()
  })

  it('uses the wall direction and only opens the matching opening', () => {
    const rotated: Floor = {
      ...doorFloor,
      walls: [{ ...doorFloor.walls[0], from: [2, 3], to: [2, 7] }],
    }
    const closed = wallObstacles(rotated, new Set([openingId('other-wall', 0), openingId('w', 1)]))
    const [x, y] = resolveCollisions([2.05, 4.5], 0.25, closed)
    expect(x).toBeCloseTo(2.35)
    expect(y).toBeCloseTo(4.5)
    expect(resolveCollisions([2, 4.5], 0.25, wallObstacles(rotated, new Set([openingId('w', 0)])))).toEqual([2, 4.5])
  })
})

it('keeps passages clear and floor-level windows solid regardless of door state', () => {
  const fills: Floor = {
    ...floor,
    walls: [
      {
        ...floor.walls[0],
        openings: [
          { type: 'passage', offset: 1, width: 1, height: 2 },
          { type: 'window', offset: 2.5, width: 1, height: 2, sill: 0 },
        ],
      },
    ],
  }
  for (const openDoors of [new Set<string>(), new Set([openingId('w', 0), openingId('w', 1)])]) {
    const obstacles = wallObstacles(fills, openDoors)
    expect(resolveCollisions([1.5, 0], 0.25, obstacles)).toEqual([1.5, 0])
    expect(resolveCollisions([3, 0.05], 0.25, obstacles)[1]).toBeCloseTo(0.35)
  }
})
