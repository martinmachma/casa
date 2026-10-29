import {
  Archive,
  Bath,
  BedDouble,
  DoorOpen,
  Footprints,
  LayoutDashboard,
  PencilRuler,
  Settings,
  Sofa,
  Square,
  Toilet,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Floor } from '../layout/types'
import type { RoomView } from '../rooms/roomViews'
import { SettingsMenu } from './SettingsMenu'

/** Home is for living in the house; planning is the editor. */
export type Section = 'home' | 'planning'

type NavRailProps = {
  section: Section
  onSection: (section: Section) => void
  floors: Floor[]
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
const ROOM_ICONS: [RegExp, ReactNode][] = [
  [/living|kitchen|lounge/i, <Sofa size={20} />],
  [/bed/i, <BedDouble size={20} />],
  [/bath|shower/i, <Bath size={20} />],
  [/wc|toilet/i, <Toilet size={20} />],
  [/stair/i, <Footprints size={20} />],
  [/hall|landing|entr/i, <DoorOpen size={20} />],
  [/storage|boiler|utility/i, <Archive size={20} />],
]
const roomIcon = (planName: string) => ROOM_ICONS.find(([test]) => test.test(planName))?.[1] ?? <Square size={20} />

/** The main menu: icons down the left edge that widen to show their names on hover. */
export const NavRail = ({ section, onSection, floors, rooms, room, onRoom }: NavRailProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <nav className="rail" aria-label="Main">
      <div className="rail-brand">
        <img src="/favicon.svg" alt="" />
        <span className="rail-label">Casa</span>
      </div>
      <RailItem
        icon={<LayoutDashboard size={20} />}
        label="Home"
        current={section === 'home' && !room}
        onClick={() => onSection('home')}
      />
      <RailItem
        icon={<PencilRuler size={20} />}
        label="Planning"
        current={section === 'planning'}
        onClick={() => onSection('planning')}
      />
      {/* Each floor's rooms in a group of their own; scrolls when they don't all fit. */}
      <div className="rail-rooms">
        {floors.map((floor) => {
          const own = rooms.filter((r) => r.floor === floor.id)
          return (
            own.length > 0 && (
              <div key={floor.id} className="rail-group" role="group" aria-label={floor.name}>
                <div className="rail-group-title" aria-hidden>
                  <span className="rail-label">{floor.name}</span>
                </div>
                {own.map((r) => (
                  <RailItem
                    key={r.id}
                    icon={roomIcon(r.planName)}
                    label={r.label}
                    current={room === r.id}
                    onClick={() => onRoom(r.id)}
                  />
                ))}
              </div>
            )
          )
        })}
      </div>
      <RailItem icon={<Settings size={20} />} label="Settings" onClick={() => setSettingsOpen(true)} dialog />
      <SettingsMenu open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </nav>
  )
}
