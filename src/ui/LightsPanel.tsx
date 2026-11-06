import { DEVICE_KINDS, type DevicePlacement } from '../devices/kinds'
import type { LightState } from '../devices/lights'
import type { ShadeState } from '../devices/shades'
import type { ItemSection, PlacedItem } from '../rooms/roomItems'
import { DeviceIcon } from './deviceIcons'
import { Section } from './kit'
import { SmartRows } from './SmartList'

// Lights can be put in by hand; the rest (sockets, blinds…) are fixed in the house's layout.
const ADD: { kind: DevicePlacement; name: string; hint: string }[] = [
  { kind: 'light', name: 'Ceiling light', hint: 'Click the floor below where the light should hang. Esc cancels.' },
  { kind: 'wall-light', name: 'Wall light', hint: 'Click a wall where the light should be mounted. Esc cancels.' },
]

type LightListProps = {
  sections: ItemSection<PlacedItem>[]
  light: (id: string) => LightState
  onLight: (id: string, patch: Partial<LightState>) => void
  shade: (id: string) => ShadeState
  onShade: (id: string, patch: Partial<ShadeState>) => void
  onOpen: (id: string) => void
  onHover: (id: string | undefined) => void
  hovered: string | undefined
}

/** The house's lights and lamps, room by room: the same rows as at home, opening each one for editing. */
export const LightList = ({ sections, ...rows }: LightListProps) => (
  <div className="light-list">
    {sections.map((section) => (
      <div key={section.name}>
        <h3 className="smart-group">{section.name}</h3>
        {section.rooms.map((room) => (
          <div key={room.name ?? ''}>
            {room.name && <h4 className="smart-room">{room.name}</h4>}
            <SmartRows items={room.items} {...rows} />
          </div>
        ))}
      </div>
    ))}
  </div>
)

type LightsPanelProps = {
  /** The device kind the next click places, if one is picked. */
  placing: DevicePlacement | undefined
  onPlacing: (kind: DevicePlacement | undefined) => void
}

/** Lights to put in; those already in the house are picked in the view. */
export const LightsPanel = ({ placing, onPlacing }: LightsPanelProps) => (
  <Section>
    <div className="catalog">
      {ADD.map((d) => (
        <button
          key={d.kind}
          className="catalog-item"
          aria-pressed={placing === d.kind}
          onClick={() => onPlacing(placing === d.kind ? undefined : d.kind)}
        >
          <span className="device-swatch" style={{ background: DEVICE_KINDS.light.color }}>
            <DeviceIcon kind="light" size={18} />
          </span>
          <span>{d.name}</span>
        </button>
      ))}
    </div>
    <p className="hint light-hint">
      {placing ? ADD.find((d) => d.kind === placing)?.hint : 'Pick a light in the view to edit it.'}
    </p>
  </Section>
)
