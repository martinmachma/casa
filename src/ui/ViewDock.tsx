import { Box, LogOut, Map as PlanIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Floor } from '../layout/types'
import type { CameraMode } from '../scene/selection'
import { FloorLayers } from './FloorLayers'
import { Segmented } from './kit'
import { WalkButton } from './WalkButton'

type ViewDockProps = {
  floors: Floor[]
  floorIndex: number
  onFloor: (index: number) => void
  /** Looking at the whole house from outside instead of one floor. */
  outside: boolean
  onOutside: () => void
  /** What's on a floor (undefined: the whole house), shown while sliding through them. */
  describeFloor: (floorIndex: number | undefined) => string
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

/** Floats over the left of the 3D view: how to look at it and which floor at the top, its rooms at the bottom. */
export const ViewDock = ({
  floors,
  floorIndex,
  onFloor,
  outside,
  onOutside,
  describeFloor,
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
    {camera !== 'walk' && (
      <FloorLayers
        floors={floors}
        floorIndex={floorIndex}
        outside={outside}
        onFloor={onFloor}
        onOutside={onOutside}
        describe={describeFloor}
        disabled={inRoom}
        label={false}
        open
      />
    )}
    {children}
  </div>
)
