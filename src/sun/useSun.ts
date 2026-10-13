import { house } from '../layout/layout'

/** The sun settings: off, or a date and wall-clock time at the house. */
export type SunSettings = { date: string; minutes: number }

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
