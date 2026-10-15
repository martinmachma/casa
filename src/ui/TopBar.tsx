import { House, LogOut, PanelLeft } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Account } from '../auth/AuthGate'
import type { Floor } from '../layout/types'
import { IconButton, Segmented } from './kit'

type TopBarProps = {
  floors: Floor[]
  floorIndex: number
  onFloor: (index: number) => void
  /** Looking at the whole house from outside instead of one floor. */
  outside: boolean
  onOutside: () => void
  leftOpen: boolean
  onToggleLeft: () => void
  account: Account
  /** The version picker. */
  versions: ReactNode
}

const OUTSIDE = 'outside'

const ordinal = (n: number) => `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`

export const TopBar = ({
  floors,
  floorIndex,
  onFloor,
  outside,
  onOutside,
  leftOpen,
  onToggleLeft,
  account,
  versions,
}: TopBarProps) => (
  <header className="topbar">
    <div className="brand">
      <img src="/favicon.svg" alt="" />
      <span className="brand-name">Casa</span>
    </div>
    <IconButton label={leftOpen ? 'Hide rooms' : 'Show rooms'} aria-pressed={leftOpen} onClick={onToggleLeft}>
      <PanelLeft size={18} />
    </IconButton>
    <span className="topbar-divider hide-narrow" />
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
    <AccountMenu account={account} />
  </header>
)

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
