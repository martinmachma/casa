import { house } from '../layout/layout'
import type { ModelValues } from './confidence'

export const MODELS = [
  { id: 'ecmwf_ifs', label: 'ECMWF' },
  { id: 'dwd_icon_seamless', label: 'ICON' },
  { id: 'ncep_gfs_global', label: 'GFS' },
  // Standalone CZ model. The seamless variant fills later days with ECMWF.
  { id: 'chmi_aladin_cz_1km', label: 'ALADIN' },
] as const

const VARIABLES = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'weather_code'] as const
const params = new URLSearchParams({
  latitude: String(house.site.latitude),
  longitude: String(house.site.longitude),
  timezone: house.site.timeZone,
  forecast_days: '7',
  daily: VARIABLES.join(','),
  models: MODELS.map((m) => m.id).join(','),
})
export const FORECAST_URL = `https://api.open-meteo.com/v1/forecast?${params}`
export const CACHE_MAX_AGE = 60 * 60 * 1000
const CACHE_KEY = `casa.weather.v1:${params}`

export type ForecastDay = { date: string; models: (ModelValues | null)[] }
type Forecast = { updatedAt: number; days: ForecastDay[] }
type CachedResponse = { updatedAt: number; response: unknown }

const parseResponse = (response: unknown): ForecastDay[] => {
  if (!response || typeof response !== 'object' || !('daily' in response)) throw new Error('Missing daily forecast')
  const daily = response.daily as Record<string, unknown>
  if (!daily || !Array.isArray(daily.time) || daily.time.length !== 7) throw new Error('Incomplete daily forecast')
  return daily.time.map((date: unknown, index: number) => {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid forecast date')
    const models = MODELS.map(({ id }) => {
      const values = VARIABLES.map((variable) => {
        const series = daily[`${variable}_${id}`]
        if (!Array.isArray(series) || series.length !== 7) throw new Error('Incomplete model forecast')
        const value: unknown = series[index]
        if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
          throw new Error('Invalid model forecast')
        }
        return value as number | null
      })
      if (values.some((v) => v === null)) return null
      const [high, low, rain, code] = values as number[]
      return { high, low, rain, code }
    })
    return { date, models }
  })
}

let memoryCache: Forecast | undefined
let pending: Promise<Forecast> | undefined

export const readForecast = (): Forecast | undefined => {
  if (memoryCache) return memoryCache
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as CachedResponse | null
    if (cached && Number.isFinite(cached.updatedAt) && cached.updatedAt > 0 && cached.updatedAt <= Date.now()) {
      memoryCache = { updatedAt: cached.updatedAt, days: parseResponse(cached.response) }
    }
  } catch {
    // A corrupt cache or disabled storage must not prevent fetching a forecast.
  }
  return memoryCache
}

/** Share in-flight requests, including React StrictMode's repeated mount. Retry is allowed after failures. */
export const loadForecast = (): Promise<Forecast> => {
  const cached = readForecast()
  if (cached && Date.now() - cached.updatedAt < CACHE_MAX_AGE) return Promise.resolve(cached)
  if (pending) return pending
  pending = (async () => {
    const result = await fetch(FORECAST_URL, { signal: AbortSignal.timeout(15000) })
    if (!result.ok) throw new Error(`Weather service returned ${result.status}`)
    const response: unknown = await result.json()
    const days = parseResponse(response)
    if (!days.some((day) => day.models.some((model) => model !== null))) throw new Error('No model data available')
    const updatedAt = Date.now()
    memoryCache = { updatedAt, days }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt, response }))
    } catch {
      // The in-memory cache still avoids repeat requests when storage is unavailable.
    }
    return memoryCache
  })().finally(() => {
    pending = undefined
  })
  return pending
}
