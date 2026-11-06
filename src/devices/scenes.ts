import { useState } from 'react'
import type { DeviceKind } from '../data/types'
import type { LightState } from './lights'
import type { ShadeState } from './shades'

/** Lights and shades around the house as someone set them once, put back with a tap. */
export type Scene = {
  id: string
  name: string
  lights: Record<string, LightState>
  shades: Record<string, ShadeState>
}

/** Whether a scene can set an item of the kind. */
export const inScenes = (item: { kind: DeviceKind }) => item.kind === 'light' || item.kind === 'blind'

export const sceneHas = (scene: Scene, id: string) => !!(scene.lights[id] ?? scene.shades[id])

export const sceneWithout = (scene: Scene, id: string): Scene => ({
  ...scene,
  lights: Object.fromEntries(Object.entries(scene.lights).filter(([key]) => key !== id)),
  shades: Object.fromEntries(Object.entries(scene.shades).filter(([key]) => key !== id)),
})

const sameLight = (a: LightState, b: LightState) =>
  a.on === b.on &&
  (!a.on ||
    (Math.round(a.brightness * 100) === Math.round(b.brightness * 100) &&
      a.mode === b.mode &&
      (a.mode === 'white' ? a.kelvin === b.kelvin : a.color.toLowerCase() === b.color.toLowerCase())))

const sameShade = (a: ShadeState, b: ShadeState) =>
  Math.round(a.position * 100) === Math.round(b.position * 100) && (a.position <= 0 || a.tilt === b.tilt)

/** Whether these items are as the scene sets them; those it doesn't know are left out. */
export const sceneActive = (
  scene: Scene,
  light: (id: string) => LightState,
  shade: (id: string) => ShadeState,
  ids: string[],
) => {
  const known = ids.filter((id) => sceneHas(scene, id))
  return (
    known.length > 0 &&
    known.every((id) =>
      scene.lights[id] ? sameLight(scene.lights[id], light(id)) : sameShade(scene.shades[id], shade(id)),
    )
  )
}

const KEY = 'casa.house-scenes'

const load = (): Scene[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export type Scenes = {
  list: Scene[]
  /** Adds the scene, or replaces the one with its id. */
  save: (scene: Scene) => void
  remove: (id: string) => void
}

/** The house's scenes, kept in this browser like the lights themselves. */
export const useScenes = (): Scenes => {
  const [list, setList] = useState(load)
  const keep = (change: (scenes: Scene[]) => Scene[]) =>
    setList((current) => {
      const next = change(current)
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // Private windows may refuse; the scenes still hold until reload.
      }
      return next
    })
  return {
    list,
    save: (scene) =>
      keep((scenes) =>
        scenes.some((s) => s.id === scene.id) ? scenes.map((s) => (s.id === scene.id ? scene : s)) : [...scenes, scene],
      ),
    remove: (id) => keep((scenes) => scenes.filter((s) => s.id !== id)),
  }
}
