import { ChevronLeft, ChevronRight, Cloud, Droplets } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { house } from '../layout/layout'
import { formatValue, summarizeDay } from '../weather/confidence'
import { CACHE_MAX_AGE, loadForecast, MODELS, readForecast, type ForecastDay } from '../weather/forecast'
import { IconButton, PanelHead } from './kit'
import { WEATHER_ICONS } from './weatherIcons'

const temperature = (value: number) => `${formatValue(value)}°`
const rangeText = ([min, max]: [number, number]) => `${formatValue(min)}–${formatValue(max)}`

export const WeatherPopup = ({ onClose }: { onClose: () => void }) => {
  const [openedAt] = useState(Date.now)
  const [forecast, setForecast] = useState(readForecast)
  const [loading, setLoading] = useState(() => {
    const cached = readForecast()
    return !cached || Date.now() - cached.updatedAt >= CACHE_MAX_AGE
  })
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [canBack, setCanBack] = useState(false)
  const [canForward, setCanForward] = useState(false)
  const [detail, setDetail] = useState<ForecastDay>()
  const popup = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)

  /** Shows an arrow only where there are more days that way. */
  const updateArrows = () => {
    const el = strip.current
    if (!el) return
    setCanBack(el.scrollLeft > 1)
    setCanForward(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }
  // The arrows follow the strip's size and the days arriving.
  useEffect(() => {
    const observer = new ResizeObserver(updateArrows)
    if (strip.current) observer.observe(strip.current)
    if (track.current) observer.observe(track.current)
    return () => observer.disconnect()
  }, [])
  /** Slides half the visible days along; the rest are already rendered, so it's smooth. */
  const slide = (direction: 1 | -1) =>
    strip.current?.scrollBy({ left: (direction * strip.current.clientWidth) / 2, behavior: 'smooth' })

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    popup.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => previous?.focus()
  }, [])

  useEffect(() => {
    let active = true
    loadForecast()
      .then((data) => {
        if (active) setForecast(data)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [attempt])

  const ranges =
    forecast?.days.flatMap((day) => day.models.flatMap((model) => (model ? [model.high, model.low] : []))) ?? []
  const scale: [number, number] = ranges.length ? [Math.min(...ranges), Math.max(...ranges)] : [0, 1]
  const days = forecast?.days ?? []
  const updated = forecast && (
    <span title={new Date(forecast.updatedAt).toLocaleString(undefined, { timeZone: house.site.timeZone })}>
      Updated{' '}
      {new Date(forecast.updatedAt).toLocaleTimeString(undefined, {
        timeZone: house.site.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })}
      {openedAt - forecast.updatedAt >= CACHE_MAX_AGE ? ' · Saved forecast' : ''}
      {' · '}
      {/* Open-Meteo's licence asks for attribution. */}
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
        Open-Meteo
      </a>
    </span>
  )

  return (
    // Clicking the dimmed house around the forecast closes it.
    <div className="weather-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={popup}
        className="weather-popup"
        role="dialog"
        aria-label="Weather forecast"
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Escape') onClose()
        }}
      >
        <PanelHead title="Weather at home" sub={updated} onClose={onClose} />
        {loading && (
          <p className="weather-status" role="status">
            {forecast ? 'Updating forecast…' : 'Loading forecast…'}
          </p>
        )}
        {error && (
          <div className="weather-status weather-error" role="alert">
            <span>
              {forecast
                ? 'Could not update. Showing saved forecast.'
                : 'Could not load the forecast. Check your connection.'}
            </span>
            <button
              className="btn btn-small"
              onClick={() => {
                setError(false)
                setLoading(true)
                setAttempt((n) => n + 1)
              }}
            >
              Retry
            </button>
          </div>
        )}
        <div className="weather-strip-wrap">
          <div className="weather-strip" ref={strip} onScroll={updateArrows}>
            <div className="weather-track" ref={track}>
              {days.map((day) => (
                <DayCard key={day.date} day={day} scale={scale} onOpen={() => setDetail(day)} />
              ))}
            </div>
          </div>
          {canBack && (
            <IconButton label="Earlier days" className="weather-arrow weather-arrow-back" onClick={() => slide(-1)}>
              <ChevronLeft size={20} />
            </IconButton>
          )}
          {canForward && (
            <IconButton label="Later days" className="weather-arrow" onClick={() => slide(1)}>
              <ChevronRight size={20} />
            </IconButton>
          )}
        </div>
        {detail && <DayDetail day={detail} onClose={() => setDetail(undefined)} />}
      </div>
    </div>
  )
}

const weekday = (date: Date) => date.toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })
const dayMonth = (date: Date) => date.toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' })

const DayCard = ({ day, scale, onOpen }: { day: ForecastDay; scale: [number, number]; onOpen: () => void }) => {
  const summary = summarizeDay(day.models)
  const date = new Date(`${day.date}T12:00:00Z`)
  const Icon = summary ? WEATHER_ICONS[summary.group] : Cloud
  return (
    <button className="weather-day" onClick={onOpen} aria-haspopup="dialog">
      <span className="weather-day-head">
        <span className="weather-date">
          <strong>{weekday(date)}</strong>
          <span>{dayMonth(date)}</span>
        </span>
        <span className="weather-model-count">{summary?.count ?? 0} of 4 models</span>
      </span>
      <Icon size={36} className="weather-day-icon" aria-label={summary?.group ?? 'Unavailable'} role="img" />
      <span className="weather-temperatures">
        {summary ? (
          <>
            <strong>{temperature(summary.high)}</strong>
            <span>{temperature(summary.low)}</span>
          </>
        ) : (
          '—'
        )}
      </span>
      {summary ? (
        <>
          <span className="weather-range-label">
            <span>Model temperatures</span>
            <span>{rangeText(summary.temperatureRange)} °C</span>
          </span>
          <span className="weather-range" aria-hidden>
            <span
              style={{
                left: `${((summary.temperatureRange[0] - scale[0]) / (scale[1] - scale[0] || 1)) * 100}%`,
                width: `${((summary.temperatureRange[1] - summary.temperatureRange[0]) / (scale[1] - scale[0] || 1)) * 100}%`,
              }}
            />
          </span>
          <span className="weather-rain" title={`${summary.wet} of ${summary.count} models expect rain`}>
            <Droplets size={13} aria-hidden />
            {rangeText(summary.rainRange)} mm · {summary.wet}/{summary.count} models wet
          </span>
          <span className="weather-confidence-line">
            {summary.confidence && (
              <span className={`weather-badge weather-${summary.confidence.toLowerCase()}`}>{summary.confidence}</span>
            )}
            <span>{summary.reason}</span>
          </span>
        </>
      ) : (
        <span className="weather-rain">No models available for this day</span>
      )}
    </button>
  )
}

/** A small dialog over the forecast with each model's numbers for one day. */
const DayDetail = ({ day, onClose }: { day: ForecastDay; onClose: () => void }) => {
  const summary = summarizeDay(day.models)
  const date = new Date(`${day.date}T12:00:00Z`)
  const dialog = useRef<HTMLDivElement>(null)

  // Focus moves in so Escape closes just this, and back to the day afterwards.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => previous?.focus()
  }, [])

  return (
    <div className="weather-detail-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialog}
        className="weather-detail"
        role="dialog"
        aria-label={`Model forecasts for ${day.date}`}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          onClose()
        }}
      >
        <PanelHead title={`${weekday(date)} ${dayMonth(date)}`} sub="Each model's forecast" onClose={onClose} />
        <table className="weather-models">
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">High °C</th>
              <th scope="col">Low °C</th>
              <th scope="col">Rain mm</th>
            </tr>
          </thead>
          <tbody>
            {MODELS.map((model, i) => {
              const values = day.models[i]
              return (
                <tr key={model.id}>
                  <th scope="row">{model.label}</th>
                  <td>{values ? formatValue(values.high) : '—'}</td>
                  <td>{values ? formatValue(values.low) : '—'}</td>
                  <td>{values ? formatValue(values.rain) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {summary && (
          <p className="weather-model-note">
            Median rain {formatValue(summary.rain)} mm · High spread {rangeText(summary.highRange)} °C · Low spread{' '}
            {rangeText(summary.lowRange)} °C
          </p>
        )}
      </div>
    </div>
  )
}
