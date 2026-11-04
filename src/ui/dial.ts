/** A dial's arc: a horseshoe open at the bottom, running clockwise from lower left to lower right. */
export const DIAL_START = 225
export const DIAL_SWEEP = 270

/** How far along the arc (0 to 1) a point lies, given relative to the dial's centre, y down. In the gap, the nearer end. */
export const dialFraction = (x: number, y: number) => {
  const angle = (Math.atan2(x, -y) * 180) / Math.PI
  const t = (((angle - DIAL_START) % 360) + 360) % 360
  if (t <= DIAL_SWEEP) return t / DIAL_SWEEP
  return t > DIAL_SWEEP + (360 - DIAL_SWEEP) / 2 ? 0 : 1
}

/** The point on the arc at a fraction, relative to the dial's centre, y down. */
export const dialPoint = (t: number, radius: number) => {
  const angle = ((DIAL_START + DIAL_SWEEP * t) * Math.PI) / 180
  return { x: radius * Math.sin(angle), y: -radius * Math.cos(angle) }
}
