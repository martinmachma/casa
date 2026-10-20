import { describe, expect, it } from 'vitest'
import { house } from '../layout/layout'
import { resolveCollisions, wallObstacles } from './collide'
import { stairHeight, stairRuns } from './stairs'
import type { Point } from '../layout/types'

describe('stair walking surface', () => {
  const floors = house.floors
  const runs = stairRuns(floors)

  it('interpolates each shared tread boundary continuously, including the winders', () => {
    for (const run of runs) {
      for (const [i, tread] of run.treads.entries()) {
        for (const [edge, fraction] of [
          [tread.entry, i / run.treads.length],
          [tread.exit, (i + 1) / run.treads.length],
        ] as const) {
          const p: Point = [(edge[0][0] + edge[1][0]) / 2, (edge[0][1] + edge[1][1]) / 2]
          const expected =
            floors[run.lower].elevation + fraction * (floors[run.upper].elevation - floors[run.lower].elevation)
          expect(stairHeight(run, floors, p)).toBeCloseTo(expected)
        }
      }
      expect(stairHeight(run, floors, [4, 4])).toBeUndefined()
    }
  })

  it('supports a full climb and descent with body clearance and closed landing doors', () => {
    // House plan: west along the bottom flight, clockwise around the winders, east to the landing.
    const path: Point[] = []
    for (let x = 2.9; x > 1.16; x -= 0.02) path.push([x, 4.75])
    for (let angle = Math.PI / 2; angle <= (3 * Math.PI) / 2; angle += 0.02)
      path.push([1.16 + Math.cos(angle) * 0.52, 4.23 + Math.sin(angle) * 0.52])
    for (let x = 1.16; x < 2.9; x += 0.02) path.push([x, 3.71])
    for (const run of runs) {
      const heights = path.map((p) => {
        const height = stairHeight(run, floors, p, 0.5)!
        expect(height).toBeDefined()
        const obstacles = floors.flatMap((floor) => wallObstacles(floor, new Set(), height))
        const resolved = resolveCollisions(p, 0.22, obstacles)
        expect(resolved[0]).toBeCloseTo(p[0])
        expect(resolved[1]).toBeCloseTo(p[1])
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          expect(
            stairHeight(run, floors, [p[0] + Math.cos(angle) * 0.22, p[1] + Math.sin(angle) * 0.22], 0.75),
          ).toBeDefined()
        }
        return height
      })
      expect(heights[0]).toBe(floors[run.lower].elevation)
      expect(heights.at(-1)).toBe(floors[run.upper].elevation)
      for (let i = 1; i < heights.length; i++) {
        expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1] - 1e-6)
        expect(heights[i] - heights[i - 1]).toBeLessThan(0.05)
      }
      expect([...heights].reverse().at(-1)).toBe(floors[run.lower].elevation)
    }
  })
})
