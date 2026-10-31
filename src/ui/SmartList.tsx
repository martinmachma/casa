import { Power, Unlink } from 'lucide-react'
import type { ReactNode } from 'react'
import { lightColor, type LightState } from '../devices/lights'
import type { SmartItem } from '../rooms/roomItems'
import { DeviceIcon } from './deviceIcons'

type SmartRowProps = {
  item: SmartItem
  sub: string
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
          <span className="muted">{sub}</span>
          {on && (
            <span className="smart-bar" aria-hidden>
              <span style={{ width: `${light!.brightness * 100}%` }} />
            </span>
          )}
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

type SmartCardProps = {
  title: string
  summary: string
  /** Switches every light off, or on when all are off; left out when there are none. */
  allLights?: { on: boolean; onChange: (on: boolean) => void }
  children: ReactNode
}

/** The card down the right that lists smart items, with a switch for all the lights and a note on linking. */
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
    <p className="smart-note">
      <Unlink size={14} aria-hidden />
      Not linked to Home Assistant yet: changes stay in this app.
    </p>
  </section>
)

type SmartTagProps = {
  item: SmartItem
  light?: LightState
  onOpen: () => void
  onHover: (hovering: boolean) => void
}

/** The tag over an item in the room's view: its icon, lit in the light's colour, and how bright it is. */
export const SmartTag = ({ item, light, onOpen, onHover }: SmartTagProps) => {
  const on = !!light?.on
  return (
    <>
      <svg className="smart-tag-line" width="40" height="30" viewBox="0 0 40 30" aria-hidden>
        <polyline points="6,22 20,8 34,8" />
      </svg>
      <button
        className="smart-tag"
        data-off={(light && !on) || undefined}
        aria-label={item.name}
        onClick={onOpen}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
      >
        <span className="smart-tag-icon" style={on ? { background: lightColor(light) } : undefined}>
          <DeviceIcon kind={item.kind} size={12} />
        </span>
        {light && <span className="muted">{on ? `${Math.round(light.brightness * 100)} %` : 'Off'}</span>}
      </button>
    </>
  )
}
