import { Trash2 } from 'lucide-react'
import type { Device } from '../data/types'
import type { LightState } from '../devices/lights'
import { DEVICE_KINDS } from '../devices/kinds'
import { LightControls } from './LightControls'
import { NumberField } from './NumberField'
import { PanelHead, Section } from './kit'
import { EditableTitle } from './EditableTitle'
import { ItemInfo } from './ItemInfo'

type DeviceEditorProps = {
  device: Device
  /** The room it's in, shown with its technical information. */
  room: string | undefined
  onChange: (patch: Partial<Device>) => void
  /** How it's set now; only lights use it. */
  light: LightState
  onLight: (patch: Partial<LightState>) => void
  onDelete: () => void
  onClose: () => void
}

const cm = (m: number) => Math.round(m * 100)

export const DeviceEditor = ({ device, room, onChange, light, onLight, onDelete, onClose }: DeviceEditorProps) => (
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
      onClose={onClose}
    />

    {device.kind === 'light' && <LightControls light={light} onChange={onLight} />}

    {!device.plan && (
      <>
        <Section>
          <div className="row" key={`z-${device.id}`}>
            <NumberField label="Height cm" min={0} value={cm(device.z)} onCommit={(v) => onChange({ z: v / 100 })} />
          </div>
        </Section>
        <Section>
          <button className="btn btn-danger btn-block" onClick={onDelete}>
            <Trash2 size={16} />
            Remove device
          </button>
        </Section>
      </>
    )}

    <ItemInfo key={device.id}>
      <dl className="item-specs">
        <div>
          <dt>Type</dt>
          <dd>{device.plan?.symbol ?? DEVICE_KINDS[device.kind].label}</dd>
        </div>
        {room && (
          <div>
            <dt>Room</dt>
            <dd>{room}</dd>
          </div>
        )}
        <div>
          <dt>Above floor</dt>
          <dd>{cm(device.z)} cm</dd>
        </div>
        {device.plan?.ports && (
          <div>
            <dt>{device.kind === 'data' ? 'RJ45 ports' : 'Outlets'}</dt>
            <dd>{device.plan.ports}</dd>
          </div>
        )}
      </dl>
      {device.plan?.notes && <p className="hint">{device.plan.notes}</p>}
      {!device.plan && (
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
      )}
    </ItemInfo>
  </>
)
