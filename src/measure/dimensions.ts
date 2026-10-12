import { wallLength, wallThickness, openingSill } from '../layout/geometry'
import { floorWallRects } from '../layout/rooms'
import type { Floor, Opening, Point, Wall } from '../layout/types'

/** A stretch of wall face you could run a tape along: between the walls that meet it. */
export type FaceRun = {
  key: string
  from: Point
  to: Point
  length: number
  labelAt: Point
  /** The way the face looks out, in the plan (n is plan-up): the label sits on that side. */
  facing: 'n' | 's' | 'e' | 'w'
}

const EPS = 1e-6
// Shorter runs are wall ends and corner stubs, not worth a label.
const MIN_RUN = 0.15
// Labels sit this far off the face, on the side they measure.
const LABEL_OFFSET = 0.03
// How far past the face to look for walls that meet it.
const PROBE = 0.01

/** What remains of [a, b] after removing the given intervals. */
const subtract = (a: number, b: number, cuts: [number, number][]): [number, number][] => {
  let parts: [number, number][] = [[a, b]]
  for (const [c0, c1] of cuts)
    parts = parts.flatMap(([p0, p1]): [number, number][] => {
      if (c1 <= p0 || c0 >= p1) return [[p0, p1]]
      return [
        [p0, Math.max(p0, c0)],
        [Math.min(p1, c1), p1],
      ].filter(([q0, q1]) => q1 - q0 > EPS) as [number, number][]
    })
  return parts
}

/**
 * The runs along both faces of every square wall on the floor: inside a room these are its clear dimensions,
 * outside the overall sizes. Doors and windows don't break a run.
 */
export const faceRuns = (floor: Floor): FaceRun[] => {
  const rects = floorWallRects(floor)
  const runs: FaceRun[] = []
  floor.walls.forEach((wall, i) => {
    const r = rects[i]
    const horizontal = Math.abs(wall.to[1] - wall.from[1]) < EPS
    const vertical = Math.abs(wall.to[0] - wall.from[0]) < EPS
    if (!horizontal && !vertical) return
    const others = rects.filter((_, j) => j !== i)
    // Each face: its fixed coordinate, and which way is "out" of the wall.
    const faces: [number, number][] = horizontal
      ? [
          [r.y0, -1],
          [r.y1, 1],
        ]
      : [
          [r.x0, -1],
          [r.x1, 1],
        ]
    for (const [at, out] of faces) {
      const probe0 = Math.min(at, at + out * PROBE)
      const probe1 = Math.max(at, at + out * PROBE)
      const cuts = others
        .filter((o) => (horizontal ? o.y0 < probe1 && o.y1 > probe0 : o.x0 < probe1 && o.x1 > probe0))
        .map((o): [number, number] => (horizontal ? [o.x0, o.x1] : [o.y0, o.y1]))
      const [a, b] = horizontal ? [r.x0, r.x1] : [r.y0, r.y1]
      subtract(a, b, cuts)
        .filter(([p0, p1]) => p1 - p0 >= MIN_RUN)
        .forEach(([p0, p1], k) => {
          const mid = (p0 + p1) / 2
          const label = at + out * LABEL_OFFSET
          runs.push({
            key: `${wall.id}:${out}:${k}`,
            from: horizontal ? [p0, at] : [at, p0],
            to: horizontal ? [p1, at] : [at, p1],
            length: p1 - p0,
            labelAt: horizontal ? [mid, label] : [label, mid],
            facing: horizontal ? (out < 0 ? 'n' : 's') : out < 0 ? 'w' : 'e',
          })
        })
    }
  })
  return runs
}

/** Where an opening's middle is in the plan. */
export const openingCenter = (wall: Wall, o: Opening): Point => {
  const t = (o.offset + o.width / 2) / wallLength(wall)
  return [wall.from[0] + (wall.to[0] - wall.from[0]) * t, wall.from[1] + (wall.to[1] - wall.from[1]) * t]
}

const cm = (m: number) => Math.round(m * 100)

/** "Window 120 × 130 cm, sill 90" / "Door 90 × 210 cm". */
export const openingText = (o: Opening) =>
  `${o.type === 'door' ? 'Door' : 'Window'} ${cm(o.width)} × ${cm(o.height)}` +
  (o.type === 'window' ? `, sill ${cm(openingSill(o))}` : '')

/** "6.03 m centre line · 34 cm thick · 2.68 m high", for the wall panel and hover. */
export const wallText = (wall: Wall, floor: Floor) =>
  `${wallLength(wall).toFixed(2)} m centre line · ${cm(wallThickness(wall, floor))} cm thick · ` +
  `${floor.height.toFixed(2)} m high`
