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
  /** Always show full-size stops on desktop; on a phone they grow while held. */
  open?: boolean
  disabled?: boolean
  /** Whether the floor's name shows beside the strip while it's dragged. */
  label?: boolean
  /** Drawn this many times bigger, from its bottom right corner, for a finger. */
  scale?: number
}

/** Height of each stop along the strip before the phone's scale, in CSS pixels. */
const STEP = 16
const HELD_STEP = 30
const OPEN_STEP = 38
const PAD = 4

/**
 * A vertical floor switch, compact on a phone until held. Sliding through its enlarged stops switches floors;
 * the whole house sits above the top floor.
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
  const step = open ? OPEN_STEP : dragging ? HELD_STEP : STEP
  const centre = (k: number) => PAD + step * k + step / 2

  const go = (k: number) => {
    if (k === last.current) return
    last.current = k
    if (k === 0) onOutside()
    else onFloor(floors.length - k)
    navigator.vibrate?.(8)
  }
  const full = PAD * 2 + step * stops
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const y = (e.clientY - (e.currentTarget.getBoundingClientRect().bottom - full * scale)) / scale
    return Math.max(0, Math.min(stops - 1, Math.round((y - centre(0)) / step)))
  }
  const pick = (e: PointerEvent<HTMLDivElement>) => go(at(e))
  const name = stop === 0 ? 'Whole house' : `${ordinal(floorIndex + 1)} floor`

  return (
    <div
      className={`floor-layers${open ? ' float' : ''}`}
      data-dragging={dragging || undefined}
      data-open={open || undefined}
      data-disabled={disabled || undefined}
    >
      <div
        className={`floor-layers-strip${open ? '' : ' float'}`}
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
        style={{ height: full, scale: scale === 1 ? undefined : String(scale) }}
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
        {Array.from({ length: stops }, (_, k) => (
          <b
            key={k}
            className="floor-layers-cell"
            data-on={k === stop || undefined}
            data-hover={(!dragging && k === hover) || undefined}
            style={{ bottom: full - centre(k) }}
          />
        ))}
        {Array.from({ length: stops }, (_, k) => (
          <span
            key={k}
            className="floor-layers-mark"
            aria-hidden
            data-on={k === stop || undefined}
            data-hover={(!dragging && k === hover) || undefined}
            style={{ bottom: full - centre(k) }}
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
