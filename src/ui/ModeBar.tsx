import { Magnet, PanelRightOpen, PencilRuler, Redo2, Undo2 } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { IconButton, Switch } from './kit'

type ModeBarProps = {
  /** Planning is editing: the house can be changed only while it's on. */
  planning: boolean
  onPlanning: (planning: boolean) => void
  /** Undo and redo, shown while editing; absent when there's nothing to step to. */
  onUndo: (() => void) | undefined
  onRedo: (() => void) | undefined
  /** The Save button, shown while editing. */
  save: ReactNode
  onOpenPanel?: () => void
  wallSnap: boolean
  onWallSnap: (snap: boolean) => void
  furnitureSnap: boolean
  onFurnitureSnap: (snap: boolean) => void
}

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

/** Stays anchored over the view, including while the details panel opens. */
export const ModeBar = ({
  planning,
  onPlanning,
  onUndo,
  onRedo,
  save,
  onOpenPanel,
  wallSnap,
  onWallSnap,
  furnitureSnap,
  onFurnitureSnap,
}: ModeBarProps) => {
  const editing = planning
  return (
    <div className="modebar">
      <button
        className="float edit-toggle"
        aria-pressed={planning}
        title={planning ? 'Stop planning (E)' : 'Planning (E)'}
        onClick={() => onPlanning(!planning)}
      >
        <PencilRuler size={16} />
        <span>Planning</span>
      </button>
      {editing && save}
      {editing && onOpenPanel && (
        <div className="float history">
          <IconButton label="Open details" small onClick={onOpenPanel}>
            <PanelRightOpen size={17} />
          </IconButton>
        </div>
      )}
      {editing && (
        <div className="float history" role="group" aria-label="History">
          <IconButton label={`Undo (${mod}Z)`} small disabled={!onUndo} onClick={onUndo}>
            <Undo2 size={17} />
          </IconButton>
          <IconButton label={`Redo (${mod}Shift+Z)`} small disabled={!onRedo} onClick={onRedo}>
            <Redo2 size={17} />
          </IconButton>
        </div>
      )}
      {editing && (
        <SnapMenu
          wallSnap={wallSnap}
          onWallSnap={onWallSnap}
          furnitureSnap={furnitureSnap}
          onFurnitureSnap={onFurnitureSnap}
        />
      )}
    </div>
  )
}

type SnapMenuProps = Pick<ModeBarProps, 'wallSnap' | 'onWallSnap' | 'furnitureSnap' | 'onFurnitureSnap'>

/** A magnet that lights up while anything snaps; its menu turns each kind on or off. */
const SnapMenu = ({ wallSnap, onWallSnap, furnitureSnap, onFurnitureSnap }: SnapMenuProps) => {
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
      <div className="float history snap">
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
