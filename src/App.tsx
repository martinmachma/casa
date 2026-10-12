import { useEffect, useState } from 'react'
import { AuthGate, type Account } from './auth/AuthGate'
import type { Backend, FurnitureItem } from './data/types'
import { useHouseData } from './data/useHouseData'
import { floorSnapWalls, normalizeAngle, snapToWalls } from './furniture/snap'
import { floorBounds } from './layout/geometry'
import { house } from './layout/layout'
import { HouseScene } from './scene/HouseScene'
import { FURNITURE_SWATCHES } from './scene/palette'
import type { CameraMode, Selection } from './scene/selection'
import { FurnitureEditor } from './ui/FurnitureEditor'
import { FurniturePanel, type BoxSize } from './ui/FurniturePanel'
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

  const floor = house.floors[floorIndex]
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

  const addBox = async (size: BoxSize) => {
    const { min, max } = floorBounds(floor)
    const created = await data.addFurniture({
      ...size,
      floor: floor.id,
      x: (min[0] + max[0]) / 2,
      y: (min[1] + max[1]) / 2,
      rotation: 0,
      color: FURNITURE_SWATCHES[1],
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
  }

  return (
    <div className="app">
      <HouseScene
        floors={house.floors}
        floorIndex={floorIndex}
        camera={camera}
        data={data}
        selection={selection}
        snap={snap}
        onSelect={setSelection}
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
        </div>
        <button
          className="btn"
          onClick={() => {
            setSelection(undefined)
            setFurnitureOpen((open) => !open)
          }}
        >
          Furniture
        </button>
        <span className="spacer" />
        <div className="chip">
          <span>{account.label}</span>
          <button className="btn btn-ghost" onClick={account.signOut}>
            Sign out
          </button>
        </div>
      </header>

      {selection?.kind === 'wall' && (
        <WallPanel
          wallId={selection.wallId}
          side={selection.side}
          color={data.wallColors.get(wallColorKey(selection.wallId, selection.side))}
          onColor={(color) => data.setWallColor(selection.wallId, selection.side, color)}
          onFlip={() => setSelection({ ...selection, side: selection.side === 'a' ? 'b' : 'a' })}
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

      {!selection && furnitureOpen && (
        <FurniturePanel
          floorName={floor.name}
          items={data.furniture.filter((f) => f.floor === floor.id)}
          snap={snap}
          onSnap={setSnap}
          onAdd={addBox}
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
