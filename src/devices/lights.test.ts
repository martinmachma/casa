import { describe, expect, it } from 'vitest'
import { colorHue, hueColor } from './lights'

describe('light hues', () => {
  it('reads back the hue a colour was made from', () => {
    for (const hue of [0, 24, 60, 120, 215, 300, 359]) expect(Math.abs(colorHue(hueColor(hue)) - hue)).toBeLessThan(3)
  })
})
