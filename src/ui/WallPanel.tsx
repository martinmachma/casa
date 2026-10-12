import type { WallSide } from '../layout/types'
import { DEFAULT_WALL, PAINT_SWATCHES } from '../scene/palette'

type WallPanelProps = {
  wallId: string
  side: WallSide
  /** Its size, e.g. "6.03 m centre line · 34 cm thick · 2.68 m high". */
  details: string
  color: string | undefined
  onColor: (color: string | undefined) => void
  onFlip: () => void
  onClose: () => void
}

export const WallPanel = ({ wallId, side, details, color, onColor, onFlip, onClose }: WallPanelProps) => {
  const current = color ?? DEFAULT_WALL
  return (
    <section className="panel" aria-label="Wall colour">
      <div className="panel-head">
        <h2>Wall colour</h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <p className="hint">
        {wallId} · side {side.toUpperCase()}
        <br />
        {details}
      </p>
      <div className="swatches">
        {PAINT_SWATCHES.map((c) => (
          <button
            key={c}
            className="swatch"
            style={{ background: c }}
            aria-label={c}
            aria-pressed={current.toLowerCase() === c}
            onClick={() => onColor(c)}
          />
        ))}
      </div>
      <div className="row">
        <label className="field">
          Any colour
          <input type="color" value={current} onChange={(e) => onColor(e.target.value)} />
        </label>
      </div>
      <div className="row row-wrap">
        <button className="btn" onClick={onFlip}>
          Other side
        </button>
        <button className="btn btn-ghost" onClick={() => onColor(undefined)} disabled={!color}>
          Reset
        </button>
      </div>
    </section>
  )
}
