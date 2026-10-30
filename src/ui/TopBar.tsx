import { ListTodo, LogOut, Settings } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Account } from '../auth/AuthGate'
import { SettingsMenu } from './SettingsMenu'
import { WeatherButton } from './WeatherButton'

type TopBarProps = {
  /** Back to the whole house, out of any room. */
  onHome: () => void
  inRoom: boolean
  /** The version picker, while planning. */
  versions?: ReactNode
  onWeather: () => void
  /** Opens the wishes & bugs list; the badge counts open ones. */
  onTodos: () => void
  openTodos: number
  account: Account
}

export const TopBar = ({ onHome, inRoom, versions, onWeather, onTodos, openTodos, account }: TopBarProps) => (
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
    {versions}
    <span className="spacer" />
    <WeatherButton onClick={onWeather} />
    <AccountMenu account={account} onTodos={onTodos} openTodos={openTodos} />
  </header>
)

type AccountMenuProps = Pick<TopBarProps, 'account' | 'onTodos' | 'openTodos'>

const AccountMenu = ({ account, onTodos, openTodos }: AccountMenuProps) => {
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
        {account.nickname && <span className="account-name">{account.nickname}</span>}
        <span className="avatar">{(account.nickname ?? account.label).charAt(0).toUpperCase()}</span>
        {openTodos > 0 && (
          <span className="todo-count" aria-label={`${openTodos} open wishes & bugs`}>
            {openTodos}
          </span>
        )}
      </button>
      {open && (
        <div className="menu" role="menu">
          {account.nickname && <div className="menu-name">{account.nickname}</div>}
          <div className="menu-label">{account.label}</div>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onTodos()
            }}
          >
            <ListTodo size={16} />
            Wishes & bugs
            {openTodos > 0 && <span className="todo-count">{openTodos}</span>}
          </button>
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
