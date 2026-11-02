import { Eraser, Paintbrush } from 'lucide-react'
import type { Brush } from '../scene/FloorWalls'
import { PanelHead, Section, Segmented } from './kit'
import { PaintSwatches } from './PaintSwatches'

type PaintPanelProps = {
  brush: Brush
  onBrush: (brush: Brush) => void
  onClose: () => void
}

// How big the squares painted with one tap are, metres.
const SIZES = [0.05, 0.1, 0.25, 0.5]

/** The paint tool: pick a colour, then tap a wall to paint a square of it or drag to paint a block of squares. */
export const PaintPanel = ({ brush, onBrush, onClose }: PaintPanelProps) => (
  <>
    <PanelHead
      eyebrow="Tool"
      title="Paint walls"
      sub={
        brush.erase
          ? 'Tap or drag to take paint off in squares. Shift-tap takes a whole wall back to white.'
          : 'Tap a wall to paint a square, drag to paint a block of them. Shift-tap paints the whole wall.'
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
    <Section title="Square">
      <Segmented
        label="Square size"
        block
        value={String(brush.size)}
        onChange={(size) => onBrush({ ...brush, size: Number(size) })}
        options={SIZES.map((s) => ({ value: String(s), label: `${Math.round(s * 100)} cm` }))}
      />
    </Section>
    {!brush.erase && (
      <Section title="Colour">
        <PaintSwatches color={brush.color} onColor={(color) => onBrush({ ...brush, color })} />
      </Section>
    )}
  </>
)
