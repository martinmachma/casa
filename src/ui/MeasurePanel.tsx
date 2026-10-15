import { Eraser, MoveDiagonal, PanelLeftRightDashed, Ruler, X } from 'lucide-react'
import { distance, formatLength, measuredLine, type MeasureMode, type Measurement } from '../measure/measure'
import { PanelHead, Section, Segmented } from './kit'

type MeasurePanelProps = {
  /** Undefined while not measuring: the box is just its header. */
  measure: Measurement | undefined
  onStart: () => void
  onMode: (mode: MeasureMode) => void
  onClear: () => void
  onClose: () => void
}

const STEPS: Record<MeasureMode, [string, string]> = {
  points: ['Tap the first point (it snaps to walls)', 'Tap the second point'],
  faces: ['Tap a wall or the side of a piece', 'Tap the wall or side opposite'],
}

/** The measure box in the left dock: a toggle, and while measuring, how and what was measured. */
export const MeasurePanel = ({ measure, onStart, onMode, onClear, onClose }: MeasurePanelProps) => {
  const head = (
    <PanelHead
      title="Measure"
      onClose={measure ? onClose : onStart}
      closeLabel={measure ? 'Stop measuring (M)' : 'Measure (M)'}
      closeIcon={measure ? <X size={18} /> : <Ruler size={17} />}
    />
  )
  if (!measure) return head
  const { mode, picks } = measure
  const line = measuredLine(measure)
  const [a, b] = line ? [line.from, line.to] : []
  const diagonal = a && b && mode === 'points' && Math.abs(a[0] - b[0]) > 0.005 && Math.abs(a[1] - b[1]) > 0.005
  const step = (i: number) => (picks.length > i ? 'done' : picks.length === i ? 'current' : 'next')

  return (
    <>
      {head}
      <Section>
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
        <div className="readout" role="status">
          <div className="eyebrow">Distance</div>
          <div className="readout-value" data-empty={a && b ? undefined : ''}>
            {a && b ? formatLength(distance(a, b)) : '–'}
          </div>
          {diagonal && (
            <div className="readout-detail">
              ↔ {formatLength(Math.abs(b[0] - a[0]))} · ↕ {formatLength(Math.abs(b[1] - a[1]))}
            </div>
          )}
          {line && !line.parallel && <div className="readout-detail">These two aren't parallel.</div>}
        </div>
        <ol className="steps">
          {STEPS[mode].map((text, i) => (
            <li key={i} data-step={i + 1} data-state={step(i)}>
              {text}
            </li>
          ))}
        </ol>
        <button className="btn btn-small btn-block" onClick={onClear} disabled={picks.length === 0}>
          <Eraser size={16} />
          Clear
        </button>
      </Section>
    </>
  )
}
