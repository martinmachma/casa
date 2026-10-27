import { LayoutDashboard, PencilRuler, Settings, Sofa } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { RoomView } from '../rooms/roomViews'
import { SettingsMenu } from './SettingsMenu'

/** Home is for living in the house; planning is the editor. */
export type Section = 'home' | 'planning'

type NavRailProps = {
  section: Section
  onSection: (section: Section) => void
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

/** The main menu: icons down the left edge that widen to show their names on hover. */
export const NavRail = ({ section, onSection, rooms, room, onRoom }: NavRailProps) => {
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
      {rooms.map((r) => (
        <RailItem
          key={r.id}
          icon={<Sofa size={20} />}
          label={r.label}
          current={room === r.id}
          onClick={() => onRoom(r.id)}
        />
      ))}
      <RailItem
        icon={<PencilRuler size={20} />}
        label="Planning"
        current={section === 'planning'}
        onClick={() => onSection('planning')}
      />
      <span className="spacer" />
      <RailItem icon={<Settings size={20} />} label="Settings" onClick={() => setSettingsOpen(true)} dialog />
      <SettingsMenu open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </nav>
  )
}
