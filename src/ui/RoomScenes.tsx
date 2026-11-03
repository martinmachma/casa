import { Check, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import type { LightState } from '../devices/lights'
import { type Scene, sceneActive } from '../devices/scenes'

type RoomScenesProps = {
  scenes: Scene[]
  onScenes: (scenes: Scene[]) => void
  lightIds: string[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
}

/**
 * The room's scenes as chips that set its lights. A new scene keeps the lights as they are; editing one puts it on,
 * so its lights can be adjusted before saving it again.
 */
export const RoomScenes = ({ scenes, onScenes, lightIds, light, onLight }: RoomScenesProps) => {
  const [editing, setEditing] = useState(false)
  // The scene open in the form, or 'new'.
  const [form, setForm] = useState<string>()
  const [name, setName] = useState('')
  const apply = (scene: Scene) => Object.entries(scene.lights).forEach(([id, s]) => onLight(id, s))
  const open = (scene: Scene | undefined) => {
    if (scene) apply(scene)
    setForm(scene?.id ?? 'new')
    setName(scene?.name ?? '')
  }
  const close = () => {
    setForm(undefined)
    setEditing(false)
  }
  const save = () => {
    const lights = Object.fromEntries(lightIds.map((id) => [id, light(id)]))
    const label = name.trim() || 'Scene'
    onScenes(
      form === 'new'
        ? [...scenes, { id: crypto.randomUUID(), name: label, lights }]
        : scenes.map((s) => (s.id === form ? { ...s, name: label, lights } : s)),
    )
    close()
  }

  return (
    <div className="smart-scenes" data-editing={editing || form ? true : undefined}>
      <div className="smart-scene-chips" role="group" aria-label="Scenes">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            className="chip"
            aria-pressed={form ? form === scene.id : !editing && sceneActive(scene, light, lightIds)}
            onClick={() => (editing || form ? open(scene) : apply(scene))}
          >
            {editing && <Pencil size={11} />}
            {scene.name}
          </button>
        ))}
        {!form && (
          <>
            <button className="chip chip-icon" aria-label="New scene" title="New scene" onClick={() => open(undefined)}>
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
          </>
        )}
      </div>
      {form && (
        <form
          className="scene-form"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <input
            autoFocus
            aria-label="Scene name"
            placeholder="Scene name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && close()}
          />
          <p className="hint">Set the lights below as you want them, then save.</p>
          <div className="scene-form-actions">
            {form !== 'new' && (
              <button
                type="button"
                className="btn btn-small btn-ghost btn-danger"
                onClick={() => {
                  onScenes(scenes.filter((s) => s.id !== form))
                  close()
                }}
              >
                Delete
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn btn-small btn-ghost" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="btn btn-small btn-primary">
              Save
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
