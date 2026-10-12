import type { RoomRegion } from '../layout/rooms'
import type { Room } from '../layout/types'
import { FLOOR_MATERIALS, floorPreview } from '../scene/floorMaterials'

type RoomPanelProps = {
  room: Room
  region: RoomRegion | undefined
  material: string | undefined
  onMaterial: (material: string | undefined) => void
  onClose: () => void
}

const GROUPS = ['Wood', 'Tiles', 'Carpet', 'Other'] as const

export const RoomPanel = ({ room, region, material, onMaterial, onClose }: RoomPanelProps) => (
  <section className="panel" aria-label="Room floor">
    <div className="panel-head">
      <h2>{room.name}</h2>
      <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </div>
    {region && <p className="hint">{region.area.toFixed(1)} m² of floor</p>}

    {GROUPS.map((group) => (
      <div key={group} className="material-group">
        <h3>{group}</h3>
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
      </div>
    ))}

    <button className="btn btn-ghost" onClick={() => onMaterial(undefined)} disabled={!material}>
      No finish (bare slab)
    </button>
  </section>
)
