import { describe, expect, it } from 'vitest'
import { sunDirection, sunPosition, zonedTime } from './sun'

const deg = (r: number) => (r * 180) / Math.PI
const PRAGUE = [50.08, 14.43] as const

describe('sunPosition', () => {
  it('is high in the south at midsummer noon in Prague', () => {
    // Solar noon in Prague is about 11:06 UTC in late June.
    const { altitude, azimuth } = sunPosition(new Date('2026-06-21T11:06:00Z'), ...PRAGUE)
    expect(deg(altitude)).toBeCloseTo(63.4, 0)
    expect(deg(azimuth)).toBeCloseTo(180, -1)
  })

  it('is low in the south at midwinter noon', () => {
    const { altitude } = sunPosition(new Date('2026-12-21T10:58:00Z'), ...PRAGUE)
    expect(deg(altitude)).toBeCloseTo(16.5, 0)
  })

  it('rises in the east at the equinox', () => {
    const { altitude, azimuth } = sunPosition(new Date('2026-03-20T05:00:00Z'), ...PRAGUE)
    expect(Math.abs(deg(altitude))).toBeLessThan(3)
    expect(deg(azimuth)).toBeGreaterThan(85)
    expect(deg(azimuth)).toBeLessThan(95)
  })
})

describe('sunDirection', () => {
  it('points to plan-south when the sun is south and north is up', () => {
    const [x, y, z] = sunDirection({ altitude: 0, azimuth: Math.PI }, 0)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(0)
    expect(z).toBeCloseTo(1)
  })

  it('turns with the north setting', () => {
    // North 90° clockwise from plan-up means plan-right is north, so a southern sun is plan-left.
    const [x, , z] = sunDirection({ altitude: 0, azimuth: Math.PI }, 90)
    expect(x).toBeCloseTo(-1)
    expect(z).toBeCloseTo(0)
  })
})

describe('zonedTime', () => {
  it('reads wall-clock time in Prague, summer and winter', () => {
    expect(zonedTime('2026-06-21', 14 * 60, 'Europe/Prague').toISOString()).toBe('2026-06-21T12:00:00.000Z')
    expect(zonedTime('2026-12-21', 14 * 60, 'Europe/Prague').toISOString()).toBe('2026-12-21T13:00:00.000Z')
  })
})
