import type { RoomRegion } from '../layout/rooms'
import { roomParts } from '../layout/roomName'
import type { Room } from '../layout/types'
import { FLOOR_MATERIALS, floorPreview } from '../scene/floorMaterials'
import { PanelHead, Section } from './kit'

type RoomPanelProps = {
  room: Room
  region: RoomRegion | undefined
  material: string | undefined
  onMaterial: (material: string | undefined) => void
  onClose: () => void
}

const GROUPS = ['Wood', 'Tiles', 'Carpet', 'Other'] as const

export const RoomPanel = ({ room, region, material, onMaterial, onClose }: RoomPanelProps) => {
  const { number, name } = roomParts(room)
  return (
    <>
      <PanelHead
        eyebrow={number ? `Room ${number}` : 'Room'}
        title={name}
        sub={region && `${region.area.toFixed(1)} m² of floor`}
        onClose={onClose}
      />
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
