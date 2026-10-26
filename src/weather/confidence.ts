export const HIGH_TEMPERATURE_SPREAD = 2
export const MEDIUM_TEMPERATURE_SPREAD = 4
export const WET_THRESHOLD_MM = 1

export type ModelValues = { high: number; low: number; rain: number; code: number }
export type Confidence = 'High' | 'Medium' | 'Low'
export type WeatherGroup = 'Clear' | 'Partly cloudy' | 'Cloudy' | 'Fog' | 'Rain' | 'Snow' | 'Thunderstorm'

export const weatherGroup = (code: number): WeatherGroup => {
  if (code === 0) return 'Clear'
  if (code <= 2) return 'Partly cloudy'
  if (code === 3) return 'Cloudy'
  if (code <= 48) return 'Fog'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Snow'
  if (code >= 95) return 'Thunderstorm'
  return 'Rain'
}

export const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const range = (values: number[]): [number, number] => [Math.min(...values), Math.max(...values)]
export const formatValue = (value: number) => Number(value.toFixed(1)).toString()

/** Agreement between deterministic models, not a calibrated probability of accuracy. */
export const summarizeDay = (values: (ModelValues | null)[]) => {
  const models = values.filter((value) => value !== null)
  if (!models.length) return null
  const highs = models.map((m) => m.high)
  const lows = models.map((m) => m.low)
  const rains = models.map((m) => m.rain)
  const highRange = range(highs)
  const lowRange = range(lows)
  const highSpread = highRange[1] - highRange[0]
  const lowSpread = lowRange[1] - lowRange[0]
  const spread = Math.max(highSpread, lowSpread)
  const wet = rains.filter((rain) => rain >= WET_THRESHOLD_MM).length
  const odd = Math.min(wet, models.length - wet)
  const temperatureLevel = spread <= HIGH_TEMPERATURE_SPREAD ? 0 : spread <= MEDIUM_TEMPERATURE_SPREAD ? 1 : 2
  const rainLevel = odd === 0 ? 0 : wet * 2 === models.length ? 2 : 1
  const level = Math.max(temperatureLevel, rainLevel)
  const temperatures = highSpread >= lowSpread ? highRange : lowRange
  const groups = models.map((m) => weatherGroup(m.code))
  // Ties use the first model in the fixed ECMWF, ICON, GFS, ALADIN order.
  const group = groups.reduce((best, candidate) =>
    groups.filter((g) => g === candidate).length > groups.filter((g) => g === best).length ? candidate : best,
  )
  const confidence: Confidence | null = models.length < 2 ? null : (['High', 'Medium', 'Low'] as const)[level]
  const reason =
    models.length < 2
      ? 'Only one model reaches this far'
      : rainLevel > 0 && rainLevel >= temperatureLevel
        ? `Models disagree about rain (${wet} of ${models.length} expect rain)`
        : temperatureLevel > 0
          ? `${highSpread >= lowSpread ? 'Highs' : 'Lows'} range ${formatValue(temperatures[0])}–${formatValue(temperatures[1])} °C`
          : 'Most models agree'
  return {
    high: median(highs),
    low: median(lows),
    rain: median(rains),
    highRange,
    lowRange,
    rainRange: range(rains),
    temperatureRange: [Math.min(...lows), Math.max(...highs)] as [number, number],
    spread,
    wet,
    count: models.length,
    group,
    confidence,
    reason,
  }
}
