import { describe, expect, it } from 'vitest'
import { hull } from './roomViews'

describe('hull', () => {
  it('keeps the outer corners and drops the points inside', () => {
    const h = hull([
      [0, 0],
      [2, 0],
      [1, 1],
      [2, 2],
      [0, 2],
      [1, 0.5],
    ])
    expect(h).toHaveLength(4)
    expect(h).not.toContainEqual([1, 1])
  })
})
