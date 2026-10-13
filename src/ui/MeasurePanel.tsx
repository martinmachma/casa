import { Eraser, MoveDiagonal, PanelLeftRightDashed } from 'lucide-react'
import { distance, formatLength, measuredLine, type MeasureMode, type Measurement } from '../measure/measure'
import { PanelHead, Section, Segmented } from './kit'

type MeasurePanelProps = {
  measure: Measurement
  onMode: (mode: MeasureMode) => void
  onClear: () => void
  onClose: () => void
}

const STEPS: Record<MeasureMode, [string, string]> = {
  points: ['Tap the first point (it snaps to walls)', 'Tap the second point'],
  faces: ['Tap a wall or the side of a piece', 'Tap the wall or side opposite'],
}

export const MeasurePanel = ({ measure, onMode, onClear, onClose }: MeasurePanelProps) => {
  const { mode, picks } = measure
  const line = measuredLine(measure)
  const [a, b] = line ? [line.from, line.to] : []
  const diagonal = a && b && mode === 'points' && Math.abs(a[0] - b[0]) > 0.005 && Math.abs(a[1] - b[1]) > 0.005
  const step = (i: number) => (picks.length > i ? 'done' : picks.length === i ? 'current' : 'next')

  return (
    <>
      <PanelHead eyebrow="Editing" title="Measure" onClose={onClose} closeLabel="Stop measuring" />
      <Section>
        <Segmented
          label="Measure between"
          block
          value={mode}
          onChange={onMode}
          options={[
            { value: 'points', label: 'Point to point', icon: <MoveDiagonal size={15} /> },
            { value: 'faces', label: 'Wall to wall', icon: <PanelLeftRightDashed size={15} /> },
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
        <p className="hint">
          {mode === 'faces'
            ? 'Measures square on from the first wall, so it reads the true gap between two walls or pieces.'
            : 'A third tap starts a new measurement.'}
        </p>
        <button className="btn btn-block" onClick={onClear} disabled={picks.length === 0}>
          <Eraser size={16} />
          Clear
        </button>
      </Section>
    </>
  )
}
