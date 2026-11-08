import { Cable, Paintbrush, Sofa, Sparkles, SquareBottomDashedScissors } from 'lucide-react'
import { IconButton, Section, Segmented, Slide } from './ui/kit'
import { TodoPopup } from './ui/TodoPopup'
import { WeatherPopup } from './ui/WeatherPopup'
import { useOpenTodoCount } from './ui/useOpenTodoCount'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Account } from './auth/AuthGate'
import type { Backend, Device, FurnitureItem, NewFurnitureItem } from './data/types'
import { useHouseData } from './data/useHouseData'
import { newDeviceName, type DevicePlacement } from './devices/kinds'
import { atHeight, deviceRoom } from './devices/place'
import { rotateGroup } from './furniture/group'
import { duplicateOffset } from './furniture/duplicate'
import { pasteFurniture } from './furniture/clipboard'
import { floorSnapWalls, normalizeAngle, snapToWalls } from './furniture/snap'
import { floorRegions } from './layout/rooms'
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
import { LightList, LightsPanel } from './ui/LightsPanel'
import { lightSettings, useLights } from './devices/lights'
import {
  forgetLocalScenes,
  inScenes,
  localScenes,
  newSceneName,
  type Scene,
  sceneHas,
  sceneWith,
  sceneWithout,
} from './devices/scenes'
import { LightControls } from './ui/LightControls'
import { daylight } from './scene/Lights'
import { FurnitureEditor } from './ui/FurnitureEditor'
import { FurnitureGroupEditor } from './ui/FurnitureGroupEditor'
import { FurniturePanel, type NewPiece, type PanelGroup } from './ui/FurniturePanel'
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
import { floorItems, itemSections, outsideLight, type PlacedItem, roomItems } from './rooms/roomItems'
import { floorShades, SHADE_UP, useShades } from './devices/shades'
import { RoomNav } from './ui/RoomNav'
import { useRoomOrder } from './rooms/useRoomOrder'
import { useSceneOrder } from './devices/useSceneOrder'
import { ItemPins } from './ui/ItemPins'
import { FloorOverview } from './ui/FloorOverview'
import { RoomOverview } from './ui/RoomOverview'
import { SceneEditor } from './ui/SceneEditor'
import { ScenePins } from './ui/ScenePins'
import { ScenesPanel } from './ui/ScenesPanel'
import { ElectricalPanel } from './ui/ElectricalPanel'
import { PhoneHome } from './ui/PhoneHome'
import { isNarrow, useNarrow } from './ui/useNarrow'
import { arrangeRooms } from './rooms/roomOrder'

type HouseProps = { backend: Backend; account: Account }

/** A scene open in the editor; the scene itself is in the draft, like any other edit. */
type SceneEdit = {
  id: string
  /** Just made, with its name still to give. */
  fresh: boolean
  /** The floor and room it was opened on, whose items stay first in its list. */
  floor: number
  room: string | undefined
  /** The item whose settings are showing. */
  open: string | undefined
}

/** The time of day scenes are looked at after dark: well past sunset, all year. */
const NIGHT_MINUTES = 23 * 60

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
  // Home on a phone has its own menus at the bottom; editing keeps the desktop's panels.
  const phone = useNarrow() && !editing
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
  // Which group the Interior panel shows, kept while something selected takes its place.
  const [panelGroup, setPanelGroup] = useState<PanelGroup>('Living')
  const [brush, setBrush] = useState<Brush>({ color: '#7f9172', erase: false, size: 0.1 })
  const [selection, setSelection] = useState<Selection>()
  const [placing, setPlacing] = useState<DevicePlacement>()
  // A new piece from the catalog, carried under the pointer until it's put down.
  const [placingPiece, setPlacingPiece] = useState<Omit<NewFurnitureItem, 'x' | 'y'>>()
  const [todosOpen, setTodosOpen] = useState(false)
  const [weatherOpen, setWeatherOpen] = useState(false)
  const openTodos = useOpenTodoCount()
  const roomOrder = useRoomOrder(backend)
  const sceneOrder = useSceneOrder(backend)
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
  const [focusInset, setFocusInset] = useState(0)
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
  const [sceneEdit, setSceneEdit] = useState<SceneEdit>()
  // The scene pointed at in the list, shown in the view.
  const [scenePreview, setScenePreview] = useState<string>()
  // While looking at scenes after dark: the sun to go back to.
  const [nightFrom, setNightFrom] = useState<{ sun: SunSettings | undefined }>()
  const focusFloor = focus && house.floors.find((f) => f.id === focus.floor)
  const focusItems = focusFloor ? roomItems(focusFloor, focus.room, data.devices, data.furniture) : []
  const dark = 1 - daylight(sunAt)
  const lightNow = (id: string) => lightSettings(lights.states[id], dark)
  const shadeNow = (id: string) => shades.states[id] ?? SHADE_UP
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
  /** Where a device is, in words. */
  const deviceWhere = (device: Device) => {
    const index = house.floors.findIndex((f) => f.id === device.floor)
    const room = deviceRoom(device, house.floors[index], floorRegions(house.floors[index]))
    const place = rooms.find((r) => r.room === room)?.label ?? 'Outside'
    return [place, `${ordinal(index + 1)} floor`, device.wall ? 'on a wall' : undefined].filter(Boolean).join(' · ')
  }
  /** Picking something shows it in the right panel, opening the panel if it was tucked away. */
  const select = (next: Selection | undefined) => {
    data.endEdit()
    setSelection(next)
    if (next) setRightOpen(true)
    // Anything can be picked in either mode; the panel follows what was.
    if (next) setEditMode('interior')
    if (next?.kind === 'device') setPanelGroup('Lights')
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

  /** A placed device is selected, ready to be named. */
  const placeDevice = (device: Omit<Device, 'id' | 'name'>) => {
    const created = data.addDevice({ ...device, name: newDeviceName(device, data.devices) })
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

  // Every smart item, with the floor it's on.
  const smartItems = useMemo<PlacedItem[]>(
    () =>
      house.floors.flatMap((f, floorIndex) =>
        floorItems(f, data.devices, data.furniture).map((item) => ({ ...item, floorIndex })),
      ),
    [data.devices, data.furniture],
  )
  const sceneItems = useMemo(() => smartItems.filter(inScenes), [smartItems])
  const lightItems = useMemo(() => smartItems.filter((item) => item.kind !== 'blind'), [smartItems])
  const scene = sceneEdit && data.scenes.find((s) => s.id === sceneEdit.id)
  // Undone away, or gone with the version it was in.
  if (sceneEdit && !scene) setSceneEdit(undefined)
  const roomName = (item: PlacedItem) => rooms.find((r) => r.room === item.room)?.label
  /** Brings an item on another floor or in another room into the view. */
  const showItem = (item: PlacedItem) => {
    if (camera === 'walk') return
    if (outsideLight(item)) {
      if (!outside) goOutside()
    } else if (outside || item.floorIndex !== floorIndex || (focus && focus.room !== item.room))
      switchFloor(item.floorIndex)
  }
  /** A light in the list is picked as if tapped in the view: a lamp is a piece of furniture. */
  const pickLightRow = (id: string) => {
    const item = lightItems.find((i) => i.id === id)
    if (!item) return
    showItem(item)
    select(item.lamp ? { kind: 'furniture', ids: [id] } : { kind: 'device', id })
  }
  /** Opens a scene in the editor; none makes a new one, ready to be named. */
  const openScene = (saved: Scene | undefined) => {
    const opened = saved ?? { id: crypto.randomUUID(), name: newSceneName(data.scenes), lights: {}, shades: {} }
    if (!saved) data.addScenes(opened)
    setPlacing(undefined)
    setScenePreview(undefined)
    setSceneEdit({
      id: opened.id,
      fresh: !saved,
      floor: focusFloor ? house.floors.indexOf(focusFloor) : floorIndex,
      room: focus?.room,
      open: undefined,
    })
  }
  /** Leaves the scene; one left with nothing in it isn't a scene. */
  const closeScene = () => {
    if (scene && !Object.keys(scene.lights).length && !Object.keys(scene.shades).length) removeScene(scene.id)
    setSceneEdit(undefined)
    setHoveredItem(undefined)
  }
  const removeScene = (id: string) => {
    data.removeScene(id)
    forgetLocalScenes([id])
  }
  const deleteScene = () => {
    if (scene) removeScene(scene.id)
    setSceneEdit(undefined)
    setHoveredItem(undefined)
  }
  const duplicateScene = () => {
    if (!scene || !sceneEdit) return
    const copy = { ...scene, id: crypto.randomUUID(), name: `${scene.name} copy` }
    data.addScenes(copy)
    setSceneEdit({ ...sceneEdit, id: copy.id, fresh: true, open: undefined })
  }
  /** Looks at scenes after dark, or back at the light from before. */
  const toggleNight = () => {
    if (nightFrom) setSun(nightFrom.sun)
    else setSun({ ...sunNow(), minutes: NIGHT_MINUTES })
    setNightFrom(nightFrom ? undefined : { sun })
  }
  const endNight = () => {
    if (nightFrom) setSun(nightFrom.sun)
    setNightFrom(undefined)
  }
  const patchSceneEdit = (patch: Partial<SceneEdit>) => setSceneEdit((edit) => edit && { ...edit, ...patch })
  /** Shows an item's settings in the scene's list, bringing it into the view if it's somewhere else. */
  const openSceneItem = (id: string | undefined) => {
    patchSceneEdit({ open: id })
    const item = sceneItems.find((i) => i.id === id)
    if (item) showItem(item)
  }
  /** Puts an item in the scene as it is now, ready to set, or takes it out. */
  const tickSceneItem = (item: Pick<PlacedItem, 'id' | 'kind'>) => {
    if (!scene) return
    if (sceneHas(scene, item.id)) {
      data.changeScene(scene.id, (s) => sceneWithout(s, item.id))
      return patchSceneEdit({ open: undefined })
    }
    data.changeScene(scene.id, (s) => sceneWith(s, [item], lightNow, shadeNow))
    openSceneItem(item.id)
  }
  /** A tap on an item in the view works like its row in the list. */
  const pickSceneItem = (id: string) => {
    const item = sceneItems.find((i) => i.id === id)
    if (!item || !scene) return
    if (sceneHas(scene, id)) openSceneItem(id)
    else tickSceneItem(item)
  }
  // Scenes from before they were kept with the house join the draft, and leave this browser once they're saved.
  const { loading: dataLoading, dirty: dataDirty, scenes: houseScenes, addScenes } = data
  useEffect(() => {
    if (!editing || dataLoading) return
    const waiting = localScenes().filter((s) => !houseScenes.some((known) => known.id === s.id))
    if (waiting.length) addScenes(...waiting)
    // Once per visit to Edit: the draft has them from then on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, dataLoading])
  useEffect(() => {
    if (!dataLoading && !dataDirty) forgetLocalScenes(houseScenes.map((s) => s.id))
  }, [dataLoading, dataDirty, houseScenes])

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
    setScenePreview(undefined)
    setNightFrom(undefined)
    setEditMode('interior')
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
    closeScene()
    endNight()
    setScenePreview(undefined)
    setSelection(undefined)
    setPlacing(undefined)
    setPlacingPiece(undefined)
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
    closeScene()
    setSelection(undefined)
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
  // E toggles Edit, M measuring, L scenes; R / Shift+R rotate, Cmd+D duplicates and Delete removes the selected item; Esc steps back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Text fields keep their own undo.
      const typing = isTyping(e.target)
      const key = e.key.toLowerCase()
      if (!typing && !locked && interaction === 'edit' && !sceneEdit && !measure && (e.metaKey || e.ctrlKey)) {
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
      if (sceneEdit && e.key === 'Escape' && !typing)
        return sceneEdit.open ? patchSceneEdit({ open: undefined }) : closeScene()
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
      else if (key === 'l') changeEditMode(editMode === 'scenes' ? 'interior' : 'scenes')
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
  // The scenes tab: nothing's moved here, and items are picked only into a scene that's open.
  const onScenes = editing && interaction === 'edit' && editMode === 'scenes'
  const inView = (item: PlacedItem) =>
    camera !== 'walk' &&
    (focus ? item.room === focus.room : outsideLight(item) || (!outside && item.floorIndex === floorIndex))
  // While a scene is put together: the items in view, as for the tags.
  const sceneTags = sceneItems.filter(inView)
  // While lights are being edited, each one in view has a tag, to find and pick it by.
  const lightTags =
    editing && interaction === 'edit' && editMode === 'interior' && panelGroup === 'Lights' && !measure && !electrical
      ? lightItems.filter(inView)
      : []
  const pickedDevice = selection?.kind === 'device' ? selection.id : undefined
  const shownScene = scene ?? data.scenes.find((s) => s.id === scenePreview)
  // Scenes that do something: at home, all of them outside, and on a floor those that reach it.
  const reachingScenes = data.scenes.filter((s) => smartItems.some((i) => sceneHas(s, i.id)))
  const floorScenes = outside ? reachingScenes : reachingScenes.filter((s) => floorTags.some((i) => sceneHas(s, i.id)))
  const sceneFloors = house.floors
    .map((_, i) => ({
      i,
      name: `${ordinal(i + 1)} floor`,
      items: sceneItems.filter((item) => item.floorIndex === i),
    }))
    .sort((a, b) => Number(b.i === sceneEdit?.floor) - Number(a.i === sceneEdit?.floor))
  const lightRows = {
    light: lightNow,
    onLight: (id: string, patch: Parameters<typeof lights.set>[1]) => lights.set(id, patch, dark),
    shade: shadeNow,
    onShade: shades.set,
    onOpen: pickLightRow,
    onHover: setHoveredItem,
    hovered: hoveredItem,
  }
  /** The lights in a list, this floor's first. */
  const lightSections = (items: PlacedItem[]) =>
    itemSections(
      house.floors
        .map((_, i) => ({ i, name: `${ordinal(i + 1)} floor`, items: items.filter((item) => item.floorIndex === i) }))
        .sort((a, b) => Number(b.i === floorIndex) - Number(a.i === floorIndex)),
      roomName,
      focus?.room,
    )
  const closeRight = () => setRightOpen(false)
  // The rooms in the order they're arranged in on a wide screen, the small ones after.
  const roomsArranged = arrangeRooms(rooms, roomOrder.order)
  const phoneRooms = [...roomsArranged.main, ...roomsArranged.minor].flatMap(
    (id) => rooms.find((r) => r.id === id) ?? [],
  )
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
            <SunPanel
              sun={sun}
              position={sunAt}
              onSun={(next) => {
                setSun(next)
                setNightFrom(undefined)
              }}
            />
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
                  closeScene()
                  endNight()
                  setEditMode('interior')
                  setElectrical(!electrical)
                  setSelection(undefined)
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
    if (sceneEdit && scene)
      return (
        <SceneEditor
          key={scene.id}
          scene={scene}
          fresh={sceneEdit.fresh}
          onChange={(next, key) => data.changeScene(next.id, () => next, key)}
          floors={sceneFloors}
          roomName={roomName}
          room={sceneEdit.room}
          open={sceneEdit.open}
          onOpen={openSceneItem}
          hovered={hoveredItem}
          onHover={setHoveredItem}
          onRemove={tickSceneItem}
          light={lightNow}
          shade={shadeNow}
          night={!!nightFrom}
          onNight={toggleNight}
          onDuplicate={duplicateScene}
          onDelete={deleteScene}
          onClose={closeScene}
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
      return (
        <DeviceEditor
          device={selectedDevice}
          where={deviceWhere(selectedDevice)}
          onChange={(patch) => {
            if (selectedDevice.plan) return patch.name && data.renameDevice(selectedDevice.id, patch.name)
            const on = house.floors.find((f) => f.id === selectedDevice.floor)
            const change = patch.z !== undefined && on ? atHeight(selectedDevice, patch.z, on) : patch
            data.patchDevice(selectedDevice.id, change, `${selectedDevice.id}:${Object.keys(patch).join()}`)
          }}
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
    if (onScenes)
      return (
        <ScenesPanel
          scenes={data.scenes}
          items={sceneItems}
          roomName={roomName}
          onOpen={openScene}
          onPreview={setScenePreview}
          night={!!nightFrom}
          onNight={toggleNight}
        />
      )
    if (interaction === 'edit')
      return (
        <FurniturePanel
          onAdd={addPiece}
          group={panelGroup}
          onGroup={(group) => {
            setPanelGroup(group)
            setPlacing(undefined)
          }}
          lights={
            <LightsPanel
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
            />
          }
          foundLights={(q) => {
            const found = lightItems.filter((i) => i.name.toLowerCase().includes(q))
            return found.length > 0 && <LightList sections={lightSections(found)} {...lightRows} />
          }}
        />
      )
    return undefined
  })()

  return (
    <div className="app" data-right={rightOpen ? 'open' : 'closed'} data-phone={phone || undefined}>
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
          cutaway={cutaway || phone}
          electrical={editing && electrical}
          data={data}
          // Nothing's moved on the scenes tab: a scene's items are picked, as they are when looking round.
          interaction={measure ? 'measure' : onScenes ? 'view' : interaction}
          editMode={editMode}
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
          // A scene open or pointed at shows as it would look.
          lights={shownScene ? { ...lights.states, ...shownScene.lights } : lights.states}
          onPickLight={onScenes ? pickSceneItem : openItem}
          shades={shownScene ? { ...shades.states, ...shownScene.shades } : shades.states}
          onPickShade={onScenes ? pickSceneItem : pickShade}
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
            ...(sceneEdit ? sceneTags : lightTags.length ? lightTags : focus ? focusItems : floorTags).map((i) => ({
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
          focusInset={phone ? focusInset : 0}
          onTapOutside={phone && !popover ? leaveRoom : undefined}
          hovered={hoveredItem}
          onHoverItem={setHoveredItem}
        />

        {/* While editing, the editor takes the room's place on the right. */}
        {focus && focusFloor && !rightOpen && !phone && (
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
            scenes={data.scenes.filter((s) => focusItems.some((i) => sceneHas(s, i.id)))}
            sceneIds={smartItems.map((i) => i.id)}
            onLeave={leaveRoom}
          />
        )}

        {/* Between rooms, smart items keep their tags; outside, so do lights without a room. */}
        {floorTags.length > 0 && !popover && !phone && (
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
            scenes={floorScenes}
            sceneIds={smartItems.map((i) => i.id)}
          />
        )}
        {floorTags.length > 0 && (
          <ItemPins
            items={floorTags}
            light={(id) => lightSettings(lights.states[id], dark)}
            onLight={(id, patch) => lights.set(id, patch, dark)}
            shade={(id) => shades.states[id] ?? SHADE_UP}
            onShade={shades.set}
            // On a phone the open item's card sits at the bottom instead of by its tag.
            open={phone ? undefined : popover}
            picked={phone ? popover : undefined}
            onOpen={openItem}
            onHover={setHoveredItem}
            hovered={hoveredItem}
            pinRefs={pinRefs}
          />
        )}

        {lightTags.length > 0 && !sceneEdit && (
          <ItemPins
            items={lightTags}
            light={lightNow}
            onLight={lightRows.onLight}
            shade={shadeNow}
            onShade={shades.set}
            open={undefined}
            onOpen={(id) => id && pickLightRow(id)}
            picked={pickedDevice}
            onHover={setHoveredItem}
            hovered={hoveredItem}
            pinRefs={pinRefs}
          />
        )}

        {sceneEdit && scene && (
          <ScenePins
            items={sceneTags}
            picked={(id) => sceneHas(scene, id)}
            open={sceneEdit.open}
            hovered={hoveredItem}
            onTick={tickSceneItem}
            onHover={setHoveredItem}
            pinRefs={pinRefs}
          />
        )}

        {phone && camera !== 'walk' && (
          <>
            {focus && (
              <ItemPins
                items={focusItems}
                light={lightNow}
                onLight={lightRows.onLight}
                shade={shadeNow}
                onShade={shades.set}
                open={undefined}
                picked={popover}
                onOpen={openPopover}
                onHover={setHoveredItem}
                hovered={hoveredItem}
                pinRefs={pinRefs}
              />
            )}
            <PhoneHome
              floors={house.floors}
              floorIndex={floorIndex}
              onFloor={switchFloor}
              outside={outside}
              onOutside={goOutside}
              rooms={phoneRooms}
              room={focus}
              onRoom={openRoom}
              onLeave={leaveRoom}
              lit={roomLights}
              scenes={focus ? data.scenes.filter((s) => focusItems.some((i) => sceneHas(s, i.id))) : floorScenes}
              allScenes={reachingScenes}
              sceneOrder={sceneOrder.order}
              onSceneOrder={sceneOrder.save}
              sceneIds={smartItems.map((i) => i.id)}
              items={focusItems}
              open={smartItems.find((i) => i.id === popover)}
              onFocusInset={setFocusInset}
              onOpen={openPopover}
              onHover={setHoveredItem}
              hovered={hoveredItem}
              light={lightNow}
              onLight={lightRows.onLight}
              shade={shadeNow}
              onShade={shades.set}
            />
          </>
        )}

        {!phone && (
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
        )}

        {!phone && modeBar}

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
                { value: 'scenes', label: 'Scenes', icon: <Sparkles size={16} /> },
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
