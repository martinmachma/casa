import { expect, it } from 'vitest'
import { paintWallArea } from './wallAreas'
import type { WallArea } from './types'

const part = { wallId: 'w', side: 'a', part: 0 } as const
let n = 0
const id = () => `n${n++}`
const square = (u: number, y: number) => ({ ...part, u0: u, u1: u + 0.1, y0: y, y1: y + 0.1 })
const rects = (areas: WallArea[]) =>
  areas.map((a) => [a.color, +a.u0.toFixed(2), +a.u1.toFixed(2), +a.y0.toFixed(2), +a.y1.toFixed(2)]).sort()

it('joins squares painted side by side into one area', () => {
  let areas = paintWallArea([], square(0, 0), 'red', id)
  areas = paintWallArea(areas, square(0.1, 0), 'red', id)
  areas = paintWallArea(areas, square(0.2, 0), 'blue', id)
  expect(rects(areas)).toEqual([
    ['blue', 0.2, 0.3, 0, 0.1],
    ['red', 0, 0.2, 0, 0.1],
  ])
})

it('paints over what is under it, leaving the rest round it', () => {
  const big = paintWallArea([], { ...part, u0: 0, u1: 0.3, y0: 0, y1: 0.3 }, 'red', id)
  const areas = paintWallArea(big, square(0.1, 0.1), 'blue', id)
  expect(rects(areas)).toHaveLength(5)
  expect(rects(areas.filter((a) => a.color === 'blue'))).toEqual([['blue', 0.1, 0.2, 0.1, 0.2]])
  // Painting the hole back joins all but one strip again.
  expect(rects(paintWallArea(areas, square(0.1, 0.1), 'red', id)).length).toBeLessThanOrEqual(2)
})

it('erases a square out of an area, and leaves other walls alone', () => {
  const other: WallArea = { ...square(0, 0), wallId: 'x', color: 'red', id: 'x' }
  const areas = paintWallArea([other, ...paintWallArea([], square(0, 0), 'red', id)], square(0, 0), undefined, id)
  expect(areas).toEqual([other])
})
