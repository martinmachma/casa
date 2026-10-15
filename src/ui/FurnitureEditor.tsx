import { Copy, RotateCcw, RotateCw, Trash2 } from 'lucide-react'
import type { FurnitureItem } from '../data/types'
import { FURNITURE_SWATCHES } from '../scene/palette'
import { NumberField } from './NumberField'
import { PanelHead, Section } from './kit'

type FurnitureEditorProps = {
  item: FurnitureItem
  /** Applies and saves a change. */
  onChange: (patch: Partial<FurnitureItem>) => void
  onRotate: (degrees: number) => void
  onDelete: () => void
  onDuplicate: () => void
  onClose: () => void
}

const cm = (m: number) => Math.round(m * 100)
const degrees = (rad: number) => Math.round(((((rad * 180) / Math.PI) % 360) + 360) % 360)

export const FurnitureEditor = ({ item, onChange, onRotate, onDelete, onDuplicate, onClose }: FurnitureEditorProps) => (
  <>
    <PanelHead
      eyebrow="Furniture"
      title={item.name}
      sub={`${cm(item.width)} × ${cm(item.depth)} × ${cm(item.height)} cm`}
      onClose={onClose}
    />

    <Section>
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
      <div className="row" key={item.id}>
        <NumberField label="Width cm" value={cm(item.width)} onCommit={(v) => onChange({ width: v / 100 })} />
        <NumberField label="Depth cm" value={cm(item.depth)} onCommit={(v) => onChange({ depth: v / 100 })} />
        <NumberField label="Height cm" value={cm(item.height)} onCommit={(v) => onChange({ height: v / 100 })} />
      </div>
      <div className="row" key={`${item.id}:z`}>
        <NumberField
          label="Above floor cm"
          value={cm(item.z ?? 0)}
          min={0}
          onCommit={(v) => onChange({ z: v ? v / 100 : undefined })}
        />
      </div>
    </Section>

    <Section title="Rotation" aside={<span className="muted num">{degrees(item.rotation)}°</span>}>
      <div className="row">
        <button className="btn" onClick={() => onRotate(-15)} title="Rotate 15° left (Shift+R)">
          <RotateCcw size={16} />
          15°
        </button>
        <button className="btn" onClick={() => onRotate(15)} title="Rotate 15° right (R)">
          <RotateCw size={16} />
          15°
        </button>
        <button className="btn" onClick={() => onRotate(90)}>
          Turn 90°
        </button>
      </div>
    </Section>

    <Section title={item.model ? 'Upholstery' : 'Colour'}>
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
    </Section>

    <Section>
      <p className="hint">
        Drag it around; raise it off the floor to hang it on a wall. <span className="kbd">R</span> rotates,{' '}
        <span className="kbd">⌘D</span> duplicates, <span className="kbd">Del</span> removes.
      </p>
      <button className="btn btn-block" onClick={onDuplicate}>
        <Copy size={16} />
        Duplicate
      </button>
      <button className="btn btn-danger btn-block" onClick={onDelete}>
        <Trash2 size={16} />
        Remove from the house
      </button>
    </Section>
  </>
)
