import { describe, expect, it } from 'vitest'
import type { Device } from '../data/types'
import { roomRegions } from '../layout/rooms'
import type { Floor } from '../layout/types'
import { atHeight, deviceRoom, lightPosition, overVoid, placeDevice, snapToWall } from './place'

// A 4×3 m box (wall centre lines), 0.2 m walls, a window in the south wall, split by a wall at x = 2 with a door.
const floor: Floor = {
  id: 'f',
  name: 'F',
  elevation: 0,
  height: 2.5,
  wallThickness: 0.2,
  rooms: [
    { id: 'west', name: 'West', label: [1, 1.5] },
    { id: 'east', name: 'East', label: [3, 1.5] },
  ],
  walls: [
    { id: 'n', from: [0, 0], to: [4, 0] },
    { id: 'e', from: [4, 0], to: [4, 3] },
    { id: 's', from: [4, 3], to: [0, 3], openings: [{ type: 'window', offset: 2.5, width: 1, height: 1.2 }] },
    { id: 'w', from: [0, 3], to: [0, 0] },
    // Side 'a' faces west.
    { id: 'mid', from: [2, 0], to: [2, 3], openings: [{ type: 'door', offset: 1, width: 0.9, height: 2 }] },
  ],
}

describe('snapToWall', () => {
  it('moves a tap onto the nearest face, on the side it was tapped', () => {
    expect(snapToWall([1, 0.3], floor, 1.1)).toMatchObject({ wall: { wallId: 'n', side: 'a' }, x: 1, y: 0.1 })
    expect(snapToWall([1, -0.2], floor, 1.1)).toMatchObject({ wall: { wallId: 'n', side: 'b' }, y: -0.1 })
  })

  it('ignores taps out of reach', () => {
    expect(snapToWall([1, 1.5], floor, 1.1)).toBeUndefined()
  })

  it('keeps clear of the corners', () => {
    const m = snapToWall([3.99, 1], floor, 1.1, Infinity, { wallId: 'n', side: 'a' })
    expect(m?.x).toBeCloseTo(4 - 0.1 - 0.08)
  })

  it('moves out of a door to its nearest edge', () => {
    const m = snapToWall([1.8, 1.5], floor, 1.1)
    expect(m?.wall).toEqual({ wallId: 'mid', side: 'a' })
    expect(m?.x).toBeCloseTo(1.9)
    expect(m?.y).toBeCloseTo(1 + 0.9 + 0.08)
  })

  it('lets a socket sit under a window but not a switch beside it', () => {
    // The window spans x 0.5–1.5 on the south wall (it runs westwards from x = 4).
    expect(snapToWall([1, 2.8], floor, 0.3)?.x).toBeCloseTo(1)
    const sw = snapToWall([1.1, 2.8], floor, 1.1)
    expect(sw?.x).toBeCloseTo(1.5 + 0.08)
  })
})

describe('deviceRoom', () => {
  const device = (patch: Partial<Device>): Device => ({
    id: '',
    floor: 'f',
    kind: 'light',
    name: '',
    x: 0,
    y: 0,
    z: 0,
    ...patch,
  })

  it('counts a wall device in the room its face looks into, and a light where it hangs', () => {
    const west = placeDevice('switch', [1.8, 0.5], floor)!
    const east = placeDevice('socket', [2.2, 0.5], floor)!
    const light = placeDevice('light', [3, 1], floor)!
    const regions = roomRegions(floor)
    expect(deviceRoom(device(west), floor, regions)).toBe('west')
    expect(deviceRoom(device(east), floor, regions)).toBe('east')
    expect(deviceRoom(device(light), floor, regions)).toBe('east')
  })

  it('puts a wall light emitter in the room its face looks into, rather than inside the wall', () => {
    const west = device({ ...placeDevice('switch', [1.8, 0.5], floor)!, kind: 'light' })
    const east = device({ ...placeDevice('switch', [2.2, 0.5], floor)!, kind: 'light' })
    expect(lightPosition(west, floor)[0]).toBeCloseTo(1.78)
    expect(lightPosition(east, floor)[0]).toBeCloseTo(2.22)
    const ceiling = device(placeDevice('light', [3, 1], floor)!)
    expect(lightPosition(ceiling, floor)).toEqual([3, 2.42, 1])
  })

  it('tells a light over the stairwell from one beside it, by where its bulb is', () => {
    const open = { ...floor, voids: [{ x0: 0, y0: 0, x1: 1, y1: 3 }] }
    expect(overVoid(device({ ...placeDevice('wall-light', [0.05, 1], floor)!, wall: undefined }), open)).toBe(true)
    expect(overVoid(device(placeDevice('light', [3, 1], floor)!), open)).toBe(false)
    expect(overVoid(device({ ...placeDevice('switch', [0.5, 1], floor)!, wall: undefined }), open)).toBe(false)
  })

  it('places smart wall lights on either face, including outside without a room', () => {
    const regions = roomRegions(floor)
    const inside = device(placeDevice('wall-light', [1, 0.2], floor)!)
    const outside = device(placeDevice('wall-light', [1, -0.2], floor)!)
    expect(inside).toMatchObject({ kind: 'light', z: 2.2, wall: { wallId: 'n', side: 'a' } })
    expect(outside).toMatchObject({ kind: 'light', z: 2.2, wall: { wallId: 'n', side: 'b' } })
    expect(deviceRoom(inside, floor, regions)).toBe('west')
    expect(deviceRoom(outside, floor, regions)).toBeUndefined()
    expect(lightPosition(inside, floor)[2]).toBeCloseTo(0.22)
    expect(lightPosition(outside, floor)[2]).toBeCloseTo(-0.22)
  })
})

describe('atHeight', () => {
  const ceiling: Device = { id: 'c', floor: 'f', kind: 'light', name: 'C', x: 1, y: 1, z: 2.5 }

  it('keeps a device under the ceiling', () => {
    expect(atHeight(ceiling, 9, floor).z).toBe(2.5)
  })

  it('slides a wall device clear of a window at its new height', () => {
    // Above the window's head on the south wall, right over the window.
    const mount = snapToWall([1, 3.1], floor, 2.4, Infinity, { wallId: 's', side: 'b' })!
    const lowered = atHeight({ ...ceiling, z: 2.4, ...mount }, 1.5, floor)
    expect(lowered.z).toBe(1.5)
    expect(Math.abs(lowered.x! - 1)).toBeGreaterThan(0.5)
  })
})
