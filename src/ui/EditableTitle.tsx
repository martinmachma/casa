import { Pencil } from 'lucide-react'
import { useRef, useState } from 'react'

/** A title that becomes a selected text field on click; Enter saves and Escape cancels. */
export const EditableTitle = ({ value, onChange }: { value: string; onChange: (name: string) => void }) => {
  const [draft, setDraft] = useState<string>()
  const cancelled = useRef(false)

  return draft === undefined ? (
    <button
      className="editable-title"
      aria-label={`Rename ${value}`}
      title="Rename"
      onClick={() => {
        cancelled.current = false
        setDraft(value)
      }}
    >
      <span>{value}</span>
      <Pencil size={13} aria-hidden />
    </button>
  ) : (
    <input
      className="editable-title-input"
      aria-label="Name"
      autoFocus
      value={draft}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        const name = e.currentTarget.value.trim()
        setDraft(undefined)
        if (!cancelled.current && name && name !== value) onChange(name)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== 'Escape') return
        e.preventDefault()
        e.stopPropagation()
        cancelled.current = e.key === 'Escape'
        e.currentTarget.blur()
      }}
    />
  )
}
