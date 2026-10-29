import { describe, expect, it } from 'vitest'
import { inTheWay } from './cut'

describe('inTheWay', () => {
  const wall = { from: [0, 0] as [number, number], to: [4, 0] as [number, number] }
  it('cuts a piece against a wall only when seen from behind that wall', () => {
    expect(inTheWay([2, 0.3], wall, [2, -5], [2, 2])).toBe(true)
    expect(inTheWay([2, 0.3], wall, [2, 5], [2, 2])).toBe(false)
  })
  it('cuts a piece standing free only on the near side of what is looked at', () => {
    expect(inTheWay([2, 1], undefined, [2, -5], [2, 2])).toBe(true)
    expect(inTheWay([2, 3], undefined, [2, -5], [2, 2])).toBe(false)
  })
})
