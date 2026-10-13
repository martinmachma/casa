import { ArrowUp } from 'lucide-react'
import type { SunPosition } from '../sun/sun'
import { sunNow, type SunSettings } from '../sun/useSun'
import { Section, Switch } from './kit'

type SunPanelProps = {
  /** Undefined while sunlight is off (even light). */
  sun: SunSettings | undefined
  position: SunPosition | undefined
  north: number
  onSun: (sun: SunSettings | undefined) => void
  onNorth: (degrees: number) => void
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

export const SunPanel = ({ sun, position, north, onSun, onNorth }: SunPanelProps) => {
  const year = sun?.date.slice(0, 4)
  return (
    <Section title="Sunlight">
      <Switch label="Light by time of day" checked={Boolean(sun)} onChange={(on) => onSun(on ? sunNow() : undefined)} />
      {sun && position && (
        <>
          <p className="hint">
            {position.altitude > 0
              ? `The sun is ${deg(position.altitude)}° high in the ${compass(position.azimuth)}.`
              : 'The sun is down.'}
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
            <button className="btn btn-small btn-ghost" onClick={() => onSun(sunNow())}>
              Now
            </button>
          </div>

          <label className="field">
            <span className="field-row">
              <span>North</span>
              <span className="row">
                <span className="north-arrow" style={{ transform: `rotate(${north}deg)` }} aria-hidden>
                  <ArrowUp size={14} />
                </span>
                <strong>{north}°</strong>
              </span>
            </span>
            <input type="range" min={0} max={359} value={north} onChange={(e) => onNorth(Number(e.target.value))} />
          </label>
          <p className="hint">North is a guess until the site plan says; turn it to match the arrow on the floor.</p>
        </>
      )}
    </Section>
  )
}
