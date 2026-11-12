import { ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, X } from 'lucide-react'
import { shadeText, type ShadeState } from '../devices/shades'
import { IconButton, Segmented } from './kit'

/** One press of a single arrow lets the shade down (or takes it up) to the next quarter. */
const STEPS = 4
const EPS = 1e-6

const TILTS = [
  { tilt: 0, label: 'Slats open', short: 'Open' },
  { tilt: 0.5, label: 'Slats half shut', short: 'Half' },
  { tilt: 1, label: 'Slats shut', short: 'Shut' },
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
  layout?: 'beside' | 'sheet'
}

/** A shade's position and slats: compact arrows beside its window, or labeled controls in the phone sheet. */
export const ShadeControls = ({ name, shade, onChange, onClose, layout = 'beside' }: ShadeControlsProps) => {
  const p = shade.position
  const up = p <= EPS
  const down = p >= 1 - EPS
  if (layout === 'sheet')
    return (
      <div className="shade-sheet-controls">
        <div className="shade-sheet-position">
          <label className="shade-sheet-label">
            <span>Position</span>
            <span className="num">{shadeText(shade)}</span>
            <input
              type="range"
              aria-label="Shade position"
              aria-valuetext={shadeText(shade)}
              min={0}
              max={100}
              step={1}
              value={Math.round(p * 100)}
              onChange={(e) => onChange({ position: Number(e.target.value) / 100 })}
            />
          </label>
          <div className="shade-sheet-actions" role="group" aria-label="Up and down">
            <button className="btn" disabled={up} onClick={() => onChange({ position: 0 })}>
              <ChevronsUp size={18} /> Up
            </button>
            <button className="btn" disabled={down} onClick={() => onChange({ position: 1 })}>
              <ChevronsDown size={18} /> Down
            </button>
          </div>
        </div>
        <fieldset className="shade-sheet-slats" disabled={up}>
          <legend>Slats</legend>
          <Segmented
            label="Slats"
            block
            disabled={up}
            value={String(TILTS.find((t) => Math.abs(shade.tilt - t.tilt) < 0.05)?.tilt)}
            options={TILTS.map((t) => ({ value: String(t.tilt), label: t.short, icon: <SlatsIcon tilt={t.tilt} /> }))}
            onChange={(tilt) => onChange({ tilt: Number(tilt) })}
          />
          {up && <p className="hint">Lower the shade to adjust the slats.</p>}
        </fieldset>
      </div>
    )
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
