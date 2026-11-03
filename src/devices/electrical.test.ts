import { describe, expect, it } from 'vitest'
import { ELECTRICAL_DEVICES } from './electrical'
import { house } from '../layout/layout'
import { floorRegions } from '../layout/rooms'
import { deviceRoom } from './place'
import { openingSill, wallLength } from '../layout/geometry'
import { roomItems } from '../rooms/roomItems'

describe('traced electrical infrastructure', () => {
  it('mounts every inside point in a room, on an existing wall and clear of openings', () => {
    const inside = ELECTRICAL_DEVICES.filter((d) => d.plan?.area === 'inside')
    const unassigned = inside.filter((d) => {
      const floor = house.floors.find((f) => f.id === d.floor)!
      return !deviceRoom(d, floor, floorRegions(floor))
    })
    expect(unassigned.map((d) => d.id)).toEqual([])
    for (const device of inside) {
      const floor = house.floors.find((f) => f.id === device.floor)!
      expect(deviceRoom(device, floor, floorRegions(floor)), device.id).toBeDefined()
      if (!device.wall) continue
      const wall = floor.walls.find((w) => w.id === device.wall!.wallId)!
      expect(wall, device.id).toBeDefined()
      const length = wallLength(wall)
      const t =
        ((device.x - wall.from[0]) * (wall.to[0] - wall.from[0]) +
          (device.y - wall.from[1]) * (wall.to[1] - wall.from[1])) /
        length
      expect(t, device.id).toBeGreaterThan(0)
      expect(t, device.id).toBeLessThan(length)
      for (const opening of wall.openings ?? []) {
        const inOpening =
          device.z > openingSill(opening) &&
          device.z < openingSill(opening) + opening.height &&
          t > opening.offset &&
          t < opening.offset + opening.width
        expect(inOpening, device.id).toBe(false)
      }
    }
  })

  it('assigns opposite faces of the bedroom media bank to their respective rooms', () => {
    const floor = house.floors[1]
    const regions = floorRegions(floor)
    for (const [id, room] of [
      ['u-bedroom', 'u-bedroom'],
      ['u-203', 'u-room-203'],
      ['u-205', 'u-room-205'],
      ['g-living', 'g-living'],
    ]) {
      const device = ELECTRICAL_DEVICES.find((d) => d.id === `electrical-${id}-data`)!
      const home = house.floors.find((f) => f.id === device.floor)!
      expect(deviceRoom(device, home, home === floor ? regions : floorRegions(home))).toBe(room)
      expect(device.plan?.ports).toBe(2)
    }
  })

  it('makes the plan lights available to room controls and scenes without adding passive connections', () => {
    const living = roomItems(house.floors[0], 'g-living', ELECTRICAL_DEVICES, []).filter((i) => i.kind !== 'blind')
    expect(living.map((i) => i.id).sort()).toEqual([
      'electrical-g-dining-light',
      'electrical-g-kitchen-light',
      'electrical-g-living-light',
      'electrical-g-worktop-light',
    ])
    expect(living.every((i) => i.kind === 'light')).toBe(true)
    const bedroom = roomItems(house.floors[1], 'u-bedroom', ELECTRICAL_DEVICES, []).filter((i) => i.kind !== 'blind')
    expect(bedroom.map((i) => i.id)).toEqual(['electrical-u-bedroom-light'])
    expect(ELECTRICAL_DEVICES.find((d) => d.id === 'electrical-g-hob')?.kind).toBe('connection')
    expect(ELECTRICAL_DEVICES.find((d) => d.id === 'electrical-roof-drain-north')?.kind).toBe('connection')
  })
})
