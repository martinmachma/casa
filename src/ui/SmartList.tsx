import { Power } from 'lucide-react'
import type { ReactNode } from 'react'
import { lightColor, type LightState } from '../devices/lights'
import { shadeText, type ShadeState } from '../devices/shades'
import type { SmartItem } from '../rooms/roomItems'
import { DeviceIcon } from './deviceIcons'

type SmartRowProps = {
  item: SmartItem
  sub?: string
  /** Its settings, for a light. */
  light?: LightState
  pressed?: boolean
  /** Its item is pointed at in the scene. */
  hovered?: boolean
  onOpen: () => void
  onHover?: (hovering: boolean) => void
  onLight?: (patch: Partial<LightState>) => void
}

/** One smart item: its tile lit in the light's own colour while on, and a switch for a light. */
export const SmartRow = ({ item, sub, light, pressed, hovered, onOpen, onHover, onLight }: SmartRowProps) => {
  const on = !!light?.on
  return (
    <li
      className="smart-row"
      data-hovered={hovered || undefined}
      onPointerEnter={() => onHover?.(true)}
      onPointerLeave={() => onHover?.(false)}
    >
      <button className="smart-item" aria-pressed={pressed} onClick={onOpen}>
        <span
          className="smart-tile"
          data-on={on || undefined}
          style={on ? { background: lightColor(light) } : undefined}
        >
          <DeviceIcon kind={item.kind} size={16} />
        </span>
        <span className="smart-item-text">
          <span className="smart-item-name">{item.name}</span>
          {sub && <span className="muted">{sub}</span>}
        </span>
      </button>
      {light && onLight && (
        <label className="switch smart-switch">
          <input
            type="checkbox"
            role="switch"
            aria-label={`${item.name} on`}
            checked={on}
            onChange={(e) => onLight({ on: e.target.checked })}
          />
          <span className="switch-track" aria-hidden />
        </label>
      )}
    </li>
  )
}

type SmartTileProps = {
  item: SmartItem
  /** Its settings, for a light: a tap switches it. */
  light?: LightState
  /** Its position, for a window's shade. */
  shade?: ShadeState
  /** Its card is open. */
  pressed?: boolean
  /** Its item is pointed at in the scene. */
  hovered?: boolean
  /** Opens its card: a tap for anything but a light, a right-click for a light. */
  onOpen: () => void
  onHover: (hovering: boolean) => void
  onLight: (patch: Partial<LightState>) => void
}

/** A smart item as a tile: its icon, lit in the light's colour while on, over its name and state. */
export const SmartTile = ({ item, light, shade, pressed, hovered, onOpen, onHover, onLight }: SmartTileProps) => {
  const on = !!light?.on
  return (
    <button
      className="smart-light"
      aria-pressed={light ? on : undefined}
      data-open={pressed || undefined}
      data-hovered={hovered || undefined}
      title={light ? `${item.name}: click to switch, right-click for brightness and colour` : item.name}
      onClick={() => (light ? onLight({ on: !on }) : onOpen())}
      onContextMenu={(e) => {
        e.preventDefault()
        onOpen()
      }}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      <span
        className="smart-light-bulb"
        data-on={on || undefined}
        style={on ? { background: lightColor(light) } : undefined}
      >
        <DeviceIcon kind={item.kind} size={18} />
      </span>
      <span className="smart-light-name">{item.name}</span>
      <span className="smart-light-state">
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
  )
}

type SmartCardProps = {
  title: string
  summary: string
  /** Switches every light off, or on when all are off; left out when there are none. */
  allLights?: { on: boolean; onChange: (on: boolean) => void }
  children: ReactNode
}

/** The card down the right that lists smart items, with a switch for all the lights. */
export const SmartCard = ({ title, summary, allLights, children }: SmartCardProps) => (
  <section className="room-card float">
    <header className="smart-card-head">
      <div>
        <h3 className="smart-card-title">{title}</h3>
        <div className="muted">{summary}</div>
      </div>
      {allLights && (
        <button className="btn btn-small" onClick={() => allLights.onChange(!allLights.on)}>
          <Power size={15} />
          {allLights.on ? 'All off' : 'All on'}
        </button>
      )}
    </header>
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

/** The tag over an item in the room's view: its icon, lit in the light's colour; a light's in a dark ring with an arc
    in its colour as far round as it's bright. */
export const SmartTag = ({ item, light, shade, onOpen, onHover }: SmartTagProps) => {
  const on = !!light?.on
  return (
    <>
      <TagLine />
      <button
        className="smart-tag"
        data-off={(light && !on) || undefined}
        data-ring={light ? true : undefined}
        aria-label={light ? `${item.name}, ${on ? `${Math.round(light.brightness * 100)} %` : 'off'}` : item.name}
        onClick={onOpen}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
      >
        <span className="smart-tag-icon" style={on ? { background: lightColor(light) } : undefined}>
          {light && (
            <svg className="smart-tag-ring" width="26" height="26" viewBox="0 0 26 26" aria-hidden>
              <circle cx="13" cy="13" r="12" />
              {on && (
                <circle
                  cx="13"
                  cy="13"
                  r="12"
                  style={{ stroke: lightColor(light) }}
                  strokeDasharray={`${light.brightness * RING} ${RING}`}
                />
              )}
            </svg>
          )}
          <DeviceIcon kind={item.kind} size={12} />
        </span>
        {shade && <span className="muted">{shadeText(shade)}</span>}
      </button>
    </>
  )
}
