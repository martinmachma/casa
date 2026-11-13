import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  ChevronRight,
  DoorOpen,
  Lightbulb,
  Redo2,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Device } from '../data/types'
import type { HouseData } from '../data/useHouseData'
import type { LightState } from '../devices/lights'
import {
  applyScene,
  forgetLocalScenes,
  inScenes,
  newSceneName,
  type Scene,
  sceneHas,
  sceneWith,
  sceneWithout,
} from '../devices/scenes'
import type { ShadeState } from '../devices/shades'
import type { Floor } from '../layout/types'
import { arrange, type Order } from '../lib/order'
import { itemSections, type PlacedItem } from '../rooms/roomItems'
import type { RoomView } from '../rooms/roomViews'
import { DeviceEditor } from './DeviceEditor'
import { DeviceIcon } from './deviceIcons'
import { EditableTitle } from './EditableTitle'
import { IconButton, PanelHead, Section, Segmented } from './kit'
import { LightControls } from './LightControls'
import { ordinal } from './ordinal'
import { PhoneOrder } from './PhoneOrder'
import { SaveButton } from './SaveVersion'
import { SceneEditor } from './SceneEditor'
import { ScenesPanel } from './ScenesPanel'
import { ShadeControls } from './ShadeControls'

type PhoneEditorProps = {
  data: HouseData
  floors: Floor[]
  rooms: RoomView[]
  items: PlacedItem[]
  roomOrder: Order | undefined
  onRoomOrder: (order: Order) => void
  sceneOrder: Order | undefined
  onSceneOrder: (order: Order) => void
  onPreview: (id: string | undefined) => void
  onDeviceChange: (device: Device, patch: Partial<Device>) => void
  onDeviceDelete: (device: Device) => void
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  shade: (id: string) => ShadeState
  onShade: (id: string, patch: Partial<ShadeState>) => void
  night: boolean
  onNight: () => void
  onClose: () => void
}

type Tab = 'scenes' | 'devices' | 'rooms'

/** The phone's shared editor: ordinary versioned edits in one sheet, with the same history and save flow as desktop. */
export const PhoneEditor = ({
  data,
  floors,
  rooms,
  items,
  roomOrder,
  onRoomOrder,
  sceneOrder,
  onSceneOrder,
  onPreview,
  onDeviceChange,
  onDeviceDelete,
  light,
  onLight,
  shade,
  onShade,
  night,
  onNight,
  onClose,
}: PhoneEditorProps) => {
  const dialog = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState<Tab>('scenes')
  const [arranging, setArranging] = useState(false)
  const [sceneId, setSceneId] = useState<string>()
  const [fresh, setFresh] = useState(false)
  const [picking, setPicking] = useState(false)
  const [open, setOpen] = useState<string>()
  const [deviceId, setDeviceId] = useState<string>()
  const scene = data.scenes.find((s) => s.id === sceneId)
  const item = items.find((i) => i.id === deviceId)
  const device = data.devices.find((d) => d.id === deviceId)
  const roomName = (item: PlacedItem) => rooms.find((r) => r.room === item.room)?.label
  const sceneItems = items.filter(inScenes)
  const sections = itemSections(
    floors.map((_, index) => ({
      name: `${ordinal(index + 1)} floor`,
      items: items.filter((i) => i.floorIndex === index),
    })),
    roomName,
  )
  const quickScenes = new Set(data.scenes.filter((s) => sceneItems.some((i) => sceneHas(s, i.id))).slice(0, 3))
  const sceneListOrder = arrange(
    data.scenes.map((s) => ({ id: s.id, minor: !quickScenes.has(s) })),
    sceneOrder,
  )

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  useEffect(() => {
    onPreview(scene?.id)
    return () => onPreview(undefined)
  }, [scene?.id, onPreview])

  const openScene = (saved: Scene | undefined) => {
    const next = saved ?? { id: crypto.randomUUID(), name: newSceneName(data.scenes), lights: {}, shades: {} }
    if (!saved) data.addScenes(next)
    setSceneId(next.id)
    setFresh(!saved)
    setOpen(undefined)
  }
  const changeScene = (next: Scene, key?: string) => data.changeScene(next.id, () => next, key)
  const back = () => {
    if (picking) return setPicking(false)
    setSceneId(undefined)
    setDeviceId(undefined)
    setOpen(undefined)
    setArranging(false)
  }
  const showList = !scene && !item && !arranging
  const rows = (pick: boolean) =>
    sections.map((section) => (
      <Section key={section.name} title={section.name}>
        {section.rooms.map((room) => (
          <div key={room.name ?? ''}>
            {room.name && <h4 className="smart-room">{room.name}</h4>}
            <ul className="scene-list">
              {room.items
                .filter((i) => !pick || inScenes(i))
                .map((i) => (
                  <li key={i.id}>
                    <button
                      className="scene-list-item"
                      aria-pressed={pick && scene ? sceneHas(scene, i.id) : undefined}
                      onClick={() => {
                        if (!pick) return setDeviceId(i.id)
                        if (scene)
                          changeScene(
                            sceneHas(scene, i.id) ? sceneWithout(scene, i.id) : sceneWith(scene, [i], light, shade),
                          )
                      }}
                    >
                      <DeviceIcon kind={i.kind} size={18} />
                      <span className="scene-list-text">{i.name}</span>
                      {pick ? (
                        <span
                          className="phone-editor-check"
                          data-checked={(!!scene && sceneHas(scene, i.id)) || undefined}
                          aria-hidden
                        >
                          {scene && sceneHas(scene, i.id) && <Check size={14} />}
                        </span>
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </Section>
    ))

  return (
    <dialog
      ref={dialog}
      className="phone-editor"
      aria-labelledby="phone-editor-title"
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) dialog.current?.close()
      }}
      onKeyDown={(e) => e.stopPropagation()}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return
        if (scene || item || arranging) {
          e.preventDefault()
          back()
        }
      }}
    >
      <div className="phone-editor-panel">
        <header className="phone-sheet-head phone-editor-head">
          {!showList && (
            <IconButton label="Back" small onClick={back}>
              <ArrowLeft size={18} />
            </IconButton>
          )}
          <h2 id="phone-editor-title">Edit home</h2>
          {showList && tab !== 'devices' && (
            <button
              className="phone-arrange"
              disabled={tab === 'rooms' ? !roomOrder : !data.scenes.length}
              onClick={() => setArranging(true)}
            >
              <ArrowUpDown size={15} /> Arrange
            </button>
          )}
          <IconButton label="Close editor" small onClick={() => dialog.current?.close()}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="phone-editor-tabs">
          <Segmented
            label="What to edit"
            block
            value={tab}
            options={[
              { value: 'scenes', label: 'Scenes', icon: <Sparkles size={16} /> },
              { value: 'devices', label: 'Devices', icon: <Lightbulb size={16} /> },
              { value: 'rooms', label: 'Rooms', icon: <DoorOpen size={16} /> },
            ]}
            onChange={(next) => {
              back()
              setPicking(false)
              setSceneId(undefined)
              setDeviceId(undefined)
              setTab(next)
            }}
          />
        </div>
        <div className="phone-editor-body" key={`${tab}:${picking}:${scene?.id ?? item?.id ?? arranging}`}>
          {arranging ? (
            <Section>
              <PhoneOrder
                order={tab === 'rooms' ? roomOrder! : sceneListOrder}
                name={(id) =>
                  tab === 'rooms' ? rooms.find((r) => r.id === id)?.label : data.scenes.find((s) => s.id === id)?.name
                }
                main={tab === 'rooms' ? 'Main rooms' : 'Over the house'}
                minor={tab === 'rooms' ? 'Other spaces' : 'More'}
                hint="Drag to change the order, or across the line to move between the groups."
                onSave={tab === 'rooms' ? onRoomOrder : onSceneOrder}
              />
              <button className="btn btn-block" onClick={back}>
                Done
              </button>
            </Section>
          ) : tab === 'scenes' ? (
            scene ? (
              picking ? (
                <>
                  <PanelHead title="Devices in the scene" sub="Choose what this scene sets." />
                  {rows(true)}
                  <div className="panel-foot">
                    <button className="btn btn-primary btn-block" onClick={() => setPicking(false)}>
                      Done
                    </button>
                  </div>
                </>
              ) : (
                <SceneEditor
                  scene={scene}
                  fresh={fresh}
                  onChange={changeScene}
                  floors={floors.map((_, index) => ({
                    name: `${ordinal(index + 1)} floor`,
                    items: sceneItems.filter((i) => i.floorIndex === index),
                  }))}
                  roomName={roomName}
                  room={undefined}
                  open={open}
                  onOpen={setOpen}
                  hovered={undefined}
                  onHover={() => {}}
                  onRemove={(i) => changeScene(sceneWithout(scene, i.id))}
                  onAdd={() => {
                    setFresh(false)
                    setPicking(true)
                  }}
                  light={light}
                  shade={shade}
                  night={night}
                  onNight={onNight}
                  onDuplicate={() => {
                    const copy = { ...scene, id: crypto.randomUUID(), name: `${scene.name} copy` }
                    data.addScenes(copy)
                    openScene(copy)
                    setFresh(true)
                  }}
                  onDelete={() => {
                    data.removeScene(scene.id)
                    forgetLocalScenes([scene.id])
                    back()
                  }}
                  onClose={back}
                />
              )
            ) : (
              <ScenesPanel
                scenes={data.scenes}
                items={sceneItems}
                roomName={roomName}
                onOpen={openScene}
                onPreview={() => {}}
                onApply={(s) => applyScene(s, onLight, onShade)}
                night={night}
                onNight={onNight}
              />
            )
          ) : tab === 'devices' ? (
            item ? (
              device ? (
                <DeviceEditor
                  device={device}
                  where={roomName(item) ?? 'Outside'}
                  onChange={(patch) => onDeviceChange(device, patch)}
                  light={light(item.id)}
                  onLight={(patch) => onLight(item.id, patch)}
                  onDelete={() => {
                    onDeviceDelete(device)
                    back()
                  }}
                  onClose={back}
                />
              ) : (
                <>
                  <PanelHead
                    title={
                      <EditableTitle
                        key={item.id}
                        value={item.name}
                        onChange={(name) => {
                          if (item.lamp) data.patchFurniture(item.id, { name })
                          else data.renameDevice(item.id, name)
                        }}
                      />
                    }
                    sub={roomName(item)}
                    onClose={back}
                    closeLabel="Done"
                  />
                  {item.kind === 'light' ? (
                    <LightControls light={light(item.id)} onChange={(p) => onLight(item.id, p)} />
                  ) : (
                    <ShadeControls
                      layout="sheet"
                      name={item.name}
                      shade={shade(item.id)}
                      onChange={(p) => onShade(item.id, p)}
                      onClose={back}
                    />
                  )}
                </>
              )
            ) : items.length ? (
              rows(false)
            ) : (
              <Section>
                <p className="hint">No devices yet.</p>
              </Section>
            )
          ) : (
            floors.map((floor, index) => (
              <Section key={floor.id} title={`${ordinal(index + 1)} floor`}>
                <ul className="scene-list">
                  {rooms
                    .filter((r) => r.floor === floor.id)
                    .map((room) => (
                      <li className="phone-editor-room" key={room.id}>
                        <EditableTitle value={room.label} onChange={(name) => data.renameRoom(room.room, name)} />
                      </li>
                    ))}
                </ul>
              </Section>
            ))
          )}
        </div>
        {data.error && (
          <button className="phone-editor-error" onClick={data.clearError} role="alert">
            {data.error}
          </button>
        )}
        {data.notice && (
          <button className="phone-editor-error" onClick={data.clearNotice} role="status">
            {data.notice}
          </button>
        )}
        <footer className="phone-editor-foot">
          <div className="phone-editor-history">
            <IconButton label="Undo" disabled={!data.canUndo} onClick={data.undo}>
              <Undo2 size={18} />
            </IconButton>
            <IconButton label="Redo" disabled={!data.canRedo} onClick={data.redo}>
              <Redo2 size={18} />
            </IconButton>
            <span className="hint">{data.dirty ? 'Draft kept on this device' : 'No unsaved changes'}</span>
          </div>
          <SaveButton data={data} />
        </footer>
      </div>
    </dialog>
  )
}
