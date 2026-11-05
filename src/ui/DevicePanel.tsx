import { Plus } from 'lucide-react'
import { DEVICE_KINDS, type DevicePlacement } from '../devices/kinds'
import type { Scene } from '../devices/scenes'
import { DeviceIcon } from './deviceIcons'
import { Section } from './kit'

// Smart devices that can be put in by hand; the rest (sockets, blinds…) are fixed in the house's layout.
const DEVICES: { kind: DevicePlacement; name: string }[] = [
  { kind: 'light', name: 'Ceiling light' },
  { kind: 'wall-light', name: 'Wall light' },
]

type DevicePanelProps = {
  /** The device kind the next tap places, if one is picked. */
  placing: DevicePlacement | undefined
  onPlacing: (kind: DevicePlacement | undefined) => void
  /** Each room with lights, and its scenes. */
  rooms: { id: string; name: string; scenes: Scene[] }[]
  /** Opens a scene in the editor; none for a new one. */
  onEditScene: (scene: Scene | undefined) => void
}

/** What's shown in Devices with nothing selected: lights to put in, and the house's scenes. */
export const DevicePanel = ({ placing, onPlacing, rooms, onEditScene }: DevicePanelProps) => (
  <>
    <Section title="Add">
      {placing && (
        <p className="hint">
          {placing === 'wall-light'
            ? 'Tap a wall where the light should be mounted.'
            : 'Tap the floor where the light should hang from the ceiling.'}
        </p>
      )}
      <div className="catalog">
        {DEVICES.map((d) => (
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
    </Section>
    <Section
      title="Scenes"
      aside={
        <button className="btn btn-small" onClick={() => onEditScene(undefined)}>
          <Plus size={14} />
          New scene
        </button>
      }
    >
      {rooms.map((room) => (
        <div key={room.id}>
          <h4 className="smart-room">{room.name}</h4>
          <div className="smart-scene-chips" role="group" aria-label={`Scenes in ${room.name}`}>
            {room.scenes.map((scene) => (
              <button key={scene.id} className="chip" onClick={() => onEditScene(scene)}>
                {scene.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </Section>
  </>
)
