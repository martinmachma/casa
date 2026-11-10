import type { DeviceKind } from '../data/types'
import type { LightState } from './lights'
import type { ShadeState } from './shades'

/**
 * Lights and shades around the house as someone set them once, put back with a tap. Kept in the house's versions,
 * like the devices and lamps it names; what the lights are doing now stays in each browser.
 */
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

type Item = { id: string; kind: DeviceKind }

/** Whether an item is a shade rather than a light, in a scene's eyes. */
const isShade = (item: { kind: DeviceKind }) => item.kind === 'blind'

/** Adds the items not in the scene yet, each set as it is now. */
export const sceneWith = (
  scene: Scene,
  items: Item[],
  light: (id: string) => LightState,
  shade: (id: string) => ShadeState,
): Scene => {
  const fresh = items.filter((i) => !sceneHas(scene, i.id))
  return {
    ...scene,
    lights: {
      ...scene.lights,
      ...Object.fromEntries(fresh.filter((i) => !isShade(i)).map((i) => [i.id, light(i.id)])),
    },
    shades: { ...scene.shades, ...Object.fromEntries(fresh.filter(isShade).map((i) => [i.id, shade(i.id)])) },
  }
}

/** Sets every light in the scene to `on`, keeping how bright and what colour each is. */
export const sceneSwitched = (scene: Scene, on: boolean): Scene => ({
  ...scene,
  lights: Object.fromEntries(Object.entries(scene.lights).map(([id, l]) => [id, { ...l, on }])),
})

/** How many of `items` the scene sets; what it names that's no longer in this version doesn't count. */
export const sceneCount = (scene: Scene, items: Item[]) => {
  const inScene = items.filter((i) => sceneHas(scene, i.id))
  const shades = inScene.filter(isShade).length
  return { lights: inScene.length - shades, shades }
}

/** "3 lights · 1 shade", or "Empty". */
export const sceneSummary = ({ lights, shades }: { lights: number; shades: number }) =>
  [
    lights && `${lights} ${lights === 1 ? 'light' : 'lights'}`,
    shades && `${shades} ${shades === 1 ? 'shade' : 'shades'}`,
  ]
    .filter(Boolean)
    .join(' · ') || 'Empty'

/** A name for a new scene that no other scene has. */
export const newSceneName = (scenes: Scene[]) => {
  const taken = new Set(scenes.map((s) => s.name))
  if (!taken.has('New scene')) return 'New scene'
  let n = 2
  while (taken.has(`New scene ${n}`)) n++
  return `New scene ${n}`
}

const sameLight = (a: LightState, b: LightState) =>
  a.on === b.on &&
  (!a.on ||
    (Math.round(a.brightness * 100) === Math.round(b.brightness * 100) &&
      a.mode === b.mode &&
      (a.mode === 'white' ? a.kelvin === b.kelvin : a.color.toLowerCase() === b.color.toLowerCase())))

const sameShade = (a: ShadeState, b: ShadeState) =>
  Math.round(a.position * 100) === Math.round(b.position * 100) && (a.position <= 0 || a.tilt === b.tilt)

/** Sets everything the scene says. */
export const applyScene = (
  scene: Scene,
  onLight: (id: string, state: LightState) => void,
  onShade: (id: string, state: ShadeState) => void,
) => {
  Object.entries(scene.lights).forEach(([id, s]) => onLight(id, s))
  Object.entries(scene.shades).forEach(([id, s]) => onShade(id, s))
}

/** Whether these items are as the scene sets them; those it doesn't set are left out. */
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

const KEY = 'nest.house-scenes'

/** Scenes from before they were saved with the house, still waiting in this browser to be brought in. */
export const localScenes = (): Scene[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

/** Stops bringing in these scenes: they're saved with the house now, or were deleted. */
export const forgetLocalScenes = (ids: string[]) => {
  try {
    const left = localScenes().filter((s) => !ids.includes(s.id))
    if (left.length) localStorage.setItem(KEY, JSON.stringify(left))
    else localStorage.removeItem(KEY)
  } catch {
    // Private windows may refuse; they kept nothing to bring in anyway.
  }
}
