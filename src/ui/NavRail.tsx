import {
  Archive,
  Bath,
  Bed,
  BedDouble,
  DoorOpen,
  Footprints,
  Settings,
  Sofa,
  Square,
  Toilet,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { RoomView } from '../rooms/roomViews'
import { SettingsMenu } from './SettingsMenu'

/** Home is for living in the house; planning is the editor. */
export type Section = 'home' | 'planning'

type NavRailProps = {
  /** Back to the whole house, out of any room. */
  onHome: () => void
  rooms: RoomView[]
  /** The room being looked at on its own, if any. */
  room: string | undefined
  onRoom: (id: string) => void
}

type RailItemProps = {
  icon: ReactNode
  label: string
  current?: boolean
  onClick: () => void
  dialog?: boolean
}

const RailItem = ({ icon, label, current, onClick, dialog }: RailItemProps) => (
  <button
    className="rail-item"
    aria-current={current ? 'page' : undefined}
    aria-haspopup={dialog ? 'dialog' : undefined}
    aria-label={label}
    onClick={onClick}
  >
    {icon}
    <span className="rail-label">{label}</span>
  </button>
)

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
const roomIcon = (planName: string, size = 20) => {
  const Icon = ROOM_ICONS.find(([test]) => test.test(planName))?.[1] ?? Square
  return <Icon size={size} />
}

/**
 * The main menu: icons down the left edge that widen on hover. The rooms lived in become tiles, the rest (halls,
 * storage) small links beneath them; the name at the top goes back to the whole house.
 */
export const NavRail = ({ onHome, rooms, room, onRoom }: NavRailProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const main = rooms.filter((r) => !r.minor)
  const minor = rooms.filter((r) => r.minor)
  return (
    <nav className="rail" aria-label="Main">
      <button
        className="rail-brand"
        aria-current={room ? undefined : 'page'}
        aria-label="Casa, whole house"
        onClick={onHome}
      >
        <img src="/favicon.svg" alt="" />
        <span className="rail-label">Casa</span>
      </button>
      {/* Scrolls when they don't all fit. */}
      <div className="rail-rooms">
        <div className="rail-tiles" role="group" aria-label="Rooms">
          {main.map((r) => (
            <button
              key={r.id}
              className="rail-tile"
              aria-current={room === r.id ? 'page' : undefined}
              aria-label={r.label}
              onClick={() => onRoom(r.id)}
            >
              {roomIcon(r.planName)}
              <span className="rail-label">{r.label}</span>
            </button>
          ))}
        </div>
        {minor.length > 0 && (
          <div className="rail-others" role="group" aria-label="Other spaces">
            <div className="rail-group-title" aria-hidden>
              <span className="rail-label">Other spaces</span>
            </div>
            <div className="rail-others-list">
              {minor.map((r) => (
                <button
                  key={r.id}
                  className="rail-other"
                  aria-current={room === r.id ? 'page' : undefined}
                  aria-label={r.label}
                  onClick={() => onRoom(r.id)}
                >
                  {roomIcon(r.planName, 16)}
                  <span className="rail-label">{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <RailItem icon={<Settings size={20} />} label="Settings" onClick={() => setSettingsOpen(true)} dialog />
      <SettingsMenu open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </nav>
  )
}
