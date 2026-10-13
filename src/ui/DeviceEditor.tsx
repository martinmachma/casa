import { Trash2 } from 'lucide-react'
import type { Device, DeviceKind } from '../data/types'
import { DEVICE_KINDS, KIND_ORDER } from '../devices/kinds'
import { DeviceIcon } from './deviceIcons'
import { NumberField } from './NumberField'
import { PanelHead, Section } from './kit'

type DeviceEditorProps = {
  device: Device
  /** The room it's in, for the heading. */
  room: string | undefined
  onChange: (patch: Partial<Device>) => void
  onKind: (kind: DeviceKind) => void
  onDelete: () => void
  onClose: () => void
}

const cm = (m: number) => Math.round(m * 100)

export const DeviceEditor = ({ device, room, onChange, onKind, onDelete, onClose }: DeviceEditorProps) => (
  <>
    <PanelHead
      eyebrow={DEVICE_KINDS[device.kind].label}
      title={device.name}
      sub={[room, device.wall ? `on the wall, ${cm(device.z)} cm up` : 'on the ceiling'].filter(Boolean).join(' · ')}
      onClose={onClose}
    />

    <Section>
      {/* Remount when another device is selected so the fields show its values. */}
      <label className="field" key={`name-${device.id}-${device.name}`}>
        Name
        <input
          defaultValue={device.name}
          onBlur={(e) =>
            e.target.value.trim() && e.target.value !== device.name && onChange({ name: e.target.value.trim() })
          }
        />
      </label>
      <div className="row" key={`z-${device.id}`}>
        <NumberField label="Height cm" min={0} value={cm(device.z)} onCommit={(v) => onChange({ z: v / 100 })} />
      </div>
      <label className="field" key={`entity-${device.id}`}>
        Home Assistant entity
        <input
          defaultValue={device.entity ?? ''}
          placeholder={`${device.kind === 'other' ? 'switch' : device.kind}.living_room`}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onBlur={(e) => {
            const entity = e.target.value.trim() || undefined
            if (entity !== device.entity) onChange({ entity })
          }}
        />
      </label>
    </Section>

    <Section title="Kind">
      <div className="catalog device-kinds">
        {KIND_ORDER.map((kind) => (
          <button
            key={kind}
            className="catalog-item"
            aria-pressed={device.kind === kind}
            onClick={() => kind !== device.kind && onKind(kind)}
          >
            <span className="device-swatch" style={{ background: DEVICE_KINDS[kind].color }}>
              <DeviceIcon kind={kind} size={18} />
            </span>
            <span>{DEVICE_KINDS[kind].label}</span>
          </button>
        ))}
      </div>
    </Section>

    <Section>
      <p className="hint">
        Drag it {device.wall ? 'along the wall' : 'across the ceiling'}. <span className="kbd">Del</span> removes.
      </p>
      <button className="btn btn-danger btn-block" onClick={onDelete}>
        <Trash2 size={16} />
        Remove device
      </button>
    </Section>
  </>
)
