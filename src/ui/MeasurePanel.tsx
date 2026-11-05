import { Eraser, MoveDiagonal, PanelLeftRightDashed, Ruler, X } from 'lucide-react'
import type { MeasureMode } from '../measure/measure'
import { IconButton, Segmented, Slide } from './kit'

type MeasurePanelProps = {
  /** Undefined while not measuring: just the ruler. */
  mode: MeasureMode | undefined
  /** Whether there's anything to clear: measurements, or a first tap. */
  canClear: boolean
  onToggle: () => void
  onMode: (mode: MeasureMode) => void
  onClear: () => void
}

/** A ruler that, while measuring, opens into what to measure between and how to stop. Lengths live on the lines. */
export const MeasurePanel = ({ mode, canClear, onToggle, onMode, onClear }: MeasurePanelProps) => (
  <div className="toolbar float" role="group" aria-label="Measure">
    <IconButton label="Measure (M)" small aria-pressed={!!mode} onClick={onToggle}>
      <Ruler size={17} />
    </IconButton>
    <Slide show={!!mode}>
      <div className="toolbar-more">
        <Segmented
          label="Measure between"
          value={mode ?? 'points'}
          onChange={onMode}
          options={[
            { value: 'points', label: 'Points', icon: <MoveDiagonal size={15} /> },
            { value: 'faces', label: 'Walls', icon: <PanelLeftRightDashed size={15} /> },
          ]}
        />
        <IconButton label="Clear all" small onClick={onClear} disabled={!canClear}>
          <Eraser size={16} />
        </IconButton>
        <IconButton label="Stop measuring (M)" small onClick={onToggle}>
          <X size={16} />
        </IconButton>
      </div>
    </Slide>
  </div>
)
