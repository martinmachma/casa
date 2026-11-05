import { Check, Pencil, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { LightState } from '../devices/lights'
import { type Scene, sceneActive } from '../devices/scenes'

type RoomScenesProps = {
  scenes: Scene[]
  /** Opens a scene in the editor, or a new one. */
  onEdit: (scene: Scene | undefined) => void
  lightIds: string[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  /** Stands at the end of the chips' row. */
  end?: ReactNode
}

/** The scenes here as chips that set their lights, with the way into the editor after them. */
export const RoomScenes = ({ scenes, onEdit, lightIds, light, onLight, end }: RoomScenesProps) => {
  const [editing, setEditing] = useState(false)
  const apply = (scene: Scene) => Object.entries(scene.lights).forEach(([id, s]) => onLight(id, s))
  const edit = (scene: Scene | undefined) => {
    setEditing(false)
    onEdit(scene)
  }

  return (
    <div className="smart-scenes" data-editing={editing || undefined}>
      <div className="smart-scene-chips" role="group" aria-label="Scenes">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            className="chip"
            aria-pressed={!editing && sceneActive(scene, light, lightIds)}
            onClick={() => (editing ? edit(scene) : apply(scene))}
          >
            {editing && <Pencil size={11} />}
            {scene.name}
          </button>
        ))}
        <button className="chip chip-icon" aria-label="New scene" title="New scene" onClick={() => edit(undefined)}>
          <Plus size={14} />
        </button>
        {scenes.length > 0 && (
          <button
            className="chip chip-icon"
            aria-label={editing ? 'Done' : 'Edit scenes'}
            title={editing ? 'Done' : 'Edit scenes'}
            aria-pressed={editing}
            onClick={() => setEditing(!editing)}
          >
            {editing ? <Check size={14} /> : <Pencil size={13} />}
          </button>
        )}
        {end}
      </div>
    </div>
  )
}
