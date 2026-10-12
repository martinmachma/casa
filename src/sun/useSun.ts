import { useState } from 'react'
import { house } from '../layout/layout'

/** The sun settings: off, or a date and wall-clock time at the house. */
export type SunSettings = { date: string; minutes: number }

const NORTH_KEY = 'casa.sun.north'

const today = (timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date()) // YYYY-MM-DD

const nowMinutes = (timeZone: string) => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date())
    .split(':')
    .map(Number)
  return h * 60 + m
}

export const sunNow = (): SunSettings => ({
  date: today(house.site.timeZone),
  minutes: nowMinutes(house.site.timeZone),
})

const readNorth = () => {
  try {
    const saved = Number(localStorage.getItem(NORTH_KEY))
    return localStorage.getItem(NORTH_KEY) !== null && Number.isFinite(saved) ? saved : house.site.north
  } catch {
    return house.site.north
  }
}

/**
 * Where north is. The real bearing isn't known yet, so it can be turned in the app; that is remembered on this
 * device only. Once known, put it in `site.north` in house.json.
 */
export const useNorth = () => {
  const [north, setNorthState] = useState(readNorth)
  const setNorth = (degrees: number) => {
    setNorthState(degrees)
    try {
      localStorage.setItem(NORTH_KEY, String(degrees))
    } catch {
      // Not remembered; fine.
    }
  }
  return [north, setNorth] as const
}
