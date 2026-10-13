import { Eye, MousePointer2, PenLine, Ruler } from 'lucide-react'
import type { Interaction } from '../scene/selection'
import { Segmented } from './kit'

type ModeBarProps = { interaction: Interaction; onChange: (interaction: Interaction) => void }

/** Floats over the 3D view: just looking, or editing, and while editing, which tool. */
export const ModeBar = ({ interaction, onChange }: ModeBarProps) => {
  const editing = interaction !== 'view'
  return (
    <div className="modebar float">
      <Segmented
        label="Mode"
        value={editing ? 'edit' : 'view'}
        onChange={(mode) => onChange(mode === 'edit' ? 'edit' : 'view')}
        options={[
          { value: 'view', label: 'View', icon: <Eye size={15} /> },
          { value: 'edit', label: 'Edit', icon: <PenLine size={15} /> },
        ]}
      />
      {editing && (
        <>
          <span className="modebar-divider" />
          <Segmented
            label="Tool"
            className="tools"
            value={interaction}
            onChange={onChange}
            options={[
              { value: 'edit', label: 'Select', icon: <MousePointer2 size={15} /> },
              { value: 'measure', label: 'Measure', icon: <Ruler size={15} /> },
            ]}
          />
        </>
      )}
    </div>
  )
}
