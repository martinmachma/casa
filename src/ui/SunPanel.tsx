import type { SunPosition } from '../sun/sun'
import { sunNow, type SunSettings } from '../sun/useSun'

type SunPanelProps = {
  sun: SunSettings
  position: SunPosition
  north: number
  onSun: (sun: SunSettings) => void
  onNorth: (degrees: number) => void
  onClose: () => void
}

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const deg = (rad: number) => Math.round((rad * 180) / Math.PI)

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const compass = (rad: number) => COMPASS[Math.round(deg(rad) / 45) % 8]

/** Seasons as dates in the year being looked at. */
const SEASONS = [
  { label: 'Winter', monthDay: '12-21' },
  { label: 'Spring', monthDay: '03-20' },
  { label: 'Summer', monthDay: '06-21' },
]

export const SunPanel = ({ sun, position, north, onSun, onNorth, onClose }: SunPanelProps) => {
  const year = sun.date.slice(0, 4)
  const up = position.altitude > 0
  return (
    <section className="panel" aria-label="Sunlight">
      <div className="panel-head">
        <h2>Sunlight</h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Turn sunlight off">
          ✕
        </button>
      </div>
      <p className="hint">
        {up ? `Sun ${deg(position.altitude)}° high in the ${compass(position.azimuth)}` : 'The sun is down'}
      </p>

      <label className="field">
        <span className="field-row">
          Time <strong>{clock(sun.minutes)}</strong>
        </span>
        <input
          type="range"
          min={4 * 60}
          max={22 * 60}
          step={5}
          value={sun.minutes}
          onChange={(e) => onSun({ ...sun, minutes: Number(e.target.value) })}
        />
      </label>

      <div className="row row-wrap">
        <input
          className="date-input"
          type="date"
          value={sun.date}
          onChange={(e) => e.target.value && onSun({ ...sun, date: e.target.value })}
          aria-label="Date"
        />
        {SEASONS.map((s) => (
          <button
            key={s.label}
            className="btn btn-small"
            aria-pressed={sun.date === `${year}-${s.monthDay}`}
            onClick={() => onSun({ ...sun, date: `${year}-${s.monthDay}` })}
          >
            {s.label}
          </button>
        ))}
        <button className="btn btn-small" onClick={() => onSun(sunNow())}>
          Now
        </button>
      </div>

      <label className="field">
        <span className="field-row">
          North <strong>{north}°</strong>
          <span className="north-arrow" style={{ transform: `rotate(${north}deg)` }} aria-hidden>
            ↑
          </span>
        </span>
        <input type="range" min={0} max={359} value={north} onChange={(e) => onNorth(Number(e.target.value))} />
      </label>
      <p className="hint">
        North is a guess until the site plan says; turn it to match. The arrow points north on the plan.
      </p>
    </section>
  )
}
