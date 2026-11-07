import type { LightState } from '../devices/lights'
import { type Scene, sceneActive } from '../devices/scenes'
import type { ShadeState } from '../devices/shades'
import { SmartCard } from './SmartList'

type RoomScenesProps = {
  scenes: Scene[]
  /** Every item in the house, which decide whether a scene is on: tapping one sets all of it. */
  ids: string[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  shade: (id: string) => ShadeState
  onShade: (id: string, patch: Partial<ShadeState>) => void
}

/** The scenes here, a card of their own as they set shades as well as lights: chips that set them. */
export const RoomScenes = ({ scenes, ids, light, onLight, shade, onShade }: RoomScenesProps) => {
  const apply = (scene: Scene) => {
    Object.entries(scene.lights).forEach(([id, s]) => onLight(id, s))
    Object.entries(scene.shades).forEach(([id, s]) => onShade(id, s))
  }

  if (!scenes.length) return null
  return (
    <SmartCard title="Scenes">
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
      </div>
    </SmartCard>
  )
}
