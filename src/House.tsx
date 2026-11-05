import { Cable, Lightbulb, Paintbrush, Sofa, SquareBottomDashedScissors } from 'lucide-react'
import { IconButton, Section, Segmented, Slide } from './ui/kit'
import { TodoPopup } from './ui/TodoPopup'
import { WeatherPopup } from './ui/WeatherPopup'
import { useOpenTodoCount } from './ui/useOpenTodoCount'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Account } from './auth/AuthGate'
import type { Backend, Device, DeviceKind, FurnitureItem, NewFurnitureItem } from './data/types'
import { useHouseData } from './data/useHouseData'
import { DEVICE_KINDS, type DevicePlacement } from './devices/kinds'
import { deviceRoom } from './devices/place'
import { rotateGroup } from './furniture/group'
import { duplicateOffset } from './furniture/duplicate'
import { pasteFurniture } from './furniture/clipboard'
import { floorSnapWalls, normalizeAngle, snapToWalls } from './furniture/snap'
import { floorRegions } from './layout/rooms'
import { roomLabel } from './layout/roomName'
import type { Point } from './layout/types'
import { house } from './layout/layout'
import { HouseScene } from './scene/HouseScene'
import type { WalkPlacement } from './scene/WalkPlacement'
import type { WalkStart } from './walk/start'
import { DEFAULT_WALL, FURNITURE_SWATCHES, WALL_CAP } from './scene/palette'
import { createCameraNudge } from './scene/cameraNudge'
import type { CameraMode, EditMode, Interaction, Selection } from './scene/selection'
import { CameraPad } from './ui/CameraPad'
import { DeviceEditor } from './ui/DeviceEditor'
import { DevicePanel } from './ui/DevicePanel'
import { lightSettings, useLights } from './devices/lights'
import { type Scene, useScenes } from './devices/scenes'
import { LightControls } from './ui/LightControls'
import { daylight } from './scene/Lights'
import { FurnitureEditor } from './ui/FurnitureEditor'
import { FurnitureGroupEditor } from './ui/FurnitureGroupEditor'
import { FurniturePanel, type NewPiece } from './ui/FurniturePanel'
import { sunNow, type SunSettings } from './sun/useSun'
import { sunPosition, zonedTime } from './sun/sun'
import { measuredLine, type MeasuredLine, type MeasurePick, type Measurement } from './measure/measure'
import { MeasurePanel } from './ui/MeasurePanel'
import { SunPanel } from './ui/SunPanel'
import { ordinal } from './ui/ordinal'
import { ViewDock } from './ui/ViewDock'
import { PaintPanel } from './ui/PaintPanel'
import type { Brush, PaintFace, PaintStroke } from './scene/FloorWalls'
import { wallPartColor } from './data/types'
import { ModeBar } from './ui/ModeBar'
import { TopBar } from './ui/TopBar'
import { SaveButton } from './ui/SaveVersion'
import { SnapMenu } from './ui/SnapMenu'
import { VersionMenu } from './ui/VersionMenu'
import { isTyping } from './ui/isTyping'
import { roomViews } from './rooms/roomViews'
import { floorItems, outsideLight, roomItems } from './rooms/roomItems'
import { floorShades, SHADE_UP, useShades } from './devices/shades'
import { RoomNav } from './ui/RoomNav'
import { useRoomOrder } from './rooms/useRoomOrder'
import { ItemPins } from './ui/ItemPins'
import { FloorOverview } from './ui/FloorOverview'
import { RoomOverview } from './ui/RoomOverview'
import { SceneEditor } from './ui/SceneEditor'
import { ElectricalPanel } from './ui/ElectricalPanel'

type HouseProps = { backend: Backend; account: Account }

// Phones start with both panels tucked away, leaving the screen to the house.
const NARROW = '(max-width: 820px)'
const isNarrow = () => window.matchMedia(NARROW).matches

const EDIT_PARAM = 'edit'
/** Home is for living in the house; Edit is the editor, `?edit` in the URL. */
type Section = 'home' | 'edit'

const savedSection = (): Section => (new URLSearchParams(window.location.search).has(EDIT_PARAM) ? 'edit' : 'home')

const saveSection = (section: Section) => {
  const url = new URL(window.location.href)
  if (section === 'edit') url.searchParams.set(EDIT_PARAM, '')
  else url.searchParams.delete(EDIT_PARAM)
  window.history.replaceState(window.history.state, '', url.toString().replace(`${EDIT_PARAM}=`, EDIT_PARAM))
}

export const House = ({ backend, account }: HouseProps) => {
  const [section, setSection] = useState(savedSection)
  const editing = section === 'edit'
  const data = useHouseData(backend, !editing)
  const [floorIndex, setFloorIndex] = useState(0)
  // The app opens on the whole house.
  const [outside, setOutside] = useState(true)
  const [planCamera, setCamera] = useState<CameraMode>('orbit')
  // The plan is an editing tool; at home the house is seen in 3D or walked through.
  const camera = editing || planCamera !== 'top' ? planCamera : 'orbit'
  const [cutaway, setCutaway] = useState(true)
  const [electrical, setElectrical] = useState(false)
  // The tool in use while editing; at home the house is only looked at.
  const [tool, setTool] = useState<Exclude<Interaction, 'view' | 'measure'>>('edit')
  const interaction: Interaction = editing ? tool : 'view'
  const [editMode, setEditMode] = useState<EditMode>('interior')
  const [brush, setBrush] = useState<Brush>({ color: '#7f9172', erase: false, size: 0.1 })
  const [selection, setSelection] = useState<Selection>()
  const [placing, setPlacing] = useState<DevicePlacement>()
  // A new piece from the catalog, carried under the pointer until it's put down.
  const [placingPiece, setPlacingPiece] = useState<Omit<NewFurnitureItem, 'x' | 'y'>>()
  const [todosOpen, setTodosOpen] = useState(false)
  const [weatherOpen, setWeatherOpen] = useState(false)
  const openTodos = useOpenTodoCount()
  const roomOrder = useRoomOrder(backend)
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
  // Sunlight follows the clock at home; Edit starts with even light.
  const [sun, setSun] = useState<SunSettings | undefined>(() => (editing ? undefined : sunNow()))
  const { site } = house
  // At home the sun can't be moved; it keeps up with the clock.
  useEffect(() => {
    if (editing) return
    const timer = setInterval(() => setSun(sunNow()), 60 * 1000)
    return () => clearInterval(timer)
  }, [editing])
  const sunAt = sun
    ? sunPosition(zonedTime(sun.date, sun.minutes, site.timeZone), site.latitude, site.longitude)
    : undefined

  // A room on its own, from the menu: a fixed view of it with its smart items alongside.
  const [roomView, setRoomView] = useState<string>()
  const [popover, setPopover] = useState<string>()
  const [walkCaptured, setWalkCaptured] = useState(false)
  const walkPlacement: WalkPlacement = useRef(undefined)
  const [walkStart, setWalkStart] = useState<WalkStart>()
  const walkOrigin = useRef<{ camera: CameraMode; outside: boolean; floor: number; rightTucked: boolean } | undefined>(
    undefined,
  )
  // Opening an item borrows its room's view; closing it returns to where it was opened.
  const [itemOrigin, setItemOrigin] = useState<{
    room: string | undefined
    floor: number
    outside: boolean
    camera: CameraMode
  }>()
  const [hoveredItem, setHoveredItem] = useState<string>()
  const pinRefs = useRef(new Map<string, HTMLElement | null>())
  const rooms = useMemo(() => roomViews(house, data.roomNames), [data.roomNames])
  const focus = rooms.find((r) => r.id === roomView)
  const lights = useLights()
  const shades = useShades()
  const scenes = useScenes()
  // The scene being put together: `scene` is empty for a new one.
  const [sceneEdit, setSceneEdit] = useState<{ scene?: Scene }>()
  const focusFloor = focus && house.floors.find((f) => f.id === focus.floor)
  const focusItems = focusFloor ? roomItems(focusFloor, focus.room, data.devices, data.furniture) : []
  const dark = 1 - daylight(sunAt)
  // Each room with lights, and whether any is on.
  const roomLights = new Map<string, boolean>()
  for (const f of house.floors)
    for (const i of floorItems(f, data.devices, data.furniture))
      if (i.kind === 'light' && i.room)
        roomLights.set(i.room, roomLights.get(i.room) || lightSettings(lights.states[i.id], dark).on)

  const floor = house.floors[floorIndex]
  // From outside, furniture goes on the ground floor or round it in the garden.
  const furnitureFloor = outside ? house.floors[0] : floor
  const selectedItems =
    selection?.kind === 'furniture' ? data.furniture.filter((f) => selection.ids.includes(f.id)) : []
  const selectedItem = selectedItems.length === 1 ? selectedItems[0] : undefined
  const selectedDevice = selection?.kind === 'device' ? data.devices.find((d) => d.id === selection.id) : undefined

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
    if (device.plan) return
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

  /** A piece picked from the catalog follows the pointer; the next tap on the house puts it down. */
  const addPiece = (piece: NewPiece) => {
    setSelection(undefined)
    setPlacing(undefined)
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

  // An explicit room leaves its camera in place; a temporary item view returns to its starting view.
  const leaveRoom = () => {
    if (itemOrigin && !itemOrigin.room) {
      setFloorIndex(itemOrigin.floor)
      setOutside(itemOrigin.outside)
      setCamera(itemOrigin.camera)
    }
    setItemOrigin(undefined)
    setRoomView(undefined)
    setPopover(undefined)
    setHoveredItem(undefined)
  }
  const openRoom = (id: string, item?: string) => {
    const view = rooms.find((r) => r.id === id)
    const index = house.floors.findIndex((f) => f.id === view?.floor)
    if (!view || index < 0) return
    setItemOrigin(item ? (itemOrigin ?? { room: roomView, floor: floorIndex, outside, camera: planCamera }) : undefined)
    setFloorIndex(index)
    setOutside(false)
    setCamera('orbit')
    setSelection(undefined)
    setPopover(item)
    setRoomView(id)
  }
  const openPopover = (id: string | undefined) => {
    setPopover(id)
    if (id || !itemOrigin) return
    setRoomView(itemOrigin.room)
    setFloorIndex(itemOrigin.floor)
    setOutside(itemOrigin.outside)
    setCamera(itemOrigin.camera)
    setHoveredItem(undefined)
    setItemOrigin(undefined)
  }

  /** Every light opens the same card and close-up, borrowing a room only when it has one. */
  const openItem = (id: string | undefined) => {
    if (!id || focus) return openPopover(id)
    for (const f of house.floors) {
      const item = floorItems(f, data.devices, data.furniture).find((i) => i.id === id)
      if (!item) continue
      if (item.room) return openRoom(item.room, id)
      setItemOrigin(itemOrigin ?? { room: roomView, floor: floorIndex, outside, camera: planCamera })
      setFloorIndex(house.floors.indexOf(f))
      setOutside(true)
      setCamera('orbit')
      setSelection(undefined)
      setPopover(id)
      return
    }
  }

  /** A tapped shade borrows its room's view while its controls are open. */
  const pickShade = (id: string) => {
    const room = house.floors.flatMap((f) => floorShades(f, floorRegions(f))).find((s) => s.id === id)?.room
    if (!room) return
    openRoom(room, id)
  }

  const switchFloor = (index: number) => {
    leaveRoom()
    // The camera keeps where it is; only Reset view (a new view key) starts it afresh.
    setFloorIndex(index)
    setOutside(false)
    setSelection(undefined)
    if (measure) setMeasure({ ...measure, picks: [] })
  }

  const startWalk = (start = walkPlacement.current?.start()) => {
    walkPlacement.current?.clear()
    if (!start) return
    walkOrigin.current = { camera, outside, floor: floorIndex, rightTucked }
    setWalkStart(start)
    setFloorIndex(start.floorIndex)
    setOutside(!!start.outside)
    setCamera('walk')
    setRightTucked(true)
    setSelection(undefined)
    setPlacing(undefined)
    setPlacingPiece(undefined)
    setTool('edit')
    stopMeasuring()
    nudge.current = createCameraNudge()
  }
  const exitWalk = () => {
    const origin = walkOrigin.current
    setCamera(origin?.camera ?? 'orbit')
    if (origin) {
      setOutside(origin.outside)
      setFloorIndex(origin.floor)
      setRightTucked(origin.rightTucked)
    }
    setWalkStart(undefined)
    nudge.current = createCameraNudge()
    walkOrigin.current = undefined
  }

  const goOutside = () => {
    leaveRoom()
    setOutside(true)
  }

  /** Edit works in a room or not; home is for looking: editing and measuring stop, and the sun follows the clock. */
  const changeSection = (next: Section) => {
    if (next === section) return
    // Leaving Edit drops unsaved edits, so it asks first, as leaving the page does.
    if (next === 'home') {
      if (data.dirty && !confirm('Leave Edit? Your unsaved changes will be lost.')) return
      data.discardDraft()
    }
    if (popover) openPopover(undefined)
    setSelection(undefined)
    setPlacing(undefined)
    setPlacingPiece(undefined)
    setSceneEdit(undefined)
    if (next === 'home') {
      stopMeasuring()
      setRightTucked(false)
    } else setTool('edit')
    setSun(next === 'home' ? sunNow() : undefined)
    setSection(next)
    saveSection(next)
  }

  /** Each mode opens on its own panel, whatever was on the way there. */
  const changeEditMode = (next: EditMode) => {
    setSelection(undefined)
    setPlacing(undefined)
    setPlacingPiece(undefined)
    setSceneEdit(undefined)
    setElectrical(false)
    setTool('edit')
    setEditMode(next)
    setRightOpen(true)
  }

  /** Measuring works in any mode; while it's on, taps measure instead of selecting. */
  const toggleMeasure = () => {
    setTool('edit')
    setSelection(undefined)
    setPlacing(undefined)
    setPlacingPiece(undefined)
    if (measure) stopMeasuring()
    else setMeasure({ mode: 'points', picks: [] })
  }
  /** While painting, taps and drags on walls paint them instead of selecting. */
  const togglePaint = () => {
    setSelection(undefined)
    setSceneEdit(undefined)
    setPlacing(undefined)
    setPlacingPiece(undefined)
    if (measure) stopMeasuring()
    setTool(tool === 'paint' ? 'edit' : 'paint')
    setRightOpen(true)
  }
  // Paint in the wall's own colour is no paint: it just covers what was there.
  const paint = (stroke: PaintStroke) => {
    const base =
      wallPartColor(data.wallColors, stroke.wallId, stroke.side, stroke.part) ??
      (stroke.side === 'a' || stroke.side === 'b' ? DEFAULT_WALL : WALL_CAP)
    data.paintArea(stroke, brush.erase || brush.color.toLowerCase() === base.toLowerCase() ? undefined : brush.color)
  }
  const paintWall = ({ wallId, side, part }: PaintFace) =>
    data.paintWall(wallId, side, part, brush.erase ? undefined : brush.color)
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
  const locked = !editing
  // E toggles Edit, M measuring, L devices; R / Shift+R rotate, Cmd+D duplicates and Delete removes the selected item; Esc steps back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Text fields keep their own undo.
      const typing = isTyping(e.target)
      const key = e.key.toLowerCase()
      if (
        !typing &&
        !locked &&
        interaction === 'edit' &&
        editMode === 'interior' &&
        !measure &&
        (e.metaKey || e.ctrlKey)
      ) {
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
      if (sceneEdit && e.key === 'Escape' && !typing) return setSceneEdit(undefined)
      if (
        focus &&
        e.key === 'Escape' &&
        !typing &&
        !selection &&
        !placing &&
        !placingPiece &&
        !measure &&
        interaction !== 'paint'
      )
        return popover ? openPopover(undefined) : leaveRoom()
      if (popover && !focus && e.key === 'Escape' && !typing) return openPopover(undefined)
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (key === 'e') return changeSection(editing ? 'home' : 'edit')
      if (locked) return
      if (key === 'm') toggleMeasure()
      else if (key === 'l') changeEditMode(editMode === 'devices' ? 'interior' : 'devices')
      else if (key === 'p') togglePaint()
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
        else if (interaction === 'paint') setTool('edit')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // While looking round, it opens only for a picked light (in a room, its card does that).
  const rightOpen = (editing || (selection?.kind === 'light' && !focus)) && !rightTucked
  // From outside, the lights out there; on a floor, what's on it, and those lights all the same.
  const floorTags =
    !focus && !editing && !rightOpen && camera !== 'walk'
      ? house.floors.flatMap((f) =>
          floorItems(f, data.devices, data.furniture).filter((item) => outsideLight(item) || (!outside && f === floor)),
        )
      : []
  const closeRight = () => setRightOpen(false)
  const modeBar = (
    <ModeBar
      editing={editing}
      onEditing={(on) => changeSection(on ? 'edit' : 'home')}
      onUndo={data.canUndo ? undo : undefined}
      onRedo={data.canRedo ? redo : undefined}
      save={<SaveButton data={data} />}
      onOpenPanel={editing && !rightOpen ? () => setRightOpen(true) : undefined}
      tools={
        <>
          <Slide show={editing}>
            <SunPanel sun={sun} position={sunAt} onSun={setSun} />
          </Slide>
          <Slide show={!locked}>
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
          </Slide>
          <Slide show={editing}>
            <div className="toolbar float">
              <IconButton label="Paint walls (P)" aria-pressed={tool === 'paint'} small onClick={togglePaint}>
                <Paintbrush size={17} />
              </IconButton>
            </div>
          </Slide>
          <Slide show={editing}>
            <div className="toolbar float">
              <IconButton
                label="Electrical plan"
                aria-pressed={electrical}
                small
                onClick={() => {
                  setElectrical(!electrical)
                  setSelection(undefined)
                  setSceneEdit(undefined)
                  setRightOpen(true)
                }}
              >
                <Cable size={17} />
              </IconButton>
            </div>
          </Slide>
          <Slide show={editing}>
            <SnapMenu
              wallSnap={wallSnap}
              onWallSnap={setWallSnap}
              furnitureSnap={furnitureSnap}
              onFurnitureSnap={setFurnitureSnap}
            />
          </Slide>
          {/* Walls in front cut down in the 3D view, to see in; not yet from outside. */}
          <Slide show={camera === 'orbit' && !outside}>
            <div className="toolbar float">
              <IconButton
                label="Cut walls"
                aria-pressed={cutaway}
                small
                disabled={!!focus}
                onClick={() => setCutaway(!cutaway)}
              >
                <SquareBottomDashedScissors size={17} />
              </IconButton>
            </div>
          </Slide>
        </>
      }
    />
  )

  const inspector = (() => {
    if (sceneEdit)
      return (
        <SceneEditor
          key={sceneEdit.scene?.id ?? 'new'}
          scene={sceneEdit.scene}
          floors={house.floors
            .map((f, i) => ({ f, name: `${ordinal(i + 1)} floor` }))
            .sort((a, b) => Number(b.f === (focusFloor ?? floor)) - Number(a.f === (focusFloor ?? floor)))
            .map(({ f, name }) => ({ name, items: floorItems(f, data.devices, data.furniture) }))}
          roomName={(item) => rooms.find((r) => r.room === item.room)?.label}
          room={focus?.room}
          light={(id) => lightSettings(lights.states[id], dark)}
          shade={(id) => shades.states[id] ?? SHADE_UP}
          onClose={() => setSceneEdit(undefined)}
        />
      )
    if (selection?.kind === 'light') {
      return (
        <LightControls
          light={lightSettings(lights.states[selection.id], dark)}
          onChange={(patch) => lights.set(selection.id, patch, dark)}
        />
      )
    }
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
      const deviceFloor = house.floors.find((f) => f.id === selectedDevice.floor)!
      const room = deviceRoom(selectedDevice, deviceFloor, floorRegions(deviceFloor))
      const roomRecord = deviceFloor.rooms.find((r) => r.id === room)
      return (
        <DeviceEditor
          device={selectedDevice}
          room={roomRecord && roomLabel(roomRecord, data.roomNames).name}
          onChange={(patch) =>
            selectedDevice.plan
              ? patch.name && data.renameDevice(selectedDevice.id, patch.name)
              : data.patchDevice(selectedDevice.id, patch, `${selectedDevice.id}:${Object.keys(patch).join()}`)
          }
          light={lightSettings(lights.states[selectedDevice.id], dark)}
          onLight={(patch) => lights.set(selectedDevice.id, patch, dark)}
          onDelete={() => deleteDevice(selectedDevice)}
          onClose={() => setSelection(undefined)}
        />
      )
    }
    if (interaction === 'paint') return <PaintPanel brush={brush} onBrush={setBrush} onClose={togglePaint} />
    if (editing && electrical)
      return (
        <ElectricalPanel
          floor={floor}
          devices={data.devices}
          outside={outside}
          roomNames={data.roomNames}
          onSelect={(id) => select({ kind: 'device', id })}
          onClose={() => setElectrical(false)}
        />
      )
    if (interaction === 'edit' && editMode === 'interior') return <FurniturePanel onAdd={addPiece} />
    if (interaction === 'edit')
      return (
        <DevicePanel
          placing={placing}
          onPlacing={(kind) => {
            setSelection(undefined)
            setPlacingPiece(undefined)
            setPlacing(kind)
            // Lights hang from a floor's ceiling, so it's placed from inside.
            if (kind && kind !== 'wall-light' && outside) setOutside(false)
            // On a phone the sheet covers the house; tuck it away so there's room to tap.
            if (kind && isNarrow()) setRightOpen(false)
          }}
          rooms={rooms.flatMap((view) => {
            const viewFloor = house.floors.find((f) => f.id === view.floor)!
            const ids = roomItems(viewFloor, view.room, data.devices, data.furniture)
              .filter((i) => i.kind === 'light')
              .map((i) => i.id)
            return ids.length ? [{ id: view.id, name: view.label, scenes: scenes.of(view.room, ids) }] : []
          })}
          onEditScene={(scene) => {
            setPlacing(undefined)
            setSceneEdit({ scene })
          }}
        />
      )
    return undefined
  })()

  return (
    <div className="app" data-right={rightOpen ? 'open' : 'closed'}>
      <TopBar
        // Already home, the name puts the camera back where it started.
        onHome={focus || popover ? leaveRoom : () => setViewKey((k) => k + 1)}
        inRoom={!!focus || !!popover}
        versions={editing && <VersionMenu data={data} />}
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
          walkPlacement={walkPlacement}
          walkStart={walkStart}
          walkFloorIndex={floorIndex}
          walkCursorNeed={rightOpen || !!popover || !!measure || interaction === 'paint'}
          onWalkCaptured={setWalkCaptured}
          outside={outside}
          camera={camera}
          cutaway={cutaway}
          electrical={editing && electrical}
          data={data}
          interaction={measure ? 'measure' : interaction}
          // Nothing's moved while a scene is put together.
          editMode={sceneEdit ? undefined : editMode}
          brush={brush}
          onPaint={paint}
          onPaintWall={paintWall}
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
          onPickLight={openItem}
          shades={shades.states}
          onPickShade={pickShade}
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
          temporaryFocus={!!itemOrigin && !itemOrigin.room}
          pins={[
            ...(focus ? focusItems : floorTags).map((i) => ({
              key: `tag:${i.id}`,
              at: i.at,
              facing: i.facing,
              look: i.look,
              mount: i.mount,
            })),
            ...focusItems.flatMap((i) => (i.beside ? [{ key: `beside:${i.id}`, at: i.beside }] : [])),
          ]}
          pinRefs={pinRefs}
          open={popover}
          hovered={hoveredItem}
          onHoverItem={setHoveredItem}
        />

        {/* While editing, the editor takes the room's place on the right. */}
        {focus && focusFloor && !rightOpen && (
          <RoomOverview
            title={focus.label}
            items={focusItems}
            light={(id) => lightSettings(lights.states[id], dark)}
            onLight={(id, patch) => lights.set(id, patch, dark)}
            shade={(id) => shades.states[id] ?? SHADE_UP}
            onShade={shades.set}
            open={popover}
            onOpen={openPopover}
            onHover={setHoveredItem}
            hovered={hoveredItem}
            pinRefs={pinRefs}
            scenes={scenes.of(
              focus.room,
              focusItems.filter((i) => i.kind === 'light').map((i) => i.id),
            )}
            onLeave={leaveRoom}
          />
        )}

        {/* Between rooms, smart items keep their tags; outside, so do lights without a room. */}
        {floorTags.length > 0 && !popover && (
          <FloorOverview
            items={floorTags}
            roomName={(item) => rooms.find((r) => r.room === item.room)?.label}
            light={(id) => lightSettings(lights.states[id], dark)}
            onLight={(id, patch) => lights.set(id, patch, dark)}
            shade={(id) => shades.states[id] ?? SHADE_UP}
            onShade={shades.set}
            onOpen={openItem}
            onHover={setHoveredItem}
            hovered={hoveredItem}
          />
        )}
        {floorTags.length > 0 && (
          <ItemPins
            items={floorTags}
            light={(id) => lightSettings(lights.states[id], dark)}
            onLight={(id, patch) => lights.set(id, patch, dark)}
            shade={(id) => shades.states[id] ?? SHADE_UP}
            onShade={shades.set}
            open={popover}
            onOpen={openItem}
            onHover={setHoveredItem}
            hovered={hoveredItem}
            pinRefs={pinRefs}
          />
        )}

        <ViewDock
          floors={house.floors}
          floorIndex={floorIndex}
          onFloor={switchFloor}
          outside={outside}
          onOutside={goOutside}
          camera={camera}
          onCamera={(next) => (next === 'walk' ? startWalk() : setCamera(next))}
          onExitWalk={exitWalk}
          onWalkDrag={(x, y) => walkPlacement.current?.preview(x, y) ?? false}
          onWalkDrop={(x, y) => {
            const start = walkPlacement.current?.point(x, y)
            walkPlacement.current?.clear()
            if (start) startWalk(start)
          }}
          onWalkCancel={() => walkPlacement.current?.clear()}
          canPlan={editing}
          inRoom={!!focus || !!popover}
        >
          {camera !== 'walk' && roomOrder.ready && (
            <RoomNav
              rooms={rooms}
              room={roomView}
              onRoom={openRoom}
              onLeave={leaveRoom}
              saved={roomOrder.order}
              onSave={roomOrder.save}
              lights={roomLights}
            />
          )}
        </ViewDock>

        {modeBar}

        {/* Drags and pinches move the 3D view; walking on a touch screen needs the buttons. */}
        {walkCaptured && <div className="crosshair" aria-hidden />}

        {!focus && camera === 'walk' && !walkCaptured && (
          <CameraPad
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
        {data.notice && (
          <div className="toast" role="status" onClick={data.clearNotice}>
            {data.notice} (tap to dismiss)
          </div>
        )}
      </main>

      <aside className="sidebar sidebar-right" aria-label="Details" inert={!rightOpen}>
        <div className="sheet-handle" onClick={closeRight} />
        {editing && (
          <Section className="edit-modes">
            <Segmented
              label="What to edit"
              block
              value={editMode}
              onChange={changeEditMode}
              options={[
                { value: 'interior', label: 'Interior', icon: <Sofa size={16} /> },
                { value: 'devices', label: 'Devices', icon: <Lightbulb size={16} /> },
              ]}
            />
          </Section>
        )}
        <div
          className="sidebar-inner"
          key={selectedDevice?.id ?? (selection?.kind === 'light' ? selection.id : 'catalog')}
        >
          {inspector}
        </div>
      </aside>
    </div>
  )
}
