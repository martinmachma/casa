import type { FurnitureItem } from '../data/types'
import { FURNITURE_SWATCHES } from '../scene/palette'
import { NumberField } from './NumberField'

type FurnitureEditorProps = {
  item: FurnitureItem
  /** Applies and saves a change. */
  onChange: (patch: Partial<FurnitureItem>) => void
  onRotate: (degrees: number) => void
  onDelete: () => void
  onClose: () => void
}

const cm = (m: number) => Math.round(m * 100)
const degrees = (rad: number) => Math.round(((((rad * 180) / Math.PI) % 360) + 360) % 360)

export const FurnitureEditor = ({ item, onChange, onRotate, onDelete, onClose }: FurnitureEditorProps) => (
  <section className="panel" aria-label="Selected furniture">
    <div className="panel-head">
      <h2>{item.name}</h2>
      <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </div>
    <p className="hint">Drag it on the floor. R / Shift+R rotates, Delete removes.</p>

    <div className="row">
      <label className="field">
        Name
        <input
          // Remount when another item is selected so the field shows its name.
          key={item.id}
          defaultValue={item.name}
          onBlur={(e) =>
            e.target.value.trim() && e.target.value !== item.name && onChange({ name: e.target.value.trim() })
          }
        />
      </label>
    </div>
    <div className="row" key={item.id}>
      <NumberField label="Width cm" value={cm(item.width)} onCommit={(v) => onChange({ width: v / 100 })} />
      <NumberField label="Depth cm" value={cm(item.depth)} onCommit={(v) => onChange({ depth: v / 100 })} />
      <NumberField label="Height cm" value={cm(item.height)} onCommit={(v) => onChange({ height: v / 100 })} />
    </div>

    <div className="row row-wrap">
      <button className="btn btn-icon" onClick={() => onRotate(-15)} aria-label="Rotate 15° left">
        ⟲
      </button>
      <button className="btn btn-icon" onClick={() => onRotate(15)} aria-label="Rotate 15° right">
        ⟳
      </button>
      <button className="btn" onClick={() => onRotate(90)}>
        Turn 90°
      </button>
      <span className="muted">{degrees(item.rotation)}°</span>
    </div>

    {item.model && <p className="hint">Colour changes the upholstery, where there is some.</p>}
    <div className="swatches">
      {FURNITURE_SWATCHES.map((c) => (
        <button
          key={c}
          className="swatch"
          style={{ background: c }}
          aria-label={c}
          aria-pressed={item.color.toLowerCase() === c}
          onClick={() => onChange({ color: c })}
        />
      ))}
    </div>

    <button className="btn btn-danger" onClick={onDelete}>
      Delete
    </button>
  </section>
)
