import { describe, expect, it } from 'vitest'
import { pastDragThreshold } from './selection'

describe('pastDragThreshold', () => {
  const start = { clientX: 100, clientY: 200, pointerType: 'mouse' }

  it('requires more than five pixels of radial movement from the press', () => {
    expect(pastDragThreshold(start, { clientX: 100, clientY: 200 })).toBe(false)
    expect(pastDragThreshold(start, { clientX: 103, clientY: 204 })).toBe(false)
    expect(pastDragThreshold(start, { clientX: 96, clientY: 196 })).toBe(true)
  })

  it('allows more slop for touch', () => {
    const touch = { ...start, pointerType: 'touch' }
    expect(pastDragThreshold(touch, { clientX: 106, clientY: 208 })).toBe(false)
    expect(pastDragThreshold(touch, { clientX: 111, clientY: 200 })).toBe(true)
    expect(pastDragThreshold(start, { clientX: 106, clientY: 208 })).toBe(true)
  })
})
