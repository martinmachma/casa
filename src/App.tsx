import { TodoPopup } from './ui/TodoPopup'
import { useOpenTodoCount } from './ui/useOpenTodoCount'
import { useEffect, useRef, useState } from 'react'
import { AuthGate, type Account } from './auth/AuthGate'
import type { Backend, Device, DeviceKind, FurnitureItem } from './data/types'
import { useHouseData } from './data/useHouseData'
import { DEVICE_KINDS } from './devices/kinds'
import { changeKind, deviceRoom, devicesPerRoom } from './devices/place'
import { rotateGroup } from './furniture/group'
import { duplicateOffset } from './furniture/duplicate'
import { floorSnapWalls, normalizeAngle, snapToWalls } from './furniture/snap'
import { floorBounds } from './layout/geometry'
import { floorRegions } from './layout/rooms'
import { roomLabel } from './layout/roomName'
import type { Point } from './layout/types'
import { house } from './layout/layout'
import { HouseScene } from './scene/HouseScene'
import { FURNITURE_SWATCHES } from './scene/palette'
import { createCameraNudge } from './scene/cameraNudge'
import type { CameraMode, Interaction, Selection } from './scene/selection'
import { CameraPad } from './ui/CameraPad'
import { DeviceEditor } from './ui/DeviceEditor'
import { DevicePanel } from './ui/DevicePanel'
import { FurnitureEditor } from './ui/FurnitureEditor'
import { FurnitureGroupEditor } from './ui/FurnitureGroupEditor'
import { FurniturePanel, type NewPiece } from './ui/FurniturePanel'
import type { SunSettings } from './sun/useSun'
import { sunPosition, zonedTime } from './sun/sun'
import { wallText } from './measure/dimensions'
import { measuredLine, type MeasuredLine, type MeasurePick, type Measurement } from './measure/measure'
import { MeasurePanel } from './ui/MeasurePanel'
import { SunPanel } from './ui/SunPanel'
import { DockBox, ViewDock } from './ui/ViewDock'
import { RoomPanel } from './ui/RoomPanel'
import { WallPanel } from './ui/WallPanel'
import { wallPartColor } from './data/types'
import { ModeBar } from './ui/ModeBar'
import { FloorList, RoomLegend } from './ui/RoomLegend'
import { TopBar } from './ui/TopBar'
import { SaveBar } from './ui/SaveBar'
import { VersionMenu } from './ui/VersionMenu'
import { isTyping } from './ui/isTyping'

export const App = () => <AuthGate>{(backend, account) => <House backend={backend} account={account} />}</AuthGate>

type HouseProps = { backend: Backend; account: Account }

// Phones start with both panels tucked away, leaving the screen to the house.
const NARROW = '(max-width: 820px)'
const isNarrow = () => window.matchMedia(NARROW).matches

const House = ({ backend, account }: HouseProps) => {
  const data = useHouseData(backend)
  const [floorIndex, setFloorIndex] = useState(0)
  const [outside, setOutside] = useState(false)
  const [camera, setCamera] = useState<CameraMode>('orbit')
  const [cutaway, setCutaway] = useState(false)
  const [interaction, setInteraction] = useState<Interaction>('view')
  const [selection, setSelection] = useState<Selection>()
  const [placing, setPlacing] = useState<DeviceKind>()
  const [hoveredRoom, setHoveredRoom] = useState<string>()
  const [todosOpen, setTodosOpen] = useState(false)
  const openTodos = useOpenTodoCount()
  const [leftOpen, setLeftOpen] = useState(() => !isNarrow())
  // The right panel is the editor: it's there while editing, and on a phone can be tucked away meanwhile.
  const [rightTucked, setRightTucked] = useState(false)
  const setRightOpen = (open: boolean) => setRightTucked(!open)
  const [snap, setSnap] = useState(true)
  const nudge = useRef(createCameraNudge())
  const [viewKey, setViewKey] = useState(0)
  const [measure, setMeasure] = useState<Measurement>()
  const [measurements, setMeasurements] = useState<MeasuredLine[]>([])
  const [sun, setSun] = useState<SunSettings>()
  const { site } = house
  const sunAt = sun
    ? sunPosition(zonedTime(sun.date, sun.minutes, site.timeZone), site.latitude, site.longitude)
    : undefined

  const floor = house.floors[floorIndex]
  const regions = floorRegions(floor)
  const selectedRoom = selection?.kind === 'room' ? floor.rooms.find((r) => r.id === selection.roomId) : undefined
  const selectedItems =
    selection?.kind === 'furniture' ? data.furniture.filter((f) => selection.ids.includes(f.id)) : []
  const selectedItem = selectedItems.length === 1 ? selectedItems[0] : undefined
  const selectedDevice = selection?.kind === 'device' ? data.devices.find((d) => d.id === selection.id) : undefined
  const floorDevices = data.devices.filter((d) => d.floor === floor.id)

  // Typing a size or dragging the colour picker undoes as one step per field.
  const changeItem = (item: FurnitureItem, patch: Partial<FurnitureItem>, key?: string) =>
    data.patchFurniture(item.id, patch, key)
  const rotateItem = (item: FurnitureItem, degrees: number) => {
    const rotation = normalizeAngle(item.rotation + (degrees * Math.PI) / 180)
    // Turning an item that sits against a wall would swing it into the wall; re-seat it, unless
    // snapping would also undo the turn (a 15° step).
    const seated = snap ? snapToWalls({ ...item, rotation }, floorSnapWalls(floor)) : undefined
    const keepsTurn = seated && Math.abs(normalizeAngle(seated.rotation - rotation)) < 1e-6
    changeItem(item, keepsTurn ? seated : { rotation })
  }
  /** Picking something shows it in the right panel, opening the panel if it was tucked away. */
  const select = (next: Selection | undefined) => {
    data.endEdit()
    setSelection(next)
    if (next) setRightOpen(true)
  }
  /** One piece turns (and re-seats against its wall); a group swings about its middle as it's arranged. */
  const rotateSelection = (degrees: number) => {
    if (selectedItem) return rotateItem(selectedItem, degrees)
    if (selectedItems.length) data.patchFurnitures(rotateGroup(selectedItems, (degrees * Math.PI) / 180))
  }
  const deleteSelection = () => {
    data.removeFurniture(...selectedItems.map((f) => f.id))
    setSelection(undefined)
  }

  /** Copies land beside the originals, or at the same plan position on another floor. */
  const duplicateSelection = (targetFloorId = floor.id) => {
    const targetIndex = house.floors.findIndex((f) => f.id === targetFloorId)
    if (!selectedItems.length || targetIndex < 0) return
    const sameFloor = targetFloorId === floor.id
    const [dx, dy] = sameFloor ? duplicateOffset(selectedItems, floorSnapWalls(floor)) : [0, 0]
    const created = data.addFurniture(
      ...selectedItems.map(({ id: _, ...item }) => ({
        ...item,
        floor: targetFloorId,
        x: item.x + dx,
        y: item.y + dy,
      })),
    )
    if (!sameFloor) switchFloor(targetIndex)
    select({ kind: 'furniture', ids: created.map((f) => f.id) })
  }

  const deleteDevice = (device: Device) => {
    data.removeDevice(device.id)
    setSelection(undefined)
  }

  /** A numbered name for a new device of the kind ("Socket 3"). */
  const deviceName = (kind: DeviceKind) => {
    const { label } = DEVICE_KINDS[kind]
    const taken = new Set(data.devices.map((d) => d.name))
    let n = data.devices.filter((d) => d.kind === kind).length + 1
    while (taken.has(`${label} ${n}`)) n++
    return `${label} ${n}`
  }

  /** A placed device is selected, ready to be named. */
  const placeDevice = (device: Omit<Device, 'id' | 'name'>) => {
    const created = data.addDevice({ ...device, name: deviceName(device.kind) })
    setPlacing(undefined)
    select({ kind: 'device', id: created.id })
  }

  /** A device still under its numbered name is renamed for its new kind. */
  const changeDeviceKind = (device: Device, kind: DeviceKind) => {
    const numbered = new RegExp(`^${DEVICE_KINDS[device.kind].label} \\d+$`).test(device.name)
    data.patchDevice(device.id, { ...changeKind(device, kind, floor), ...(numbered ? { name: deviceName(kind) } : {}) })
  }

  /** Where new pieces appear: the middle of the biggest room's largest open area, else the floor's middle. */
  const dropPoint = (): Point => {
    const biggest = [...floorRegions(floor).values()].sort((a, b) => b.area - a.area)[0]
    const cell = biggest?.cells.reduce((p, c) =>
      (c.x1 - c.x0) * (c.y1 - c.y0) > (p.x1 - p.x0) * (p.y1 - p.y0) ? c : p,
    )
    if (cell) return [(cell.x0 + cell.x1) / 2, (cell.y0 + cell.y1) / 2]
    const { min, max } = floorBounds(floor)
    return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2]
  }

  const addPiece = (piece: NewPiece) => {
    const [x, y] = dropPoint()
    const [created] = data.addFurniture({
      ...piece,
      floor: floor.id,
      x,
      y,
      rotation: 0,
      // A box gets a wood tone; a model's colour is its fabric (blue-grey, as in the thumbnails).
      color: piece.model ? FURNITURE_SWATCHES[4] : FURNITURE_SWATCHES[1],
    })
    select({ kind: 'furniture', ids: [created.id] })
  }

  const switchFloor = (index: number) => {
    setFloorIndex(index)
    setOutside(false)
    setSelection(undefined)
    setHoveredRoom(undefined)
    if (measure) setMeasure({ ...measure, picks: [] })
  }

  /** The outside view is for looking only: no editing, and no walking. */
  const goOutside = () => {
    setOutside(true)
    setHoveredRoom(undefined)
    changeInteraction('view')
    if (camera === 'walk') setCamera('orbit')
  }

  /** Nothing stays selected across modes; measuring carries on. */
  const changeInteraction = (next: Interaction) => {
    setSelection(undefined)
    setPlacing(undefined)
    setInteraction(next)
    if (next === 'view') setRightTucked(false)
    if (next === 'devices') setRightOpen(true)
  }
  /** Measuring works in any mode; while it's on, taps measure instead of selecting. */
  const toggleMeasure = () => {
    setSelection(undefined)
    setPlacing(undefined)
    if (measure) stopMeasuring()
    else setMeasure({ mode: 'points', picks: [] })
  }
  const stopMeasuring = () => {
    setMeasure(undefined)
    setMeasurements([])
  }
  // The second tap finishes a measurement and the next tap starts another.
  const addMeasurePick = (pick: MeasurePick) => {
    if (!measure) return
    const line = measure.picks.length === 1 && measuredLine({ ...measure, picks: [measure.picks[0], pick] })
    if (!line) return setMeasure({ ...measure, picks: [pick] })
    setMeasurements((ms) => [...ms, { ...line, id: crypto.randomUUID(), floor: floor.id }])
    setMeasure({ ...measure, picks: [] })
  }

  // A stepped-back item may no longer exist, so nothing stays selected.
  const undo = () => {
    setSelection(undefined)
    data.undo()
  }
  const redo = () => {
    setSelection(undefined)
    data.redo()
  }

  // E toggles editing, M measuring, L devices; R / Shift+R rotate, Cmd+D duplicates and Delete removes the selected item; Esc steps back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Text fields keep their own undo.
      const typing = isTyping(e.target)
      const key = e.key.toLowerCase()
      if (!typing && !outside && (e.metaKey || e.ctrlKey) && (key === 'z' || key === 'y')) {
        e.preventDefault()
        if (key === 'y' || e.shiftKey) redo()
        else undo()
        return
      }
      if (!typing && !outside && selectedItems.length && (e.metaKey || e.ctrlKey) && key === 'd') {
        e.preventDefault()
        duplicateSelection()
        return
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || outside) return
      if (key === 'e') changeInteraction(interaction === 'view' ? 'edit' : 'view')
      else if (key === 'm') toggleMeasure()
      else if (key === 'l') changeInteraction(interaction === 'devices' ? 'edit' : 'devices')
      else if (selectedItems.length && key === 'r') rotateSelection(e.shiftKey ? -15 : 15)
      else if (selectedItems.length && (e.key === 'Delete' || e.key === 'Backspace')) deleteSelection()
      else if (selectedDevice && (e.key === 'Delete' || e.key === 'Backspace')) deleteDevice(selectedDevice)
      else if (e.key === 'Escape') {
        if (selection) setSelection(undefined)
        else if (placing) setPlacing(undefined)
        else if (measure?.picks.length) setMeasure({ ...measure, picks: [] })
        else if (measure) stopMeasuring()
        else if (interaction === 'devices') changeInteraction('edit')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const editing = interaction !== 'view'
  const rightOpen = editing && !rightTucked
  const closeRight = () => setRightOpen(false)
  const modeBar = !outside && (
    <ModeBar
      interaction={interaction}
      onChange={changeInteraction}
      onUndo={data.canUndo ? undo : undefined}
      onRedo={data.canRedo ? redo : undefined}
      onOpenPanel={editing && !rightOpen ? () => setRightOpen(true) : undefined}
    />
  )

  const inspector = (() => {
    if (selection?.kind === 'wall') {
      const wall = floor.walls.find((w) => w.id === selection.wallId)
      return (
        <WallPanel
          side={selection.side}
          details={wall ? wallText(wall, floor) : ''}
          color={wallPartColor(data.wallColors, selection.wallId, selection.side, selection.part)}
          onColor={(color) => data.setWallColor(selection.wallId, selection.side, selection.part, color)}
          onClose={() => setSelection(undefined)}
        />
      )
    }
    if (selectedRoom)
      return (
        <RoomPanel
          room={selectedRoom}
          region={regions.get(selectedRoom.id)}
          names={data.roomNames}
          onName={(name) => data.setRoomName(selectedRoom.id, name)}
          material={data.roomFloors.get(selectedRoom.id)}
          onMaterial={(material) => data.setRoomFloor(selectedRoom.id, material)}
          onClose={() => setSelection(undefined)}
        />
      )
    if (selectedItem)
      return (
        <FurnitureEditor
          item={selectedItem}
          onChange={(patch) => changeItem(selectedItem, patch, `${selectedItem.id}:${Object.keys(patch).join()}`)}
          onRotate={rotateSelection}
          onDelete={deleteSelection}
          onDuplicate={() => duplicateSelection()}
          floors={house.floors}
          onDuplicateToFloor={duplicateSelection}
          onClose={() => setSelection(undefined)}
        />
      )
    if (selectedItems.length > 1)
      return (
        <FurnitureGroupEditor
          items={selectedItems}
          onColor={(color) => data.patchFurnitures(new Map(selectedItems.map((f) => [f.id, { color }])))}
          onRotate={rotateSelection}
          onDelete={deleteSelection}
          onDuplicate={() => duplicateSelection()}
          floors={house.floors}
          onDuplicateToFloor={duplicateSelection}
          onPick={(id) => select({ kind: 'furniture', ids: [id] })}
          onRemove={(id) => select({ kind: 'furniture', ids: selectedItems.map((f) => f.id).filter((i) => i !== id) })}
          onClose={() => setSelection(undefined)}
        />
      )
    if (selectedDevice) {
      const room = deviceRoom(selectedDevice, floor, regions)
      const roomRecord = floor.rooms.find((r) => r.id === room)
      return (
        <DeviceEditor
          device={selectedDevice}
          room={roomRecord && roomLabel(roomRecord, data.roomNames).name}
          onChange={(patch) =>
            data.patchDevice(selectedDevice.id, patch, `${selectedDevice.id}:${Object.keys(patch).join()}`)
          }
          onKind={(kind) => changeDeviceKind(selectedDevice, kind)}
          onDelete={() => deleteDevice(selectedDevice)}
          onClose={() => setSelection(undefined)}
        />
      )
    }
    if (interaction === 'devices')
      return (
        <DevicePanel
          devices={floorDevices}
          placing={placing}
          onPlacing={(kind) => {
            setPlacing(kind)
            // On a phone the sheet covers the house; tuck it away so there's room to tap.
            if (kind && isNarrow()) setRightOpen(false)
          }}
          onSelect={(id) => select({ kind: 'device', id })}
          onClose={() => changeInteraction('edit')}
        />
      )
    if (interaction === 'edit')
      return (
        <FurniturePanel
          items={data.furniture.filter((f) => f.floor === floor.id)}
          snap={snap}
          onSnap={setSnap}
          onAdd={addPiece}
          onSelect={(id) => select({ kind: 'furniture', ids: [id] })}
        />
      )
    return undefined
  })()

  return (
    <div className="app" data-right={rightOpen ? 'open' : 'closed'}>
      <TopBar
        floors={house.floors}
        floorIndex={floorIndex}
        onFloor={switchFloor}
        outside={outside}
        onOutside={goOutside}
        onTodos={() => setTodosOpen(true)}
        openTodos={openTodos}
        account={account}
        versions={<VersionMenu data={data} />}
      />

      {todosOpen && <TodoPopup onClose={() => setTodosOpen(false)} />}

      <main className="viewport">
        <HouseScene
          floors={house.floors}
          floorIndex={outside ? house.floors.length - 1 : floorIndex}
          outside={outside}
          camera={camera}
          cutaway={cutaway}
          data={data}
          interaction={measure ? 'measure' : interaction}
          selection={selection}
          hoveredRoom={hoveredRoom}
          onHoverRoom={setHoveredRoom}
          snap={snap}
          sun={sunAt}
          north={site.north}
          roomNumbers={leftOpen}
          measure={measure}
          onMeasurePick={addMeasurePick}
          measurements={measurements}
          onRemoveMeasurement={(id) => setMeasurements((ms) => ms.filter((m) => m.id !== id))}
          placing={placing}
          onPlaceDevice={placeDevice}
          nudge={nudge}
          viewKey={viewKey}
          onSelect={select}
          itemActions={{
            onRotate: () => rotateSelection(15),
            onDuplicate: () => duplicateSelection(),
            onDelete: deleteSelection,
          }}
        />

        <ViewDock camera={camera} onCamera={setCamera} canWalk={!outside} cutaway={cutaway} onCutaway={setCutaway}>
          <DockBox label={outside ? 'Floors' : 'Rooms'} grow>
            {outside ? (
              <FloorList
                floors={house.floors}
                onPick={switchFloor}
                collapsed={!leftOpen}
                onToggle={() => setLeftOpen(!leftOpen)}
              />
            ) : (
              <RoomLegend
                floor={floor}
                regions={regions}
                names={data.roomNames}
                devices={devicesPerRoom(floorDevices, floor, regions)}
                hovered={hoveredRoom}
                selected={selection?.kind === 'room' ? selection.roomId : undefined}
                onHover={setHoveredRoom}
                onPick={interaction === 'edit' ? (roomId) => select({ kind: 'room', roomId }) : undefined}
                collapsed={!leftOpen}
                onToggle={() => setLeftOpen(!leftOpen)}
              />
            )}
          </DockBox>
        </ViewDock>

        {!rightOpen && modeBar}

        <div className="bottom-tools">
          {!outside && (
            <MeasurePanel
              mode={measure?.mode}
              canClear={measurements.length > 0 || !!measure?.picks.length}
              onToggle={toggleMeasure}
              onMode={(mode) => setMeasure({ mode, picks: [] })}
              onClear={() => {
                setMeasurements([])
                if (measure) setMeasure({ ...measure, picks: [] })
              }}
            />
          )}
          <SunPanel sun={sun} position={sunAt} onSun={setSun} />
        </div>

        <CameraPad
          mode={camera}
          onHold={(axis, value) => (nudge.current[axis] = value)}
          onRelease={(axis, value) => nudge.current[axis] === value && (nudge.current[axis] = 0)}
          onReset={() => setViewKey((k) => k + 1)}
        />

        {data.dirty && <SaveBar data={data} />}

        {data.loading && <div className="toast">Loading the house…</div>}
        {data.error && (
          <div className="toast" role="alert" onClick={data.clearError}>
            Couldn't save: {data.error} (tap to dismiss)
          </div>
        )}
      </main>

      <aside className="sidebar sidebar-right" aria-label="Details" inert={!rightOpen}>
        <div className="sheet-handle" onClick={closeRight} />
        {rightOpen && modeBar}
        <div className="sidebar-inner">
          {inspector}
        </div>
      </aside>
    </div>
  )
}
