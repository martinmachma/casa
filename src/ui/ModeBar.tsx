import { Eye, Lightbulb, MousePointer2, PenLine, Redo2, Ruler, Undo2 } from 'lucide-react'
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

/** Icons at the top right of the 3D view: just looking, or editing, and while editing, which tool. */
export const ModeBar = ({ interaction, onChange, onUndo, onRedo }: ModeBarProps) => {
  const editing = interaction !== 'view'
  return (
    <div className="modebar">
      <Segmented
        label="Mode"
        className="float"
        value={editing ? 'edit' : 'view'}
        onChange={(mode) => onChange(mode === 'edit' ? 'edit' : 'view')}
        options={[
          { value: 'view', label: 'View (E)', icon: <Eye size={17} />, iconOnly: true },
          { value: 'edit', label: 'Edit (E)', icon: <PenLine size={17} />, iconOnly: true },
        ]}
      />
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
            { value: 'measure', label: 'Measure (M)', icon: <Ruler size={17} />, iconOnly: true },
            { value: 'devices', label: 'Devices (D)', icon: <Lightbulb size={17} />, iconOnly: true },
          ]}
        />
      )}
    </div>
  )
}
