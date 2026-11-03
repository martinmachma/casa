import { expect, it } from 'vitest'
import { hits } from '../furniture/collision'
import { openingSill, wallLength } from './geometry'
import { house } from './layout'
import { floorRegions, floorWallRects, roomAt } from './rooms'

it('keeps traced heaters in their rooms, clear of walls and below existing window sills', () => {
  const locations: Record<string, [string, string]> = {
    'g-dining-radiator': ['g-living', 'g-north'],
    'g-living-radiator': ['g-living', 'g-south'],
    'g-hall-radiator': ['g-hall', 'g-entrance-south'],
    'u-sara-radiator': ['u-room-205', 'u-north'],
    'u-bedroom-radiator': ['u-bedroom', 'u-south'],
    'u-martin-radiator': ['u-room-203', 'u-south'],
    'u-bath-towel-rail': ['u-bath', 'u-205-bath'],
  }
  for (const floor of house.floors) {
    const regions = floorRegions(floor)
    for (const fixture of (floor.fixtures ?? []).filter((f) => f.kind === 'radiator' || f.kind === 'towelRail')) {
      const [room, wallId] = locations[fixture.id]
      expect(roomAt(regions, fixture.x, fixture.y), fixture.name).toBe(room)
      expect(hits({ ...fixture, floor: floor.id }, [], floorWallRects(floor)), fixture.name).toEqual([])
      // The face points into the same room, including the towel rail on the opposite partition face.
      expect(
        roomAt(regions, fixture.x - Math.sin(fixture.rotation) * 0.2, fixture.y + Math.cos(fixture.rotation) * 0.2),
        fixture.name,
      ).toBe(room)
      if (fixture.mount === 'floor') continue // A freestanding low panel in front of terrace glazing.
      const wall = floor.walls.find((w) => w.id === wallId)!
      const t =
        ((fixture.x - wall.from[0]) * (wall.to[0] - wall.from[0]) +
          (fixture.y - wall.from[1]) * (wall.to[1] - wall.from[1])) /
        wallLength(wall)
      for (const opening of wall.openings ?? []) {
        if (t + fixture.width / 2 <= opening.offset || t - fixture.width / 2 >= opening.offset + opening.width) continue
        expect(openingSill(opening) - ((fixture.z ?? 0) + fixture.height), fixture.name).toBeGreaterThan(0.05)
      }
    }
  }
})
