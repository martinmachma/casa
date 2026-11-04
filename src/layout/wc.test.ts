import { expect, it } from 'vitest'
import { blockedDoors, doorSweeps, fixtureSolids, hits } from '../furniture/collision'
import { house } from './layout'
import { wallJoints } from './geometry'
import { floorRegions, floorWallRects, roomAt } from './rooms'
import { WC_BOXING_WALLS, WC_TILE_HEIGHT, wcWallFinish } from './wc'

const floor = house.floors.find((f) => f.id === 'ground')!
const regions = floorRegions(floor)
const structure = { ...floor, walls: floor.walls.filter((w) => !WC_BOXING_WALLS.includes(w.id)) }

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
  expect(finished).toHaveLength(6)
  const fullRoom = floorRegions(structure)
  for (const wall of finished) {
    const { side, u0, u1 } = wcWallFinish(floor, wall)!
    const length = Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1])
    const dx = (wall.to[0] - wall.from[0]) / length
    const dy = (wall.to[1] - wall.from[1]) / length
    const inward = ((wall.thickness ?? floor.wallThickness) / 2 + 0.001) * (side === 'a' ? 1 : -1)
    for (const u of [u0 + 0.001, (u0 + u1) / 2, u1 - 0.001])
      expect(roomAt(fullRoom, wall.from[0] + dx * u - dy * inward, wall.from[1] + dy * u + dx * inward), wall.id).toBe(
        'g-wc',
      )
  }
})

it('matches the plan’s 15 cm WC boxing and 10 cm basin return, with both fittings flush against their fronts', () => {
  const west = floor.walls.find((w) => w.id === 'g-west')!
  const north = floor.walls.find((w) => w.id === 'g-storage-wc')!
  const toiletFrame = floor.walls.find((w) => w.id === 'g-wc-frame')!
  const basinFrame = floor.walls.find((w) => w.id === 'g-wc-basin-frame')!
  const toilet = floor.fixtures!.find((f) => f.id === 'g-wc-toilet')!
  const basin = floor.fixtures!.find((f) => f.id === 'g-wc-basin')!
  const toiletFace = toiletFrame.from[0] + toiletFrame.thickness! / 2
  const basinFace = basinFrame.from[1] + basinFrame.thickness! / 2
  expect(toiletFace - (west.from[0] + west.thickness! / 2)).toBeCloseTo(0.15)
  expect(basinFace - (north.from[1] + north.thickness! / 2)).toBeCloseTo(0.1)
  expect(toilet.x - toilet.depth / 2).toBeCloseTo(toiletFace)
  expect(basin.y - basin.depth / 2).toBeCloseTo(basinFace)
  expect(toiletFrame.height).toBe(WC_TILE_HEIGHT)
  expect(basinFrame.height).toBe(WC_TILE_HEIGHT)
  expect(WC_TILE_HEIGHT).toBe(1.2)
  expect(regions.get('g-wc')!.area).toBeCloseTo(floorRegions(structure).get('g-wc')!.area)
  // Installation boxing must not move saved paint from the hall or storage onto another part.
  for (const wall of structure.walls) expect(wallJoints(wall, floor), wall.id).toEqual(wallJoints(wall, structure))
})
