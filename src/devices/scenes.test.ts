import { describe, expect, it } from 'vitest'
import type { LightState } from './lights'
import { newSceneName, type Scene, sceneCount, sceneSummary, sceneSwitched, sceneWith } from './scenes'
import { SHADE_UP } from './shades'

const off: LightState = { on: false, brightness: 0.5, mode: 'white', kelvin: 3000, color: '#ffffff' }
const empty: Scene = { id: 's', name: 'Evening', lights: {}, shades: {} }
const lamp = { id: 'lamp', kind: 'light' as const }
const blind = { id: 'blind', kind: 'blind' as const }

describe('scenes', () => {
  it('adds items as they are now, keeping what the scene already sets', () => {
    const scene = sceneWith(
      { ...empty, lights: { lamp: { ...off, brightness: 0.2 } } },
      [lamp, blind],
      () => off,
      () => SHADE_UP,
    )
    expect(scene.lights.lamp.brightness).toBe(0.2)
    expect(scene.shades.blind).toEqual(SHADE_UP)
  })

  it('switches every light, keeping its level', () => {
    const scene = sceneSwitched({ ...empty, lights: { lamp: off } }, true)
    expect(scene.lights.lamp).toEqual({ ...off, on: true })
  })

  it('does not count what is gone from this version', () => {
    const scene = { ...empty, lights: { lamp: off, removed: off }, shades: { blind: SHADE_UP } }
    expect(sceneCount(scene, [lamp, blind])).toEqual({ lights: 1, shades: 1 })
    expect(sceneSummary({ lights: 2, shades: 1 })).toBe('2 lights · 1 shade')
    expect(sceneSummary({ lights: 0, shades: 0 })).toBe('Empty')
  })

  it('names a new scene apart from the others', () => {
    expect(newSceneName([])).toBe('New scene')
    expect(newSceneName([{ ...empty, name: 'New scene' }])).toBe('New scene 2')
  })
})
