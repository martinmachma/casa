import { Eraser, MoveDiagonal, PanelLeftRightDashed, Ruler, X } from 'lucide-react'
import type { MeasureMode } from '../measure/measure'
import { IconButton, Segmented } from './kit'

type MeasurePanelProps = {
  /** Undefined while not measuring: just the ruler. */
  mode: MeasureMode | undefined
  /** Whether there's anything to clear: measurements, or a first tap. */
  canClear: boolean
  onToggle: () => void
  onMode: (mode: MeasureMode) => void
  onClear: () => void
}

/**
 * Bottom centre, beside the sun: a ruler that, while measuring, opens into what to measure between and how to stop. Lengths live on the lines.
 */
export const MeasurePanel = ({ mode, canClear, onToggle, onMode, onClear }: MeasurePanelProps) => {
  if (!mode)
    return (
      <div className="toolbar float">
        <IconButton label="Measure (M)" small onClick={onToggle}>
          <Ruler size={17} />
        </IconButton>
      </div>
    )

  return (
    <div className="toolbar float" data-open="" role="group" aria-label="Measure">
      <Ruler size={17} className="toolbar-icon" />
      <Segmented
        label="Measure between"
        value={mode}
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
  )
}
