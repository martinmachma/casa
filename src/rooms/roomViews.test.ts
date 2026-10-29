import { describe, expect, it } from 'vitest'
import { house } from '../layout/layout'
import { floorRegions } from '../layout/rooms'
import type { Point } from '../layout/types'
import { roomEdges } from './roomViews'

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
