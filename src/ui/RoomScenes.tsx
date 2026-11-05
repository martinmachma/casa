import type { ReactNode } from 'react'
import type { LightState } from '../devices/lights'
import { type Scene, sceneActive } from '../devices/scenes'

type RoomScenesProps = {
  scenes: Scene[]
  lightIds: string[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  /** Stands at the end of the chips' row. */
  end?: ReactNode
}

/** The scenes here as chips that set their lights. */
export const RoomScenes = ({ scenes, lightIds, light, onLight, end }: RoomScenesProps) => {
  const apply = (scene: Scene) => Object.entries(scene.lights).forEach(([id, s]) => onLight(id, s))

  return (
    <div className="smart-scenes">
      <div className="smart-scene-chips" role="group" aria-label="Scenes">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            className="chip"
            aria-pressed={sceneActive(scene, light, lightIds)}
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
