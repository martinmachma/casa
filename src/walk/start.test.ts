import { describe, expect, it } from 'vitest'
import type { Floor, Outdoor } from '../layout/types'
import { outdoorObstacles, resolveCollisions, wallObstacles } from './collide'
import { nearestWalkPoint, onFloorSurface, outdoorWalkPoint, WALK_RADIUS } from './start'

const floor: Floor = {
  id: 'upper',
  name: 'Upper floor',
  elevation: 3,
  height: 2.6,
  wallThickness: 0.2,
  outline: [
    [0, 0],
    [6, 0],
    [6, 6],
    [0, 6],
  ],
  rooms: [{ id: 'room', name: 'Room', label: [3, 3] }],
  walls: [
    { id: 'n', from: [0, 0], to: [6, 0] },
    { id: 'e', from: [6, 0], to: [6, 6] },
    { id: 's', from: [6, 6], to: [0, 6] },
    { id: 'w', from: [0, 6], to: [0, 0] },
  ],
}

describe('walk starting positions', () => {
  it('preserves a clear position on the selected upper floor', () => {
    expect(nearestWalkPoint(floor, [1.5, 4], wallObstacles(floor))).toEqual([1.5, 4])
  })

  it('moves a starting position off furniture while keeping it nearby', () => {
    const obstacles = [...wallObstacles(floor), { cx: 3, cy: 3, hu: 0.5, hv: 0.5, angle: Math.PI / 4 }]
    const at = nearestWalkPoint(floor, [3, 3], obstacles)!
    expect(at).toBeDefined()
    expect(Math.hypot(at[0] - 3, at[1] - 3)).toBeCloseTo(0.5 + WALK_RADIUS)
    expect(resolveCollisions(at, WALK_RADIUS, obstacles)).toEqual(at)
  })

  it('keeps the whole body inside the slab and off walls when the view is outside', () => {
    const at = nearestWalkPoint(floor, [-8, 2], wallObstacles(floor))!
    expect(at[0]).toBeCloseTo(0.1 + WALK_RADIUS)
    expect(at[1]).toBeCloseTo(2)
    expect(onFloorSurface(floor, at, WALK_RADIUS)).toBe(true)
  })

  it('avoids stair voids and rejects drops beyond a slab or through a void', () => {
    const withVoid = { ...floor, voids: [{ x0: 2, x1: 4, y0: 2, y1: 4 }] }
    expect(onFloorSurface(withVoid, [3, 3])).toBe(false)
    expect(onFloorSurface(withVoid, [-1, 3])).toBe(false)
    const at = nearestWalkPoint(withVoid, [3, 3], wallObstacles(withVoid))!
    expect(at).toBeDefined()
    expect(onFloorSurface(withVoid, at, WALK_RADIUS)).toBe(true)
    expect(Math.hypot(at[0] - 3, at[1] - 3)).toBeCloseTo(1 + WALK_RADIUS)
  })

  it('refuses to start when the floor has no clear standing space', () => {
    const obstacles = [...wallObstacles(floor), { cx: 3, cy: 3, hu: 4, hv: 4, angle: 0 }]
    expect(nearestWalkPoint(floor, [3, 3], obstacles)).toBeUndefined()
  })
})

const groundFloor: Floor = { ...floor, id: 'ground', elevation: 0 }
const outdoor: Outdoor = {
  level: -0.35,
  garden: [
    [-5, -5],
    [10, -5],
    [10, 10],
    [-5, 10],
  ],
  terrace: {
    name: 'Terrace',
    level: -0.1,
    outline: [
      [6, 0],
      [9, 0],
      [9, 3],
      [6, 3],
    ],
  },
  paving: [
    {
      name: 'Path',
      level: -0.05,
      outline: [
        [6, 1],
        [9, 1],
        [9, 2],
        [6, 2],
      ],
    },
  ],
  sheds: [{ id: 'shed', name: 'Shed', x0: -3, x1: -1, y0: 3, y1: 5, height: 2 }],
  blocks: [{ id: 'wall', name: 'Garden wall', x0: 7, x1: 8, y0: 5, y1: 6, height: 1, kind: 'wall' }],
}

describe('outdoor walk starting positions', () => {
  const obstacles = [...wallObstacles(groundFloor), ...outdoorObstacles(outdoor)]

  it('keeps a clear drop on the lawn, terrace or paving exactly where it was placed', () => {
    for (const at of [
      [-2, 2],
      [7, 0.5],
      [7, 1.5],
    ] as [number, number][]) {
      expect(outdoorWalkPoint(groundFloor, outdoor, at, obstacles)).toEqual(at)
    }
  })

  it('moves drops clear of sheds and garden walls using the same obstacles as walking', () => {
    for (const obstacle of outdoorObstacles(outdoor)) {
      const at = outdoorWalkPoint(groundFloor, outdoor, [obstacle.cx, obstacle.cy], obstacles)!
      expect(at).toBeDefined()
      expect(resolveCollisions(at, WALK_RADIUS, obstacles)).toEqual(at)
      expect(Math.hypot(at[0] - obstacle.cx, at[1] - obstacle.cy)).toBeCloseTo(
        Math.min(obstacle.hu, obstacle.hv) + WALK_RADIUS,
      )
    }
  })

  it('rejects the house footprint and positions whose body extends beyond the plot', () => {
    for (const at of [
      [3, 3],
      [-6, 2],
      [-4.9, 2],
    ] as [number, number][]) {
      expect(outdoorWalkPoint(groundFloor, outdoor, at, obstacles)).toBeUndefined()
    }
  })
})
