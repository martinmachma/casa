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
  /** The floating boxes under the view switch (rooms, sunlight, measure). */
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
    {children}
  </div>
)

type DockBoxProps = { label: string; grow?: boolean; children: ReactNode }

/** One floating box in the dock; `grow` lets a long list take the leftover height and scroll. */
export const DockBox = ({ label, grow, children }: DockBoxProps) => (
  <aside className="dock-panel float" data-grow={grow ? '' : undefined} aria-label={label}>
    {children}
  </aside>
)
