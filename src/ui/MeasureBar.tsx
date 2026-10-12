import { distance, formatLength, measuredLine, type MeasureMode, type Measurement } from '../measure/measure'

type MeasureBarProps = {
  measure: Measurement
  onMode: (mode: MeasureMode) => void
  onClear: () => void
  onDone: () => void
}

const PROMPTS: Record<MeasureMode, [string, string]> = {
  points: ['Tap the first point (snaps to walls)', 'Tap the second point'],
  faces: ['Tap a wall or the side of a piece', 'Tap the other wall or side'],
}

export const MeasureBar = ({ measure, onMode, onClear, onDone }: MeasureBarProps) => {
  const { mode, picks } = measure
  const line = measuredLine(measure)
  const [a, b] = line ? [line.from, line.to] : []
  return (
    <div className="measure-bar" role="status">
      <div className="segmented" role="group" aria-label="Measure between">
        <button aria-pressed={mode === 'points'} onClick={() => onMode('points')} title="Point to point">
          Points
        </button>
        <button aria-pressed={mode === 'faces'} onClick={() => onMode('faces')} title="Wall to wall, square on">
          Faces
        </button>
      </div>
      {a && b ? (
        <span>
          <strong>{formatLength(distance(a, b))}</strong>
          {mode === 'points' && Math.abs(a[0] - b[0]) > 0.005 && Math.abs(a[1] - b[1]) > 0.005 && (
            <span className="muted">
              {' '}
              · ↔ {formatLength(Math.abs(b[0] - a[0]))} · ↕ {formatLength(Math.abs(b[1] - a[1]))}
            </span>
          )}
          {!line?.parallel && <span className="muted"> · not parallel</span>}
        </span>
      ) : (
        <span className="muted">{PROMPTS[mode][picks.length]}</span>
      )}
      {picks.length > 0 && (
        <button className="btn btn-ghost" onClick={onClear}>
          Clear
        </button>
      )}
      <button className="btn" onClick={onDone}>
        Done
      </button>
    </div>
  )
}
