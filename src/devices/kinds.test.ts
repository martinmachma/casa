import { describe, expect, it } from 'vitest'
import type { Device } from '../data/types'
import { newDeviceName } from './kinds'

const light = (name: string, extra: Partial<Device> = {}): Device => ({
  id: name,
  floor: 'f',
  kind: 'light',
  name,
  x: 0,
  y: 0,
  z: 2.5,
  ...extra,
})

describe('newDeviceName', () => {
  it("counts lights put in by hand, not the plan's", () => {
    const plan = { sheet: 2, symbol: 'L', area: 'inside' } as const
    expect(newDeviceName({ kind: 'light' }, [light('Living light', { plan })])).toBe('Ceiling light 1')
  })

  it('tells wall lights from ceiling lights and steps past a taken name', () => {
    const wall = { wall: { wallId: 'w', side: 'a' } } as const
    expect(newDeviceName({ kind: 'light', ...wall }, [light('Ceiling light 1')])).toBe('Wall light 1')
    expect(newDeviceName({ kind: 'light' }, [light('Ceiling light 2')])).toBe('Ceiling light 3')
  })
})
