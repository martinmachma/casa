import { Copy, RotateCcw, RotateCw, Trash2, X } from 'lucide-react'
import type { FurnitureItem } from '../data/types'
import type { Floor } from '../layout/types'
import { DuplicateToFloor } from './DuplicateToFloor'
import { FURNITURE_SWATCHES } from '../scene/palette'
import { IconButton, PanelHead, Section } from './kit'

type FurnitureGroupEditorProps = {
  items: FurnitureItem[]
  onColor: (color: string) => void
  onRotate: (degrees: number) => void
  onDelete: () => void
  onDuplicate: () => void
  floors: Floor[]
  onDuplicateToFloor: (floorId: string) => void
  /** Narrows the selection to just this piece, to edit it. */
  onPick: (id: string) => void
  /** Takes a piece out of the selection. */
  onRemove: (id: string) => void
  onClose: () => void
}

/** Several pieces selected: what applies to all of them. Names and sizes are per piece, so they're edited one at a time. */
export const FurnitureGroupEditor = ({
  items,
  onColor,
  onRotate,
  onDelete,
  onDuplicate,
  floors,
  onDuplicateToFloor,
  onPick,
  onRemove,
  onClose,
}: FurnitureGroupEditorProps) => {
  const shared = items.every((f) => f.color.toLowerCase() === items[0].color.toLowerCase()) ? items[0].color : undefined
  return (
    <>
      <PanelHead eyebrow="Furniture" title={`${items.length} pieces`} sub="Selected together" onClose={onClose} />

      <Section title="Selected">
        <ul className="item-list">
          {items.map((item) => (
            <li key={item.id} className="item-row">
              <button onClick={() => onPick(item.id)} title="Edit just this one">
                <span className="dot" style={{ background: item.color }} />
                <span className="item-name">{item.name}</span>
              </button>
              <IconButton label="Leave out" small onClick={() => onRemove(item.id)}>
                <X size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Rotation">
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

      <Section title="Colour">
        <div className="swatches">
          {FURNITURE_SWATCHES.map((c) => (
            <button
              key={c}
              className="swatch"
              style={{ background: c }}
              aria-label={c}
              aria-pressed={shared?.toLowerCase() === c}
              onClick={() => onColor(c)}
            />
          ))}
        </div>
      </Section>

      <Section>
        <p className="hint">
          Drag any of them to move the lot; with snapping on, they snap to walls together. <span className="kbd">Shift</span>-tap
          adds or leaves out a piece; a plain tap picks just that one.
        </p>
        <button className="btn btn-block" onClick={onDuplicate}>
          <Copy size={16} />
          Duplicate all
        </button>
        <DuplicateToFloor floors={floors} currentFloor={items[0].floor} onDuplicate={onDuplicateToFloor} />
        <button className="btn btn-danger btn-block" onClick={onDelete}>
          <Trash2 size={16} />
          Remove {items.length} pieces
        </button>
      </Section>
    </>
  )
}
