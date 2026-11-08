import { GripVertical, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { LightState } from '../devices/lights'
import { applyScene, type Scene, sceneActive } from '../devices/scenes'
import type { ShadeState } from '../devices/shades'
import { arrange, type Order } from '../lib/order'
import { IconButton } from './kit'

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
 * Home's scenes on a phone: a row of the ones this person chose, in their order, and All for a sheet of every scene.
 * There Edit drags them up and down and across the line between shown and not, as the desktop room list does. Any
 * number can be on at once: a scene is on while all it sets is as it says.
 */
export const PhoneScenes = ({ scenes, all, saved, onSave, ids, light, onLight, shade, onShade }: PhoneScenesProps) => {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  // The order while a scene is being dragged, saved once it's dropped.
  const [moving, setMoving] = useState<Order>()
  const [dragged, setDragged] = useState<string>()
  const list = useRef<HTMLDivElement>(null)
  // The scene in hand and where it's got to.
  const held = useRef<{ id: string; order?: Order }>(undefined)
  const order =
    moving ??
    arrange(
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

  // Where the pointer is among the other rows decides where the dragged one goes; the line between the shown ones
  // and the rest is a row too. Kept in a ref as well, as a quick drag can end before React has drawn it.
  const drag = (y: number) => {
    const h = held.current
    if (!h || !list.current) return
    const id = h.id
    const now = h.order ?? order
    const flat = [...now.main, '', ...now.minor].filter((r) => r !== id)
    const rows = [...list.current.querySelectorAll<HTMLElement>('[data-slot]')].filter((el) => el.dataset.slot !== id)
    const at = rows.filter((el) => {
      const box = el.getBoundingClientRect()
      return box.top + box.height / 2 < y
    }).length
    flat.splice(at, 0, id)
    const split = flat.indexOf('')
    h.order = { main: flat.slice(0, split), minor: flat.slice(split + 1) }
    setMoving(h.order)
  }
  const drop = (y: number) => {
    drag(y)
    if (held.current?.order) onSave(held.current.order)
    held.current = undefined
    setMoving(undefined)
    setDragged(undefined)
  }

  const slot = (id: string) => {
    const scene = byId.get(id)
    if (!scene) return null
    return (
      <div key={id} className="phone-scene-slot" data-slot={id} data-dragged={dragged === id || undefined}>
        {scene.name}
        <span
          className="phone-scene-grip"
          aria-label={`Move ${scene.name}`}
          onPointerDown={(e) => {
            list.current?.setPointerCapture(e.pointerId)
            held.current = { id }
            setDragged(id)
            e.preventDefault()
          }}
        >
          <GripVertical size={16} />
        </span>
      </div>
    )
  }

  return (
    <>
      <div className="phone-scenes" role="group" aria-label="Scenes">
        {shown.map(row)}
        <button className="phone-scene phone-scenes-all" onClick={() => setOpen(true)}>
          All
        </button>
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
              <div
                ref={list}
                className="phone-scene-order"
                onPointerMove={(e) => drag(e.clientY)}
                onPointerUp={(e) => drop(e.clientY)}
                onPointerCancel={(e) => drop(e.clientY)}
              >
                <h3>Shown over the rooms</h3>
                {order.main.map((id) => slot(id))}
                <h3 data-slot="">In the list</h3>
                {order.minor.map((id) => slot(id))}
                <p className="hint">Drag a scene up or down, or across the line to show or hide it.</p>
              </div>
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
