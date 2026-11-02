import { Eraser, Paintbrush } from 'lucide-react'
import type { Brush } from '../scene/FloorWalls'
import { PanelHead, Section, Segmented } from './kit'
import { PaintSwatches } from './PaintSwatches'

type PaintPanelProps = {
  brush: Brush
  onBrush: (brush: Brush) => void
  onClose: () => void
}

/** The paint tool: pick a colour, then tap walls to paint them or drag across them to paint a rectangle. */
export const PaintPanel = ({ brush, onBrush, onClose }: PaintPanelProps) => (
  <>
    <PanelHead
      eyebrow="Tool"
      title="Paint walls"
      sub={
        brush.erase
          ? 'Tap a painted area to remove it, or a wall to take it back to white.'
          : 'Tap a wall or painted area to paint it. Drag across a wall to paint a rectangle on it.'
      }
      onClose={onClose}
      closeLabel="Stop painting (P)"
    />
    <Section>
      <Segmented
        label="Brush"
        block
        value={brush.erase ? 'erase' : 'paint'}
        onChange={(mode) => onBrush({ ...brush, erase: mode === 'erase' })}
        options={[
          { value: 'paint', label: 'Paint', icon: <Paintbrush size={15} /> },
          { value: 'erase', label: 'Erase', icon: <Eraser size={15} /> },
        ]}
      />
    </Section>
    {!brush.erase && (
      <Section title="Colour">
        <PaintSwatches color={brush.color} onColor={(color) => onBrush({ ...brush, color })} />
      </Section>
    )}
  </>
)
