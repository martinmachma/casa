import { Minus, Plus } from 'lucide-react'
import { floorRegions } from '../layout/rooms'
import type { Floor } from '../layout/types'
import { PanelHead } from './kit'

const area = (m2: number) => `${m2.toFixed(1)} m²`

type FloorListProps = { floors: Floor[]; onPick: (index: number) => void; collapsed: boolean; onToggle: () => void }

/** The left panel from outside: the floors, each a way back in. */
export const FloorList = ({ floors, onPick, collapsed, onToggle }: FloorListProps) => {
  const areas = floors.map((f) => [...floorRegions(f).values()].reduce((sum, r) => sum + r.area, 0))
  const rooms = floors.reduce((sum, f) => sum + f.rooms.length, 0)
  return (
    <>
      <PanelHead
        eyebrow="Outside"
        title="Floors"
        sub={`${rooms} rooms · ${area(areas.reduce((a, b) => a + b, 0))}`}
        onClose={onToggle}
        closeLabel={collapsed ? 'Show floors' : 'Hide floors'}
        closeIcon={collapsed ? <Plus size={18} /> : <Minus size={18} />}
      />
      {!collapsed && (
        <ul className="legend" data-clickable="">
          {floors.map((f, i) => (
            <li key={f.id}>
              <button className="legend-item" onClick={() => onPick(i)}>
                <span className="badge">{i + 1}</span>
                <span className="legend-name">{f.name}</span>
                <span className="legend-area">{area(areas[i])}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
