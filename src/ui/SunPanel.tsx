import { CalendarDays, Sun, X } from 'lucide-react'
import { useState } from 'react'
import type { SunPosition } from '../sun/sun'
import { sunNow, type SunSettings } from '../sun/useSun'
import { IconButton } from './kit'

type SunPanelProps = {
  /** Undefined while sunlight is off (even light). */
  sun: SunSettings | undefined
  position: SunPosition | undefined
  onSun: (sun: SunSettings | undefined) => void
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

/** Bottom centre of the 3D view: a sun button that opens into a timeline of the day while sunlight is on. */
export const SunPanel = ({ sun, position, onSun }: SunPanelProps) => {
  const [dateOpen, setDateOpen] = useState(false)
  const toggle = (
    <IconButton
      label={sun ? 'Even light' : 'Sunlight by time of day'}
      aria-pressed={Boolean(sun)}
      small
      onClick={() => onSun(sun ? undefined : sunNow())}
    >
      <Sun size={17} />
    </IconButton>
  )
  if (!sun) return <div className="toolbar float">{toggle}</div>

  const year = sun.date.slice(0, 4)
  return (
    <div className="toolbar sunbar float" data-open="">
      <Sun size={17} className="toolbar-icon" />
      <div className="sunbar-time">
        <strong>{clock(sun.minutes)}</strong>
        <span className="sunbar-sun">
          {position && position.altitude > 0 ? `${deg(position.altitude)}° ${compass(position.azimuth)}` : 'Down'}
        </span>
      </div>
      <input
        className="sunbar-slider"
        type="range"
        min={4 * 60}
        max={22 * 60}
        step={5}
        value={sun.minutes}
        onChange={(e) => onSun({ ...sun, minutes: Number(e.target.value) })}
        aria-label="Time of day"
      />
      <IconButton label="Date" aria-pressed={dateOpen} small onClick={() => setDateOpen(!dateOpen)}>
        <CalendarDays size={16} />
      </IconButton>
      <IconButton label="Even light" small onClick={() => onSun(undefined)}>
        <X size={16} />
      </IconButton>
      {dateOpen && (
        <div className="sunbar-date float">
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
      )}
    </div>
  )
}
