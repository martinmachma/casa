import { CloudSun, LayoutDashboard, ListTodo, LogOut, PencilRuler, Settings } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Account } from '../auth/AuthGate'
import { SettingsMenu } from './SettingsMenu'

/** Home is for living in the house; planning is the editor. */
export type Section = 'home' | 'planning'

type NavRailProps = {
  section: Section
  onSection: (section: Section) => void
  onWeather: () => void
  /** Opens the wishes & bugs list; the badge counts open ones. */
  onTodos: () => void
  openTodos: number
  account: Account
}

type RailItemProps = {
  icon: ReactNode
  label: string
  current?: boolean
  badge?: number
  onClick: () => void
  dialog?: boolean
}

const RailItem = ({ icon, label, current, badge, onClick, dialog }: RailItemProps) => (
  <button
    className="rail-item"
    aria-current={current ? 'page' : undefined}
    aria-haspopup={dialog ? 'dialog' : undefined}
    title={label}
    onClick={onClick}
  >
    {icon}
    <span className="rail-label">{label}</span>
    {!!badge && <span className="todo-count">{badge}</span>}
  </button>
)

export const NavRail = ({ section, onSection, onWeather, onTodos, openTodos, account }: NavRailProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <nav className="rail" aria-label="Main">
      <img className="rail-brand" src="/favicon.svg" alt="Casa" />
      <RailItem
        icon={<LayoutDashboard size={20} />}
        label="Home"
        current={section === 'home'}
        onClick={() => onSection('home')}
      />
      <RailItem icon={<CloudSun size={20} />} label="Weather" onClick={onWeather} dialog />
      <span className="rail-divider" />
      <RailItem
        icon={<PencilRuler size={20} />}
        label="Planning"
        current={section === 'planning'}
        onClick={() => onSection('planning')}
      />
      <RailItem icon={<ListTodo size={20} />} label="To-dos" badge={openTodos} onClick={onTodos} dialog />
      <span className="spacer" />
      <RailItem icon={<Settings size={20} />} label="Settings" onClick={() => setSettingsOpen(true)} dialog />
      <SettingsMenu open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AccountMenu account={account} />
    </nav>
  )
}

const AccountMenu = ({ account }: { account: Account }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div className="menu-anchor" ref={ref}>
      <button className="avatar" onClick={() => setOpen(!open)} aria-label="Account" aria-expanded={open}>
        {account.label.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-label">{account.label}</div>
          <button role="menuitem" onClick={account.signOut}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
