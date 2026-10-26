import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { house } from '../layout/layout'
import { formatValue, summarizeDay, type WeatherGroup } from '../weather/confidence'
import { CACHE_MAX_AGE, loadForecast, MODELS, readForecast, type ForecastDay } from '../weather/forecast'
import { PanelHead } from './kit'

const ICONS: Record<WeatherGroup, typeof Sun> = {
  Clear: Sun,
  'Partly cloudy': CloudSun,
  Cloudy: Cloud,
  Fog: CloudFog,
  Rain: CloudRain,
  Snow: CloudSnow,
  Thunderstorm: CloudLightning,
}
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
  const popup = useRef<HTMLDivElement>(null)

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

  return (
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
      <PanelHead title="Weather at home" sub="7 days · agreement across four models" onClose={onClose} />
      <div className="weather-scroll">
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
        {forecast?.days.map((day) => (
          <DayRow key={day.date} day={day} scale={scale} />
        ))}
      </div>
      <footer className="weather-footer">
        {forecast && (
          <span title={new Date(forecast.updatedAt).toLocaleString(undefined, { timeZone: house.site.timeZone })}>
            Updated{' '}
            {new Date(forecast.updatedAt).toLocaleTimeString(undefined, {
              timeZone: house.site.timeZone,
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
            {openedAt - forecast.updatedAt >= CACHE_MAX_AGE ? ' · Saved forecast' : ''}
          </span>
        )}
        <span>Confidence describes model agreement. Rain ≥ 1 mm.</span>
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Weather data by Open-Meteo.com
        </a>
      </footer>
    </div>
  )
}

const DayRow = ({ day, scale }: { day: ForecastDay; scale: [number, number] }) => {
  const summary = summarizeDay(day.models)
  const date = new Date(`${day.date}T12:00:00Z`)
  const Icon = summary ? ICONS[summary.group] : Cloud
  return (
    <details className="weather-day">
      <summary>
        <span className="weather-day-head">
          <span className="weather-date">
            <strong>{date.toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })}</strong>
            <span>{date.toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
          </span>
          <Icon size={24} aria-label={summary?.group ?? 'Unavailable'} role="img" />
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
          <span className="weather-model-count">{summary?.count ?? 0} of 4 models</span>
          <span className="weather-expand" aria-hidden>
            ⌄
          </span>
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
            <span className="weather-rain">
              <Droplets size={13} aria-hidden />
              {summary.wet} of {summary.count} models expect rain · {rangeText(summary.rainRange)} mm
            </span>
            <span className="weather-confidence-line">
              {summary.confidence && (
                <span className={`weather-badge weather-${summary.confidence.toLowerCase()}`}>
                  {summary.confidence}
                </span>
              )}
              <span>{summary.reason}</span>
            </span>
          </>
        ) : (
          <span className="weather-rain">No models available for this day</span>
        )}
      </summary>
      <table className="weather-models">
        <caption>Model forecasts for {day.date}</caption>
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
    </details>
  )
}
