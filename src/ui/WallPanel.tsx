import { RotateCcw } from 'lucide-react'
import type { WallFace } from '../layout/types'
import { DEFAULT_WALL, PAINT_SWATCHES } from '../scene/palette'
import { PanelHead, Section } from './kit'

type WallPanelProps = {
  side: WallFace
  /** Its size, e.g. "6.03 m centre line · 34 cm thick · 2.68 m high". */
  details: string
  color: string | undefined
  onColor: (color: string | undefined) => void
  onClose: () => void
}

export const WallPanel = ({ side, details, color, onColor, onClose }: WallPanelProps) => {
  const current = color ?? DEFAULT_WALL
  return (
    <>
      <PanelHead
        eyebrow="Wall"
        title={side === 'end' ? 'Wall end' : `Side ${side.toUpperCase()}`}
        sub={details}
        onClose={onClose}
      />
      <Section title="Paint">
        <div className="swatches">
          {PAINT_SWATCHES.map((c) => (
            <button
              key={c}
              className="swatch"
              style={{ background: c }}
              aria-label={c}
              title={c}
              aria-pressed={current.toLowerCase() === c}
              onClick={() => onColor(c)}
            />
          ))}
        </div>
        <div className="row">
          <label className="color-field">
            <input type="color" value={current} onChange={(e) => onColor(e.target.value)} />
            <span>Custom colour</span>
          </label>
          <button className="btn btn-ghost" onClick={() => onColor(undefined)} disabled={!color} title="Back to white">
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </Section>
    </>
  )
}
