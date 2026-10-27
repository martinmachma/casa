import { useState } from 'react'

/** A light switched by hand: on or off, and how bright when on (0 to 1). */
export type LightState = { on: boolean; brightness: number }

/**
 * How brightly a light shines, 0 to 1. One nobody has switched follows the day, coming on after dark;
 * once switched it stays as set.
 */
export const lightLevel = (state: LightState | undefined, dark: number) =>
  state ? (state.on ? state.brightness : 0) : dark

const KEY = 'casa.lights'

const load = (): Record<string, LightState> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export type Lights = {
  states: Readonly<Record<string, LightState>>
  /** Switches a ceiling light or lamp (by device or furniture id); `dark` fills in a light nobody has switched. */
  set: (id: string, patch: Partial<LightState>, dark: number) => void
  toggle: (id: string, dark: number) => void
}

/**
 * The lights' switches, kept in this browser for now. Linking real lights (each device's Home Assistant entity)
 * swaps this for their live state and sends each change to them.
 */
export const useLights = (): Lights => {
  const [states, setStates] = useState(load)
  const set = (id: string, patch: Partial<LightState>, dark: number) =>
    setStates((current) => {
      const now = current[id] ?? { on: dark > 0.5, brightness: 1 }
      const next = { ...current, [id]: { ...now, ...patch } }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // Private windows may refuse; the switch still works until reload.
      }
      return next
    })
  const toggle = (id: string, dark: number) => set(id, { on: !(lightLevel(states[id], dark) > 0) }, dark)
  return { states, set, toggle }
}
