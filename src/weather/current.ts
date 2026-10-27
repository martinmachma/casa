import { house } from '../layout/layout'
import { weatherGroup, type WeatherGroup } from './confidence'

const params = new URLSearchParams({
  latitude: String(house.site.latitude),
  longitude: String(house.site.longitude),
  timezone: house.site.timeZone,
  current: 'temperature_2m,weather_code,is_day',
})
const CURRENT_URL = `https://api.open-meteo.com/v1/forecast?${params}`
const MAX_AGE = 15 * 60 * 1000

export type CurrentWeather = { temperature: number; group: WeatherGroup; day: boolean }

let cache: { at: number; value: CurrentWeather } | undefined
let pending: Promise<CurrentWeather> | undefined

/** The weather at the house right now, for the top bar; shared and kept for a quarter of an hour. */
export const loadCurrent = (): Promise<CurrentWeather> => {
  if (cache && Date.now() - cache.at < MAX_AGE) return Promise.resolve(cache.value)
  pending ??= (async () => {
    const result = await fetch(CURRENT_URL, { signal: AbortSignal.timeout(15000) })
    if (!result.ok) throw new Error(`Weather service returned ${result.status}`)
    const { current } = (await result.json()) as {
      current?: { temperature_2m?: unknown; weather_code?: unknown; is_day?: unknown }
    }
    const temperature = current?.temperature_2m
    const code = current?.weather_code
    if (typeof temperature !== 'number' || typeof code !== 'number') throw new Error('Missing current weather')
    const value = { temperature, group: weatherGroup(code), day: current?.is_day !== 0 }
    cache = { at: Date.now(), value }
    return value
  })().finally(() => {
    pending = undefined
  })
  return pending
}
