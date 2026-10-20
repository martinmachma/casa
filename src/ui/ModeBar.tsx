import { Lightbulb, MousePointer2, PanelRightOpen, PenLine, Redo2, Undo2 } from 'lucide-react'
import type { Interaction } from '../scene/selection'
import { IconButton, Segmented } from './kit'

type ModeBarProps = {
  interaction: Interaction
  onChange: (interaction: Interaction) => void
  /** Undo and redo, shown while editing; absent when there's nothing to step to. */
  onUndo: (() => void) | undefined
  onRedo: (() => void) | undefined
  onOpenPanel?: () => void
}

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

/** The panel header while open; floats over the view when the panel is closed. */
export const ModeBar = ({ interaction, onChange, onUndo, onRedo, onOpenPanel }: ModeBarProps) => {
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
