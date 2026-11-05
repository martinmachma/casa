import { Trash2 } from 'lucide-react'
import type { Device } from '../data/types'
import type { LightState } from '../devices/lights'
import { DEVICE_KINDS } from '../devices/kinds'
import { LightControls } from './LightControls'
import { NumberField } from './NumberField'
import { PanelHead, Section } from './kit'
import { ElectricalDetails } from './ElectricalPanel'

type DeviceEditorProps = {
  device: Device
  /** The room it's in, for the heading. */
  room: string | undefined
  onChange: (patch: Partial<Device>) => void
  /** How it's set now; only lights use it. */
  light: LightState
  onLight: (patch: Partial<LightState>) => void
  onDelete: () => void
  onClose: () => void
}

const cm = (m: number) => Math.round(m * 100)

const NameField = ({ device, onChange }: Pick<DeviceEditorProps, 'device' | 'onChange'>) => (
  <label className="field">
    Name
    <input
      defaultValue={device.name}
      onBlur={(e) =>
        e.target.value.trim() && e.target.value !== device.name && onChange({ name: e.target.value.trim() })
      }
    />
  </label>
)

export const DeviceEditor = ({ device, room, onChange, light, onLight, onDelete, onClose }: DeviceEditorProps) =>
  device.plan ? (
    <ElectricalDetails device={device} room={room} onClose={onClose}>
      {device.kind === 'light' && (
        <>
          <LightControls light={light} onChange={onLight} />
          <Section>
            <NameField key={`${device.id}-${device.name}`} device={device} onChange={onChange} />
          </Section>
        </>
      )}
    </ElectricalDetails>
  ) : (
    <>
      <PanelHead
        eyebrow={DEVICE_KINDS[device.kind].label}
        title={device.name}
        sub={[room, device.wall ? `on the wall, ${cm(device.z)} cm up` : 'on the ceiling'].filter(Boolean).join(' · ')}
        onClose={onClose}
      />

      {device.kind === 'light' && <LightControls light={light} onChange={onLight} />}

      <Section>
        {/* Remount when another device is selected so the fields show its values. */}
        <NameField key={`${device.id}-${device.name}`} device={device} onChange={onChange} />
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
