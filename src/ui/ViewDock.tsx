import { Box, Footprints, Map as PlanIcon, SquareBottomDashedScissors } from 'lucide-react'
import type { CameraMode } from '../scene/selection'
import { IconButton, Segmented } from './kit'

type ViewDockProps = {
  camera: CameraMode
  onCamera: (camera: CameraMode) => void
  /** The plan view is for planning; at home there's only 3D and walking. */
  canPlan: boolean
  /** Walls in front cut down in the 3D view, to see in; offered only there, and not yet from outside. */
  canCut: boolean
  cutaway: boolean
  onCutaway: (cutaway: boolean) => void
}

/** Floats over the top left of the 3D view: how to look at the house. */
export const ViewDock = ({ camera, onCamera, canPlan, canCut, cutaway, onCutaway }: ViewDockProps) => (
  <div className="dock">
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
        className="views"
      />
      {camera === 'orbit' && canCut && (
        <IconButton label="Cut walls" aria-pressed={cutaway} small onClick={() => onCutaway(!cutaway)}>
          <SquareBottomDashedScissors size={16} />
        </IconButton>
      )}
    </div>
  </div>
)
