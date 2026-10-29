import { Lightbulb, MousePointer2, PanelRightOpen, PencilRuler, Redo2, Undo2 } from 'lucide-react'
import type { Interaction } from '../scene/selection'
import { IconButton, Segmented } from './kit'

type ModeBarProps = {
  /** Planning is editing: the house can be changed only while it's on. */
  planning: boolean
  onPlanning: (planning: boolean) => void
  /** The tool in use while planning. */
  interaction: Interaction
  onChange: (interaction: Interaction) => void
  /** Undo and redo, shown while editing; absent when there's nothing to step to. */
  onUndo: (() => void) | undefined
  onRedo: (() => void) | undefined
  onOpenPanel?: () => void
}

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

/** Stays anchored over the view, including while the details panel opens. */
export const ModeBar = ({ planning, onPlanning, interaction, onChange, onUndo, onRedo, onOpenPanel }: ModeBarProps) => {
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
        <Segmented
          label="Tool"
          className="float tools"
          value={interaction}
          onChange={onChange}
          options={[
            { value: 'edit', label: 'Select', icon: <MousePointer2 size={17} />, iconOnly: true },
            { value: 'devices', label: 'Devices (L)', icon: <Lightbulb size={17} />, iconOnly: true },
          ]}
        />
      )}
    </div>
  )
}
