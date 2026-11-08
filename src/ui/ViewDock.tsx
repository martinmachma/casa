import { Box, House, LogOut, Map as PlanIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Floor } from '../layout/types'
import type { CameraMode } from '../scene/selection'
import { Segmented } from './kit'
import { ordinal } from './ordinal'
import { WalkButton } from './WalkButton'

type ViewDockProps = {
  floors: Floor[]
  floorIndex: number
  onFloor: (index: number) => void
  /** Looking at the whole house from outside instead of one floor. */
  outside: boolean
  onOutside: () => void
  camera: CameraMode
  onCamera: (camera: CameraMode) => void
  onExitWalk: () => void
  onWalkDrag: (x: number, y: number) => boolean
  onWalkDrop: (x: number, y: number) => void
  onWalkCancel: () => void
  /** The plan view is for editing; at home there's only 3D and walking. */
  canPlan: boolean
  /** In a room the floor and camera are the room's own, so the switches only show where you are. */
  inRoom: boolean
  /** The rooms, at the bottom. */
  children?: ReactNode
}

const OUTSIDE = 'outside'

/** Floats over the left of the 3D view: which floor and how to look at it at the top, its rooms at the bottom. */
export const ViewDock = ({
  floors,
  floorIndex,
  onFloor,
  outside,
  onOutside,
  camera,
  onCamera,
  onExitWalk,
  onWalkDrag,
  onWalkDrop,
  onWalkCancel,
  canPlan,
  inRoom,
  children,
}: ViewDockProps) => (
  <div className="dock">
    {camera === 'walk' ? (
      <div className="walk-notice float">
        <span>
          Press <kbd>ESC</kbd> to see the cursor
        </span>
        <button className="btn btn-ghost" onClick={onExitWalk}>
          <LogOut size={15} />
          Exit walk
        </button>
      </div>
    ) : (
      <div className="dock-bars">
        <div className="dock-bar float">
          <Segmented
            label="Floor"
            value={outside ? OUTSIDE : floors[floorIndex].id}
            onChange={(id) => (id === OUTSIDE ? onOutside() : onFloor(floors.findIndex((f) => f.id === id)))}
            options={[
              { value: OUTSIDE, label: 'Outside', icon: <House size={15} />, iconOnly: true },
              ...floors.map((f, i) => ({ value: f.id, label: ordinal(i + 1) })),
            ]}
            disabled={inRoom}
            className="floors"
          />
        </div>
        <div className="dock-bar float">
          <Segmented
            label="View"
            value={camera}
            onChange={onCamera}
            options={[
              { value: 'top', label: 'Plan', icon: <PlanIcon size={15} />, show: canPlan },
              { value: 'orbit', label: '3D', icon: <Box size={15} /> },
            ]}
            disabled={inRoom}
            className="views"
          />
          <div className="segmented">
            <WalkButton
              disabled={inRoom}
              onStart={() => onCamera('walk')}
              onDrag={onWalkDrag}
              onDrop={onWalkDrop}
              onCancel={onWalkCancel}
            />
          </div>
        </div>
      </div>
    )}
    {children}
  </div>
)
