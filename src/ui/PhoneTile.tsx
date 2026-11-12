import { ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { lightColor, type LightState } from '../devices/lights'
import { shadeText, type ShadeState } from '../devices/shades'
import type { SmartItem } from '../rooms/roomItems'
import { DeviceIcon } from './deviceIcons'

/** How long a finger rests on a tile before it opens the item's controls instead of switching it, in ms. */
const HOLD = 450
/** How far a finger moves before it's scrolling the tiles rather than pressing one, in CSS pixels. */
const SLOP = 8

type PhoneTileProps = {
  item: SmartItem
  /** The room it's in, when the tiles are the whole floor's. */
  place: string | undefined
  light?: LightState
  shade?: ShadeState
  onLight: (patch: Partial<LightState>) => void
  onShade: (patch: Partial<ShadeState>) => void
  onOpen: () => void
}

/** A tap switches the item; its arrow (or holding the tile) opens controls without changing its state. */
export const PhoneTile = ({ item, place, light, shade, onLight, onShade, onOpen }: PhoneTileProps) => {
  const on = !!light?.on
  const level = light ? (on ? light.brightness : 0) : shade?.position
  const active = !!level && level > 0.005
  const press = useRef<{ x: number; y: number; timer: number; held: boolean }>(undefined)
  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer)
  }
  useEffect(() => () => window.clearTimeout(press.current?.timer), [])
  const state = light
    ? on
      ? `${Math.round(light.brightness * 100)} %`
      : 'Off'
    : shade
      ? shadeText(shade)
      : item.lamp
        ? 'Lamp'
        : 'Not linked'
  return (
    <div className="phone-tile" data-kind={item.kind} data-on={active || undefined}>
      <button
        className="phone-tile-toggle"
        aria-label={`${item.name}${place ? `, ${place}` : ''}, ${state}`}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          cancel()
          const p = { x: e.clientX, y: e.clientY, held: false, timer: 0 }
          p.timer = window.setTimeout(() => {
            p.held = true
            navigator.vibrate?.(8)
            onOpen()
          }, HOLD)
          press.current = p
        }}
        onPointerMove={(e) => {
          const p = press.current
          if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) cancel()
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onClick={() => {
          if (press.current?.held) return
          if (light) onLight({ on: !on })
          else if (shade) onShade({ position: shade.position > 0 ? 0 : 1 })
          else onOpen()
        }}
      >
        <span className="phone-tile-icon" style={on ? { color: lightColor(light!) } : undefined}>
          <DeviceIcon kind={item.kind} size={19} />
        </span>
        <span className="phone-tile-text">
          <b>{item.name}</b>
          <small>{place ? `${place} · ${state}` : state}</small>
        </span>
      </button>
      <button
        className="phone-tile-open"
        aria-label={`Adjust ${item.name}${place ? `, ${place}` : ''}`}
        onClick={onOpen}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
