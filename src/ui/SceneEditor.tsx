import { ChevronDown, Copy, Plus, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { LightState } from '../devices/lights'
import { type Scene, sceneCount, sceneHas, sceneSummary, sceneSwitched } from '../devices/scenes'
import { shadeText, type ShadeState } from '../devices/shades'
import { itemSections, type PlacedItem } from '../rooms/roomItems'
import { EditableTitle } from './EditableTitle'
import { DeviceIcon } from './deviceIcons'
import { IconButton, PanelHead, Segmented, Slide, SLIDE_MS } from './kit'
import { LightControls } from './LightControls'
import { NightButton } from './ScenesPanel'
import { LightDot } from './SmartList'

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
  item: PlacedItem
  /** What the scene sets it to: one or the other. */
  light: LightState | undefined
  shade: ShadeState | undefined
  open: boolean
  hovered: boolean
  onRemove: () => void
  onOpen: () => void
  onHover: (hovering: boolean) => void
  onLight: (light: LightState) => void
  onShade: (shade: ShadeState) => void
}

/** One item in the scene: its tile switches it there, and the row opens the rest of what's set. */
const SceneRow = ({
  item,
  light,
  shade,
  open,
  hovered,
  onRemove,
  onOpen,
  onHover,
  onLight,
  onShade,
}: SceneRowProps) => {
  const down = !!shade && shade.position > 0.005
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
      data-hovered={hovered || undefined}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      <div className="scene-row-head">
        <button
          className="smart-tile scene-tile"
          data-on={light?.on || down || undefined}
          aria-label={
            light ? `Switch ${item.name} ${light.on ? 'off' : 'on'}` : `${down ? 'Raise' : 'Lower'} ${item.name}`
          }
          title={light ? (light.on ? 'Switch off' : 'Switch on') : down ? 'Raise' : 'Lower'}
          onClick={() =>
            light ? onLight({ ...light, on: !light.on }) : onShade({ ...shade!, position: down ? 0 : 1 })
          }
        >
          <DeviceIcon kind={item.kind} size={15} />
        </button>
        <button className="scene-row-open" aria-expanded={open} onClick={onOpen}>
          <span className="smart-row-name">{item.name}</span>
          <span className="smart-row-state">
            {light?.on && <LightDot light={light} />}
            {light ? (light.on ? `${Math.round(light.brightness * 100)} %` : 'Off') : shadeText(shade!)}
          </span>
          <ChevronDown className="scene-row-chevron" size={14} />
        </button>
        <IconButton small label={`Remove ${item.name} from the scene`} onClick={onRemove}>
          <X size={14} />
        </IconButton>
      </div>
      <Slide vertical show={open}>
        {light && <LightControls light={light} onChange={(p) => onLight({ ...light, ...p })} />}
        {shade && <ShadeTarget shade={shade} onChange={(p) => onShade({ ...shade, ...p })} />}
      </Slide>
    </li>
  )
}

type SceneEditorProps = {
  scene: Scene
  /** Just made: its name is ready to be typed over. */
  fresh: boolean
  /** Changes with the same `key` (one light being set) undo as one step. */
  onChange: (scene: Scene, key?: string) => void
  /** Each floor's smart items, the one it was opened on first; only those in the scene are listed. */
  floors: { name: string; items: PlacedItem[] }[]
  /** A room's name, for the items in it. */
  roomName: (item: PlacedItem) => string | undefined
  /** The room it was opened from, listed first. */
  room: string | undefined
  /** The item whose settings are showing. */
  open: string | undefined
  onOpen: (id: string | undefined) => void
  /** The item pointed at, here or in the view. */
  hovered: string | undefined
  onHover: (id: string | undefined) => void
  onRemove: (item: PlacedItem) => void
  /** Opens an item picker where the view isn't available, such as the phone's sheet. */
  onAdd?: () => void
  /** How an item is set now. */
  light: (id: string) => LightState
  shade: (id: string) => ShadeState
  night: boolean
  onNight: () => void
  onDuplicate: () => void
  onDelete: () => void
  onClose: () => void
}

/**
 * A scene being put together, as ordinary edits: undo steps back through them. It lists what's in the scene; items
 * are added from the view. What it sets each item to is its own, whatever the item is doing now.
 */
export const SceneEditor = ({
  scene,
  fresh,
  onChange,
  floors,
  roomName,
  room,
  open,
  onOpen,
  hovered,
  onHover,
  onRemove,
  onAdd,
  light,
  shade,
  night,
  onNight,
  onDuplicate,
  onDelete,
  onClose,
}: SceneEditorProps) => {
  const count = sceneCount(
    scene,
    floors.flatMap((f) => f.items),
  )
  const sections = itemSections(
    floors.map((f) => ({ ...f, items: f.items.filter((i) => sceneHas(scene, i.id)) })),
    roomName,
    room,
  )

  /** Everything in the scene set as it is now. */
  const setAsNow = () =>
    onChange({
      ...scene,
      lights: Object.fromEntries(Object.keys(scene.lights).map((id) => [id, light(id)])),
      shades: Object.fromEntries(Object.keys(scene.shades).map((id) => [id, shade(id)])),
    })

  return (
    <>
      <PanelHead
        eyebrow="Scene"
        title={
          <EditableTitle
            key={scene.id}
            value={scene.name}
            startEditing={fresh}
            onChange={(name) => onChange({ ...scene, name })}
          />
        }
        sub={sceneSummary(count)}
        closeLabel="Done"
        onClose={onClose}
      />
      <div className="scene-form scene-editor-head">
        <div className="scene-editor-tools">
          {count.lights + count.shades > 0 ? (
            <div className="scene-set-all" role="group" aria-label="Set everything in the scene">
              <span className="muted">Set all</span>
              <button
                className="btn btn-small btn-ghost"
                disabled={!count.lights}
                onClick={() => onChange(sceneSwitched(scene, true))}
              >
                On
              </button>
              <button
                className="btn btn-small btn-ghost"
                disabled={!count.lights}
                onClick={() => onChange(sceneSwitched(scene, false))}
              >
                Off
              </button>
              <button
                className="btn btn-small btn-ghost"
                title="Set everything in the scene as it is in the house now"
                onClick={setAsNow}
              >
                As it is now
              </button>
            </div>
          ) : (
            <p className="hint">
              {onAdd ? 'Add devices to choose what this scene sets.' : 'Tick items in the view to add them.'}
            </p>
          )}
          <NightButton night={night} onNight={onNight} />
        </div>
        {onAdd && (
          <button className="btn btn-small" onClick={onAdd}>
            <Plus size={15} />
            Add devices
          </button>
        )}
      </div>

      <div className="smart-card-body">
        {sections.map((section) => (
          <div key={section.name}>
            <h3 className="smart-group">{section.name}</h3>
            {section.rooms.map((r) => (
              <div key={r.name ?? ''}>
                {r.name && <h4 className="smart-room">{r.name}</h4>}
                <ul className="scene-rows">
                  {r.items.map((item) => (
                    <SceneRow
                      key={item.id}
                      item={item}
                      light={scene.lights[item.id]}
                      shade={scene.shades[item.id]}
                      open={open === item.id}
                      hovered={hovered === item.id}
                      onRemove={() => onRemove(item)}
                      onOpen={() => onOpen(open === item.id ? undefined : item.id)}
                      onHover={(h) => onHover(h ? item.id : undefined)}
                      onLight={(l) =>
                        onChange({ ...scene, lights: { ...scene.lights, [item.id]: l } }, `${scene.id}:${item.id}`)
                      }
                      onShade={(s) =>
                        onChange({ ...scene, shades: { ...scene.shades, [item.id]: s } }, `${scene.id}:${item.id}`)
                      }
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="scene-form-actions panel-foot">
        <button className="btn btn-small btn-ghost btn-danger" onClick={onDelete}>
          Delete
        </button>
        <button className="btn btn-small btn-ghost" disabled={!sections.length} onClick={onDuplicate}>
          <Copy size={14} />
          Duplicate
        </button>
        <span className="spacer" />
        <button className="btn btn-small btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </>
  )
}
