import {
  Archive,
  Bath,
  Bed,
  BedDouble,
  DoorOpen,
  Footprints,
  Sofa,
  Square,
  Toilet,
  type LucideIcon,
} from 'lucide-react'
import type { RoomView } from '../rooms/roomViews'

type RoomNavProps = {
  rooms: RoomView[]
  /** The room being looked at on its own, if any. */
  room: string | undefined
  onRoom: (id: string) => void
}

// A room's icon, from what the plan calls it.
const ROOM_ICONS: [RegExp, LucideIcon][] = [
  [/living|kitchen|lounge/i, Sofa],
  [/bed/i, BedDouble],
  [/bath|shower/i, Bath],
  [/wc|toilet/i, Toilet],
  [/stair/i, Footprints],
  [/hall|landing|entr/i, DoorOpen],
  [/storage|boiler|utility/i, Archive],
  [/room/i, Bed],
]
const roomIcon = (planName: string) => {
  const Icon = ROOM_ICONS.find(([test]) => test.test(planName))?.[1] ?? Square
  return <Icon size={20} />
}

/** Cards for the rooms down the left of the view: the rooms lived in as tiles, halls and storage as small links. */
export const RoomNav = ({ rooms, room, onRoom }: RoomNavProps) => {
  const main = rooms.filter((r) => !r.minor)
  const minor = rooms.filter((r) => r.minor)
  return (
    <nav className="room-nav float" aria-label="Rooms">
      <div className="room-tiles">
        {main.map((r) => (
          <button
            key={r.id}
            className="room-tile"
            aria-current={room === r.id ? 'page' : undefined}
            aria-label={r.label}
            onClick={() => onRoom(r.id)}
          >
            {roomIcon(r.planName)}
            <span className="room-tile-label">{r.label}</span>
          </button>
        ))}
      </div>
      {minor.length > 0 && (
        <div className="room-others" role="group" aria-label="Other spaces">
          {minor.map((r) => (
            <button
              key={r.id}
              className="room-other"
              aria-current={room === r.id ? 'page' : undefined}
              onClick={() => onRoom(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  )
}
