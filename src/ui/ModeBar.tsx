import { PanelRightOpen, PencilRuler, Redo2, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconButton } from './kit'

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
  /** Measuring, snapping and the sun: left of the rest, pushed aside by the details panel. */
  tools?: ReactNode
}

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

/** Stays anchored over the view, including while the details panel opens. */
export const ModeBar = ({ planning, onPlanning, onUndo, onRedo, save, onOpenPanel, tools }: ModeBarProps) => {
  const editing = planning
  return (
    <div className="modebar">
      <div className="modebar-main">
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
      </div>
      {tools && <div className="modebar-tools">{tools}</div>}
    </div>
  )
}
