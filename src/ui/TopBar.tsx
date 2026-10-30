import { House, ListTodo, LogOut, Settings } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Account } from '../auth/AuthGate'
import type { Floor } from '../layout/types'
import { IconButton, Segmented } from './kit'
import { SettingsMenu } from './SettingsMenu'
import { WeatherButton } from './WeatherButton'

type TopBarProps = {
  /** Back to the whole house, out of any room. */
  onHome: () => void
  inRoom: boolean
  floors: Floor[]
  floorIndex: number
  onFloor: (index: number) => void
  /** Looking at the whole house from outside instead of one floor. */
  outside: boolean
  onOutside: () => void
  /** The version picker, while planning. */
  versions?: ReactNode
  onWeather: () => void
  /** Opens the wishes & bugs list; the badge counts open ones. */
  onTodos: () => void
  openTodos: number
  account: Account
}

const OUTSIDE = 'outside'

const ordinal = (n: number) => `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`

export const TopBar = ({
  onHome,
  inRoom,
  floors,
  floorIndex,
  onFloor,
  outside,
  onOutside,
  versions,
  onWeather,
  onTodos,
  openTodos,
  account,
}: TopBarProps) => (
  <header className="topbar">
    <button
      className="brand"
      aria-current={inRoom ? undefined : 'page'}
      aria-label="Casa, whole house"
      onClick={onHome}
    >
      <img src="/favicon.svg" alt="" />
      <span>Casa</span>
    </button>
    <Segmented
      label="Floor"
      value={outside ? OUTSIDE : floors[floorIndex].id}
      onChange={(id) => (id === OUTSIDE ? onOutside() : onFloor(floors.findIndex((f) => f.id === id)))}
      options={[
        { value: OUTSIDE, label: 'Outside', icon: <House size={15} />, iconOnly: true },
        ...floors.map((f, i) => ({ value: f.id, label: ordinal(i + 1) })),
      ]}
      className="floors"
    />
    {versions}
    <span className="spacer" />
    <WeatherButton onClick={onWeather} />
    <IconButton label="Wishes & bugs" className="todo-open" onClick={onTodos}>
      <ListTodo size={18} />
      {openTodos > 0 && <span className="todo-count">{openTodos}</span>}
    </IconButton>
    <AccountMenu account={account} />
  </header>
)

const AccountMenu = ({ account }: { account: Account }) => {
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div className="menu-anchor" ref={ref}>
      <button className="account" onClick={() => setOpen(!open)} aria-label="Account" aria-expanded={open}>
        <span className="avatar">{(account.nickname ?? account.label).charAt(0).toUpperCase()}</span>
        {account.nickname && <span className="account-name">{account.nickname}</span>}
      </button>
      {open && (
        <div className="menu" role="menu">
          {account.nickname && <div className="menu-name">{account.nickname}</div>}
          <div className="menu-label">{account.label}</div>
          <button
            role="menuitem"
            aria-haspopup="dialog"
            onClick={() => {
              setOpen(false)
              setSettingsOpen(true)
            }}
          >
            <Settings size={16} />
            Settings
          </button>
          <button role="menuitem" onClick={account.signOut}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
      <SettingsMenu open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
