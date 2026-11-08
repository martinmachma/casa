import { describe, expect, it } from 'vitest'
import { animationProgress } from './animation'

describe('camera flight timing', () => {
  it('finishes within one frame of its duration at both smooth and phone frame rates', () => {
    for (const frameMs of [1000 / 60, 125, 200]) {
      const started = 100_000
      let now = started
      for (let frame = 0; frame < 120 && animationProgress(started, now, 1.1) < 1; frame++) now += frameMs
      expect(animationProgress(started, now, 1.1)).toBe(1)
      expect(now - started).toBeGreaterThanOrEqual(1100)
      expect(now - started).toBeLessThan(1100 + frameMs + 0.001)
    }
  })

  it('starts after idle, catches up after a stalled frame, and restarts for another room', () => {
    const started = 100_000
    expect(animationProgress(started, started, 1.1)).toBe(0)
    const beforeStall = animationProgress(started, started + 100, 1.1)
    const afterStall = animationProgress(started, started + 900, 1.1)
    expect(afterStall - beforeStall).toBeGreaterThan(0.7)
    expect(animationProgress(started, started + 5000, 1.1)).toBe(1)
    const nextRoom = started + 10_000
    expect(animationProgress(nextRoom, nextRoom, 1.1)).toBe(0)
  })
})
