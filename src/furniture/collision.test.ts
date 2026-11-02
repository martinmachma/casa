import { describe, expect, it } from 'vitest'
import type { Floor, Opening } from '../layout/types'
import { house } from '../layout/layout'
import { blockedDoors, colliding, doorSweeps, fixtureSolids, footprintOutline, hits, type Solid } from './collision'

// A wall along x = 0, 0.2 thick.
const walls = [{ x0: -0.1, x1: 0.1, y0: 0, y1: 4 }]
const piece = (id: string, x: number, y: number, extra: Partial<Solid> = {}): Solid => ({
  id,
  floor: 'f',
  x,
  y,
  width: 1,
  depth: 1,
  rotation: 0,
  height: 0.8,
  ...extra,
})

describe('collision', () => {
  it('marks overlaps with walls and other pieces, but not flush or stacked ones', () => {
    const items = [
      piece('flush', 0.6, 1),
      piece('inWall', 0.4, 3),
      piece('a', 3, 1),
      piece('b', 3.5, 1.5),
      piece('lamp', 3, 1, { width: 0.3, depth: 0.3, z: 0.8 }),
      piece('rug', 3, 1, { height: 0.01 }),
      piece('desk', 1.9, 3.5, { height: 0.75 }),
      piece('chair', 2.1, 3.5, { model: 'chairDesk', width: 0.6, depth: 0.6 }),
    ]
    expect([...colliding(items, walls)].sort()).toEqual(['a', 'b', 'inWall'])
  })

  it('leaves the empty corner of an L-shaped sofa free', () => {
    const sofa = piece('sofa', 3, 2, { model: 'loungeSofaLong', width: 2.2, depth: 1.6 })
    // The chaise runs along +x at the back (+y); the corner in front of the seat, at -x, +y, is open.
    const table = piece('table', 2.4, 2.6, { width: 0.6, depth: 0.4, height: 0.4 })
    expect(colliding([sofa, table], walls).size).toBe(0)
    expect(colliding([sofa, { ...table, x: 3.6 }], walls).size).toBe(2)
  })

  it('catches a turned piece by its corner', () => {
    expect(colliding([piece('t', 0.75, 1, { rotation: Math.PI / 4 })], walls).size).toBe(1)
  })

  it('marks furniture and placement previews against fixed radiators, including chairs beside low panels', () => {
    const fixtures = house.floors.flatMap(fixtureSolids)
    const radiator = fixtures.find((f) => f.id === 'g-dining-radiator')!
    const chair = piece('chair', radiator.x, radiator.y, {
      floor: radiator.floor,
      model: 'chairDesk',
      width: 0.4,
      depth: 0.4,
    })
    expect([...colliding([chair], [], fixtures)]).toEqual(['chair'])
    expect([...colliding([{ ...chair, id: 'placing' }], [], fixtures)]).toEqual(['placing'])
    expect(colliding([{ ...chair, y: radiator.y + 0.5 }], [], fixtures).size).toBe(0)
    expect(colliding([{ ...chair, floor: 'upper' }], [], fixtures).size).toBe(0)
  })

  it('uses the towel rail mounting height so objects below or above it remain clear', () => {
    const fixtures = fixtureSolids(house.floors[1])
    const rail = fixtures.find((f) => f.id === 'u-bath-towel-rail')!
    const cabinet = piece('cabinet', rail.x, rail.y, { floor: rail.floor, width: 0.2, depth: 0.2 })
    expect(hits(cabinet, fixtures, [])).toContain(rail.id)
    expect(hits({ ...cabinet, height: 0.2 }, fixtures, [])).toEqual([])
    expect(hits({ ...cabinet, z: 1.6 }, fixtures, [])).toEqual([])
  })
})

describe('footprintOutline', () => {
  it('traces an L as six edges', () => {
    const outline = footprintOutline([
      [-0.5, 0.5, -0.5, 0],
      [0, 0.5, 0, 0.5],
    ])
    expect(outline).toHaveLength(6)
  })

  // A door 0.8 wide in a wall along y = 0, 1 m from its west end, hinged on the west and opening south (+y).
  const doorFloor = (door: Partial<Opening> = {}): Floor => ({
    id: 'f',
    name: 'F',
    elevation: 0,
    height: 2.6,
    wallThickness: 0.2,
    rooms: [],
    walls: [
      { id: 'w', from: [0, 0], to: [4, 0], openings: [{ type: 'door', offset: 1, width: 0.8, height: 2, ...door }] },
    ],
  })
  const blockers = (floor: Floor, items: Solid[]) => blockedDoors(items, doorSweeps(floor), 'f').get('w:0') ?? []
  const small = (id: string, x: number, y: number, extra: Partial<Solid> = {}) =>
    piece(id, x, y, { width: 0.3, depth: 0.3, ...extra })

  it('finds what stands where a door leaf swings open', () => {
    const items = [
      small('inSwing', 1.4, 0.5),
      small('otherSide', 1.4, -0.5),
      // Seated flush against the wall right beside the hinge.
      piece('besideHinge', 0.5, 0.6),
      // In the square round the arc but past the arc itself.
      small('pastArc', 1.85, 0.95),
      small('rug', 1.4, 0.5, { height: 0.01 }),
      small('aboveDoor', 1.4, 0.5, { z: 2.1 }),
    ]
    expect(blockers(doorFloor(), items)).toEqual(['inSwing'])
    expect(blockers(doorFloor({ swing: 'b', hinge: 'to' }), items)).toEqual(['otherSide'])
    expect(blockers(doorFloor({ type: 'sliding' }), items)).toEqual([])
  })

  it('includes fixed equipment in the door sweep', () => {
    const floor: Floor = {
      ...doorFloor(),
      fixtures: [{ ...small('radiator', 1.4, 0.5), kind: 'radiator', name: 'Radiator', z: 0.15 }],
    }
    expect(blockers(floor, fixtureSolids(floor))).toEqual(['radiator'])
  })
})
