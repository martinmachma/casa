import { floorRegions, type RoomRegion } from '../layout/rooms'
import { roomParts } from '../layout/roomName'
import type { Floor } from '../layout/types'
import { PanelHead } from './kit'

type RoomLegendProps = {
  floor: Floor
  regions: Map<string, RoomRegion>
  /** The room under the pointer, here or on its number in the 3D view. */
  hovered: string | undefined
  selected: string | undefined
  onHover: (roomId: string | undefined) => void
  /** Picking a room opens its floor finishes; only while editing. */
  onPick: ((roomId: string) => void) | undefined
  onClose: () => void
}

const area = (m2: number) => `${m2.toFixed(1)} m²`

/** The left panel: the floor's rooms, keyed by the numbers shown in the 3D view. */
export const RoomLegend = ({ floor, regions, hovered, selected, onHover, onPick, onClose }: RoomLegendProps) => {
  return (
    <>
      <PanelHead title="Rooms" onClose={onClose} closeLabel="Hide rooms" />
      <ul className="legend" data-clickable={onPick ? '' : undefined} onMouseLeave={() => onHover(undefined)}>
        {floor.rooms.map((room) => {
          const { number, name } = roomParts(room)
          const region = regions.get(room.id)
          return (
            <li key={room.id}>
              <button
                className="legend-item"
                data-active={hovered === room.id ? '' : undefined}
                aria-current={selected === room.id}
                onMouseEnter={() => onHover(room.id)}
                onFocus={() => onHover(room.id)}
                onBlur={() => onHover(undefined)}
                onClick={() => onPick?.(room.id)}
              >
                <span className="badge">{number ?? '–'}</span>
                <span className="legend-name">{name}</span>
                {region && <span className="legend-area">{area(region.area)}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

type FloorListProps = { floors: Floor[]; onPick: (index: number) => void; onClose: () => void }

/** The left panel from outside: the floors, each a way back in. */
export const FloorList = ({ floors, onPick, onClose }: FloorListProps) => {
  const areas = floors.map((f) => [...floorRegions(f).values()].reduce((sum, r) => sum + r.area, 0))
  const rooms = floors.reduce((sum, f) => sum + f.rooms.length, 0)
  return (
    <>
      <PanelHead
        eyebrow="Outside"
        title="Floors"
        sub={`${rooms} rooms · ${area(areas.reduce((a, b) => a + b, 0))}`}
        onClose={onClose}
        closeLabel="Hide floors"
      />
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
    </>
  )
}
