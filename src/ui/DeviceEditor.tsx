import { Trash2 } from 'lucide-react'
import type { Device } from '../data/types'
import type { LightState } from '../devices/lights'
import { DEVICE_KINDS } from '../devices/kinds'
import { LightControls } from './LightControls'
import { NumberField } from './NumberField'
import { PanelHead, Section } from './kit'
import { EditableTitle } from './EditableTitle'

type DeviceEditorProps = {
  device: Device
  /** Where it is, in words. */
  where: string
  onChange: (patch: Partial<Device>) => void
  /** How it's set now; only lights use it. */
  light: LightState
  onLight: (patch: Partial<LightState>) => void
  onDelete: () => void
  onClose: () => void
}

const cm = (m: number) => Math.round(m * 100)

export const DeviceEditor = ({ device, where, onChange, light, onLight, onDelete, onClose }: DeviceEditorProps) => (
  <>
    <PanelHead
      eyebrow={DEVICE_KINDS[device.kind].label}
      title={
        !device.plan || device.kind === 'light' ? (
          <EditableTitle key={device.id} value={device.name} onChange={(name) => onChange({ name })} />
        ) : (
          device.name
        )
      }
      sub={where}
      onClose={onClose}
    />

    {device.kind === 'light' && <LightControls light={light} onChange={onLight} />}

    {device.plan && (
      <Section>
        <p className="hint">
          Fixed by the electrical plan ({device.plan.symbol}), so it can't be moved or removed.
          {device.kind === 'light' && ' Its name is yours to change.'}
        </p>
        {device.plan.notes && <p className="hint">{device.plan.notes}</p>}
      </Section>
    )}

    {!device.plan && (
      <>
        <Section>
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
        <div className="panel-foot">
          <button className="btn btn-danger btn-block" onClick={onDelete}>
            <Trash2 size={16} />
            Remove {DEVICE_KINDS[device.kind].label.toLowerCase()}
          </button>
        </div>
      </>
    )}
  </>
)
