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
import type { CameraMode, Selection } from './scene/selection'
import { CameraPad } from './ui/CameraPad'
import { FurnitureEditor } from './ui/FurnitureEditor'
import { FurniturePanel, type NewPiece } from './ui/FurniturePanel'
import { sunNow, useNorth, type SunSettings } from './sun/useSun'
import { sunPosition, zonedTime } from './sun/sun'
import { wallText } from './measure/dimensions'
import { MeasureBar } from './ui/MeasureBar'
import { SunPanel } from './ui/SunPanel'
import { RoomPanel } from './ui/RoomPanel'
import { WallPanel } from './ui/WallPanel'
import { wallColorKey } from './data/types'

export const App = () => <AuthGate>{(backend, account) => <House backend={backend} account={account} />}</AuthGate>

type HouseProps = { backend: Backend; account: Account }

const House = ({ backend, account }: HouseProps) => {
  const data = useHouseData(backend)
  const [floorIndex, setFloorIndex] = useState(0)
  const [camera, setCamera] = useState<CameraMode>('orbit')
  const [selection, setSelection] = useState<Selection>()
  const [furnitureOpen, setFurnitureOpen] = useState(false)
  const [snap, setSnap] = useState(true)
  const nudge = useRef(createCameraNudge())
  const [viewKey, setViewKey] = useState(0)
  const [measure, setMeasure] = useState<Point[]>()
  const [sun, setSun] = useState<SunSettings>()
  const [showSizes, setShowSizes] = useState(false)
  const [north, setNorth] = useNorth()
  const { site } = house
  const sunAt = sun
    ? sunPosition(zonedTime(sun.date, sun.minutes, site.timeZone), site.latitude, site.longitude)
    : undefined

  const floor = house.floors[floorIndex]
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
    if (created) setSelection({ kind: 'furniture', id: created.id })
  }

  // R / Shift+R rotate and Delete removes the selected item, unless typing in a field.
  useEffect(() => {
    if (!selectedItem) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'r' || e.key === 'R') rotateItem(selectedItem, e.shiftKey ? -15 : 15)
      else if (e.key === 'Delete' || e.key === 'Backspace') deleteItem(selectedItem)
      else if (e.key === 'Escape') setSelection(undefined)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const switchFloor = (index: number) => {
    setFloorIndex(index)
    setSelection(undefined)
    if (measure) setMeasure([])
  }

  const toggleMeasure = () => {
    setSelection(undefined)
    setFurnitureOpen(false)
    setMeasure(measure ? undefined : [])
  }
  // A third tap starts a new measurement.
  const addMeasurePoint = (p: Point) => setMeasure((points = []) => (points.length === 1 ? [points[0], p] : [p]))

  return (
    <div className="app">
      <HouseScene
        floors={house.floors}
        floorIndex={floorIndex}
        camera={camera}
        data={data}
        selection={selection}
        snap={snap}
        sun={sunAt}
        north={north}
        showSizes={showSizes}
        measure={measure}
        onMeasurePoint={addMeasurePoint}
        nudge={nudge}
        viewKey={viewKey}
        onSelect={setSelection}
      />

      <CameraPad
        mode={camera}
        onHold={(axis, value) => (nudge.current[axis] = value)}
        onRelease={(axis, value) => nudge.current[axis] === value && (nudge.current[axis] = 0)}
        onReset={() => setViewKey((k) => k + 1)}
      />

      <header className="topbar">
        <div className="segmented" role="group" aria-label="Floor">
          {house.floors.map((f, i) => (
            <button key={f.id} aria-pressed={i === floorIndex} onClick={() => switchFloor(i)}>
              {f.name}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Camera">
          <button aria-pressed={camera === 'top'} onClick={() => setCamera('top')}>
            Top
          </button>
          <button aria-pressed={camera === 'orbit'} onClick={() => setCamera('orbit')}>
            3D
          </button>
          <button aria-pressed={camera === 'walk'} onClick={() => setCamera('walk')}>
            Walk
          </button>
        </div>
        <button
          className="btn"
          onClick={() => {
            setSelection(undefined)
            setMeasure(undefined)
            setFurnitureOpen((open) => !open)
          }}
        >
          Furniture
        </button>
        <button className="btn" aria-pressed={showSizes} onClick={() => setShowSizes(!showSizes)}>
          Sizes
        </button>
        <button className="btn" aria-pressed={Boolean(measure)} onClick={toggleMeasure}>
          Measure
        </button>
        <button
          className="btn"
          aria-pressed={Boolean(sun)}
          onClick={() => {
            setSelection(undefined)
            setFurnitureOpen(false)
            setSun(sun ? undefined : sunNow())
          }}
        >
          Sun
        </button>
        <span className="spacer" />
        <div className="chip">
          <span>{account.label}</span>
          <button className="btn btn-ghost" onClick={account.signOut}>
            Sign out
          </button>
        </div>
      </header>

      {measure && <MeasureBar points={measure} onClear={() => setMeasure([])} onDone={() => setMeasure(undefined)} />}

      {selection?.kind === 'wall' && (
        <WallPanel
          wallId={selection.wallId}
          side={selection.side}
          details={(() => {
            const wall = floor.walls.find((w) => w.id === selection.wallId)
            return wall ? wallText(wall, floor) : ''
          })()}
          color={data.wallColors.get(wallColorKey(selection.wallId, selection.side))}
          onColor={(color) => data.setWallColor(selection.wallId, selection.side, color)}
          onFlip={() => setSelection({ ...selection, side: selection.side === 'a' ? 'b' : 'a' })}
          onClose={() => setSelection(undefined)}
        />
      )}

      {selectedRoom && (
        <RoomPanel
          room={selectedRoom}
          region={floorRegions(floor).get(selectedRoom.id)}
          material={data.roomFloors.get(selectedRoom.id)}
          onMaterial={(material) => data.setRoomFloor(selectedRoom.id, material)}
          onClose={() => setSelection(undefined)}
        />
      )}

      {selectedItem && (
        <FurnitureEditor
          item={selectedItem}
          onChange={(patch) => changeItem(selectedItem, patch)}
          onRotate={(deg) => rotateItem(selectedItem, deg)}
          onDelete={() => deleteItem(selectedItem)}
          onClose={() => setSelection(undefined)}
        />
      )}

      {!selection && !furnitureOpen && sun && sunAt && (
        <SunPanel
          sun={sun}
          position={sunAt}
          north={north}
          onSun={setSun}
          onNorth={setNorth}
          onClose={() => setSun(undefined)}
        />
      )}

      {!selection && furnitureOpen && (
        <FurniturePanel
          floorName={floor.name}
          items={data.furniture.filter((f) => f.floor === floor.id)}
          snap={snap}
          onSnap={setSnap}
          onAdd={addPiece}
          onSelect={(id) => setSelection({ kind: 'furniture', id })}
          onClose={() => setFurnitureOpen(false)}
        />
      )}

      {data.loading && <div className="toast">Loading the house…</div>}
      {data.error && (
        <div className="toast" role="alert" onClick={data.clearError}>
          Couldn't save: {data.error} (tap to dismiss)
        </div>
      )}
    </div>
  )
}
