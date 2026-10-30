import { Radio, Save } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { HouseData } from '../data/useHouseData'
import { PanelHead } from './kit'

const defaultName = () =>
  new Date().toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'

/** The toolbar's Save button: lights up while there are unsaved edits and opens a small dialog to name the version. */
export const SaveButton = ({ data }: { data: HouseData }) => {
  const [open, setOpen] = useState(false)
  const { dirty } = data

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (dirty) setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty])

  return (
    <>
      <button
        className="float save-toggle"
        data-dirty={dirty}
        disabled={!dirty}
        title={dirty ? `Save changes (${mod}S)` : 'Nothing to save'}
        onClick={() => setOpen(true)}
      >
        <Save size={16} />
        <span>Save</span>
      </button>
      {open && <SaveDialog data={data} onClose={() => setOpen(false)} />}
    </>
  )
}

const SaveDialog = ({ data, onClose }: { data: HouseData; onClose: () => void }) => {
  const dialog = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [placeholder] = useState(defaultName)

  useEffect(() => dialog.current?.showModal(), [])

  const save = async (makeLive: boolean) => {
    setSaving(true)
    await data.saveDraft(name.trim() || placeholder, makeLive)
    dialog.current?.close()
  }

  const discard = () => {
    if (!confirm('Discard your unsaved changes?')) return
    data.discardDraft()
    dialog.current?.close()
  }

  return (
    <dialog
      ref={dialog}
      className="settings-dialog save-dialog"
      onClose={onClose}
      aria-labelledby="save-title"
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.target === e.currentTarget && dialog.current?.close()}
    >
      <PanelHead
        title={<span id="save-title">Save version</span>}
        onClose={() => dialog.current?.close()}
        closeLabel="Cancel"
      />
      <form
        className="save-form"
        onSubmit={(e) => {
          e.preventDefault()
          save(false)
        }}
      >
        <label className="field">
          Name
          <input
            autoFocus
            value={name}
            maxLength={80}
            placeholder={placeholder}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="save-actions">
          <button className="btn btn-small btn-ghost btn-danger" type="button" disabled={saving} onClick={discard}>
            Discard changes
          </button>
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
        </div>
      </form>
    </dialog>
  )
}
