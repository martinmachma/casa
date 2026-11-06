import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LightState } from '../devices/lights'
import { type Scene, sceneHas } from '../devices/scenes'
import { shadeText, type ShadeState } from '../devices/shades'
import type { SmartItem } from '../rooms/roomItems'
import { DeviceIcon } from './deviceIcons'
import { PanelHead, Segmented, Slide, SLIDE_MS } from './kit'
import { LightControls } from './LightControls'
import { LightDot } from './SmartList'

type Item = SmartItem & { room: string | undefined }

const TILTS = [
  { value: '0', label: 'Open' },
  { value: '0.5', label: 'Half' },
  { value: '1', label: 'Shut' },
]

type ShadeTargetProps = {
  shade: ShadeState
  onChange: (patch: Partial<ShadeState>) => void
}

/** How far a shade is let down in the scene, and how its slats stand. */
const ShadeTarget = ({ shade, onChange }: ShadeTargetProps) => (
  <div className="scene-shade">
    <input
      type="range"
      aria-label="How far down"
      min={0}
      max={100}
      value={Math.round(shade.position * 100)}
      onChange={(e) => onChange({ position: Number(e.target.value) / 100 })}
    />
    <Segmented
      label="Slats"
      block
      disabled={shade.position <= 0}
      value={String(shade.tilt)}
      options={TILTS}
      onChange={(tilt) => onChange({ tilt: Number(tilt) })}
    />
  </div>
)

type SceneRowProps = {
  item: Item
  /** What the scene sets it to, if it's in the scene. */
  light: LightState | undefined
  shade: ShadeState | undefined
  open: boolean
  hovered: boolean
  onTick: () => void
  onOpen: () => void
  onHover: (hovering: boolean) => void
  onLight: (light: LightState) => void
  onShade: (shade: ShadeState) => void
}

/** One item: its box puts it in the scene, and the row opens what the scene sets it to. */
const SceneRow = ({ item, light, shade, open, hovered, onTick, onOpen, onHover, onLight, onShade }: SceneRowProps) => {
  const picked = !!(light || shade)
  const row = useRef<HTMLLIElement>(null)
  // Once it has opened, all of it is brought into view, wherever it was opened from.
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => row.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), SLIDE_MS)
    return () => clearTimeout(timer)
  }, [open])
  return (
    <li
      ref={row}
      className="scene-row"
      data-picked={picked || undefined}
      data-hovered={hovered || undefined}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      <div className="scene-row-head">
        <button
          className="scene-tick"
          role="checkbox"
          aria-checked={picked}
          aria-label={`${picked ? 'Remove' : 'Add'} ${item.name}`}
          title={picked ? 'Remove from the scene' : 'Add to the scene'}
          onClick={onTick}
        >
          {picked && <Check size={13} />}
        </button>
        <button className="scene-row-open" aria-expanded={open} onClick={onOpen}>
          <span className="smart-tile" data-on={light?.on || (shade && shade.position > 0.005) || undefined}>
            <DeviceIcon kind={item.kind} size={15} />
          </span>
          <span className="smart-row-name">{item.name}</span>
          {picked && (
            <span className="smart-row-state">
              {light?.on && <LightDot light={light} />}
              {light ? (light.on ? `${Math.round(light.brightness * 100)} %` : 'Off') : shadeText(shade!)}
            </span>
          )}
          {picked && <ChevronDown className="scene-row-chevron" size={14} />}
        </button>
      </div>
      <Slide vertical show={open && picked}>
        {light && <LightControls light={light} onChange={(p) => onLight({ ...light, ...p })} />}
        {shade && <ShadeTarget shade={shade} onChange={(p) => onShade({ ...shade, ...p })} />}
      </Slide>
    </li>
  )
}

type SceneEditorProps = {
  /** The scene as saved; none for a new one. */
  saved: Scene | undefined
  /** The scene as it's being put together. */
  draft: Scene
  onChange: (draft: Scene) => void
  /** Each floor's smart items, the one it was opened on first. */
  floors: { name: string; items: Item[] }[]
  /** A room's name, for the items in it. */
  roomName: (item: Item) => string | undefined
  /** The room it was opened from, listed first. */
  room: string | undefined
  /** The item whose settings are showing. */
  open: string | undefined
  onOpen: (id: string | undefined) => void
  /** The item pointed at, here or in the view. */
  hovered: string | undefined
  onHover: (id: string | undefined) => void
  onTick: (item: Item) => void
  /** How an item is set now. */
  light: (id: string) => LightState
  shade: (id: string) => ShadeState
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}

/**
 * A scene being put together from anything in the house. What it sets each item to is its own, whatever the item is
 * doing now.
 */
export const SceneEditor = ({
  saved,
  draft,
  onChange,
  floors,
  roomName,
  room,
  open,
  onOpen,
  hovered,
  onHover,
  onTick,
  light,
  shade,
  onSave,
  onDelete,
  onClose,
}: SceneEditorProps) => {
  const [show, setShow] = useState<'all' | 'picked'>('all')

  const all = floors.flatMap((f) => f.items)
  const picked = all.filter((i) => sceneHas(draft, i.id))
  const name = draft.name.trim()
  const canSave = !!name && picked.length > 0
  const shown = (items: Item[]) => items.filter((i) => show === 'all' || sceneHas(draft, i.id))

  const byRoom = (items: Item[]) => {
    const inRooms = shown(items).filter((i) => i.room)
    const ids = [...new Set(inRooms.map((i) => i.room))]
    return [...ids.filter((id) => id === room), ...ids.filter((id) => id !== room)].map((id) => {
      const rows = inRooms.filter((i) => i.room === id)
      return { name: roomName(rows[0]), rows }
    })
  }
  const sections = [
    ...floors.map((f) => ({ name: f.name, rooms: byRoom(f.items) })),
    { name: 'Outside', rooms: [{ name: undefined, rows: shown(all.filter((i) => !i.room)) }] },
  ].filter((s) => s.rooms.some((r) => r.rows.length))

  /** Everything in the scene set as it is now. */
  const setAsNow = () =>
    onChange({
      ...draft,
      lights: Object.fromEntries(Object.keys(draft.lights).map((id) => [id, light(id)])),
      shades: Object.fromEntries(Object.keys(draft.shades).map((id) => [id, shade(id)])),
    })

  return (
    <>
      <PanelHead eyebrow="Scene" title={name || saved?.name || 'New scene'} onClose={onClose} />
      <div className="scene-form scene-editor-head">
        <input
          autoFocus
          aria-label="Scene name"
          placeholder="Scene name"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'Enter' && canSave) onSave()
          }}
        />
        <div className="scene-editor-tools">
          <Segmented
            label="Which items to list"
            value={show}
            options={[
              { value: 'all', label: 'All' },
              { value: 'picked', label: `In scene · ${picked.length}` },
            ]}
            onChange={setShow}
          />
          <button
            className="btn btn-small btn-ghost"
            disabled={!picked.length}
            title="Set everything in the scene as it is now"
            onClick={setAsNow}
          >
            Use current
          </button>
        </div>
      </div>

      <div className="smart-card-body">
        {sections.map((section) => (
          <div key={section.name}>
            <h3 className="smart-group">{section.name}</h3>
            {section.rooms
              .filter((r) => r.rows.length)
              .map((r) => (
                <div key={r.name ?? ''}>
                  {r.name && <h4 className="smart-room">{r.name}</h4>}
                  <ul className="scene-rows">
                    {r.rows.map((item) => (
                      <SceneRow
                        key={item.id}
                        item={item}
                        light={draft.lights[item.id]}
                        shade={draft.shades[item.id]}
                        open={open === item.id}
                        hovered={hovered === item.id}
                        onTick={() => onTick(item)}
                        onOpen={() =>
                          sceneHas(draft, item.id) ? onOpen(open === item.id ? undefined : item.id) : onTick(item)
                        }
                        onHover={(h) => onHover(h ? item.id : undefined)}
                        onLight={(l) => onChange({ ...draft, lights: { ...draft.lights, [item.id]: l } })}
                        onShade={(s) => onChange({ ...draft, shades: { ...draft.shades, [item.id]: s } })}
                      />
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        ))}
        {!sections.length && <p className="hint">Nothing in this scene yet.</p>}
      </div>

      <div className="scene-form-actions panel-foot">
        {saved && (
          <button className="btn btn-small btn-ghost btn-danger" onClick={onDelete}>
            Delete
          </button>
        )}
        <span className="spacer" />
        <button className="btn btn-small btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-small btn-primary"
          disabled={!canSave}
          title={canSave ? undefined : name ? 'Add something to the scene first' : 'Give the scene a name first'}
          onClick={onSave}
        >
          Save
        </button>
      </div>
    </>
  )
}
