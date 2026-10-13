import { useEffect, useRef, useState } from 'react'
import { AuthGate, type Account } from './auth/AuthGate'
import type { Backend, FurnitureItem } from './data/types'
import { useHouseData } from './data/useHouseData'
import { floorSnapWalls, normalizeAngle, snapToWalls } from './furniture/snap'
import { floorBounds } from './layout/geometry'
import { floorRegions } from './layout/rooms'
import type { Point } from './layout/types'
import { house } from './layout/layout'
import { HouseScene } from './scene/HouseScene'
import { FURNITURE_SWATCHES } from './scene/palette'
import { createCameraNudge } from './scene/cameraNudge'
import type { CameraMode, Interaction, Selection } from './scene/selection'
import { CameraPad } from './ui/CameraPad'
import { FurnitureEditor } from './ui/FurnitureEditor'
import { FurniturePanel, type NewPiece } from './ui/FurniturePanel'
import type { SunSettings } from './sun/useSun'
import { sunPosition, zonedTime } from './sun/sun'
import { wallText } from './measure/dimensions'
import type { MeasurePick, Measurement } from './measure/measure'
import { MeasurePanel } from './ui/MeasurePanel'
import { SunPanel } from './ui/SunPanel'
import { RoomPanel } from './ui/RoomPanel'
import { WallPanel } from './ui/WallPanel'
import { wallColorKey } from './data/types'
import { ModeBar } from './ui/ModeBar'
import { FloorList, RoomLegend } from './ui/RoomLegend'
import { TopBar } from './ui/TopBar'

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
  const [interaction, setInteraction] = useState<Interaction>('view')
  const [selection, setSelection] = useState<Selection>()
  const [hoveredRoom, setHoveredRoom] = useState<string>()
  const [leftOpen, setLeftOpen] = useState(() => !isNarrow())
  const [rightOpen, setRightOpen] = useState(() => !isNarrow())
  const [snap, setSnap] = useState(true)
  const nudge = useRef(createCameraNudge())
  const [viewKey, setViewKey] = useState(0)
  const [measure, setMeasure] = useState<Measurement>()
  const [sun, setSun] = useState<SunSettings>()
  const { site } = house
  const sunAt = sun
    ? sunPosition(zonedTime(sun.date, sun.minutes, site.timeZone), site.latitude, site.longitude)
    : undefined

  const floor = house.floors[floorIndex]
  const regions = floorRegions(floor)
  const selectedRoom = selection?.kind === 'room' ? floor.rooms.find((r) => r.id === selection.roomId) : undefined
  const selectedItem = selection?.kind === 'furniture' ? data.furniture.find((f) => f.id === selection.id) : undefined

  const changeItem = (item: FurnitureItem, patch: Partial<FurnitureItem>) => {
    data.patchFurniture(item.id, patch)
    data.saveFurniture({ ...item, ...patch })
  }
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
    setSelection(next)
    if (next) setRightOpen(true)
  }
  const deleteItem = (item: FurnitureItem) => {
    data.removeFurniture(item.id)
    setSelection(undefined)
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

  const addPiece = async (piece: NewPiece) => {
    const [x, y] = dropPoint()
    const created = await data.addFurniture({
      ...piece,
      floor: floor.id,
      x,
      y,
      rotation: 0,
      // A box gets a wood tone; a model's colour is its fabric (blue-grey, as in the thumbnails).
      color: piece.model ? FURNITURE_SWATCHES[4] : FURNITURE_SWATCHES[1],
    })
    if (created) select({ kind: 'furniture', id: created.id })
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

  /** Measuring is part of editing: leaving edit mode stops it, and nothing stays selected across modes. */
  const changeInteraction = (next: Interaction) => {
    setSelection(undefined)
    setInteraction(next)
    if (next === 'measure') {
      setMeasure((m) => m ?? { mode: 'points', picks: [] })
      setRightOpen(true)
    } else setMeasure(undefined)
  }
  // A third tap starts a new measurement.
  const addMeasurePick = (pick: MeasurePick) =>
    setMeasure((m) => m && { ...m, picks: m.picks.length === 1 ? [m.picks[0], pick] : [pick] })

  // E toggles editing, M measuring; R / Shift+R rotate and Delete removes the selected item; Esc steps back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey || outside) return
      const key = e.key.toLowerCase()
      if (key === 'e') changeInteraction(interaction === 'view' ? 'edit' : 'view')
      else if (key === 'm') changeInteraction(interaction === 'measure' ? 'edit' : 'measure')
      else if (selectedItem && key === 'r') rotateItem(selectedItem, e.shiftKey ? -15 : 15)
      else if (selectedItem && (e.key === 'Delete' || e.key === 'Backspace')) deleteItem(selectedItem)
      else if (e.key === 'Escape') {
        if (selection) setSelection(undefined)
        else if (interaction === 'measure') changeInteraction('edit')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const editing = interaction !== 'view'
  const closeRight = () => setRightOpen(false)

  const inspector = (() => {
    if (measure)
      return (
        <MeasurePanel
          measure={measure}
          onMode={(mode) => setMeasure({ mode, picks: [] })}
          onClear={() => setMeasure({ ...measure, picks: [] })}
          onClose={() => changeInteraction('edit')}
        />
      )
    if (selection?.kind === 'wall') {
      const wall = floor.walls.find((w) => w.id === selection.wallId)
      return (
        <WallPanel
          side={selection.side}
          details={wall ? wallText(wall, floor) : ''}
          color={data.wallColors.get(wallColorKey(selection.wallId, selection.side))}
          onColor={(color) => data.setWallColor(selection.wallId, selection.side, color)}
          onFlip={() => setSelection({ ...selection, side: selection.side === 'a' ? 'b' : 'a' })}
          onClose={() => setSelection(undefined)}
        />
      )
    }
    if (selectedRoom)
      return (
        <RoomPanel
          room={selectedRoom}
          region={regions.get(selectedRoom.id)}
          material={data.roomFloors.get(selectedRoom.id)}
          onMaterial={(material) => data.setRoomFloor(selectedRoom.id, material)}
          onClose={() => setSelection(undefined)}
        />
      )
    if (selectedItem)
      return (
        <FurnitureEditor
          item={selectedItem}
          onChange={(patch) => changeItem(selectedItem, patch)}
          onRotate={(deg) => rotateItem(selectedItem, deg)}
          onDelete={() => deleteItem(selectedItem)}
          onClose={() => setSelection(undefined)}
        />
      )
    if (editing)
      return (
        <FurniturePanel
          items={data.furniture.filter((f) => f.floor === floor.id)}
          snap={snap}
          onSnap={setSnap}
          onAdd={addPiece}
          onSelect={(id) => select({ kind: 'furniture', id })}
        />
      )
    return <SunPanel sun={sun} position={sunAt} onSun={setSun} />
  })()

  return (
    <div className="app" data-left={leftOpen ? 'open' : 'closed'} data-right={rightOpen ? 'open' : 'closed'}>
      <TopBar
        floors={house.floors}
        floorIndex={floorIndex}
        onFloor={switchFloor}
        outside={outside}
        onOutside={goOutside}
        camera={camera}
        onCamera={setCamera}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen(!leftOpen)}
        onToggleRight={() => setRightOpen(!rightOpen)}
        account={account}
      />

      <aside className="sidebar sidebar-left" aria-label="Rooms" inert={!leftOpen}>
        <div className="sidebar-inner">
          {outside ? (
            <FloorList floors={house.floors} onPick={switchFloor} onClose={() => setLeftOpen(false)} />
          ) : (
            <RoomLegend
              floor={floor}
              regions={regions}
              hovered={hoveredRoom}
              selected={selection?.kind === 'room' ? selection.roomId : undefined}
              onHover={setHoveredRoom}
              onPick={editing && !measure ? (roomId) => select({ kind: 'room', roomId }) : undefined}
              onClose={() => setLeftOpen(false)}
            />
          )}
        </div>
      </aside>

      <main className="viewport">
        <HouseScene
          floors={house.floors}
          floorIndex={outside ? house.floors.length - 1 : floorIndex}
          outside={outside}
          camera={camera}
          data={data}
          interaction={interaction}
          selection={selection}
          hoveredRoom={hoveredRoom}
          onHoverRoom={setHoveredRoom}
          snap={snap}
          sun={sunAt}
          north={site.north}
          measure={measure}
          onMeasurePick={addMeasurePick}
          nudge={nudge}
          viewKey={viewKey}
          onSelect={select}
        />

        {!outside && <ModeBar interaction={interaction} onChange={changeInteraction} />}

        <CameraPad
          mode={camera}
          onHold={(axis, value) => (nudge.current[axis] = value)}
          onRelease={(axis, value) => nudge.current[axis] === value && (nudge.current[axis] = 0)}
          onReset={() => setViewKey((k) => k + 1)}
        />

        {data.loading && <div className="toast">Loading the house…</div>}
        {data.error && (
          <div className="toast" role="alert" onClick={data.clearError}>
            Couldn't save: {data.error} (tap to dismiss)
          </div>
        )}
      </main>

      <aside className="sidebar sidebar-right" aria-label="Details" inert={!rightOpen}>
        <div className="sidebar-inner">
          <div className="sheet-handle" onClick={closeRight} />
          {inspector}
        </div>
      </aside>
    </div>
  )
}
