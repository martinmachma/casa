import { Magnet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { IconButton, Switch } from './kit'

type SnapMenuProps = {
  wallSnap: boolean
  onWallSnap: (snap: boolean) => void
  furnitureSnap: boolean
  onFurnitureSnap: (snap: boolean) => void
}

/** A magnet that lights up while anything snaps; its menu turns each kind on or off. */
export const SnapMenu = ({ wallSnap, onWallSnap, furnitureSnap, onFurnitureSnap }: SnapMenuProps) => {
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
      <div className="toolbar float snap">
        <IconButton
          label="Snapping"
          small
          aria-expanded={open}
          aria-pressed={wallSnap || furnitureSnap}
          onClick={() => setOpen(!open)}
        >
          <Magnet size={17} />
        </IconButton>
      </div>
      {open && (
        <div className="menu snap-menu">
          <div className="menu-label">Snap to</div>
          <Switch label="Walls" checked={wallSnap} onChange={onWallSnap} />
          <Switch label="Furniture" checked={furnitureSnap} onChange={onFurnitureSnap} />
        </div>
      )}
    </div>
  )
}
