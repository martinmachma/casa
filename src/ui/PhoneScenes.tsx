import { Pencil } from 'lucide-react'
import type { LightState } from '../devices/lights'
import { applyScene, type Scene, sceneActive } from '../devices/scenes'
import type { ShadeState } from '../devices/shades'
import { arrange, type Order } from '../lib/order'

/** How many scenes are shown over the rooms before anyone has chosen. */
const SHOWN_AT_FIRST = 3

type PhoneScenesProps = {
  /** The scenes that reach what's in view: the row shows the chosen ones among them. */
  scenes: Scene[]
  /** Every scene, for the list. */
  all: Scene[]
  /** This person's chosen scenes and their order; undefined until they first arrange them. */
  saved: Order | undefined
  onEdit: () => void
  /** Every item in the house, which decide whether a scene is on. */
  ids: string[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  shade: (id: string) => ShadeState
  onShade: (id: string, patch: Partial<ShadeState>) => void
}

/**
 * Home's quick scenes, with one fixed entry to the editor for scenes, devices and rooms, even in an empty house.
 */
export const PhoneScenes = ({ scenes, all, saved, onEdit, ids, light, onLight, shade, onShade }: PhoneScenesProps) => {
  const order = arrange(
    all.map((s, i) => ({ id: s.id, minor: i >= SHOWN_AT_FIRST })),
    saved,
  )
  const byId = new Map(all.map((s) => [s.id, s]))
  const here = new Set(scenes.map((s) => s.id))
  const shown = order.main.filter((id) => here.has(id)).flatMap((id) => byId.get(id) ?? [])
  const on = (scene: Scene) => sceneActive(scene, light, shade, ids)
  const apply = (scene: Scene) => applyScene(scene, onLight, onShade)
  const row = (scene: Scene) => (
    <button key={scene.id} className="phone-scene" aria-pressed={on(scene)} onClick={() => apply(scene)}>
      <i />
      {scene.name}
    </button>
  )

  return (
    <div className="phone-scenes" role="group" aria-label="Scenes">
      <button
        className="phone-scene phone-home-edit"
        aria-label="Edit scenes, devices and rooms"
        aria-haspopup="dialog"
        onClick={onEdit}
      >
        <Pencil size={16} />
      </button>
      <div className="phone-scenes-row">{shown.map(row)}</div>
    </div>
  )
}
