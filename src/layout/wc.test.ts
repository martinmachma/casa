import { expect, it } from 'vitest'
import { blockedDoors, doorSweeps, fixtureSolids, hits } from '../furniture/collision'
import { house } from './layout'
import { floorRegions, floorWallRects, roomAt } from './rooms'
import { wcWallFinish } from './wc'

const floor = house.floors.find((f) => f.id === 'ground')!
const regions = floorRegions(floor)

it('fits the WC and basin inside the room, clear of walls, one another and the entrance swing', () => {
  const fittings = fixtureSolids(floor).filter((f) => f.id.startsWith('g-wc-'))
  expect(fittings).toHaveLength(2)
  for (const fixture of fittings) {
    expect(hits(fixture, fittings, floorWallRects(floor)), fixture.id).toEqual([])
    const c = Math.cos(fixture.rotation),
      s = Math.sin(fixture.rotation)
    for (const u of [-0.49, 0.49])
      for (const v of [-0.49, 0.49])
        expect(
          roomAt(
            regions,
            fixture.x + u * fixture.width * c - v * fixture.depth * s,
            fixture.y + u * fixture.width * s + v * fixture.depth * c,
          ),
          fixture.id,
        ).toBe('g-wc')
  }
  expect(blockedDoors(fittings, doorSweeps(floor), floor.id).size).toBe(0)
})

it('keeps the WC finishes within its inward wall faces, away from the hall and storage', () => {
  const finished = floor.walls.filter((w) => wcWallFinish(floor, w))
  expect(finished).toHaveLength(4)
  for (const wall of finished) {
    const { side, u0, u1 } = wcWallFinish(floor, wall)!
    const length = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1])
    const dx = (wall.to[0] - wall.from[0]) / length
    const dy = (wall.to[1] - wall.from[1]) / length
    const inward = ((wall.thickness ?? floor.wallThickness) / 2 + 0.001) * (side === 'a' ? 1 : -1)
    for (const u of [u0 + 0.001, (u0 + u1) / 2, u1 - 0.001])
      expect(roomAt(regions, wall.from[0] + dx * u - dy * inward, wall.from[1] + dy * u + dx * inward), wall.id).toBe(
        'g-wc',
      )
  }
})
