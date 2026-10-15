import { describe, expect, it } from 'vitest'
import { rotateGroup } from './group'

describe('rotateGroup', () => {
  it('swings pieces about their middle and turns each by the same angle', () => {
    const turned = rotateGroup(
      [
        { id: 'a', x: 0, y: 0, rotation: 0 },
        { id: 'b', x: 2, y: 0, rotation: 0 },
      ],
      Math.PI / 2,
    )
    const a = turned.get('a')!
    const b = turned.get('b')!
    expect([a.x, a.y]).toEqual([expect.closeTo(1), expect.closeTo(-1)])
    expect([b.x, b.y]).toEqual([expect.closeTo(1), expect.closeTo(1)])
    expect(b.rotation).toBeCloseTo(Math.PI / 2)
  })
})
