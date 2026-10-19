import { describe, expect, it } from 'vitest'
import { snapFurniture, snapGroupToWalls, snapToWalls, type SnapWall } from './snap'

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

describe('snapGroupToWalls', () => {
  it('uses the nearest member and shares its correction without changing the layout', () => {
    const items = [{ ...box, x: 1, y: 0.43 }, { ...box, x: 3, y: 0.38 }]
    const [dx, dy] = snapGroupToWalls(items, room)
    expect(dx).toBe(0)
    expect(dy).toBeCloseTo(-0.03)
    const moved = items.map((f) => ({ ...f, x: f.x + dx, y: f.y + dy }))
    expect(moved[1].y).toBeCloseTo(0.35)
    expect(moved[1].x - moved[0].x).toBeCloseTo(items[1].x - items[0].x)
    expect(moved[1].y - moved[0].y).toBeCloseTo(items[1].y - items[0].y)
    expect(items[1].y).toBe(0.38)
  })

  it('uses the actual rotated footprint without squaring it, including at corners', () => {
    const item = { ...box, x: 0.68, y: 0.48, rotation: 0.2 }
    const [dx, dy] = snapGroupToWalls([item], room)
    expect(item.x + dx).toBeCloseTo(0.1 + 0.5 * Math.cos(0.2) + 0.25 * Math.sin(0.2))
    expect(item.y + dy).toBeCloseTo(0.1 + 0.5 * Math.sin(0.2) + 0.25 * Math.cos(0.2))
    expect(item.rotation).toBe(0.2)
    const angle = Math.PI / 4
    const diagonal: SnapWall[] = [{ from: [0, 0], to: [4, 4], thickness: 0.2 }]
    const [sx, sy] = snapGroupToWalls([{ ...box, x: 2, y: 2 + 0.4 * Math.SQRT2, rotation: angle }], diagonal)
    expect(sx).toBeCloseTo(0.05 / Math.SQRT2)
    expect(sy).toBeCloseTo(-0.05 / Math.SQRT2)
  })

  it('ignores ineligible members and keeps free or already flush groups in place', () => {
    for (const items of [
      [],
      [{ ...box, x: 2, y: 2 }],
      [{ ...box, x: 5, y: 0.4 }],
      [{ ...box, x: 2, y: 0.4, rotation: 0.6 }],
      [{ ...box, x: 1, y: 0.35 }, { ...box, x: 3, y: 0.4 }],
    ]) expect(snapGroupToWalls(items, room)).toEqual([0, 0])
    expect(snapGroupToWalls([{ ...box, x: 2, y: 0.2 }], room)[1]).toBeCloseTo(0.15)
  })
})

describe('snapFurniture', () => {
  const neighbour = { ...box, id: 'other', floor: 'ground', height: 0.8, x: 2, y: 2 }
  const dragged = { ...neighbour, id: 'dragged', x: 3.05 }

  it('butts edges on either axis and side, correcting small overlaps and choosing the nearest piece', () => {
    for (const [x, y, expectedX, expectedY] of [
      [3.05, 2.1, 3, 2.1],
      [1.05, 2, 1, 2],
      [2.1, 2.55, 2.1, 2.5],
      [2, 1.45, 2, 1.5],
    ]) {
      expect(snapFurniture({ ...dragged, x, y }, [], [neighbour])).toEqual({
        x: expectedX,
        y: expectedY,
        rotation: 0,
      })
    }
    expect(snapFurniture(dragged, [], [{ ...neighbour, id: 'farther', x: 1.97 }, neighbour]).x).toBe(3)
  })

  it('squares and seats rotated, unequal pieces at the nearest quarter turn', () => {
    const angle = Math.PI / 3
    const distance = neighbour.width / 2 + dragged.depth / 2
    const item = {
      ...dragged,
      x: 2 + (distance + 0.05) * Math.cos(angle),
      y: 2 + (distance + 0.05) * Math.sin(angle),
      rotation: angle + Math.PI / 2 + 0.2,
    }
    const p = snapFurniture(item, [], [{ ...neighbour, rotation: angle }])
    expect(p.x).toBeCloseTo(2 + distance * Math.cos(angle))
    expect(p.y).toBeCloseTo(2 + distance * Math.sin(angle))
    expect(p.rotation).toBeCloseTo(angle + Math.PI / 2)
  })

  it('ignores other floors, disjoint heights, itself and excluded dragged items', () => {
    const free = { x: dragged.x, y: dragged.y, rotation: dragged.rotation }
    for (const other of [
      { ...neighbour, floor: 'upstairs' },
      { ...neighbour, z: dragged.height },
      { ...neighbour, z: -neighbour.height },
      { ...neighbour, id: dragged.id },
    ])
      expect(snapFurniture(dragged, [], [other])).toEqual(free)
    expect(snapFurniture(dragged, [], [neighbour], 0.1, [neighbour.id])).toEqual(free)
    expect(snapFurniture({ ...dragged, z: 0.4 }, [], [{ ...neighbour, z: 0.5 }]).x).toBe(3)
  })

  it('requires nearby, overlapping edges and a rotation within 15 degrees', () => {
    for (const item of [
      { ...dragged, x: 3.11 },
      { ...dragged, y: 2.55 },
      { ...dragged, x: 2.5 },
      { ...dragged, rotation: 0.3 },
    ])
      expect(snapFurniture(item, [], [neighbour])).toEqual({ x: item.x, y: item.y, rotation: item.rotation })
  })

  it('snaps along a wall while preserving its placement, and leaves snapped corners alone', () => {
    for (const item of [
      { ...dragged, x: 2, y: 0.35 },
      { ...dragged, x: 2, y: 0.4 },
      { ...dragged, x: 0.65, y: 0.4 },
    ]) {
      const other = { ...neighbour, x: item.x + 1.02, y: item.y }
      const wall = snapToWalls(item, room)
      expect(snapFurniture(item, room, [other])).toEqual(item.x === 0.65 ? wall : { ...wall, x: other.x - 1 })
    }
  })
})
