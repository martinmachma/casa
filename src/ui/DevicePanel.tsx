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
  scenes: Scene[]
  /** Opens a scene in the editor; none for a new one. */
  onEditScene: (scene: Scene | undefined) => void
}

/** What's shown in Devices with nothing selected: lights to put in, and the house's scenes. */
export const DevicePanel = ({ placing, onPlacing, scenes, onEditScene }: DevicePanelProps) => (
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
    <Section title="Scenes">
      {scenes.length > 0 ? (
        <div className="smart-scene-chips" role="group" aria-label="Scenes">
          {scenes.map((scene) => (
            <button key={scene.id} className="chip" onClick={() => onEditScene(scene)}>
              {scene.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="hint">No scenes yet. A scene sets any lights and shades in the house with one tap.</p>
      )}
    </Section>
    <div className="panel-foot">
      <button className="btn btn-block" onClick={() => onEditScene(undefined)}>
        <Plus size={16} />
        New scene
      </button>
    </div>
  </>
)
