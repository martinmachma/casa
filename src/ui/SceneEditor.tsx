import { Check, ChevronDown, Copy, Minus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LightState } from '../devices/lights'
import {
  type Scene,
  sceneCount,
  sceneFromNow,
  sceneHas,
  sceneSummary,
  sceneSwitched,
  sceneWith,
} from '../devices/scenes'
import { shadeText, type ShadeState } from '../devices/shades'
import { itemSections, type PlacedItem } from '../rooms/roomItems'
import { EditableTitle } from './EditableTitle'
import { DeviceIcon } from './deviceIcons'
import { PanelHead, Segmented, Slide, SLIDE_MS } from './kit'
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

type GroupTickProps = {
  /** Everything in the group, whichever rows are listed. */
  items: PlacedItem[]
  scene: Scene
  name: string
  onTick: (items: PlacedItem[], add: boolean) => void
}

/** Puts a whole room or floor in the scene or takes it out; it shows when only some of it is in. */
const GroupTick = ({ items, scene, name, onTick }: GroupTickProps) => {
  const count = items.filter((i) => sceneHas(scene, i.id)).length
  const all = count === items.length
  return (
    <button
      className="scene-tick"
      role="checkbox"
      aria-checked={all ? true : count ? 'mixed' : false}
      aria-label={`${all ? 'Remove' : 'Add'} everything in ${name}`}
      title={all ? `Remove everything in ${name}` : `Add everything in ${name}`}
      onClick={() => onTick(items, !all)}
    >
      {all ? <Check size={13} /> : count > 0 && <Minus size={13} />}
    </button>
  )
}

type SceneRowProps = {
  item: PlacedItem
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

/** One item: its box puts it in the scene, its tile switches it there, and the row opens the rest of what's set. */
const SceneRow = ({ item, light, shade, open, hovered, onTick, onOpen, onHover, onLight, onShade }: SceneRowProps) => {
  const picked = !!(light || shade)
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
        <button
          className="smart-tile scene-tile"
          data-on={light?.on || down || undefined}
          disabled={!picked}
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
  scene: Scene
  /** Just made: its name is ready to be typed over. */
  fresh: boolean
  /** Changes with the same `key` (one light being set) undo as one step. */
  onChange: (scene: Scene, key?: string) => void
  /** Each floor's smart items, the one it was opened on first. */
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
  onTick: (item: PlacedItem) => void
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
 * A scene being put together from anything in the house, as ordinary edits: undo steps back through them. What it
 * sets each item to is its own, whatever the item is doing now.
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
  onTick,
  light,
  shade,
  night,
  onNight,
  onDuplicate,
  onDelete,
  onClose,
}: SceneEditorProps) => {
  const [show, setShow] = useState<'all' | 'picked'>('all')

  const all = floors.flatMap((f) => f.items)
  const count = sceneCount(scene, all)
  const picked = count.lights + count.shades
  const lit = all.some((i) => (i.kind === 'blind' ? shade(i.id).position > 0 : light(i.id).on))
  const sections = itemSections(floors, roomName, room)
  const shown = (items: PlacedItem[]) => items.filter((i) => show === 'all' || sceneHas(scene, i.id))

  /** Puts in or takes out a whole group as one step. */
  const tickAll = (items: PlacedItem[], add: boolean) => {
    if (add) return onChange(sceneWith(scene, items, light, shade))
    const ids = new Set(items.map((i) => i.id))
    const keep = <T,>(set: Record<string, T>) => Object.fromEntries(Object.entries(set).filter(([id]) => !ids.has(id)))
    onChange({ ...scene, lights: keep(scene.lights), shades: keep(scene.shades) })
  }

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
          <Segmented
            label="Which items to list"
            value={show}
            options={[
              { value: 'all', label: 'All' },
              { value: 'picked', label: `In scene · ${picked}` },
            ]}
            onChange={setShow}
          />
          <NightButton night={night} onNight={onNight} />
        </div>
        {picked > 0 ? (
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
          <div className="scene-set-all" role="group" aria-label="Start the scene">
            <span className="muted">Start from</span>
            <button
              className="btn btn-small btn-ghost"
              title="Puts every light in the house in the scene, switched off"
              onClick={() =>
                onChange(
                  sceneSwitched(
                    sceneWith(
                      scene,
                      all.filter((i) => i.kind !== 'blind'),
                      light,
                      shade,
                    ),
                    false,
                  ),
                )
              }
            >
              All off
            </button>
            <button
              className="btn btn-small btn-ghost"
              disabled={!lit}
              title={lit ? 'Puts in the lights that are on and the shades that are down' : 'Nothing is on now'}
              onClick={() => onChange(sceneFromNow(scene, all, light, shade))}
            >
              What's on now
            </button>
          </div>
        )}
      </div>

      <div className="smart-card-body">
        {sections
          .map((section) => ({
            ...section,
            rooms: section.rooms.map((r) => ({ ...r, rows: shown(r.items) })).filter((r) => r.rows.length),
          }))
          .filter((section) => section.rooms.length)
          .map((section) => (
            <div key={section.name}>
              <h3 className="smart-group scene-head">
                <GroupTick
                  items={sections.find((s) => s.name === section.name)!.rooms.flatMap((r) => r.items)}
                  scene={scene}
                  name={section.name}
                  onTick={tickAll}
                />
                {section.name}
              </h3>
              {section.rooms.map((r) => (
                <div key={r.name ?? ''}>
                  {r.name && (
                    <h4 className="smart-room scene-head">
                      <GroupTick items={r.items} scene={scene} name={r.name} onTick={tickAll} />
                      {r.name}
                    </h4>
                  )}
                  <ul className="scene-rows">
                    {r.rows.map((item) => (
                      <SceneRow
                        key={item.id}
                        item={item}
                        light={scene.lights[item.id]}
                        shade={scene.shades[item.id]}
                        open={open === item.id}
                        hovered={hovered === item.id}
                        onTick={() => onTick(item)}
                        onOpen={() =>
                          sceneHas(scene, item.id) ? onOpen(open === item.id ? undefined : item.id) : onTick(item)
                        }
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
        {show === 'picked' && !picked && <p className="hint">Nothing in this scene yet.</p>}
      </div>

      <div className="scene-form-actions panel-foot">
        <button className="btn btn-small btn-ghost btn-danger" onClick={onDelete}>
          Delete
        </button>
        <button className="btn btn-small btn-ghost" disabled={!picked} onClick={onDuplicate}>
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
