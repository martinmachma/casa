import type { WallArea } from './types'

type Rect = { u0: number; u1: number; y0: number; y1: number }

// Edges closer than this (metres) are the same edge.
const EPS = 1e-4

const near = (p: number, q: number) => Math.abs(p - q) < EPS
const tidy = (v: number) => Math.round(v / EPS) * EPS

/** What's left of `a` with `cut` taken out: up to four rectangles round the hole. */
export const subtractRect = <T extends Rect>(a: T, cut: Rect): T[] => {
  if (cut.u0 >= a.u1 - EPS || cut.u1 <= a.u0 + EPS || cut.y0 >= a.y1 - EPS || cut.y1 <= a.y0 + EPS) return [a]
  const u0 = Math.max(a.u0, cut.u0)
  const u1 = Math.min(a.u1, cut.u1)
  return [
    ...(cut.u0 > a.u0 + EPS ? [{ ...a, u1: cut.u0 }] : []),
    ...(cut.u1 < a.u1 - EPS ? [{ ...a, u0: cut.u1 }] : []),
    ...(cut.y0 > a.y0 + EPS ? [{ ...a, u0, u1, y1: cut.y0 }] : []),
    ...(cut.y1 < a.y1 - EPS ? [{ ...a, u0, u1, y0: cut.y1 }] : []),
  ]
}

/** The one rectangle two make, side by side or one on the other; undefined if they don't. */
const join = (a: Rect, b: Rect): Rect | undefined => {
  if (near(a.y0, b.y0) && near(a.y1, b.y1) && (near(a.u1, b.u0) || near(b.u1, a.u0)))
    return { u0: Math.min(a.u0, b.u0), u1: Math.max(a.u1, b.u1), y0: a.y0, y1: a.y1 }
  if (near(a.u0, b.u0) && near(a.u1, b.u1) && (near(a.y1, b.y0) || near(b.y1, a.y0)))
    return { u0: a.u0, u1: a.u1, y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1) }
  return undefined
}

/**
 * The areas after painting a rectangle on one part of a wall side in `color`, or taking paint off it (no colour:
 * the side's own paint shows there again). Paint covers what was under it, so areas never overlap, and
 * same-coloured areas that line up are joined into one.
 */
export const paintWallArea = (
  areas: WallArea[],
  at: Omit<WallArea, 'id' | 'color'>,
  color: string | undefined,
  newId: () => string = () => crypto.randomUUID(),
): WallArea[] => {
  const onPart = (a: WallArea) => a.wallId === at.wallId && a.side === at.side && a.part === at.part
  const rect = { u0: tidy(at.u0), u1: tidy(at.u1), y0: tidy(at.y0), y1: tidy(at.y1) }
  let mine = areas.filter(onPart).flatMap((a) => {
    const left = subtractRect(a, rect)
    // A cut area keeps its id on one of its pieces.
    return left.length === 1 && left[0] === a ? [a] : left.map((r, i) => (i ? { ...r, id: newId() } : r))
  })
  if (color) mine.push({ ...at, ...rect, color, id: newId() })
  for (let joined = true; joined;) {
    joined = false
    for (let i = 0; i < mine.length && !joined; i++)
      for (let j = i + 1; j < mine.length && !joined; j++) {
        const r = mine[i].color === mine[j].color && join(mine[i], mine[j])
        if (!r) continue
        mine = [...mine.filter((_, k) => k !== i && k !== j), { ...mine[i], ...r }]
        joined = true
      }
  }
  return [...areas.filter((a) => !onPart(a)), ...mine]
}
