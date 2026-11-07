import { ArrowDown, ArrowUp, Power } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { lightColor, type LightState } from '../devices/lights'
import { shadeText, type ShadeState } from '../devices/shades'
import type { SmartItem } from '../rooms/roomItems'
import { DeviceIcon } from './deviceIcons'

/** How far a press moves along a row before it's a drag rather than a click. */
const DRAG_START = 4

type SmartRowProps = {
  item: SmartItem
  /** Its settings, for a light. */
  light?: LightState
  /** Its position, for a window's shade. */
  shade?: ShadeState
  /** Its item is pointed at in the scene. */
  hovered?: boolean
  onOpen: () => void
  onHover: (hovering: boolean) => void
  onLight: (patch: Partial<LightState>) => void
  onShade: (patch: Partial<ShadeState>) => void
}

/** The colour a light gives off, by its level. */
export const LightDot = ({ light }: { light: LightState }) => (
  <span className="smart-row-dot" style={{ background: lightColor(light) }} />
)

/** One smart item, filled as far as it's lit or let down: its tile switches it, the rest of the row opens it, and a drag along the row sets the level. */
const SmartRow = ({ item, light, shade, hovered, onOpen, onHover, onLight, onShade }: SmartRowProps) => {
  const on = !!light?.on
  const level = light ? (on ? light.brightness : 0) : shade?.position
  const active = !!level && level > 0.005
  const press = useRef<{ x: number; from: number; width: number }>(undefined)
  const dragged = useRef(false)
  const [dragging, setDragging] = useState(false)
  const setLevel = (to: number) => {
    if (shade) onShade({ position: to })
    else onLight(to > 0.005 ? { on: true, brightness: to } : { on: false })
  }
  const release = () => {
    press.current = undefined
    setDragging(false)
  }
  const icon = (
    <span className="smart-tile" data-on={active || undefined}>
      <span className="smart-row-device">
        <DeviceIcon kind={item.kind} size={15} />
      </span>
      {light && <Power className="smart-row-action" size={15} />}
      {shade &&
        (shade.position > 0 ? (
          <ArrowUp className="smart-row-action" size={15} />
        ) : (
          <ArrowDown className="smart-row-action" size={15} />
        ))}
    </span>
  )
  return (
    <li
      className="smart-row"
      data-kind={item.kind}
      data-on={active || undefined}
      data-hovered={hovered || undefined}
      data-dragging={dragging || undefined}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onPointerDown={(e) => {
        dragged.current = false
        if (level !== undefined && e.button === 0)
          press.current = { x: e.clientX, from: level, width: e.currentTarget.offsetWidth }
      }}
      onPointerMove={(e) => {
        const p = press.current
        if (!p) return
        if (!e.buttons) return release()
        const moved = e.clientX - p.x
        if (!dragged.current) {
          if (Math.abs(moved) < DRAG_START) return
          dragged.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          setDragging(true)
        }
        setLevel(Math.min(1, Math.max(0, p.from + moved / p.width)))
      }}
      onPointerUp={release}
      onPointerCancel={release}
      // The click that ends a drag isn't a click on the row.
      onClickCapture={(e) => {
        if (dragged.current) e.stopPropagation()
        dragged.current = false
      }}
    >
      {level !== undefined && <span className="smart-row-fill" style={{ width: `${level * 100}%` }} />}
      {light || shade ? (
        <button
          className="smart-row-toggle"
          aria-label={
            light
              ? `Switch ${item.name} ${on ? 'off' : 'on'}`
              : `${shade!.position > 0 ? 'Raise' : 'Lower'} ${item.name}`
          }
          title={light ? (on ? 'Switch off' : 'Switch on') : shade!.position > 0 ? 'Raise' : 'Lower'}
          onClick={() => (light ? onLight({ on: !on }) : onShade({ position: shade!.position > 0 ? 0 : 1 }))}
        >
          {icon}
        </button>
      ) : (
        <span className="smart-row-toggle">{icon}</span>
      )}
      <button className="smart-row-open" title={item.name} onClick={onOpen}>
        <span className="smart-row-name">{item.name}</span>
        <span className="smart-row-state">
          {on && <LightDot light={light!} />}
          {light
            ? on
              ? `${Math.round(light.brightness * 100)} %`
              : 'Off'
            : shade
              ? shadeText(shade)
              : item.lamp
                ? 'Lamp'
                : 'Not linked'}
        </span>
      </button>
    </li>
  )
}

type SmartRowsProps = {
  items: SmartItem[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  shade: (id: string) => ShadeState
  onShade: (id: string, patch: Partial<ShadeState>) => void
  onOpen: (id: string) => void
  onHover: (id: string | undefined) => void
  /** The item pointed at, here or in the view. */
  hovered: string | undefined
}

/** A list of smart items, each kind together: lights and shades tell themselves apart by their icons. */
export const SmartRows = ({ items, light, onLight, shade, onShade, onOpen, onHover, hovered }: SmartRowsProps) => (
  <ul className="smart-rows">
    {[...new Set(items.map((i) => i.kind))]
      .flatMap((kind) => items.filter((i) => i.kind === kind))
      .map((item) => (
        <SmartRow
          key={item.id}
          item={item}
          light={item.kind === 'light' ? light(item.id) : undefined}
          shade={item.kind === 'blind' ? shade(item.id) : undefined}
          hovered={hovered === item.id}
          onOpen={() => onOpen(item.id)}
          onHover={(h) => onHover(h ? item.id : undefined)}
          onLight={(p) => onLight(item.id, p)}
          onShade={(p) => onShade(item.id, p)}
        />
      ))}
  </ul>
)

/** A card down the side of the view: its small header stays put while what's under it scrolls. */
export const SmartCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="room-card float">
    <h3 className="smart-card-head">{title}</h3>
    <div className="smart-card-body">{children}</div>
  </section>
)

type SmartTagProps = {
  item: SmartItem
  light?: LightState
  shade?: ShadeState
  onOpen: () => void
  onHover: (hovering: boolean) => void
}

/** The line from an item to its tag, or to the card the tag opens into: it leaves at an angle, then runs flat. */
export const TagLine = ({ reach = 0 }: { reach?: number }) => (
  // Straight up from just above the item to the tag's foot, then across to an open card.
  <svg className="smart-tag-line" width={4 + reach} height="32" viewBox={`-2 -32 ${4 + reach} 32`} aria-hidden>
    <polyline points={`0,-6 0,-30${reach ? ` ${reach},-30` : ''}`} />
  </svg>
)

const RING = 2 * Math.PI * 12

/** The tag over an item in the room's view: just its icon, lit in a light's colour, in a dark ring with an arc as far
    round as a light is bright, in its colour, or as far as a shade is down. */
export const SmartTag = ({ item, light, shade, onOpen, onHover }: SmartTagProps) => {
  const on = !!light?.on
  const level = light ? (on ? light.brightness : 0) : shade?.position
  return (
    <>
      <TagLine />
      <button
        className="smart-tag"
        data-off={(light && !on) || undefined}
        data-ring={level !== undefined || undefined}
        aria-label={
          light
            ? `${item.name}, ${on ? `${Math.round(light.brightness * 100)} %` : 'off'}`
            : shade
              ? `${item.name}, ${shadeText(shade)}`
              : item.name
        }
        onClick={onOpen}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
      >
        <span className="smart-tag-icon" style={on ? { background: lightColor(light) } : undefined}>
          {level !== undefined && (
            <svg className="smart-tag-ring" width="26" height="26" viewBox="0 0 26 26" aria-hidden>
              <circle cx="13" cy="13" r="12" />
              {level > 0.005 && (
                <circle
                  cx="13"
                  cy="13"
                  r="12"
                  style={on ? { stroke: lightColor(light) } : undefined}
                  strokeDasharray={`${level * RING} ${RING}`}
                />
              )}
            </svg>
          )}
          <DeviceIcon kind={item.kind} size={12} />
        </span>
      </button>
    </>
  )
}
