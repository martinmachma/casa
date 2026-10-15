import { Box, Footprints, Map as PlanIcon, SquareBottomDashedScissors } from 'lucide-react'
import type { ReactNode } from 'react'
import type { CameraMode } from '../scene/selection'
import { IconButton, Segmented } from './kit'

type ViewDockProps = {
  camera: CameraMode
  onCamera: (camera: CameraMode) => void
  /** Walking is for inside a floor. */
  canWalk: boolean
  /** Near walls hidden in the 3D view; offered only there. */
  cutaway: boolean
  onCutaway: (cutaway: boolean) => void
  /** The floating panel under the view switch (rooms, sunlight); absent while tucked away. */
  children?: ReactNode
}

/** Floats over the top left of the 3D view: how to look at the house, and the rooms and sunlight below it. */
export const ViewDock = ({ camera, onCamera, canWalk, cutaway, onCutaway, children }: ViewDockProps) => (
  <div className="dock">
    <div className="dock-bar float">
      <Segmented
        label="View"
        value={camera}
        onChange={onCamera}
        options={[
          { value: 'top', label: 'Plan', icon: <PlanIcon size={15} /> },
          { value: 'orbit', label: '3D', icon: <Box size={15} /> },
          ...(canWalk ? [{ value: 'walk' as const, label: 'Walk', icon: <Footprints size={15} /> }] : []),
        ]}
        className="views"
      />
      {camera === 'orbit' && canWalk && (
        <IconButton
          label={cutaway ? 'Show near walls' : 'Hide near walls'}
          aria-pressed={cutaway}
          small
          onClick={() => onCutaway(!cutaway)}
        >
          <SquareBottomDashedScissors size={16} />
        </IconButton>
      )}
    </div>
    {children && (
      <aside className="dock-panel float" aria-label="Rooms">
        {children}
      </aside>
    )}
  </div>
)
