import { Radio, Save, Undo2 } from 'lucide-react'
import { useState } from 'react'
import type { HouseData } from '../data/useHouseData'

const defaultName = () =>
  new Date().toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Shown while there are unsaved edits: save them as a new version (and make it live), or throw them away. */
export const SaveBar = ({ data }: { data: HouseData }) => {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [placeholder] = useState(defaultName)

  const save = async (makeLive: boolean) => {
    setSaving(true)
    await data.saveDraft(name.trim() || placeholder, makeLive)
    setSaving(false)
    setName('')
  }

  return (
    <form
      className="savebar float"
      onSubmit={(e) => {
        e.preventDefault()
        save(false)
      }}
    >
      <span className="savebar-title">Unsaved changes</span>
      <input
        className="savebar-name"
        value={name}
        maxLength={80}
        placeholder={placeholder}
        aria-label="Version name"
        onChange={(e) => setName(e.target.value)}
      />
      <button className="btn btn-small" type="submit" disabled={saving} title="Save as a new version">
        <Save size={15} />
        Save
      </button>
      <button
        className="btn btn-small btn-primary"
        type="button"
        disabled={saving}
        title="Save as a new version and make it the live one"
        onClick={() => save(true)}
      >
        <Radio size={15} />
        Save &amp; make live
      </button>
      <button
        className="btn btn-small btn-ghost"
        type="button"
        disabled={saving}
        title="Discard the changes"
        aria-label="Discard"
        onClick={() => confirm('Discard your unsaved changes?') && data.discardDraft()}
      >
        <Undo2 size={15} />
      </button>
    </form>
  )
}
