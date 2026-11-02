import { RotateCcw, Trash2 } from 'lucide-react'
import type { WallArea } from '../data/types'
import type { WallFace } from '../layout/types'
import { DEFAULT_WALL } from '../scene/palette'
import { PaintSwatches } from './PaintSwatches'
import { PanelHead, Section, Segmented } from './kit'
import { NumberField } from './NumberField'

const WHOLE = 'whole'
// Areas are kept at least this big, metres.
const MIN_SIZE = 0.01

const cm = (m: number) => Math.round(m * 100)

/**
 * The stretch of the picked part you can see, along the wall from its `from` point (across it, on an end), and
 * how high it is. Mirrored when its left end, as you face it, is at `u1`.
 */
export type WallFaceSpan = { u0: number; u1: number; height: number; mirrored: boolean }

type WallPanelProps = {
  side: WallFace
  /** Its size, e.g. "6.03 m centre line · 34 cm thick · 2.68 m high". */
  details: string
  color: string | undefined
  onColor: (color: string | undefined) => void
  face?: WallFaceSpan
  /** The areas painted on this part, in the order they're painted. */
  areas: WallArea[]
  /** The one being edited; none edits the whole part. */
  area: WallArea | undefined
  onSelectArea: (id: string | undefined) => void
  /** Changes with the same `key` undo as one step. */
  onPatchArea: (patch: Partial<WallArea>, key: string) => void
  onRemoveArea: () => void
  onClose: () => void
}

/** Where an area is as you face it: from the left end of the part you can see, and from the floor. */
const placement = (area: WallArea, face: WallFaceSpan) => ({
  left: face.mirrored ? face.u1 - area.u1 : area.u0 - face.u0,
  width: area.u1 - area.u0,
  bottom: area.y0,
  height: area.y1 - area.y0,
})

/** An area placed as you face it, kept on the part. */
const place = (
  face: WallFaceSpan,
  { left, width, bottom, height }: ReturnType<typeof placement>,
): Partial<WallArea> => {
  const span = face.u1 - face.u0
  const l = Math.min(Math.max(left, 0), span - MIN_SIZE)
  const w = Math.min(Math.max(width, MIN_SIZE), span - l)
  const b = Math.min(Math.max(bottom, 0), face.height - MIN_SIZE)
  const h = Math.min(Math.max(height, MIN_SIZE), face.height - b)
  const u0 = face.mirrored ? face.u1 - l - w : face.u0 + l
  return { u0, u1: u0 + w, y0: b, y1: b + h }
}

export const WallPanel = ({
  side,
  details,
  color,
  onColor,
  face,
  areas,
  area,
  onSelectArea,
  onPatchArea,
  onRemoveArea,
  onClose,
}: WallPanelProps) => {
  const current = area?.color ?? color ?? DEFAULT_WALL
  const paint = (c: string) => (area ? onPatchArea({ color: c }, 'color') : onColor(c))
  const at = area && face && placement(area, face)
  const move = (patch: Partial<NonNullable<typeof at>>, key: string) =>
    area && face && at && onPatchArea(place(face, { ...at, ...patch }), key)
  return (
    <>
      <PanelHead
        eyebrow="Wall"
        title={side === 'end' ? 'Wall end' : `Side ${side.toUpperCase()}`}
        sub={details}
        onClose={onClose}
      />
      {/* Areas are painted with the paint tool, by dragging across the wall. */}
      {face && areas.length > 0 && (
        <Section title="Paint on">
          <Segmented
            label="Paint on"
            value={area?.id ?? WHOLE}
            options={[
              { value: WHOLE, label: 'Whole wall' },
              ...areas.map((a, i) => ({ value: a.id, label: `Area ${i + 1}` })),
            ]}
            onChange={(id) => onSelectArea(id === WHOLE ? undefined : id)}
            className="segmented-wrap"
          />
        </Section>
      )}
      <Section title="Paint">
        <PaintSwatches color={current} onColor={paint}>
          {!area && (
            <button
              className="btn btn-ghost"
              onClick={() => onColor(undefined)}
              disabled={!color}
              title="Back to white"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          )}
        </PaintSwatches>
      </Section>
      {area && at && face && (
        <Section title="Area">
          {/* Remount when another area is picked or this one changes, so the fields show its values. */}
          <div className="row" key={`${area.id}:u:${area.u0}:${area.u1}`}>
            <NumberField
              label="From left cm"
              min={0}
              value={cm(at.left)}
              onCommit={(v) => move({ left: v / 100 }, 'left')}
            />
            <NumberField label="Width cm" value={cm(at.width)} onCommit={(v) => move({ width: v / 100 }, 'width')} />
          </div>
          <div className="row" key={`${area.id}:y:${area.y0}:${area.y1}`}>
            <NumberField
              label="From floor cm"
              min={0}
              value={cm(at.bottom)}
              onCommit={(v) => move({ bottom: v / 100 }, 'bottom')}
            />
            <NumberField
              label="Height cm"
              value={cm(at.height)}
              onCommit={(v) => move({ height: v / 100 }, 'height')}
            />
          </div>
          <div className="row">
            <button className="btn btn-small" onClick={() => move({ left: 0, width: face.u1 - face.u0 }, 'full-width')}>
              Full width
            </button>
            <button className="btn btn-small" onClick={() => move({ bottom: 0, height: face.height }, 'full-height')}>
              Full height
            </button>
          </div>
          <p className="muted">Measured as you face it, from its left edge.</p>
          <button className="btn btn-danger btn-block" onClick={onRemoveArea}>
            <Trash2 size={16} />
            Remove area
          </button>
        </Section>
      )}
    </>
  )
}
