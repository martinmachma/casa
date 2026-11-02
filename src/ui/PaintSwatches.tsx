import type { ReactNode } from 'react'
import { PAINT_SWATCHES } from '../scene/palette'

/** The paint colours to pick from, plus any colour; `children` go beside the custom colour. */
export const PaintSwatches = ({
  color,
  onColor,
  children,
}: {
  color: string
  onColor: (color: string) => void
  children?: ReactNode
}) => (
  <>
    <div className="swatches">
      {PAINT_SWATCHES.map((c) => (
        <button
          key={c}
          className="swatch"
          style={{ background: c }}
          aria-label={c}
          title={c}
          aria-pressed={color.toLowerCase() === c}
          onClick={() => onColor(c)}
        />
      ))}
    </div>
    <div className="row">
      <label className="color-field">
        <input type="color" value={color} onChange={(e) => onColor(e.target.value)} />
        <span>Custom colour</span>
      </label>
      {children}
    </div>
  </>
)
