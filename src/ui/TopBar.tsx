import { Box, Footprints, LogOut, Map as PlanIcon, PanelLeft, PanelRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Account } from '../auth/AuthGate'
import type { Floor } from '../layout/types'
import type { CameraMode } from '../scene/selection'
import { IconButton, Segmented } from './kit'

type TopBarProps = {
  floors: Floor[]
  floorIndex: number
  onFloor: (index: number) => void
  camera: CameraMode
  onCamera: (camera: CameraMode) => void
  leftOpen: boolean
  rightOpen: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
  account: Account
}

export const TopBar = ({
  floors,
  floorIndex,
  onFloor,
  camera,
  onCamera,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
  account,
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
      value={floors[floorIndex].id}
      onChange={(id) => onFloor(floors.findIndex((f) => f.id === id))}
      options={floors.map((f, i) => ({ value: f.id, label: f.name, icon: <span className="num">{i + 1}</span> }))}
      className="floors"
    />
    <span className="spacer" />
    <Segmented
      label="View"
      value={camera}
      onChange={onCamera}
      options={[
        { value: 'top', label: 'Plan', icon: <PlanIcon size={15} /> },
        { value: 'orbit', label: '3D', icon: <Box size={15} /> },
        { value: 'walk', label: 'Walk', icon: <Footprints size={15} /> },
      ]}
      className="views"
    />
    <IconButton label={rightOpen ? 'Hide panel' : 'Show panel'} aria-pressed={rightOpen} onClick={onToggleRight}>
      <PanelRight size={18} />
    </IconButton>
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
