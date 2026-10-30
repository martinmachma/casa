import { describe, expect, it } from 'vitest'
import { groundLevel } from './ground'
import type { Floor, Outdoor } from './types'

const floor = {
  elevation: 0,
  outline: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ],
} as Floor
const outdoor: Outdoor = {
  level: -0.35,
  garden: [
    [-10, -10],
    [10, -10],
    [10, 10],
    [-10, 10],
  ],
  terrace: {
    name: 'Terrace',
    level: -0.3,
    outline: [
      [4, 0],
      [8, 0],
      [8, 4],
      [4, 4],
    ],
  },
  paving: [
    {
      name: 'Path',
      level: -0.125,
      outline: [
        [6, 0],
        [7, 0],
        [7, 6],
        [6, 6],
      ],
    },
  ],
  sheds: [],
}

describe('groundLevel', () => {
  it('is the slab inside the house', () => expect(groundLevel(floor, outdoor, [2, 2])).toBe(0))
  it('is the terrace on it', () => expect(groundLevel(floor, outdoor, [5, 2])).toBe(-0.3))
  it('takes the higher paving where they overlap', () => expect(groundLevel(floor, outdoor, [6.5, 2])).toBe(-0.125))
  it('is the lawn elsewhere', () => expect(groundLevel(floor, outdoor, [-2, 2])).toBe(-0.35))
})
