import { useState } from 'react'
import type { LightState } from './lights'

/** A room's lights as someone set them once, put back with a tap. */
export type Scene = { id: string; name: string; lights: Record<string, LightState> }

const white = (brightness: number, kelvin: number): LightState => ({
  on: true,
  brightness,
  mode: 'white',
  kelvin,
  color: '#ff8a3d',
})

/** What a room starts with until its scenes are changed: every light bright and cool, or dim and warm. */
const defaults = (lightIds: string[]): Scene[] =>
  [
    { id: 'bright', name: 'Bright', set: white(1, 4000) },
    { id: 'relax', name: 'Relax', set: white(0.4, 2700) },
  ].map(({ id, name, set }) => ({ id, name, lights: Object.fromEntries(lightIds.map((l) => [l, set])) }))

const same = (a: LightState, b: LightState) =>
  a.on === b.on &&
  (!a.on ||
    (Math.round(a.brightness * 100) === Math.round(b.brightness * 100) &&
      a.mode === b.mode &&
      (a.mode === 'white' ? a.kelvin === b.kelvin : a.color.toLowerCase() === b.color.toLowerCase())))

/** Whether the lights are as the scene sets them; lights it doesn't know are left out. */
export const sceneActive = (scene: Scene, light: (id: string) => LightState, lightIds: string[]) => {
  const ids = lightIds.filter((id) => scene.lights[id])
  return ids.length > 0 && ids.every((id) => same(scene.lights[id], light(id)))
}

const KEY = 'casa.scenes'

const load = (): Record<string, Scene[]> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export type Scenes = {
  /** A room's scenes; the two to start with until any are changed. */
  of: (room: string, lightIds: string[]) => Scene[]
  set: (room: string, scenes: Scene[]) => void
}

/** Each room's scenes, kept in this browser like the lights themselves. */
export const useScenes = (): Scenes => {
  const [saved, setSaved] = useState(load)
  return {
    of: (room, lightIds) => saved[room] ?? defaults(lightIds),
    set: (room, scenes) =>
      setSaved((current) => {
        const next = { ...current, [room]: scenes }
        try {
          localStorage.setItem(KEY, JSON.stringify(next))
        } catch {
          // Private windows may refuse; the scenes still hold until reload.
        }
        return next
      }),
  }
}
