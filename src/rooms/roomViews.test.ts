import { describe, expect, it } from 'vitest'
import { house } from '../layout/layout'
import { floorRegions } from '../layout/rooms'
import type { Point } from '../layout/types'
import { PerspectiveCamera, Vector3 } from 'three'
import { roomEdges, roomPose } from './roomViews'

describe('roomEdges', () => {
  it('traces the outline of the living room and nothing inside it', () => {
    const ground = house.floors.find((f) => f.id === 'ground')!
    const edges = roomEdges(ground, 'g-living')
    const cells = floorRegions(ground).get('g-living')!.cells
    // Every edge lies on the region's boundary: just outside it, no cell of the room.
    for (const e of edges) {
      const mid: Point = [(e.from[0] + e.to[0]) / 2 + e.out[0] * 0.01, (e.from[1] + e.to[1]) / 2 + e.out[1] * 0.01]
      expect(cells.some((c) => mid[0] > c.x0 && mid[0] < c.x1 && mid[1] > c.y0 && mid[1] < c.y1)).toBe(false)
    }
    // The outline's length matches the perimeter of a plain rectangle or more, never the sum of all cell sides.
    expect(edges.length).toBeLessThan(cells.length * 4)
  })
})

describe('roomPose', () => {
  it('keeps every room floor in view, from above but not straight down', () => {
    for (const aspect of [1.8, 0.5])
      for (const floor of house.floors)
        // A room seen from its door shows what's ahead of it, not all of its floor.
        for (const room of floor.rooms.filter((r) => r.view !== 'door')) {
          const pose = roomPose(floor, room.id, aspect)!
          const camera = new PerspectiveCamera(45, aspect)
          camera.position.copy(pose.position)
          camera.lookAt(pose.target)
          camera.updateMatrixWorld()
          const { min, max } = pose.box
          for (const [x, z] of [min, max, [min[0], max[1]], [max[0], min[1]]]) {
            const p = new Vector3(x, floor.elevation, z).project(camera)
            expect(Math.abs(p.x)).toBeLessThan(1)
            expect(Math.abs(p.y)).toBeLessThan(1)
          }
          const down = pose.position.clone().sub(pose.target).normalize().y
          expect(down).toBeGreaterThan(0.5)
          expect(down).toBeLessThan(0.9)
        }
  })
})
