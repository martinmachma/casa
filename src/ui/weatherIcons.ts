import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from 'lucide-react'
import type { WeatherGroup } from '../weather/confidence'

export const WEATHER_ICONS: Record<WeatherGroup, typeof Sun> = {
  Clear: Sun,
  'Partly cloudy': CloudSun,
  Cloudy: Cloud,
  Fog: CloudFog,
  Rain: CloudRain,
  Snow: CloudSnow,
  Thunderstorm: CloudLightning,
}
