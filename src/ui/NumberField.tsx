import { useState } from 'react'

type NumberFieldProps = {
  label: string
  value: number
  min?: number
  onCommit: (value: number) => void
}

/** A number input that only reports a value once it's valid and the user leaves the field or presses Enter. */
export const NumberField = ({ label, value, min = 1, onCommit }: NumberFieldProps) => {
  const [draft, setDraft] = useState<string>()

  const commit = () => {
    if (draft === undefined) return
    const n = Number(draft)
    if (Number.isFinite(n) && n >= min) onCommit(n)
    setDraft(undefined)
  }

  return (
    <label className="field">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={min}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  )
}
