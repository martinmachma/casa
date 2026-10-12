import { describe, expect, it } from 'vitest'
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
    expect(resolveCollisions([1.5, 0], 0.25, obstacles)).toEqual([1.5, 0])
  })

  it('does not let the walker through a window', () => {
    const [, y] = resolveCollisions([3, 0.05], 0.25, obstacles)
    expect(y).toBeCloseTo(0.35)
  })
})
