import { useState, type ReactNode } from 'react'
import type { CameraNudgeAxis } from '../scene/cameraNudge'

type Hold = {
  /** A button went down: keep moving along `axis` in direction `value`. */
  onHold: (axis: CameraNudgeAxis, value: number) => void
  /** It came up again. */
  onRelease: (axis: CameraNudgeAxis, value: number) => void
}

type CameraPadProps = Hold & {
  /** Which buttons make sense for the current camera. */
  mode: 'top' | 'orbit' | 'walk'
  onReset: () => void
}

const HIDDEN_KEY = 'casa.cameraPad.hidden'

const readHidden = () => {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

/** On-screen camera buttons: hold to keep moving. Made for thumbs, works with a mouse too. */
export const CameraPad = ({ onHold, onRelease, mode, onReset }: CameraPadProps) => {
  const [hidden, setHidden] = useState(readHidden)

  const toggle = () => {
    setHidden(!hidden)
    try {
      localStorage.setItem(HIDDEN_KEY, hidden ? '0' : '1')
    } catch {
      // Remembering is a nicety.
    }
  }

  if (hidden)
    return (
      <div className="camera-pad camera-pad-hidden">
        <button className="pad-btn" onClick={toggle} aria-label="Show camera buttons">
          ✥
        </button>
      </div>
    )

  const hold = (axis: CameraNudgeAxis, value: number, label: string, icon: ReactNode) => (
    <HoldButton onHold={onHold} onRelease={onRelease} axis={axis} value={value} label={label}>
      {icon}
    </HoldButton>
  )

  const reset = (
    <button className="pad-btn" onClick={onReset} aria-label={mode === 'walk' ? 'Back to the start' : 'Reset view'}>
      ⌂
    </button>
  )
  const hide = (
    <button className="pad-btn pad-btn-small" onClick={toggle} aria-label="Hide camera buttons">
      ✕
    </button>
  )

  if (mode === 'walk')
    return (
      <div className="camera-pad" aria-label="Walking">
        <div className="pad-grid">
          {hold('right', -1, 'Step left', '⇠')}
          {hold('forward', 1, 'Walk forward', '▲')}
          {hold('right', 1, 'Step right', '⇢')}
          {hold('turn', -1, 'Turn left', '◀')}
          {reset}
          {hold('turn', 1, 'Turn right', '▶')}
          <span />
          {hold('forward', -1, 'Walk back', '▼')}
          <span />
        </div>
        <div className="pad-column">
          {hold('tilt', 1, 'Look up', '⤒')}
          {hold('tilt', -1, 'Look down', '⤓')}
          {hide}
        </div>
      </div>
    )

  return (
    <div className="camera-pad" aria-label="Camera">
      <div className="pad-grid">
        {mode === 'orbit' ? hold('turn', -1, 'Rotate left', '⟲') : <span />}
        {hold('forward', 1, 'Move up', '▲')}
        {mode === 'orbit' ? hold('turn', 1, 'Rotate right', '⟳') : <span />}
        {hold('right', -1, 'Move left', '◀')}
        {reset}
        {hold('right', 1, 'Move right', '▶')}
        {mode === 'orbit' ? hold('tilt', 1, 'Tilt up', '⤒') : <span />}
        {hold('forward', -1, 'Move down', '▼')}
        {mode === 'orbit' ? hold('tilt', -1, 'Tilt down', '⤓') : <span />}
      </div>
      <div className="pad-column">
        {hold('zoom', 1, 'Zoom in', '+')}
        {hold('zoom', -1, 'Zoom out', '−')}
        {hide}
      </div>
    </div>
  )
}

type HoldButtonProps = Hold & {
  axis: CameraNudgeAxis
  value: number
  label: string
  children: ReactNode
}

const HoldButton = ({ onHold, onRelease, axis, value, label, children }: HoldButtonProps) => {
  const release = () => onRelease(axis, value)
  return (
    <button
      className="pad-btn"
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        // Keep receiving the release even if the finger slides off the button.
        if (e.currentTarget.hasPointerCapture?.(e.pointerId) === false)
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // Synthetic pointers can't be captured; the button still works.
          }
        onHold(axis, value)
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  )
}
