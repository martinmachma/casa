import {
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  House,
  MoveLeft,
  MoveRight,
  RotateCcw,
  RotateCw,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { CameraNudgeAxis } from '../scene/cameraNudge'

type Hold = {
  /** A button went down: keep moving along `axis` in direction `value`. */
  onHold: (axis: CameraNudgeAxis, value: number) => void
  /** It came up again. */
  onRelease: (axis: CameraNudgeAxis, value: number) => void
}

type CameraPadProps = Hold & {
  onReset: () => void
}

/** On-screen walking buttons: hold to keep moving. Made for thumbs, works with a mouse too. */
export const CameraPad = ({ onHold, onRelease, onReset }: CameraPadProps) => {
  const hold = (axis: CameraNudgeAxis, value: number, label: string, icon: ReactNode) => (
    <HoldButton onHold={onHold} onRelease={onRelease} axis={axis} value={value} label={label}>
      {icon}
    </HoldButton>
  )

  const reset = (
    <button className="pad-btn pad-btn-home" onClick={onReset} aria-label="Back to the start" title="Back to the start">
      <House size={17} />
    </button>
  )

  return (
    <div className="camera-pad float" aria-label="Walking">
      <div className="pad-grid">
        {hold('right', -1, 'Step left', <MoveLeft size={18} />)}
        {hold('forward', 1, 'Walk forward', <ChevronUp size={20} />)}
        {hold('right', 1, 'Step right', <MoveRight size={18} />)}
        {hold('turn', -1, 'Turn left', <RotateCcw size={17} />)}
        {reset}
        {hold('turn', 1, 'Turn right', <RotateCw size={17} />)}
        <span />
        {hold('forward', -1, 'Walk back', <ChevronDown size={20} />)}
        <span />
      </div>
      <div className="pad-column">
        {hold('tilt', 1, 'Look up', <ChevronsUp size={18} />)}
        {hold('tilt', -1, 'Look down', <ChevronsDown size={18} />)}
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
