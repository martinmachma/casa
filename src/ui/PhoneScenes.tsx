import { Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import type { LightState } from '../devices/lights'
import { applyScene, type Scene, sceneActive } from '../devices/scenes'
import type { ShadeState } from '../devices/shades'
import { arrange, type Order } from '../lib/order'
import { IconButton } from './kit'
import { PhoneOrder } from './PhoneOrder'

/** How many scenes are shown over the rooms before anyone has chosen. */
const SHOWN_AT_FIRST = 3

type PhoneScenesProps = {
  /** The scenes that reach what's in view: the row shows the chosen ones among them. */
  scenes: Scene[]
  /** Every scene, for the list. */
  all: Scene[]
  /** This person's chosen scenes and their order; undefined until they first arrange them. */
  saved: Order | undefined
  onSave: (order: Order) => void
  /** Every item in the house, which decide whether a scene is on. */
  ids: string[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  shade: (id: string) => ShadeState
  onShade: (id: string, patch: Partial<ShadeState>) => void
}

/**
 * Home's scenes on a phone: a button for a sheet of every scene, then a row of the ones this person chose, in their
 * order. In the sheet Edit drags them up and down and across the line between shown and not, as the desktop room list
 * does. Any number can be on at once: a scene is on while all it sets is as it says.
 */
export const PhoneScenes = ({ scenes, all, saved, onSave, ids, light, onLight, shade, onShade }: PhoneScenesProps) => {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const order = arrange(
    all.map((s, i) => ({ id: s.id, minor: i >= SHOWN_AT_FIRST })),
    saved,
  )
  const byId = new Map(all.map((s) => [s.id, s]))
  const here = new Set(scenes.map((s) => s.id))
  const shown = order.main.filter((id) => here.has(id)).flatMap((id) => byId.get(id) ?? [])
  const on = (scene: Scene) => sceneActive(scene, light, shade, ids)
  const apply = (scene: Scene) => applyScene(scene, onLight, onShade)
  if (!all.length) return null

  const close = () => {
    setOpen(false)
    setEditing(false)
  }
  const row = (scene: Scene) => (
    <button key={scene.id} className="phone-scene" aria-pressed={on(scene)} onClick={() => apply(scene)}>
      <i />
      {scene.name}
    </button>
  )

  return (
    <>
      <div className="phone-scenes" role="group" aria-label="Scenes">
        <button className="phone-scene phone-scenes-all" aria-label="All scenes" onClick={() => setOpen(true)}>
          <Sparkles size={16} />
        </button>
        <div className="phone-scenes-row">{shown.map(row)}</div>
      </div>

      {open && (
        <>
          <div className="phone-scrim" onClick={close} />
          <div className="phone-sheet float" role="dialog" aria-label="Scenes">
            <div className="phone-sheet-head">
              <h2>Scenes</h2>
              <button className="phone-edit" aria-pressed={editing} onClick={() => setEditing(!editing)}>
                {editing ? 'Done' : 'Edit'}
              </button>
              <IconButton label="Close" small onClick={close}>
                <X size={16} />
              </IconButton>
            </div>
            {editing ? (
              <PhoneOrder
                order={order}
                name={(id) => byId.get(id)?.name}
                main="Shown over the rooms"
                minor="In the list"
                hint="Drag a scene up or down, or across the line to show or hide it."
                onSave={onSave}
              />
            ) : (
              <>
                <h3>Shown</h3>
                <div className="phone-scene-list">{order.main.flatMap((id) => byId.get(id) ?? []).map(row)}</div>
                {order.minor.length > 0 && (
                  <>
                    <h3>More</h3>
                    <div className="phone-scene-list">{order.minor.flatMap((id) => byId.get(id) ?? []).map(row)}</div>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
