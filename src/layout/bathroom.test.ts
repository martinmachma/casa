import { expect, it } from 'vitest'
import { blockedDoors, doorSweeps, fixtureSolids, hits } from '../furniture/collision'
import { house } from './layout'
import { wallEndExtensions } from './geometry'
import { floorRegions, floorWallRects, roomAt } from './rooms'

const floor = house.floors.find((f) => f.id === 'upper')!
const bathroom = fixtureSolids(floor).filter((f) => f.id.startsWith('u-bath-'))

it('fits the bathroom fittings inside the room, clear of walls, each other and the entrance swing', () => {
  const regions = floorRegions(floor)
  for (const fixture of bathroom) {
    expect(hits(fixture, bathroom, floorWallRects(floor)), fixture.id).toEqual([])
    const c = Math.cos(fixture.rotation),
      s = Math.sin(fixture.rotation)
    for (const u of [-0.49, 0.49])
      for (const v of [-0.49, 0.49]) {
        expect(
          roomAt(
            regions,
            fixture.x + u * fixture.width * c - v * fixture.depth * s,
            fixture.y + u * fixture.width * s + v * fixture.depth * c,
          ),
          fixture.id,
        ).toBe('u-bath')
      }
  }
  expect(blockedDoors(bathroom, doorSweeps(floor), floor.id).size).toBe(0)
})

it('fits the 110 × 90 shower flush with the WC partition, leaving the window and basin approach clear', () => {
  const shower = bathroom.find((f) => f.id === 'u-bath-shower')!
  const partition = floor.walls.find((w) => w.id === 'u-bath-shaft')!
  const vanity = bathroom.find((f) => f.id === 'u-bath-vanity')!
  expect(vanity.width).toBe(1)
  expect(shower.width).toBe(1.1)
  expect(shower.depth).toBe(0.9)
  // The partition's visible free end includes its cap, inset 2 mm like the rendered wall pieces.
  const wallFront = partition.from[0] - wallEndExtensions(partition, floor, 0.002).from
  const showerFront = shower.x - shower.depth / 2
  expect(wallFront).toBeCloseTo(showerFront, 5)
  // Its south edge meets the partition next to the WC, rather than the window corner.
  expect(shower.y + shower.width / 2).toBeCloseTo(partition.from[1] - floor.wallThickness / 2)
  expect(shower.y - shower.width / 2).toBeGreaterThan(0.9)
  expect(shower.x - shower.depth / 2 - (vanity.x + vanity.depth / 2)).toBeGreaterThan(0.85)
})
