import { TodoPopup } from './ui/TodoPopup'
import { WeatherPopup } from './ui/WeatherPopup'
import { useOpenTodoCount } from './ui/useOpenTodoCount'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AuthGate, type Account } from './auth/AuthGate'
import type { Backend, Device, DeviceKind, FurnitureItem, NewFurnitureItem } from './data/types'
import { useHouseData } from './data/useHouseData'
import { DEVICE_KINDS } from './devices/kinds'
import { changeKind, deviceRoom } from './devices/place'
import { rotateGroup } from './furniture/group'
import { duplicateOffset } from './furniture/duplicate'
import { pasteFurniture } from './furniture/clipboard'
import { floorSnapWalls, normalizeAngle, snapToWalls } from './furniture/snap'
import { floorRegions, roomAt } from './layout/rooms'
import { roomLabel } from './layout/roomName'
import type { Point } from './layout/types'
import { house } from './layout/layout'
import { HouseScene } from './scene/HouseScene'
import { FURNITURE_SWATCHES } from './scene/palette'
import { createCameraNudge } from './scene/cameraNudge'
import type { CameraMode, Interaction, Selection } from './scene/selection'
import { CameraPad } from './ui/CameraPad'
import { DeviceEditor } from './ui/DeviceEditor'
import { lightSettings, useLights } from './devices/lights'
import { LightPanel } from './ui/LightPanel'
import { daylight } from './scene/Lights'
import { DevicePanel } from './ui/DevicePanel'
import { FurnitureEditor } from './ui/FurnitureEditor'
import { FurnitureGroupEditor } from './ui/FurnitureGroupEditor'
import { FurniturePanel, type NewPiece } from './ui/FurniturePanel'
import { sunNow, type SunSettings } from './sun/useSun'
import { sunPosition, zonedTime } from './sun/sun'
import { wallText } from './measure/dimensions'
import { measuredLine, type MeasuredLine, type MeasurePick, type Measurement } from './measure/measure'
import { MeasurePanel } from './ui/MeasurePanel'
import { SunPanel } from './ui/SunPanel'
import { ViewDock } from './ui/ViewDock'
import { RoomPanel } from './ui/RoomPanel'
import { WallPanel } from './ui/WallPanel'
import { wallPartColor } from './data/types'
import { ModeBar } from './ui/ModeBar'
import { TopBar } from './ui/TopBar'
import { NavRail, type Section } from './ui/NavRail'
import { SaveButton } from './ui/SaveVersion'
import { SnapMenu } from './ui/SnapMenu'
import { VersionMenu } from './ui/VersionMenu'
import { isTyping } from './ui/isTyping'
import { roomViews } from './rooms/roomViews'
import { roomItems } from './rooms/roomItems'
import { RoomOverview } from './ui/RoomOverview'

export const App = () => <AuthGate>{(backend, account) => <House backend={backend} account={account} />}</AuthGate>

type HouseProps = { backend: Backend; account: Account }

// Phones start with both panels tucked away, leaving the screen to the house.
const NARROW = '(max-width: 820px)'
const isNarrow = () => window.matchMedia(NARROW).matches

const SECTION_KEY = 'casa.section'
const savedSection = (): Section => {
  try {
    return localStorage.getItem(SECTION_KEY) === 'home' ? 'home' : 'planning'
  } catch {
    return 'planning'
  }
}

const House = ({ backend, account }: HouseProps) => {
  const [section, setSection] = useState(savedSection)
  const planning = section === 'planning'
  const data = useHouseData(backend, !planning)
  const [floorIndex, setFloorIndex] = useState(0)
  // The app opens on the whole house.
  const [outside, setOutside] = useState(true)
  const [planCamera, setCamera] = useState<CameraMode>('orbit')
  // The plan is a planning tool; at home the house is seen in 3D or walked through.
  const camera = planning || planCamera !== 'top' ? planCamera : 'orbit'
  const [cutaway, setCutaway] = useState(true)
  // The tool in use while planning; at home the house is only looked at.
  const [tool, setTool] = useState<Exclude<Interaction, 'view' | 'measure'>>('edit')
  const interaction: Interaction = planning ? tool : 'view'
  const [selection, setSelection] = useState<Selection>()
  const [placing, setPlacing] = useState<DeviceKind>()
  // A new piece from the catalog, carried under the pointer until it's put down.
  const [placingPiece, setPlacingPiece] = useState<Omit<NewFurnitureItem, 'x' | 'y'>>()
  const [todosOpen, setTodosOpen] = useState(false)
  const [weatherOpen, setWeatherOpen] = useState(false)
  const openTodos = useOpenTodoCount()
  // The right panel is the editor: it's there while editing, and on a phone can be tucked away meanwhile.
  const [rightTucked, setRightTucked] = useState(false)
  const setRightOpen = (open: boolean) => setRightTucked(!open)
  const [wallSnap, setWallSnap] = useState(true)
  const [furnitureSnap, setFurnitureSnap] = useState(true)
  const nudge = useRef(createCameraNudge())
  const clipboard = useRef<NewFurnitureItem[]>([])
  const floorPointer = useRef<(() => Point | undefined) | undefined>(undefined)
  const [viewKey, setViewKey] = useState(0)
  const [measure, setMeasure] = useState<Measurement>()
  const [measurements, setMeasurements] = useState<MeasuredLine[]>([])
  // Sunlight follows the clock at home; planning starts with even light.
  const [sun, setSun] = useState<SunSettings | undefined>(() => (planning ? undefined : sunNow()))
  const { site } = house
  // At home the sun can't be moved; it keeps up with the clock.
  useEffect(() => {
    if (planning) return
    const timer = setInterval(() => setSun(sunNow()), 60 * 1000)
    return () => clearInterval(timer)
  }, [planning])
  const sunAt = sun
    ? sunPosition(zonedTime(sun.date, sun.minutes, site.timeZone), site.latitude, site.longitude)
    : undefined

  // A room on its own, from the menu: a fixed view of it with its smart items alongside.
  const [roomView, setRoomView] = useState<string>()
  const [popover, setPopover] = useState<string>()
  const [hoveredItem, setHoveredItem] = useState<string>()
  const pinRefs = useRef(new Map<string, HTMLElement | null>())
  const rooms = useMemo(() => roomViews(house, data.roomNames), [data.roomNames])
  const focus = rooms.find((r) => r.id === roomView)
  const lights = useLights()
  const focusFloor = focus && house.floors.find((f) => f.id === focus.floor)
  const focusItems = focusFloor ? roomItems(focusFloor, focus.room, data.devices, data.furniture) : []
  const dark = 1 - daylight(sunAt)

  const floor = house.floors[floorIndex]
  // From outside, furniture goes on the ground floor or round it in the garden.
  const furnitureFloor = outside ? house.floors[0] : floor
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
    const seated = wallSnap ? snapToWalls({ ...item, rotation }, floorSnapWalls(furnitureFloor)) : undefined
    const keepsTurn = seated && Math.abs(normalizeAngle(seated.rotation - rotation)) < 1e-6
    const turned = keepsTurn ? seated : { x: item.x, y: item.y, rotation }
    changeItem(item, turned)
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
    if (!selectedItems.length) return
    const turned = rotateGroup(selectedItems, (degrees * Math.PI) / 180)
    data.patchFurnitures(turned)
  }
  const deleteSelection = () => {
    data.removeFurniture(...selectedItems.map((f) => f.id))
    setSelection(undefined)
  }

  /** Copies land beside the originals, or at the same plan position on another floor. */
  const duplicateSelection = (targetFloorId = furnitureFloor.id) => {
    const targetIndex = house.floors.findIndex((f) => f.id === targetFloorId)
    if (!selectedItems.length || targetIndex < 0) return
    const sameFloor = targetFloorId === furnitureFloor.id
    const [dx, dy] = sameFloor ? duplicateOffset(selectedItems, floorSnapWalls(furnitureFloor)) : [0, 0]
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

  /** A piece picked from the catalog follows the pointer; the next tap on the house puts it down. */
  const addPiece = (piece: NewPiece) => {
    setSelection(undefined)
    setPlacingPiece({
      ...piece,
      floor: furnitureFloor.id,
      rotation: 0,
      // A box gets a wood tone; a model's colour is its fabric (blue-grey, as in the thumbnails).
      color: piece.model ? FURNITURE_SWATCHES[4] : FURNITURE_SWATCHES[1],
    })
    // On a phone the sheet covers the house; tuck it away so there's room to tap.
    if (isNarrow()) setRightOpen(false)
  }
  const placePiece = (at: Pick<FurnitureItem, 'x' | 'y' | 'rotation'>) => {
    if (!placingPiece) return
    const [created] = data.addFurniture({ ...placingPiece, ...at, floor: furnitureFloor.id })
    setPlacingPiece(undefined)
    select({ kind: 'furniture', ids: [created.id] })
  }

  // Leaving a room, the camera stays where the room left it, on the room's floor.
  const leaveRoom = () => {
    setRoomView(undefined)
    setPopover(undefined)
    setHoveredItem(undefined)
  }
  const openRoom = (id: string) => {
    const view = rooms.find((r) => r.id === id)
    const index = house.floors.findIndex((f) => f.id === view?.floor)
    if (!view || index < 0) return
    setFloorIndex(index)
    setOutside(false)
    setCamera('orbit')
    setSelection(undefined)
    setPopover(undefined)
    setRoomView(id)
  }

  const switchFloor = (index: number) => {
    leaveRoom()
    // The camera keeps where it is; only Reset view (a new view key) starts it afresh.
    setFloorIndex(index)
    setOutside(false)
    setSelection(undefined)
    if (measure) setMeasure({ ...measure, picks: [] })
  }

  const goOutside = () => {
    leaveRoom()
    setOutside(true)
  }

  /** Planning is editing, in a room or not; home is for looking: editing and measuring stop, and the sun follows the clock. */
  const changeSection = (next: Section) => {
    if (next === section) return
    setSelection(undefined)
    setPlacing(undefined)
    setPlacingPiece(undefined)
    if (next === 'home') {
      stopMeasuring()
      setRightTucked(false)
    } else setTool('edit')
    setSun(next === 'home' ? sunNow() : undefined)
    setSection(next)
    try {
      localStorage.setItem(SECTION_KEY, next)
    } catch {
      // Private windows may refuse storage; the section just isn't remembered.
    }
  }

  /** Nothing stays selected across tools; measuring carries on. */
  const changeInteraction = (next: Interaction) => {
    if (next === 'view' || next === 'measure') return changeSection('home')
    if (!planning) changeSection('planning')
    setSelection(undefined)
    setPlacing(undefined)
    setPlacingPiece(undefined)
    setTool(next)
    if (next === 'devices') setRightOpen(true)
  }
  /** Measuring works in any mode; while it's on, taps measure instead of selecting. */
  const toggleMeasure = () => {
    setSelection(undefined)
    setPlacing(undefined)
    setPlacingPiece(undefined)
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

  // Outside and at home, the house is only looked at.
  const locked = !planning
  // E toggles planning, M measuring, L devices; R / Shift+R rotate, Cmd+D duplicates and Delete removes the selected item; Esc steps back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Text fields keep their own undo.
      const typing = isTyping(e.target)
      const key = e.key.toLowerCase()
      if (!typing && !locked && interaction === 'edit' && !measure && (e.metaKey || e.ctrlKey)) {
        if (key === 'c' && selectedItems.length) {
          e.preventDefault()
          clipboard.current = selectedItems.map(({ id: _, ...item }) => ({ ...item }))
          return
        }
        if (key === 'v' && clipboard.current.length) {
          e.preventDefault()
          const at = floorPointer.current?.()
          if (!at) return
          const created = data.addFurniture(...pasteFurniture(clipboard.current, furnitureFloor.id, at))
          select({ kind: 'furniture', ids: created.map((f) => f.id) })
          return
        }
      }
      if (!typing && !locked && (e.metaKey || e.ctrlKey) && (key === 'z' || key === 'y')) {
        e.preventDefault()
        if (key === 'y' || e.shiftKey) redo()
        else undo()
        return
      }
      if (!typing && !locked && selectedItems.length && (e.metaKey || e.ctrlKey) && key === 'd') {
        e.preventDefault()
        duplicateSelection()
        return
      }
      // Esc first steps back out of what's being done in the room, then out of the room.
      if (focus && e.key === 'Escape' && !typing && !selection && !placing && !placingPiece && !measure)
        return popover ? setPopover(undefined) : leaveRoom()
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (key === 'e') return changeSection(planning ? 'home' : 'planning')
      if (locked) return
      if (key === 'm') toggleMeasure()
      else if (key === 'l') changeInteraction(interaction === 'devices' ? 'edit' : 'devices')
      else if (placingPiece && key === 'r')
        setPlacingPiece({
          ...placingPiece,
          rotation: normalizeAngle(placingPiece.rotation + ((e.shiftKey ? -15 : 15) * Math.PI) / 180),
        })
      else if (selectedItems.length && key === 'r') rotateSelection(e.shiftKey ? -15 : 15)
      else if (selectedItems.length && (e.key === 'Delete' || e.key === 'Backspace')) deleteSelection()
      else if (selectedDevice && (e.key === 'Delete' || e.key === 'Backspace')) deleteDevice(selectedDevice)
      else if (e.key === 'Escape') {
        if (selection) setSelection(undefined)
        else if (placingPiece) setPlacingPiece(undefined)
        else if (placing) setPlacing(undefined)
        else if (measure?.picks.length) setMeasure({ ...measure, picks: [] })
        else if (measure) stopMeasuring()
        else if (interaction === 'devices') changeInteraction('edit')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const editing = planning
  // While looking round, it opens only for a picked light (in a room, its card does that).
  const rightOpen = (editing || (selection?.kind === 'light' && !focus)) && !rightTucked
  const closeRight = () => setRightOpen(false)
  const modeBar = (
    <ModeBar
      planning={planning}
      onPlanning={(on) => changeSection(on ? 'planning' : 'home')}
      onUndo={data.canUndo ? undo : undefined}
      onRedo={data.canRedo ? redo : undefined}
      save={<SaveButton data={data} />}
      onOpenPanel={editing && !rightOpen ? () => setRightOpen(true) : undefined}
    />
  )

  const inspector = (() => {
    if (selection?.kind === 'light') {
      const device = data.devices.find((d) => d.id === selection.id)
      const lamp = data.furniture.find((f) => f.id === selection.id)
      const home = house.floors.find((f) => f.id === (device ?? lamp)?.floor)
      if (!home || !(device || lamp)) return undefined
      const regions = floorRegions(home)
      const roomId = device ? deviceRoom(device, home, regions) : roomAt(regions, lamp!.x, lamp!.y)
      const room = home.rooms.find((r) => r.id === roomId)
      return (
        <LightPanel
          kind={device ? 'Ceiling light' : 'Lamp'}
          name={device?.name ?? lamp!.name}
          room={room && roomLabel(room, data.roomNames).name}
          entity={device?.entity}
          light={lightSettings(lights.states[selection.id], dark)}
          onChange={(patch) => lights.set(selection.id, patch, dark)}
          onClose={() => setSelection(undefined)}
        />
      )
    }
    if (selection?.kind === 'wall') {
      // From outside, the wall can be on any floor.
      const home = house.floors.find((f) => f.walls.some((w) => w.id === selection.wallId)) ?? floor
      const wall = home.walls.find((w) => w.id === selection.wallId)
      return (
        <WallPanel
          side={selection.side}
          details={wall ? wallText(wall, home) : ''}
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
          light={lightSettings(lights.states[selectedDevice.id], dark)}
          onLight={(patch) => lights.set(selectedDevice.id, patch, dark)}
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
          onTool={changeInteraction}
        />
      )
    if (interaction === 'edit') return <FurniturePanel onTool={changeInteraction} onAdd={addPiece} />
    return undefined
  })()

  return (
    <div className="app" data-right={rightOpen ? 'open' : 'closed'}>
      <NavRail onHome={leaveRoom} rooms={rooms} room={roomView} onRoom={openRoom} />
      <TopBar
        floors={house.floors}
        floorIndex={floorIndex}
        onFloor={switchFloor}
        outside={outside}
        onOutside={goOutside}
        versions={planning && <VersionMenu data={data} />}
        onWeather={() => setWeatherOpen(true)}
        onTodos={() => setTodosOpen(true)}
        openTodos={openTodos}
        account={account}
      />

      {todosOpen && <TodoPopup onClose={() => setTodosOpen(false)} />}
      {weatherOpen && <WeatherPopup onClose={() => setWeatherOpen(false)} />}

      <main className="viewport">
        <HouseScene
          floorPointer={floorPointer}
          floors={house.floors}
          floorIndex={outside ? house.floors.length - 1 : floorIndex}
          onWalkFloorChange={setFloorIndex}
          outside={outside}
          camera={camera}
          cutaway={cutaway}
          data={data}
          interaction={measure ? 'measure' : interaction}
          selection={selection}
          wallSnap={wallSnap}
          furnitureSnap={furnitureSnap}
          sun={sunAt}
          north={site.north}
          measure={measure}
          onMeasurePick={addMeasurePick}
          measurements={measurements}
          onRemoveMeasurement={(id) => setMeasurements((ms) => ms.filter((m) => m.id !== id))}
          placing={placing}
          placingPiece={placingPiece}
          onPlacePiece={placePiece}
          lights={lights.states}
          onPickLight={(id) => (focus ? setPopover(id) : select({ kind: 'light', id }))}
          onPlaceDevice={placeDevice}
          nudge={nudge}
          viewKey={viewKey}
          onSelect={select}
          itemActions={{
            onRotate: () => rotateSelection(15),
            onDuplicate: () => duplicateSelection(),
            onDelete: deleteSelection,
          }}
          focusRoom={focus?.room}
          pins={[...focusItems.filter((i) => i.id === popover).map((i) => ({ key: i.id, at: i.at }))]}
          pinRefs={pinRefs}
          highlight={hoveredItem ?? popover}
          onHoverItem={focus ? setHoveredItem : undefined}
        />

        {/* While planning, the editor takes the room's place on the right. */}
        {focus && focusFloor && !rightOpen && (
          <RoomOverview
            title={focus.label}
            area={floorRegions(focusFloor).get(focus.room)?.area}
            items={focusItems}
            light={(id) => lightSettings(lights.states[id], dark)}
            onLight={(id, patch) => lights.set(id, patch, dark)}
            open={popover}
            onOpen={setPopover}
            onHover={setHoveredItem}
            onClose={leaveRoom}
            pinRefs={pinRefs}
          />
        )}

        {!focus && (
          <ViewDock
            camera={camera}
            onCamera={setCamera}
            canPlan={planning}
            canCut={!outside}
            cutaway={cutaway}
            onCutaway={setCutaway}
          />
        )}

        {modeBar}

        <div className="bottom-tools">
          {!locked && (
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
          {planning && (
            <SnapMenu
              wallSnap={wallSnap}
              onWallSnap={setWallSnap}
              furnitureSnap={furnitureSnap}
              onFurnitureSnap={setFurnitureSnap}
            />
          )}
          {planning && <SunPanel sun={sun} position={sunAt} onSun={setSun} />}
        </div>

        {!focus && (
          <CameraPad
            mode={camera}
            onHold={(axis, value) => (nudge.current[axis] = value)}
            onRelease={(axis, value) => nudge.current[axis] === value && (nudge.current[axis] = 0)}
            onReset={() => setViewKey((k) => k + 1)}
          />
        )}

        {data.loading && <div className="toast">Loading the house…</div>}
        {data.error && (
          <div className="toast" role="alert" onClick={data.clearError}>
            Couldn't save: {data.error} (tap to dismiss)
          </div>
        )}
      </main>

      <aside className="sidebar sidebar-right" aria-label="Details" inert={!rightOpen}>
        <div className="sheet-handle" onClick={closeRight} />
        <div className="sidebar-inner">{inspector}</div>
      </aside>
    </div>
  )
}
