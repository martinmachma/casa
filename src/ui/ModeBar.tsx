import { Eye, MousePointer2, PenLine, Ruler } from 'lucide-react'
import type { Interaction } from '../scene/selection'
import { Segmented } from './kit'

type ModeBarProps = { interaction: Interaction; onChange: (interaction: Interaction) => void }

/** Icons at the top right of the 3D view: just looking, or editing, and while editing, which tool. */
export const ModeBar = ({ interaction, onChange }: ModeBarProps) => {
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
        <Segmented
          label="Tool"
          className="float tools"
          value={interaction}
          onChange={onChange}
          options={[
            { value: 'edit', label: 'Select', icon: <MousePointer2 size={17} />, iconOnly: true },
            { value: 'measure', label: 'Measure (M)', icon: <Ruler size={17} />, iconOnly: true },
          ]}
        />
      )}
    </div>
  )
}
