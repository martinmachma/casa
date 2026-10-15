import { Eraser, MoveDiagonal, PanelLeftRightDashed, Ruler, X } from 'lucide-react'
import type { MeasureMode } from '../measure/measure'
import { IconButton, PanelHead, Section, Segmented } from './kit'

type MeasurePanelProps = {
  /** Undefined while not measuring: the box is just its header. */
  mode: MeasureMode | undefined
  /** Whether there's anything to clear: measurements, or a first tap. */
  canClear: boolean
  onStart: () => void
  onMode: (mode: MeasureMode) => void
  onClear: () => void
  onClose: () => void
}

/** The measure box in the left dock: a toggle, and while measuring, what to measure between. Lengths live on the lines. */
export const MeasurePanel = ({ mode, canClear, onStart, onMode, onClear, onClose }: MeasurePanelProps) => {
  const head = (
    <PanelHead
      title="Measure"
      onClose={mode ? onClose : onStart}
      closeLabel={mode ? 'Stop measuring (M)' : 'Measure (M)'}
      closeIcon={mode ? <X size={18} /> : <Ruler size={17} />}
    />
  )
  if (!mode) return head

  return (
    <>
      {head}
      <Section>
        <div className="measure-row">
          <Segmented
            label="Measure between"
            block
            value={mode}
            onChange={onMode}
            options={[
              { value: 'points', label: 'Points', icon: <MoveDiagonal size={15} /> },
              { value: 'faces', label: 'Walls', icon: <PanelLeftRightDashed size={15} /> },
            ]}
          />
          <IconButton label="Clear all" onClick={onClear} disabled={!canClear}>
            <Eraser size={16} />
          </IconButton>
        </div>
      </Section>
    </>
  )
}
