import { Box, Footprints, House, Map as PlanIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Floor } from '../layout/types'
import type { CameraMode } from '../scene/selection'
import { Segmented } from './kit'

type ViewDockProps = {
  floors: Floor[]
  floorIndex: number
  onFloor: (index: number) => void
  /** Looking at the whole house from outside instead of one floor. */
  outside: boolean
  onOutside: () => void
  camera: CameraMode
  onCamera: (camera: CameraMode) => void
  /** The plan view is for planning; at home there's only 3D and walking. */
  canPlan: boolean
  /** In a room the floor and camera are the room's own, so the switches only show where you are. */
  inRoom: boolean
  /** The rooms, under the switches. */
  children?: ReactNode
}

const OUTSIDE = 'outside'

const ordinal = (n: number) => `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`

/** Floats over the top left of the 3D view: which floor, how to look at it, and its rooms. */
export const ViewDock = ({
  floors,
  floorIndex,
  onFloor,
  outside,
  onOutside,
  camera,
  onCamera,
  canPlan,
  inRoom,
  children,
}: ViewDockProps) => (
  <div className="dock">
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
          ...(canPlan ? [{ value: 'top' as const, label: 'Plan', icon: <PlanIcon size={15} /> }] : []),
          { value: 'orbit', label: '3D', icon: <Box size={15} /> },
          { value: 'walk', label: 'Walk', icon: <Footprints size={15} /> },
        ]}
        disabled={inRoom}
        className="views"
      />
    </div>
    {children}
  </div>
)
