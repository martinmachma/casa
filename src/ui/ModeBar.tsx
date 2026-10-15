import { Lightbulb, MousePointer2, PenLine, Redo2, Undo2 } from 'lucide-react'
import type { Interaction } from '../scene/selection'
import { IconButton, Segmented } from './kit'

type ModeBarProps = {
  interaction: Interaction
  onChange: (interaction: Interaction) => void
  /** Undo and redo, shown while editing; absent when there's nothing to step to. */
  onUndo: (() => void) | undefined
  onRedo: (() => void) | undefined
}

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

/**
 * Top right of the 3D view: the edit toggle, and while editing, history and which tool to its left. It floats above the
 * right panel, which keeps room for it, so opening the panel doesn't move it.
 */
export const ModeBar = ({ interaction, onChange, onUndo, onRedo }: ModeBarProps) => {
  const editing = interaction !== 'view'
  return (
    <div className="modebar">
      <button
        className="float edit-toggle"
        aria-pressed={editing}
        title={editing ? 'Stop editing (E)' : 'Edit (E)'}
        onClick={() => onChange(editing ? 'view' : 'edit')}
      >
        <PenLine size={16} />
        <span>Edit</span>
      </button>
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
