import type { ReactNode } from 'react'
import type { LightState } from '../devices/lights'
import { type Scene, sceneActive } from '../devices/scenes'
import type { ShadeState } from '../devices/shades'

type RoomScenesProps = {
  scenes: Scene[]
  /** Every item in the house, which decide whether a scene is on: tapping one sets all of it. */
  ids: string[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  shade: (id: string) => ShadeState
  onShade: (id: string, patch: Partial<ShadeState>) => void
  /** Stands at the end of the chips' row. */
  end?: ReactNode
}

/** The scenes here as chips that set their lights and shades. */
export const RoomScenes = ({ scenes, ids, light, onLight, shade, onShade, end }: RoomScenesProps) => {
  const apply = (scene: Scene) => {
    Object.entries(scene.lights).forEach(([id, s]) => onLight(id, s))
    Object.entries(scene.shades).forEach(([id, s]) => onShade(id, s))
  }

  return (
    <div className="smart-scenes">
      <div className="smart-scene-chips" role="group" aria-label="Scenes">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            className="chip"
            aria-pressed={sceneActive(scene, light, shade, ids)}
            onClick={() => apply(scene)}
          >
            {scene.name}
          </button>
        ))}
        {end}
      </div>
    </div>
  )
}
