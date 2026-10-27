import { describe, expect, it } from 'vitest'
import { canMove, colliding, constrainMove, type Solid } from './collision'

// A wall along x = 0, 0.2 thick.
const walls = [{ x0: -0.1, x1: 0.1, y0: 0, y1: 4 }]
const piece = (id: string, x: number, y: number, extra: Partial<Solid> = {}): Solid => ({
  id,
  floor: 'f',
  x,
  y,
  width: 1,
  depth: 1,
  rotation: 0,
  height: 0.8,
  ...extra,
})

describe('collision', () => {
  it('marks overlaps with walls and other pieces, but not flush or stacked ones', () => {
    const items = [
      piece('flush', 0.6, 1),
      piece('inWall', 0.4, 3),
      piece('a', 3, 1),
      piece('b', 3.5, 1.5),
      piece('lamp', 3, 1, { width: 0.3, depth: 0.3, z: 0.8 }),
      piece('rug', 3, 1, { height: 0.01 }),
      piece('desk', 1.9, 3.5, { height: 0.75 }),
      piece('chair', 2.1, 3.5, { model: 'chairDesk', width: 0.6, depth: 0.6 }),
    ]
    expect([...colliding(items, walls)].sort()).toEqual(['a', 'b', 'inWall'])
  })

  it('leaves the empty corner of an L-shaped sofa free', () => {
    const sofa = piece('sofa', 3, 2, { model: 'loungeSofaLong', width: 2.2, depth: 1.6 })
    // The chaise runs along +x at the back (+y); the corner in front of the seat, at -x, +y, is open.
    const table = piece('table', 2.4, 2.6, { width: 0.6, depth: 0.4, height: 0.4 })
    expect(colliding([sofa, table], walls).size).toBe(0)
    expect(colliding([sofa, { ...table, x: 3.6 }], walls).size).toBe(2)
  })

  it('catches a turned piece by its corner', () => {
    expect(colliding([piece('t', 0.75, 1, { rotation: Math.PI / 4 })], walls).size).toBe(1)
  })

  it('stops a move into a wall or through it, but lets a stuck piece out', () => {
    const p = piece('p', 1, 1)
    expect(canMove([p], [{ x: 0.3, y: 1, rotation: 0 }], [p], walls)).toBe(false)
    expect(canMove([p], [{ x: -1, y: 1, rotation: 0 }], [p], walls)).toBe(false)
    const stuck = piece('s', 0.3, 1)
    expect(canMove([stuck], [{ x: 1, y: 1, rotation: 0 }], [stuck], walls)).toBe(true)
  })

  it('slides along a wall when dragged diagonally into it', () => {
    const p = piece('p', 1, 1)
    expect(constrainMove([p], [{ x: 0.3, y: 2, rotation: 0 }], [p], walls)).toEqual([{ x: 1, y: 2, rotation: 0 }])
  })
})
