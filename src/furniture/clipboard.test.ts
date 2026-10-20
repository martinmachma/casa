import { describe, expect, it } from 'vitest'
import type { NewFurnitureItem } from '../data/types'
import { pasteFurniture } from './clipboard'

const item: NewFurnitureItem = {
  floor: 'ground',
  name: 'Shelf',
  width: 2,
  depth: 0.4,
  height: 0.6,
  x: 2,
  y: 3,
  z: 1.2,
  rotation: 0.7,
  color: '#abc',
  model: 'shelf',
}

describe('pasteFurniture', () => {
  it('places a single centre at the cursor on the target floor, retaining its properties', () => {
    expect(pasteFurniture([item], 'upper', [8, 9])).toEqual([{ ...item, floor: 'upper', x: 8, y: 9 }])
  })

  it('translates a group about the mean of its centres and keeps the snapshot reusable', () => {
    const snapshot = Object.freeze([Object.freeze({ ...item }), Object.freeze({ ...item, x: 6, y: 7, width: 4 })])
    const pasted = pasteFurniture(snapshot, 'upper', [10, 12])
    expect(pasted).toEqual([
      { ...item, floor: 'upper', x: 8, y: 10 },
      { ...item, floor: 'upper', x: 12, y: 14, width: 4 },
    ])
    pasted[0].color = '#fff'
    expect(pasteFurniture(snapshot, 'ground', [4, 5])).toEqual(snapshot)
  })
})
