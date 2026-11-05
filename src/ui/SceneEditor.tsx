import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { LightState } from '../devices/lights'
import type { Scene } from '../devices/scenes'
import { shadeText, type ShadeState } from '../devices/shades'
import type { SmartItem } from '../rooms/roomItems'
import { DeviceIcon } from './deviceIcons'
import { Segmented } from './kit'
import { LightControls } from './LightControls'
import { LightDot } from './SmartList'

type Item = SmartItem & { room: string | undefined }

/** What the scene sets an item to. */
type Target = { light: LightState } | { shade: ShadeState }

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
  target: Target | undefined
  open: boolean
  onTick: () => void
  onOpen: () => void
  onChange: (target: Target) => void
}

/** One item: its box puts it in the scene, and the row opens what the scene sets it to. */
const SceneRow = ({ item, target, open, onTick, onOpen, onChange }: SceneRowProps) => {
  const light = target && 'light' in target ? target.light : undefined
  const shade = target && 'shade' in target ? target.shade : undefined
  return (
    <li className="scene-row" data-picked={target ? true : undefined}>
      <div className="scene-row-head">
        <button
          className="scene-tick"
          role="checkbox"
          aria-checked={!!target}
          aria-label={`${target ? 'Remove' : 'Add'} ${item.name}`}
          title={target ? 'Remove from the scene' : 'Add to the scene'}
          onClick={onTick}
        >
          {target && <Check size={13} />}
        </button>
        <button className="scene-row-open" aria-expanded={open} onClick={onOpen}>
          <span className="smart-tile" data-on={light?.on || (shade && shade.position > 0.005) || undefined}>
            <DeviceIcon kind={item.kind} size={15} />
          </span>
          <span className="smart-row-name">{item.name}</span>
          {target && (
            <span className="smart-row-state">
              {light?.on && <LightDot light={light} />}
              {light ? (light.on ? `${Math.round(light.brightness * 100)} %` : 'Off') : shadeText(shade!)}
            </span>
          )}
          {target && <ChevronDown className="scene-row-chevron" size={14} />}
        </button>
      </div>
      {open && light && <LightControls light={light} onChange={(p) => onChange({ light: { ...light, ...p } })} />}
      {open && shade && <ShadeTarget shade={shade} onChange={(p) => onChange({ shade: { ...shade, ...p } })} />}
    </li>
  )
}

type SceneEditorProps = {
  /** The scene being changed; none for a new one. */
  scene: Scene | undefined
  /** Each floor's smart items, the one in view first. */
  floors: { name: string; items: Item[] }[]
  /** A room's name, for the items in it. */
  roomName: (item: Item) => string | undefined
  /** The room it was opened from, listed first. */
  room: string | undefined
  light: (id: string) => LightState
  shade: (id: string) => ShadeState
  onClose: () => void
}

/**
 * A scene being put together from anything in the house. What it sets each item to is its own, whatever the item is
 * doing now. Only the look so far: Save and Delete just close it, and nothing is previewed.
 */
export const SceneEditor = ({ scene, floors, roomName, room, light, shade, onClose }: SceneEditorProps) => {
  const [name, setName] = useState(scene?.name ?? '')
  const [targets, setTargets] = useState<Record<string, Target>>(() =>
    Object.fromEntries(Object.entries(scene?.lights ?? {}).map(([id, l]) => [id, { light: l }])),
  )
  const [open, setOpen] = useState<string>()
  const [show, setShow] = useState<'all' | 'picked'>('all')

  const switchable = (i: Item) => i.kind === 'light' || i.kind === 'blind'
  const now = (i: Item): Target => (i.kind === 'blind' ? { shade: shade(i.id) } : { light: light(i.id) })
  const all = floors.flatMap((f) => f.items).filter(switchable)
  const picked = all.filter((i) => targets[i.id])
  const shown = (items: Item[]) => items.filter((i) => switchable(i) && (show === 'all' || targets[i.id]))

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

  const tick = (i: Item) => {
    const { [i.id]: gone, ...rest } = targets
    setTargets(gone ? rest : { ...targets, [i.id]: now(i) })
    setOpen(gone ? undefined : i.id)
  }

  return (
    <div className="room-cards" data-scene>
      <section className="room-card float">
        <div className="scene-form scene-editor-head">
          <input
            autoFocus
            aria-label="Scene name"
            placeholder="Scene name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
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
              onClick={() => setTargets(Object.fromEntries(picked.map((i) => [i.id, now(i)])))}
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
                          target={targets[item.id]}
                          open={open === item.id}
                          onTick={() => tick(item)}
                          onOpen={() =>
                            targets[item.id] ? setOpen(open === item.id ? undefined : item.id) : tick(item)
                          }
                          onChange={(target) => setTargets({ ...targets, [item.id]: target })}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ))}
          {!sections.length && <p className="hint">Nothing in this scene yet.</p>}
        </div>

        <div className="scene-form-actions scene-editor-foot">
          {scene && (
            <button className="btn btn-small btn-ghost btn-danger" onClick={onClose}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button className="btn btn-small btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-small btn-primary" disabled={!picked.length} onClick={onClose}>
            Save
          </button>
        </div>
      </section>
    </div>
  )
}
