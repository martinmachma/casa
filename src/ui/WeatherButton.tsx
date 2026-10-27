import { Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { loadCurrent, type CurrentWeather } from '../weather/current'
import { WEATHER_ICONS } from './weatherIcons'

const REFRESH = 15 * 60 * 1000

/** The top bar's weather: what it's like at the house now; opens the forecast. */
export const WeatherButton = ({ onClick }: { onClick: () => void }) => {
  const [now, setNow] = useState<CurrentWeather>()

  useEffect(() => {
    let active = true
    const load = () =>
      loadCurrent()
        .then((value) => active && setNow(value))
        .catch(() => {
          // The button still opens the forecast; it just shows no reading.
        })
    void load()
    const timer = setInterval(load, REFRESH)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  const clearNight = now && !now.day && now.group === 'Clear'
  const Icon = clearNight ? Moon : WEATHER_ICONS[now?.group ?? 'Partly cloudy']
  const label = now ? (now.group === 'Clear' && now.day ? 'Sunny' : now.group) : undefined
  return (
    <button className="weather-button" onClick={onClick} aria-haspopup="dialog" title="Weather forecast">
      <Icon
        size={26}
        className="weather-button-icon"
        data-sun={now?.group === 'Clear' && now.day ? '' : undefined}
        aria-hidden
      />
      <span className="weather-button-text">
        <strong>Weather</strong>
        {now && (
          <span>
            {Math.round(now.temperature)}°C {label}
          </span>
        )}
      </span>
    </button>
  )
}
