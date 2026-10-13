import type { RoomRegion } from '../layout/rooms'
import { roomLabel } from '../layout/roomName'
import type { Room } from '../layout/types'
import { FLOOR_MATERIALS, floorPreview } from '../scene/floorMaterials'
import { PanelHead, Section } from './kit'

type RoomPanelProps = {
  room: Room
  region: RoomRegion | undefined
  /** Names we gave rooms, replacing the plan's. */
  names: Map<string, string>
  onName: (name: string) => void
  material: string | undefined
  onMaterial: (material: string | undefined) => void
  onClose: () => void
}

const GROUPS = ['Wood', 'Tiles', 'Carpet', 'Other'] as const

export const RoomPanel = ({ room, region, names, onName, material, onMaterial, onClose }: RoomPanelProps) => {
  const { number, name, planName } = roomLabel(room, names)
  return (
    <>
      <PanelHead
        eyebrow={number ? `Room ${number}` : 'Room'}
        title={name}
        sub={region && `${region.area.toFixed(1)} m² of floor`}
        onClose={onClose}
      />
      <Section>
        <label className="field">
          Name
          <input
            // Remount on another room, or when undo changes the name, so the field shows it.
            key={`${room.id}:${name}`}
            defaultValue={name}
            placeholder={planName}
            maxLength={60}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            onBlur={(e) => {
              const next = e.target.value.trim()
              // Clearing the field, or typing the plan's name, goes back to the plan's.
              if (next !== name) onName(next === planName ? '' : next)
            }}
          />
        </label>
      </Section>
      {GROUPS.map((group) => (
        <Section key={group} title={group}>
          <div className="materials">
            {FLOOR_MATERIALS.filter((m) => m.group === group).map((m) => (
              <button
                key={m.id}
                className="material"
                aria-pressed={material === m.id}
                onClick={() => onMaterial(m.id)}
                title={m.name}
              >
                <img src={floorPreview(m)} alt="" />
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        </Section>
      ))}
      <Section>
        <button className="btn btn-ghost btn-block" onClick={() => onMaterial(undefined)} disabled={!material}>
          No finish (bare slab)
        </button>
      </Section>
    </>
  )
}
