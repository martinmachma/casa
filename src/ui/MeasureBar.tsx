import type { Point } from '../layout/types'
import { distance, formatLength } from '../measure/measure'

type MeasureBarProps = {
  points: Point[]
  onClear: () => void
  onDone: () => void
}

export const MeasureBar = ({ points, onClear, onDone }: MeasureBarProps) => {
  const [a, b] = points
  return (
    <div className="measure-bar" role="status">
      {b ? (
        <span>
          <strong>{formatLength(distance(a, b))}</strong>
          {Math.abs(a[0] - b[0]) > 0.005 && Math.abs(a[1] - b[1]) > 0.005 && (
            <span className="muted">
              {' '}
              · ↔ {formatLength(Math.abs(b[0] - a[0]))} · ↕ {formatLength(Math.abs(b[1] - a[1]))}
            </span>
          )}
        </span>
      ) : (
        <span className="muted">{a ? 'Tap the second point' : 'Tap the first point (snaps to walls)'}</span>
      )}
      {a && (
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
