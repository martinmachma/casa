import { useState } from 'react'

/**
 * A light as Home Assistant controls one: on or off, how bright when on (0 to 1), and either a shade of white
 * (colour temperature, kelvin) or a colour.
 */
export type LightState = {
  on: boolean
  brightness: number
  mode: 'white' | 'color'
  kelvin: number
  /** Hex colour, used in colour mode. */
  color: string
}

/** The range of whites a smart bulb usually offers, warm to cool. */
export const KELVIN_MIN = 2200
export const KELVIN_MAX = 6500
const DEFAULTS: Omit<LightState, 'on'> = { brightness: 1, mode: 'white', kelvin: 3000, color: '#ff8a3d' }

/**
 * How brightly a light shines, 0 to 1. One nobody has switched follows the day, coming on after dark;
 * once switched it stays as set.
 */
export const lightLevel = (state: LightState | undefined, dark: number) =>
  state ? (state.on ? state.brightness : 0) : dark

const hex = (v: number) =>
  Math.round(Math.min(255, Math.max(0, v)))
    .toString(16)
    .padStart(2, '0')

/** The colour of white light at a colour temperature (Tanner Helland's fit to the black-body curve). */
export const kelvinColor = (kelvin: number) => {
  const t = kelvin / 100
  const r = t <= 66 ? 255 : 329.7 * (t - 60) ** -0.1332
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * (t - 60) ** -0.0755
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/** The colour a light gives off. */
export const lightColor = (state: LightState | undefined) => {
  const s = { ...DEFAULTS, ...state }
  return s.mode === 'color' ? s.color : kelvinColor(s.kelvin)
}

/** A light's full settings, filling in what nobody has set yet; `dark` decides whether it's on. */
export const lightSettings = (state: LightState | undefined, dark: number): LightState =>
  state ?? { ...DEFAULTS, on: dark > 0.5 }

const KEY = 'casa.lights'

const load = (): Record<string, LightState> => {
  try {
    const saved: Record<string, Partial<LightState>> = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return Object.fromEntries(Object.entries(saved).map(([id, s]) => [id, { ...DEFAULTS, on: false, ...s }]))
  } catch {
    return {}
  }
}

export type Lights = {
  states: Readonly<Record<string, LightState>>
  /** Changes a ceiling light or lamp (by device or furniture id); `dark` fills in a light nobody has switched. */
  set: (id: string, patch: Partial<LightState>, dark: number) => void
}

/**
 * The lights' settings, kept in this browser for now. Linking real lights (each device's Home Assistant entity)
 * swaps this for their live state and sends each change to them.
 */
export const useLights = (): Lights => {
  const [states, setStates] = useState(load)
  const set = (id: string, patch: Partial<LightState>, dark: number) =>
    setStates((current) => {
      const next = { ...current, [id]: { ...lightSettings(current[id], dark), ...patch } }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // Private windows may refuse; the light still changes until reload.
      }
      return next
    })
  return { states, set }
}
