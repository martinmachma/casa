import { ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, X } from 'lucide-react'
import type { ShadeState } from '../devices/shades'
import { IconButton } from './kit'

/** One press of a single arrow lets the shade down (or takes it up) to the next quarter. */
const STEPS = 4
const EPS = 1e-6

const TILTS = [
  { tilt: 0, label: 'Slats open' },
  { tilt: 0.5, label: 'Slats half shut' },
  { tilt: 1, label: 'Slats shut' },
]

/** Three slats seen end-on, turned as far as the tilt turns the real ones. */
const SlatsIcon = ({ tilt }: { tilt: number }) => {
  const angle = tilt * 75
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      {[4, 9, 14].map((y) => (
        <line
          key={y}
          x1="3.5"
          x2="14.5"
          y1={y}
          y2={y}
          transform={`rotate(${angle} 9 ${y})`}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

type ShadeControlsProps = {
  name: string
  shade: ShadeState
  onChange: (patch: Partial<ShadeState>) => void
  onClose: () => void
}

/** A shade's controls beside it, without a card: a close button, arrows up and down, and how far the slats turn. */
export const ShadeControls = ({ name, shade, onChange, onClose }: ShadeControlsProps) => {
  const p = shade.position
  const up = p <= EPS
  const down = p >= 1 - EPS
  return (
    <div className="shade-controls">
      <div className="shade-group float">
        <IconButton label={`Close ${name}`} onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="shade-buttons">
        <div className="shade-group float" role="group" aria-label="Up and down">
          <IconButton label="All the way up" disabled={up} onClick={() => onChange({ position: 0 })}>
            <ChevronsUp size={18} />
          </IconButton>
          <IconButton
            label="Up a bit"
            disabled={up}
            onClick={() => onChange({ position: Math.max(0, (Math.ceil(p * STEPS - EPS) - 1) / STEPS) })}
          >
            <ChevronUp size={18} />
          </IconButton>
          <IconButton
            label="Down a bit"
            disabled={down}
            onClick={() => onChange({ position: Math.min(1, (Math.floor(p * STEPS + EPS) + 1) / STEPS) })}
          >
            <ChevronDown size={18} />
          </IconButton>
          <IconButton label="All the way down" disabled={down} onClick={() => onChange({ position: 1 })}>
            <ChevronsDown size={18} />
          </IconButton>
        </div>
        <div className="shade-group float" role="group" aria-label="Slats">
          {TILTS.map((t) => (
            <IconButton
              key={t.tilt}
              label={up ? `${t.label} (let it down first)` : t.label}
              disabled={up}
              aria-pressed={Math.abs(shade.tilt - t.tilt) < 0.05}
              onClick={() => onChange({ tilt: t.tilt })}
            >
              <SlatsIcon tilt={t.tilt} />
            </IconButton>
          ))}
        </div>
      </div>
    </div>
  )
}
