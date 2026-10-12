import { describe, expect, it } from 'vitest'
import type { Rect } from '../layout/rooms'
import {
  alignWith,
  footprintOutline,
  formatLength,
  measuredLine,
  pickFace,
  rectOutline,
  snapToWallFaces,
} from './measure'

// A wall along x = 0…4 with faces at y = -0.1 and 0.1, and one along y = 0…3 with faces at x = -0.1 and 0.1.
const walls: Rect[] = [
  { x0: -0.1, x1: 4.1, y0: -0.1, y1: 0.1 },
  { x0: -0.1, x1: 0.1, y0: -0.1, y1: 3.1 },
]

describe('snapToWallFaces', () => {
  it('lands on a nearby face', () => {
    expect(snapToWallFaces([2, 0.18], walls)).toEqual([2, 0.1])
  })

  it('lands in a corner when both faces are near', () => {
    expect(snapToWallFaces([0.15, 0.2], walls)).toEqual([0.1, 0.1])
  })

  it('leaves points in the open alone', () => {
    expect(snapToWallFaces([2, 1.5], walls)).toEqual([2, 1.5])
  })

  it("ignores a face's line beyond the wall's end", () => {
    expect(snapToWallFaces([4.5, 2.05], [{ x0: 0, x1: 1, y0: 1.9, y1: 2.1 }])).toEqual([4.5, 2.05])
  })
})

describe('alignWith', () => {
  it('squares up a nearly horizontal or vertical line', () => {
    expect(alignWith([0, 0], [3, 0.1])).toEqual([3, 0])
    expect(alignWith([1, 1], [1.1, 4])).toEqual([1, 4])
  })

  it('keeps a diagonal', () => {
    expect(alignWith([0, 0], [2, 1])).toEqual([2, 1])
  })
})

it('formats lengths', () => {
  expect(formatLength(0.456)).toBe('46 cm')
  expect(formatLength(3.4167)).toBe('3.42 m')
})

describe('measuring between faces', () => {
  const outlines = [rectOutline(walls[0]), footprintOutline({ x: 2, y: 2, width: 2, depth: 1, rotation: 0 })]

  it('picks the nearest side, or the side of a piece tapped inside', () => {
    expect(pickFace([2, 0.2], outlines, 0.15)?.face).toEqual({ a: [4.1, 0.1], b: [-0.1, 0.1] })
    expect(pickFace([2, 1.6], outlines, 0.15)?.face).toEqual({ a: [1, 1.5], b: [3, 1.5] })
    expect(pickFace([2, 0.8], outlines, 0.15)).toBeUndefined()
  })

  it('prefers a side parallel to the first face', () => {
    const wall = pickFace([2, 0.2], outlines, 0.15)!.face
    expect(pickFace([1.05, 1.6], outlines, 0.15, wall)?.face).toEqual({ a: [1, 1.5], b: [3, 1.5] })
  })

  it('measures square on from the first face wherever the second is tapped', () => {
    const wall = pickFace([2, 0.2], outlines, 0.15)!
    const sofa = pickFace([2.7, 1.6], outlines, 0.15)!
    const line = measuredLine({ mode: 'faces', picks: [wall, sofa] })!
    expect(line.from[0]).toBeCloseTo(2.7)
    expect(line.to[1] - line.from[1]).toBeCloseTo(1.4)
    expect(line.parallel).toBe(true)
  })
})
