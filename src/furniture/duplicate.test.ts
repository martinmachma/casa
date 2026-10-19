import { describe, expect, it } from 'vitest'
import { duplicateOffset } from './duplicate'
import type { SnapWall } from './snap'

const room: SnapWall[] = [
  { from: [0, 0], to: [4, 0], thickness: 0.2 },
  { from: [4, 0], to: [4, 4], thickness: 0.2 },
  { from: [4, 4], to: [0, 4], thickness: 0.2 },
  { from: [0, 4], to: [0, 0], thickness: 0.2 },
]
const box = { x: 2, y: 2, width: 1, depth: 0.5, rotation: 0 }

describe('duplicateOffset', () => {
  it('tries width, depth, then the opposite sides without crossing any wall', () => {
    expect(duplicateOffset([box], room)).toEqual([1.3, 0])
    expect(duplicateOffset([{ ...box, x: 3.4 }], room)).toEqual([-0, 0.8])
    expect(duplicateOffset([{ ...box, x: 3.4, y: 3.65 }], room)).toEqual([-1.3, -0])
    expect(duplicateOffset([{ ...box, x: 0.6 }], room)).toEqual([1.3, 0])
    expect(duplicateOffset([{ ...box, y: 0.35 }], room)).toEqual([1.3, 0])
    expect(duplicateOffset([{ ...box, width: 3.8, y: 3.65 }], room)).toEqual([0, -0.8])
  })

  it('uses the rotated width axis, including diagonal walls', () => {
    const rotation = Math.PI / 4
    const wall: SnapWall = { from: [0, 0], to: [4, 4], thickness: 0.2 }
    const offset = duplicateOffset([{ ...box, y: 2 + Math.SQRT2 * 0.35, rotation }], [wall])
    expect(offset[0]).toBeCloseTo(1.3 / Math.SQRT2)
    expect(offset[1]).toBeCloseTo(1.3 / Math.SQRT2)
  })

  it('uses one offset large enough to clear every original in a group', () => {
    const items = [box, { ...box, x: 3.3, rotation: Math.PI / 2 }]
    const offset = duplicateOffset(items, [])
    expect(offset[0]).toBeCloseTo(2.35)
    expect(offset[1]).toBe(0)
    const besideWall = [box, { ...box, x: 3.4 }]
    expect(duplicateOffset(besideWall, room)).toEqual([-0, 0.8])
  })

  it('ignores walls beyond their segment ends', () => {
    expect(duplicateOffset([box], [{ from: [3, 0], to: [3, 1], thickness: 0.2 }])).toEqual([1.3, 0])
  })

  it('falls back to the old nudge when no side fits', () => {
    expect(duplicateOffset([{ ...box, width: 3.8, depth: 3.8 }], room)).toEqual([0.3, 0.3])
  })
})
