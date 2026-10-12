// Where the sun is, from the NOAA low-precision formulas (good to well under a degree, plenty for shadows).

const RAD = Math.PI / 180

export type SunPosition = {
  /** Above the horizon, radians (negative at night). */
  altitude: number
  /** Compass bearing, radians clockwise from north (π/2 is east). */
  azimuth: number
}

const mod = (a: number, n: number) => ((a % n) + n) % n

export const sunPosition = (when: Date, latitude: number, longitude: number): SunPosition => {
  const n = when.getTime() / 86400000 + 2440587.5 - 2451545.0 // days since J2000
  const meanLongitude = mod(280.46 + 0.9856474 * n, 360)
  const anomaly = mod(357.528 + 0.9856003 * n, 360) * RAD
  const eclipticLongitude = (meanLongitude + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD
  const obliquity = (23.439 - 0.0000004 * n) * RAD

  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude))
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude))
  const siderealHours = mod(18.697374558 + 24.06570982441908 * n, 24)
  const hourAngle = (siderealHours * 15 + longitude) * RAD - rightAscension

  const lat = latitude * RAD
  const altitude = Math.asin(
    Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle),
  )
  const azimuth = mod(
    Math.atan2(-Math.sin(hourAngle), Math.tan(declination) * Math.cos(lat) - Math.sin(lat) * Math.cos(hourAngle)),
    2 * Math.PI,
  )
  return { altitude, azimuth }
}

/**
 * Unit vector from the house towards the sun in scene space (x east in the plan, y up, z south in the plan),
 * with true north `northDegrees` clockwise from the plan's up.
 */
export const sunDirection = ({ altitude, azimuth }: SunPosition, northDegrees: number): [number, number, number] => {
  const bearing = azimuth + northDegrees * RAD
  const flat = Math.cos(altitude)
  return [flat * Math.sin(bearing), Math.sin(altitude), -flat * Math.cos(bearing)]
}

/** The instant of a wall-clock time on a date in `timeZone`, e.g. 14:30 on 2026-06-21 in Europe/Prague. */
export const zonedTime = (date: string, minutes: number, timeZone: string): Date => {
  const [y, m, d] = date.split('-').map(Number)
  const asUtc = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60)
  const offsetAt = (t: number) => {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(new Date(t))
      .find((p) => p.type === 'timeZoneName')?.value
    const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/)
    return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) * 60000 : 0
  }
  // Twice, so a time just after a DST switch uses the offset in force then.
  const first = asUtc - offsetAt(asUtc)
  return new Date(asUtc - offsetAt(first))
}
