import type { Device, DeviceKind } from '../data/types'
import { DEVICE_KINDS, KIND_ORDER } from '../devices/kinds'
import { DeviceIcon } from './deviceIcons'
import { PanelHead, Section } from './kit'

type DevicePanelProps = {
  /** Devices on this floor. */
  devices: Device[]
  /** The kind the next tap places, if one is picked. */
  placing: DeviceKind | undefined
  onPlacing: (kind: DeviceKind | undefined) => void
  onSelect: (id: string) => void
  onClose: () => void
}

/** The right panel while the devices tool is on and none is selected: what to place, and what's placed. */
export const DevicePanel = ({ devices, placing, onPlacing, onSelect, onClose }: DevicePanelProps) => (
  <>
    <PanelHead eyebrow="Smart home" title="Devices" onClose={onClose} closeLabel="Stop placing devices" />

    <Section title="Place">
      <div className="catalog device-kinds">
        {KIND_ORDER.map((kind) => (
          <button
            key={kind}
            className="catalog-item"
            aria-pressed={placing === kind}
            onClick={() => onPlacing(placing === kind ? undefined : kind)}
          >
            <span className="device-swatch" style={{ background: DEVICE_KINDS[kind].color }}>
              <DeviceIcon kind={kind} size={18} />
            </span>
            <span>{DEVICE_KINDS[kind].label}</span>
          </button>
        ))}
      </div>
      <p className="hint">
        {placing
          ? placing === 'light'
            ? 'Tap the floor where the light should hang from the ceiling.'
            : `Tap next to a wall to put the ${DEVICE_KINDS[placing].label.toLowerCase()} on it.`
          : 'Pick a kind, then tap in the house. Drag a placed device to move it.'}
      </p>
    </Section>

    <Section title="On this floor" aside={<span className="muted num">{devices.length}</span>}>
      {devices.length > 0 ? (
        <ul className="item-list">
          {devices.map((d) => (
            <li key={d.id}>
              <button onClick={() => onSelect(d.id)}>
                <DeviceIcon kind={d.kind} />
                <span className="item-name">{d.name}</span>
                <span className="item-size">{d.entity ?? ''}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">No devices here yet.</p>
      )}
    </Section>
  </>
)
