import { House } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'
import type { Floor } from '../layout/types'
import { ordinal } from './ordinal'

type FloorLayersProps = {
  floors: Floor[]
  floorIndex: number
  outside: boolean
  onFloor: (index: number) => void
  onOutside: () => void
  /** What's shown under a stop's name while dragging: undefined is the whole house. */
  describe: (floorIndex: number | undefined) => string
  /** Always spread out with every floor's number on its slab, as on a desktop; otherwise it opens while dragged. */
  open?: boolean
  disabled?: boolean
}

/** Height of each stop along the strip, in CSS pixels: closed, and spread out for good. */
const STEP = 20
const OPEN_STEP = 30
const PAD = 4

/**
 * The floors as a small stack of slabs at the edge of the view, in the order they stack. A thumb slid up and down it
 * goes through them as it passes each one, with the floor's name beside it; above the top floor is the whole house.
 */
export const FloorLayers = ({
  floors,
  floorIndex,
  outside,
  onFloor,
  onOutside,
  describe,
  open = false,
  disabled = false,
}: FloorLayersProps) => {
  // Stop 0 is the whole house, then the floors from the top down.
  const stops = floors.length + 1
  const stop = outside ? 0 : floors.length - floorIndex
  const [dragging, setDragging] = useState(false)
  // The stop the thumb last went to, so a drag switches once per stop it passes.
  const last = useRef(stop)
  const step = open ? OPEN_STEP : STEP
  const centre = (k: number) => PAD + step * k + step / 2

  const go = (k: number) => {
    if (k === last.current) return
    last.current = k
    if (k === 0) onOutside()
    else onFloor(floors.length - k)
    navigator.vibrate?.(8)
  }
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    go(Math.max(0, Math.min(stops - 1, Math.round((y - centre(0)) / step))))
  }

  // Closed, the slabs sit close together in the middle of the floors' stops; a drag spreads them out onto their stops.
  const spread = open || dragging
  const middle = (centre(1) + centre(stops - 1)) / 2
  const slabTop = (k: number) => (spread ? centre(k) : middle + (k - stops / 2) * 7)
  const name = stop === 0 ? 'Whole house' : `${ordinal(floorIndex + 1)} floor`

  return (
    <div
      className="floor-layers"
      data-dragging={dragging || undefined}
      data-open={open || undefined}
      data-disabled={disabled || undefined}
    >
      <div
        className="floor-layers-strip"
        role="slider"
        aria-label="Floor"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={stops - 1}
        aria-valuenow={stops - 1 - stop}
        aria-valuetext={name}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        data-dragging={dragging || undefined}
        style={{ height: PAD * 2 + step * stops }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          last.current = stop
          setDragging(true)
          pick(e)
        }}
        onPointerMove={(e) => dragging && pick(e)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(e) => {
          last.current = stop
          if (e.key === 'ArrowUp' && stop > 0) go(stop - 1)
          else if (e.key === 'ArrowDown' && stop < stops - 1) go(stop + 1)
          else return
          e.preventDefault()
        }}
      >
        {/* Spread out, each stop's place shows as a faint cell, so the layers can be told apart. */}
        {Array.from({ length: stops }, (_, k) => (
          <b key={k} className="floor-layers-cell" data-on={k === stop || undefined} style={{ top: centre(k) }} />
        ))}
        {floors.map((f, i) => {
          const k = floors.length - i
          return (
            <i
              key={f.id}
              className="floor-layers-slab"
              data-on={k === stop || undefined}
              data-all={stop === 0 || undefined}
              style={{ top: slabTop(k) }}
            />
          )
        })}
        {/* Each floor's number sits on its slab; the whole house, which has no slab of its own, is the house. */}
        {Array.from({ length: stops }, (_, k) => (
          <span
            key={k}
            className="floor-layers-mark"
            aria-hidden
            data-on={k === stop || undefined}
            style={{ top: centre(k) }}
          >
            {k === 0 ? <House size={13} /> : floors.length - k + 1}
          </span>
        ))}
      </div>
      {dragging && (
        <div className="floor-layers-label float" style={{ top: centre(stop) }}>
          <b>{name}</b>
          <span>{describe(stop === 0 ? undefined : floorIndex)}</span>
        </div>
      )}
    </div>
  )
}
