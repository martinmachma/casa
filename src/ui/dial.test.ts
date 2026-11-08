import { describe, expect, it } from 'vitest'
import { dialFraction, dialPoint } from './dial'

describe('dial arc', () => {
  it('reads back a point on the arc', () => {
    for (const t of [0, 0.25, 0.5, 0.8, 1]) {
      const { x, y } = dialPoint(t, 62)
      expect(dialFraction(x, y)).toBeCloseTo(t)
    }
  })

  it('runs from lower left over the top to lower right', () => {
    expect(dialFraction(-1, 1)).toBeCloseTo(0)
    expect(dialFraction(0, -1)).toBeCloseTo(0.5)
    expect(dialFraction(1, 1)).toBeCloseTo(1)
  })

  it('snaps a point in the gap to the nearer end', () => {
    expect(dialFraction(-0.1, 1)).toBe(0)
    expect(dialFraction(0.1, 1)).toBe(1)
  })
})
