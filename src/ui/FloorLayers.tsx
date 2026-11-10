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
  /** Whether the floor's name shows beside the strip while it's dragged. */
  label?: boolean
  /** Drawn this many times bigger, from its bottom right corner, for a finger. */
  scale?: number
}

/** Height of each stop along the strip, in CSS pixels: closed, and spread out for good. */
const STEP = 23
const OPEN_STEP = 40
const PAD = 4
/** Closed, how far apart the slabs sit, and the house above the top one. */
const GAP = 10
const HOUSE_GAP = 13

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
  scale = 1,
  label = true,
}: FloorLayersProps) => {
  // Stop 0 is the whole house, then the floors from the top down.
  const stops = floors.length + 1
  const stop = outside ? 0 : floors.length - floorIndex
  const [dragging, setDragging] = useState(false)
  // The stop under a mouse that isn't dragging, lit up so a click's target shows.
  const [hover, setHover] = useState<number>()
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
  // Closed, the strip is only as tall as the house and the slabs stacked close together; a drag grows it upwards and spreads them out onto their stops.
  const spread = open || dragging
  const cluster = HOUSE_GAP + (stops - 2) * GAP
  const full = PAD * 2 + step * stops
  const height = spread ? full : cluster + 29
  // The strip keeps its bottom, so a stop's place in the full strip is that much further down than in this one.
  const shift = full - height
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const y = (e.clientY - (e.currentTarget.getBoundingClientRect().bottom - full * scale)) / scale
    return Math.max(0, Math.min(stops - 1, Math.round((y - centre(0)) / step)))
  }
  const pick = (e: PointerEvent<HTMLDivElement>) => go(at(e))
  const place = (k: number) => centre(k) - shift
  const slabTop = (k: number) => (spread ? centre(k) : 14.5 + (k === 0 ? 0 : HOUSE_GAP + (k - 1) * GAP))
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
        style={{ height, scale: scale === 1 ? undefined : String(scale) }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          last.current = stop
          setDragging(true)
          pick(e)
        }}
        onPointerMove={(e) => {
          if (dragging) pick(e)
          else if (e.pointerType === 'mouse') setHover(at(e))
        }}
        onPointerLeave={() => setHover(undefined)}
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
          <b
            key={k}
            className="floor-layers-cell"
            data-on={k === stop || undefined}
            data-hover={(!dragging && k === hover) || undefined}
            style={{ top: place(k) }}
          />
        ))}
        {floors.map((f, i) => {
          const k = floors.length - i
          return (
            <i
              key={f.id}
              className="floor-layers-slab"
              data-on={k === stop || undefined}
              data-all={stop === 0 || undefined}
              data-hover={(!dragging && k === hover) || undefined}
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
            data-hover={(!dragging && k === hover) || undefined}
            style={{ top: slabTop(k) }}
          >
            {k === 0 ? <House size={open ? 17 : dragging ? 15 : 13} /> : floors.length - k + 1}
          </span>
        ))}
      </div>
      {dragging && label && (
        <div className="floor-layers-label float" style={{ top: full - (full - centre(stop)) * scale }}>
          <b>{name}</b>
          <span>{describe(stop === 0 ? undefined : floorIndex)}</span>
        </div>
      )}
    </div>
  )
}
